const fs = require('fs').promises;
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const ffmpeg = require('fluent-ffmpeg');
const { Spectrogram } = require('./spectrogram');

/**
 * ModelTrainer handles training and fine-tuning of audio upscaling models
 */
class ModelTrainer {
  constructor(options = {}) {
    this.options = {
      batchSize: 32,
      epochs: 10,
      learningRate: 0.001,
      validationSplit: 0.2,
      saveCheckpoints: true,
      checkpointDir: path.join(__dirname, '../models/checkpoints'),
      ...options
    };
    
    this.spectrogram = new Spectrogram();
    this.initialized = false;
  }
  
  /**
   * Initialize the trainer
   */
  async initialize() {
    try {
      // Create checkpoint directory if it doesn't exist
      if (this.options.saveCheckpoints) {
        await fs.mkdir(this.options.checkpointDir, { recursive: true });
      }
      
      this.initialized = true;
      console.log('Model trainer initialized successfully');
    } catch (err) {
      console.error('Error initializing model trainer:', err);
      throw err;
    }
  }
  
  /**
   * Train a model on a dataset of audio files
   * @param {Object} model - TensorFlow.js model to train
   * @param {Array<string>} lowQualityFiles - Paths to low-quality audio files
   * @param {Array<string>} highQualityFiles - Paths to high-quality audio files
   * @param {string} modelType - Type of model being trained (voice, music, etc.)
   * @param {function} progressCallback - Callback for progress updates
   */
  async trainModel(model, lowQualityFiles, highQualityFiles, modelType, progressCallback) {
    if (!this.initialized) {
      await this.initialize();
    }
    
    if (lowQualityFiles.length !== highQualityFiles.length) {
      throw new Error('Number of low-quality and high-quality files must match');
    }
    
    try {
      // Report initial progress
      if (progressCallback) progressCallback(0);
      
      console.log(`Starting training for ${modelType} model with ${lowQualityFiles.length} file pairs`);
      
      // Create dataset
      const dataset = await this.createDataset(lowQualityFiles, highQualityFiles, progressCallback);
      
      // Split into training and validation sets
      const validationSplit = this.options.validationSplit;
      const numValidation = Math.floor(dataset.length * validationSplit);
      const numTraining = dataset.length - numValidation;
      
      const trainingData = dataset.slice(0, numTraining);
      const validationData = dataset.slice(numTraining);
      
      console.log(`Training set: ${trainingData.length} samples`);
      console.log(`Validation set: ${validationData.length} samples`);
      
      // Progress update
      if (progressCallback) progressCallback(20);
      
      // Create TensorFlow datasets
      const trainingDataset = tf.data.array(trainingData)
        .map(item => {
          // Reshape tensors to [segmentLength, 1] for Conv1D
          const segmentLength = item.lowQuality.shape[0];
          return {
            xs: item.lowQuality.reshape([segmentLength, 1]),
            ys: item.highQuality.reshape([segmentLength, 1])
          };
        })
        .batch(this.options.batchSize)
        .shuffle(100);
      
      const validationDataset = tf.data.array(validationData)
        .map(item => {
          // Reshape tensors to [segmentLength, 1] for Conv1D
          const segmentLength = item.lowQuality.shape[0];
          return {
            xs: item.lowQuality.reshape([segmentLength, 1]),
            ys: item.highQuality.reshape([segmentLength, 1])
          };
        })
        .batch(this.options.batchSize);
      
      // Configure training
      const optimizer = tf.train.adam(this.options.learningRate);
      
      model.compile({
        optimizer,
        loss: 'meanSquaredError',
        metrics: ['mse']
      });
      
      // Set up checkpointing if enabled
      let callbacks = [];
      
      // Custom checkpoint callback (TensorFlow.js doesn't have a built-in one)
      if (this.options.saveCheckpoints) {
        const checkpointPath = path.join(this.options.checkpointDir, `${modelType}_model`);
        
        // Create a custom callback for saving checkpoints
        const checkpointCallback = {
          onEpochEnd: async (epoch, logs) => {
            if (epoch % 1 === 0) { // Save every epoch
              await model.save(`file://${checkpointPath}`);
              console.log(`Saved checkpoint at epoch ${epoch}`);
            }
          }
        };
        
        callbacks.push(checkpointCallback);
      }
      
      // Add progress callback
      callbacks.push({
        onEpochEnd: (epoch, logs) => {
          const progress = 20 + (epoch + 1) / this.options.epochs * 70;
          if (progressCallback) progressCallback(progress);
          
          console.log(`Epoch ${epoch + 1}/${this.options.epochs} - loss: ${logs.loss.toFixed(4)} - val_loss: ${logs.val_loss.toFixed(4)}`);
        }
      });
      
      // Train the model
      const history = await model.fitDataset(trainingDataset, {
        epochs: this.options.epochs,
        validationData: validationDataset,
        callbacks
      });
      
      // Save the trained model
      const modelPath = path.join(__dirname, `../models/${modelType}-model`);
      await model.save(`file://${modelPath}`);
      
      // Final progress update
      if (progressCallback) progressCallback(100);
      
      console.log(`Model training completed and saved to ${modelPath}`);
      
      return {
        history: history.history,
        modelPath
      };
    } catch (error) {
      console.error('Error during model training:', error);
      throw error;
    }
  }
  
