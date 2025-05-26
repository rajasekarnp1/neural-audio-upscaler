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
        .map(item => ({
          xs: item.lowQuality,
          ys: item.highQuality
        }))
        .batch(this.options.batchSize)
        .shuffle(100);
      
      const validationDataset = tf.data.array(validationData)
        .map(item => ({
          xs: item.lowQuality,
          ys: item.highQuality
        }))
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
    // Convert to WAV for processing
    const tempWavPath = `${filePath}.temp.wav`;
    
    try {
      // Convert to standard format
      await new Promise((resolve, reject) => {
        ffmpeg(filePath)
          .output(tempWavPath)
          .audioCodec('pcm_s16le')
          .audioChannels(1) // Mono for simplicity
          .audioFrequency(44100)
          .on('end', resolve)
          .on('error', reject)
          .run();
      });
      
      // Read the WAV file
      const buffer = await fs.readFile(tempWavPath);
      
      // Parse WAV header (simplified)
      const sampleRate = buffer.readUInt32LE(24);
      const numChannels = buffer.readUInt16LE(22);
      const bitsPerSample = buffer.readUInt16LE(34);
      const dataSize = buffer.readUInt32LE(40);
      
      // Extract audio data
      const dataOffset = 44; // Standard WAV header size
      const numSamples = dataSize / (bitsPerSample / 8) / numChannels;
      
      // Convert to float32 samples
      const samples = new Float32Array(numSamples);
      const bytesPerSample = bitsPerSample / 8;
      const scale = 1.0 / (1 << (bitsPerSample - 1));
      
      for (let i = 0; i < numSamples; i++) {
        const sampleOffset = dataOffset + i * bytesPerSample;
        
        // Read sample based on bit depth
        let sample = 0;
        if (bitsPerSample === 16) {
          sample = buffer.readInt16LE(sampleOffset);
        } else if (bitsPerSample === 24) {
          // 24-bit samples need special handling
          const b1 = buffer[sampleOffset];
          const b2 = buffer[sampleOffset + 1];
          const b3 = buffer[sampleOffset + 2];
          sample = ((b3 << 16) | (b2 << 8) | b1) << 8 >> 8; // Sign extension
        } else if (bitsPerSample === 32) {
          sample = buffer.readInt32LE(sampleOffset);
        } else {
          // Default to 16-bit
          sample = buffer.readInt16LE(sampleOffset);
        }
        
        // Normalize to [-1, 1]
        samples[i] = sample * scale;
      }
      
      // Segment the audio into training chunks
      const segmentSize = 8192; // ~0.2 seconds at 44.1kHz
      const segments = [];
      
      for (let i = 0; i < samples.length - segmentSize; i += segmentSize / 2) { // 50% overlap
        const segment = samples.slice(i, i + segmentSize);
        if (segment.length === segmentSize) {
          segments.push(segment);
        }
      }
      
      // Clean up temp file
      await fs.unlink(tempWavPath);
      
      return segments;
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempWavPath);
      } catch (e) {
        // Ignore cleanup errors
      }
      
      throw error;
    }
  }
}

module.exports = { ModelTrainer };