  /**
   * Fine-tune an existing model on a small dataset
   * @param {Object} model - TensorFlow.js model to fine-tune
   * @param {Array<string>} lowQualityFiles - Paths to low-quality audio files
   * @param {Array<string>} highQualityFiles - Paths to high-quality audio files
   * @param {string} modelType - Type of model being trained (voice, music, etc.)
   * @param {function} progressCallback - Callback for progress updates
   */
  async fineTuneModel(model, lowQualityFiles, highQualityFiles, modelType, progressCallback) {
    // For fine-tuning, we use fewer epochs and a lower learning rate
    const originalEpochs = this.options.epochs;
    const originalLR = this.options.learningRate;
    
    this.options.epochs = Math.max(3, Math.floor(this.options.epochs / 3));
    this.options.learningRate = this.options.learningRate / 10;
    
    try {
      // Train with reduced parameters
      const result = await this.trainModel(model, lowQualityFiles, highQualityFiles, modelType, progressCallback);
      
      // Restore original parameters
      this.options.epochs = originalEpochs;
      this.options.learningRate = originalLR;
      
      return result;
    } catch (error) {
      // Restore original parameters even on error
      this.options.epochs = originalEpochs;
      this.options.learningRate = originalLR;
      
      throw error;
    }
  }
  
  /**
   * Create a dataset from pairs of audio files
   * @param {Array<string>} lowQualityFiles - Paths to low-quality audio files
   * @param {Array<string>} highQualityFiles - Paths to high-quality audio files
   * @param {function} progressCallback - Callback for progress updates
   * @returns {Array} Dataset of tensor pairs
   */
  async createDataset(lowQualityFiles, highQualityFiles, progressCallback) {
    const dataset = [];
    
    for (let i = 0; i < lowQualityFiles.length; i++) {
      try {
        // Update progress
        if (progressCallback) {
          const progress = (i / lowQualityFiles.length) * 20;
          progressCallback(progress);
        }
        
        // Extract audio segments from both files
        const lowQualitySegments = await this.extractAudioSegments(lowQualityFiles[i]);
        const highQualitySegments = await this.extractAudioSegments(highQualityFiles[i]);
        
        // Make sure we have the same number of segments
        const numSegments = Math.min(lowQualitySegments.length, highQualitySegments.length);
        
        console.log(`[ModelTrainer.createDataset] File: ${lowQualityFiles[i]}, LQ Segments: ${lowQualitySegments.length}, HQ Segments: ${highQualitySegments.length}, Min Segments: ${numSegments}`);

        // Add segments to dataset
        for (let j = 0; j < numSegments; j++) {
          dataset.push({
            lowQuality: tf.tensor(lowQualitySegments[j]),
            highQuality: tf.tensor(highQualitySegments[j])
          });
        }
      } catch (error) {
        console.warn(`Error processing file pair ${i + 1}/${lowQualityFiles.length}:`, error);
        // Continue with next pair
      }
    }
    
    return dataset;
  }
  
  /**
   * Extract audio segments from a file for training
   * @param {string} filePath - Path to audio file
   * @returns {Array} Array of audio segments
   */
  async extractAudioSegments(filePath) {
    let processingFilePath = filePath;
    let needsConversion = true;
    let tempWavPath = null;

    try {
      // Check if input file exists
      await fs.access(filePath);
      console.log(`[ModelTrainer.extractAudioSegments] Input file ${filePath} exists.`);

      // Probe file to see if conversion is needed
      const metadata = await new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, data) => {
          if (err) return reject(err);
          resolve(data);
        });
      });

      const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
      if (audioStream &&
          audioStream.codec_name === 'pcm_s16le' &&
          audioStream.channels === 1 &&
          audioStream.sample_rate === '44100') {
        console.log(`[ModelTrainer.extractAudioSegments] File ${filePath} already in target format. Skipping conversion.`);
        needsConversion = false;
      } else {
        console.log(`[ModelTrainer.extractAudioSegments] File ${filePath} requires conversion. Current format: ${audioStream ? JSON.stringify(audioStream) : 'unknown'}`);
      }

      if (needsConversion) {
        // Use a distinct temporary file name in a known directory
        const tempFileName = `model_trainer_temp_${path.basename(filePath)}_${Date.now()}.wav`;
        tempWavPath = path.join(this.options.checkpointDir, tempFileName);
        processingFilePath = tempWavPath;

        // Convert to standard format
        await new Promise((resolve, reject) => {
          console.log(`[ModelTrainer.extractAudioSegments] Starting ffmpeg conversion for: ${filePath} to ${tempWavPath}`);
          const command = ffmpeg(filePath)
            .inputFormat('wav') // Assuming input is wav, ffprobe would give more details for others
            .output(tempWavPath)
            .audioCodec('pcm_s16le')
            .audioChannels(1)
            .audioFrequency(44100)
            .on('error', function(err, stdout, stderr) {
              console.error(`[ModelTrainer.extractAudioSegments] ffmpeg error for ${filePath}:`, err.message);
              console.error(`[ModelTrainer.extractAudioSegments] ffmpeg stderr for ${filePath}:`, stderr);
              reject(err);
            })
            .on('end', function(stdout, stderr) {
              console.log(`[ModelTrainer.extractAudioSegments] ffmpeg conversion finished successfully for ${filePath}.`);
              resolve();
            });
          command.run();
        });
      }
      
      // Read the WAV file (either original or converted temp file)
      const buffer = await fs.readFile(processingFilePath);
      
      // Parse WAV header (simplified)
      // This parsing assumes a very standard WAV structure, which ffmpeg should produce.
      const sampleRate = buffer.readUInt32LE(24);
      const numChannels = buffer.readUInt16LE(22); // Should be 1 if converted or checked
      const bitsPerSample = buffer.readUInt16LE(34); // Should be 16 if converted or checked

      let dataOffset = 44; // Standard WAV header size
      let dataSize = buffer.readUInt32LE(40);

      // Basic check for 'data' chunk, similar to AudioUpscaler's readAudioFile
      const dataChunkId = buffer.toString('ascii', 36, 40);
      if (dataChunkId !== 'data') {
        let offset = 12;
        let foundDataChunk = false;
        while(offset < buffer.length - 8) {
            const chunkId = buffer.toString('ascii', offset, offset + 4);
            const chunkSize = buffer.readUInt32LE(offset + 4);
            if (chunkId === 'data') {
                dataOffset = offset + 8;
                dataSize = chunkSize;
                foundDataChunk = true;
                break;
            }
            offset += 8 + chunkSize;
            if (chunkSize <= 0) { // Avoid infinite loop on malformed chunk
                console.warn(`[ModelTrainer.extractAudioSegments] Encountered zero or negative chunk size for ${chunkId} in ${processingFilePath}`);
                break;
            }
        }
        if (!foundDataChunk) {
             console.warn(`[ModelTrainer.extractAudioSegments] Could not find 'data' chunk in ${processingFilePath}. Using default offset/size. This might be incorrect.`);
        }
      }

      console.log(`[ModelTrainer.extractAudioSegments] Processing file: ${processingFilePath}, Parsed Header - sampleRate: ${sampleRate}, numChannels: ${numChannels}, bitsPerSample: ${bitsPerSample}, dataSize: ${dataSize}`);
      
      const bytesPerSampleCalc = bitsPerSample / 8;
      if (bytesPerSampleCalc === 0 || numChannels === 0) {
        throw new Error(`Invalid WAV properties: bytesPerSampleCalc=${bytesPerSampleCalc}, numChannels=${numChannels}`);
      }
      const numSamples = dataSize / bytesPerSampleCalc / numChannels;
      console.log(`[ModelTrainer.extractAudioSegments] Calculated numSamples: ${numSamples}`);
      
      // Convert to float32 samples
      const samples = new Float32Array(numSamples);
      const scale = 1.0 / (1 << (bitsPerSample - 1));
      
      for (let i = 0; i < numSamples; i++) {
        const sampleOffset = dataOffset + (i * numChannels) * bytesPerSampleCalc; // For mono, (i * numChannels) is just i
        
        let sample = 0;
        if (bitsPerSample === 16) {
          sample = buffer.readInt16LE(sampleOffset);
        } else { // Should always be 16-bit due to conversion/check
          console.warn(`[ModelTrainer.extractAudioSegments] Unexpected bitsPerSample ${bitsPerSample} in ${processingFilePath}. Treating as 16-bit.`);
          sample = buffer.readInt16LE(sampleOffset);
        }
        samples[i] = sample * scale;
      }
      
      // Segment the audio
      const segmentSize = 8192;
      const segments = [];
      if (numSamples >= segmentSize) {
        for (let i = 0; i <= samples.length - segmentSize; i += segmentSize / 2) { // Use <= for the loop condition
          const segment = samples.slice(i, i + segmentSize);
          segments.push(segment);
        }
      } else {
        console.log(`[ModelTrainer.extractAudioSegments] Not enough samples (${numSamples}) to create segments of size ${segmentSize}.`);
      }
      
      if (tempWavPath && needsConversion) { // Clean up only if we created a temp file
        await fs.unlink(tempWavPath);
      }
      
      console.log(`[ModelTrainer.extractAudioSegments] File: ${filePath} (processed from ${processingFilePath}), Samples read: ${samples.length}, Segments created: ${segments.length}`);
      return segments;
    } catch (error) {
      console.error(`[ModelTrainer.extractAudioSegments] Error processing ${filePath}:`, error);
      if (tempWavPath && needsConversion) { // Attempt cleanup on error too
        try {
          await fs.unlink(tempWavPath);
        } catch (e) {
          // Ignore cleanup errors
        }
      }
      throw error;
    }
  }
}

module.exports = { ModelTrainer };