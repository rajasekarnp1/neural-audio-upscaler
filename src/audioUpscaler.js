const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');
const tf = require('@tensorflow/tfjs-node');
const { Spectrogram } = require('./spectrogram');
const { PhaseReconstructor } = require('./phaseReconstructor');
const { ContentAnalyzer } = require('./contentAnalyzer');
const { AudioPreprocessor } = require('./audioPreprocessor');
const { AudioPostprocessor } = require('./audioPostprocessor');
const { ModelTrainer } = require('./modelTrainer');

class AudioUpscaler {
  constructor(options = {}) {
    this.options = {
      trainingMode: false,
      usePreprocessing: true,
      usePostprocessing: true,
      preserveQuality: true,
      modelPath: path.join(__dirname, '../models'),
      ...options
    };
    
    this.models = {};
    this.progressCallback = null;
    this.contentAnalyzer = new ContentAnalyzer();
    this.phaseReconstructor = new PhaseReconstructor();
    this.preprocessor = new AudioPreprocessor();
    this.postprocessor = new AudioPostprocessor();
    this.modelTrainer = new ModelTrainer();
    this.initialize();
  }
  
  async initialize() {
    try {
      // Initialize content analyzer
      await this.contentAnalyzer.initialize();
      
      // Load specialized models
      await this.loadModels();
      
      console.log('Audio upscaler initialized successfully');
    } catch (err) {
      console.error('Error initializing upscaler:', err);
    }
  }
  
  async loadModels() {
    // Base model types
    const baseModelTypes = ['general', 'voice', 'music', 'ambient'];
    
    // Load or create all models
    for (const type of baseModelTypes) {
      const modelPath = path.join(__dirname, `../models/${type}-model/model.json`);
      try {
        this.models[type] = await tf.loadLayersModel(`file://${modelPath}`);
        console.log(`Loaded ${type} upscaler model`);
      } catch (err) {
        console.log(`Creating ${type} upscaler model`);
        this.models[type] = this.createModel(type);
      }
    }
  }
  
  createModel(type) {
    // Create specialized models based on audio type
    let model;
    
    switch(type) {
      case 'voice':
        model = this.createVoiceModel();
        break;
      case 'music':
        model = this.createMusicModel();
        break;
      case 'ambient':
        model = this.createAmbientModel();
        break;
      default:
        model = this.createGeneralModel();
    }
    
    return model;
  }
  
  createGeneralModel() {
    // WaveNet-inspired model with dilated convolutions
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.conv1d({
      inputShape: [null, 1],
      filters: 32,
      kernelSize: 3,
      padding: 'same',
      activation: 'relu'
    }));
    
    // Dilated convolution blocks for long-range dependencies
    const dilationRates = [1, 2, 4, 8, 16];
    for (const rate of dilationRates) {
      model.add(tf.layers.conv1d({
        filters: 32,
        kernelSize: 3,
        padding: 'same',
        dilation: rate,
        activation: 'relu'
      }));
    }
    
    // Output layer
    model.add(tf.layers.conv1d({
      filters: 1,
      kernelSize: 3,
      padding: 'same',
      activation: 'tanh'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  createVoiceModel() {
    // Specialized for voice with focus on formants and articulation
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.conv1d({
      inputShape: [null, 1],
      filters: 32,
      kernelSize: 5, // Larger kernel for voice details
      padding: 'same',
      activation: 'relu'
    }));
    
    // Middle layers
    for (let i = 0; i < 3; i++) {
      model.add(tf.layers.conv1d({
        filters: 32,
        kernelSize: 5,
        padding: 'same',
        activation: 'relu'
      }));
    }
    
    // Output layer
    model.add(tf.layers.conv1d({
      filters: 1,
      kernelSize: 3,
      padding: 'same',
      activation: 'tanh'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  createMusicModel() {
    // Specialized for music with harmonic structure preservation
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.conv1d({
      inputShape: [null, 1],
      filters: 48,
      kernelSize: 3,
      padding: 'same',
      activation: 'relu'
    }));
    
    // Deeper network for music complexity
    for (let i = 0; i < 5; i++) {
      model.add(tf.layers.conv1d({
        filters: 48,
        kernelSize: 3,
        padding: 'same',
        activation: 'relu'
      }));
    }
    
    // Output layer
    model.add(tf.layers.conv1d({
      filters: 1,
      kernelSize: 3,
      padding: 'same',
      activation: 'tanh'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  createAmbientModel() {
    // Specialized for ambient sounds with focus on noise characteristics
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.conv1d({
      inputShape: [null, 1],
      filters: 32,
      kernelSize: 7, // Wider kernel for ambient sounds
      padding: 'same',
      activation: 'relu'
    }));
    
    // Middle layers
    for (let i = 0; i < 3; i++) {
      model.add(tf.layers.conv1d({
        filters: 32,
        kernelSize: 7,
        padding: 'same',
        activation: 'relu'
      }));
    }
    
    // Output layer
    model.add(tf.layers.conv1d({
      filters: 1,
      kernelSize: 3,
      padding: 'same',
      activation: 'tanh'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError'
    });
    
    return model;
  }
  
  onProgress(callback) {
    this.progressCallback = callback;
  }
  
  reportProgress(percent) {
    if (this.progressCallback) {
      this.progressCallback(Math.round(percent));
    }
  }
  
  async upscale(inputPath, outputPath, forcedAudioType = null) {
    try {
      // Create temporary file paths
      const tempDir = path.join(path.dirname(inputPath), '.temp');
      await fs.mkdir(tempDir, { recursive: true });
      
      const tempBaseName = path.basename(inputPath, path.extname(inputPath));
      const preprocessedPath = path.join(tempDir, `${tempBaseName}_preprocessed.wav`);
      const upscaledPath = path.join(tempDir, `${tempBaseName}_upscaled.wav`);
      
      // Step 1: Analyze audio content
      this.reportProgress(5);
      console.log('Analyzing audio content...');
      const audioContent = await this.contentAnalyzer.analyze(inputPath);
      console.log(`Detected audio type: ${audioContent.dominantType}`);
      
      // Select the appropriate model - use forced type if provided
      const audioType = forcedAudioType || audioContent.dominantType;
      const model = this.models[audioType] || this.models.general;
      
      this.reportProgress(10);
      
      // Step 2: Preprocess audio if enabled
      let processingPath = inputPath;
      let audioInfo = null;
      
      if (this.options.usePreprocessing) {
        console.log('Preprocessing audio for optimal quality...');
        const preprocessResult = await this.preprocessor.preprocess(
          inputPath, 
          preprocessedPath,
          progress => this.reportProgress(10 + progress * 0.15)
        );
        
        processingPath = preprocessedPath;
        audioInfo = preprocessResult.audioInfo;
        console.log('Preprocessing complete with filters:', preprocessResult.appliedFilters);
      }
      
      this.reportProgress(25);
      
      // Step 3: Apply neural upscaling
      console.log(`Applying neural upscaling with ${audioType} model...`);
      
      // Read audio data
      const audioData = await this.readAudioFile(processingPath);
      
      // Process with neural model
      const enhancedData = await this.processAudio(
        audioData, 
        model,
        progress => this.reportProgress(25 + progress * 0.5)
      );
      
      // Save enhanced audio
      await this.saveAudioFile(enhancedData, upscaledPath);
      
      this.reportProgress(75);
      
      // Step 4: Postprocess audio if enabled
      if (this.options.usePostprocessing) {
        console.log('Applying post-processing for final quality enhancement...');
        await this.postprocessor.postprocess(
          upscaledPath,
          inputPath, // Original for reference
          outputPath,
          audioInfo,
          progress => this.reportProgress(75 + progress * 0.2)
        );
      } else {
        // If no postprocessing, just convert to output format with high quality
        await new Promise((resolve, reject) => {
          ffmpeg(upscaledPath)
            .output(outputPath)
            .audioQuality(0) // Best quality
            .on('progress', (progress) => {
              if (progress.percent) {
                this.reportProgress(75 + progress.percent * 0.2);
              }
            })
            .on('end', resolve)
            .on('error', reject)
            .run();
        });
      }
      
      // Step 6: If in training mode, update model with this example
      // This must happen BEFORE cleaning up tempDir if upscaledPath is used as a target.
      if (this.options.trainingMode && this.options.preserveQuality) {
        // processingPath is the input to the model, upscaledPath is the model's direct output
        if (processingPath && upscaledPath) {
          try {
            console.log(`Attempting to fine-tune ${audioType} model with ${processingPath} and ${upscaledPath}...`);
            await this.modelTrainer.fineTuneModel(
              model,
              [processingPath], // Low quality input to the model
              [upscaledPath],   // High quality output from the model (before post-processing)
              audioType,
              (progress) => { console.log(`Fine-tuning progress for ${audioType} model: ${progress}%`); }
            );
            console.log(`Fine-tuning for ${audioType} model completed.`);
          } catch (tuneError) {
            console.warn(`Warning: Fine-tuning model ${audioType} failed. Continuing without update. Error:`, tuneError);
          }
        } else {
          console.warn(`Warning: Skipping fine-tuning for ${audioType} model due to missing processingPath or upscaledPath.`);
        }
      }

      // Step 7: Clean up temp files (moved after potential fine-tuning)
      try {
        await fs.rm(tempDir, { recursive: true, force: true });
        console.log(`Temporary directory ${tempDir} cleaned up.`);
      } catch (err) {
        console.warn('Failed to clean up temp files:', err);
      }
      
      this.reportProgress(100);
      return {
        success: true,
        audioType,
        enhancementApplied: true
      };
    } catch (error) {
      console.error('Error during upscaling:', error);
      throw error;
    }
  }
  
  async analyzeAudioType(filePath) {
    // Use the ContentAnalyzer to determine audio type
    const content = await this.contentAnalyzer.analyze(filePath);
    return content.dominantType;
  }
  
  async readAudioFile(filePath) {
    const wavBuffer = await fs.readFile(filePath);

    // Parse WAV header (simplified)
    const sampleRate = wavBuffer.readUInt32LE(24);
    const numChannels = wavBuffer.readUInt16LE(22);
    const bitsPerSample = wavBuffer.readUInt16LE(34);
    const dataChunkId = wavBuffer.toString('ascii', 36, 40); // Should be 'data'

    let dataOffset = 44; // Standard WAV header size including 'data' chunk header
    let dataSize = wavBuffer.readUInt32LE(40);

    // Handle potential non-PCM formats or LIST INFO chunks before 'data'
    // This is a simplified check; a robust parser would iterate through chunks.
    if (dataChunkId !== 'data') {
        // Attempt to find 'data' chunk, common in some WAV files (e.g., with LIST INFO)
        let offset = 12; // Skip RIFF, size, WAVE
        while(offset < wavBuffer.length - 8) {
            const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
            const chunkSize = wavBuffer.readUInt32LE(offset + 4);
            if (chunkId === 'data') {
                dataOffset = offset + 8;
                dataSize = chunkSize;
                break;
            }
            offset += 8 + chunkSize;
        }
        if (dataOffset === 44 && dataChunkId !== 'data') { // Still not found
             throw new Error(`Could not find 'data' chunk in WAV file: ${filePath}`);
        }
    }

    const numSamplesPerChannel = dataSize / (bitsPerSample / 8) / numChannels;
    const channelSamples = [];
    const bytesPerSample = bitsPerSample / 8;
    const scale = 1.0 / (1 << (bitsPerSample - 1));

    for (let channel = 0; channel < numChannels; channel++) {
      const samples = new Float32Array(numSamplesPerChannel);
      for (let i = 0; i < numSamplesPerChannel; i++) {
        const sampleOffset = dataOffset + (i * numChannels + channel) * bytesPerSample;

        let sampleVal = 0;
        if (bitsPerSample === 16) {
          sampleVal = wavBuffer.readInt16LE(sampleOffset);
        } else if (bitsPerSample === 24) {
          const b1 = wavBuffer[sampleOffset];
          const b2 = wavBuffer[sampleOffset + 1];
          const b3 = wavBuffer[sampleOffset + 2];
          sampleVal = ((b3 << 16) | (b2 << 8) | b1) << 8 >> 8;
        } else if (bitsPerSample === 32 && wavBuffer.readUInt16LE(20) === 1) { // PCM
          sampleVal = wavBuffer.readInt32LE(sampleOffset);
        } else if (bitsPerSample === 32 && wavBuffer.readUInt16LE(20) === 3) { // IEEE Float
          sampleVal = wavBuffer.readFloatLE(sampleOffset);
          // For IEEE float, scale is not needed if it's already [-1, 1]
          // However, raw PCM f32le is often not normalized, so we might still scale.
          // For simplicity, we'll assume direct use or that it needs scaling.
          // If it's already normalized, this might scale it down too much.
          // A more robust solution would check the actual range or metadata.
          samples[i] = sampleVal; // Assuming it's already in -1 to 1 range
          continue;
        } else {
          // Default or unsupported
          sampleVal = wavBuffer.readInt16LE(sampleOffset); // Fallback to 16-bit
        }
        samples[i] = sampleVal * scale;
      }
      channelSamples.push(samples);
    }
    
    return {
      buffer: wavBuffer, // Original buffer
      samples: channelSamples,
      sampleRate,
      numChannels,
      bitsPerSample,
      filePath
    };
  }
  
  async processAudio(audioData, model, progressCallback) {
    // audioData is now expected to have:
    // { buffer, samples (array of Float32Array), sampleRate, numChannels, bitsPerSample, filePath }
    
    try {
      const enhancedChannels = [];
      const numChannels = audioData.numChannels; // Get from new audioData structure

      for (let channel = 0; channel < numChannels; channel++) {
        const samples = audioData.samples[channel]; // Use pre-parsed samples
        
        // Actual model inference
        const inputTensor = tf.tensor3d(samples, [1, samples.length, 1]);
        const outputTensor = model.predict(inputTensor);
        const enhancedSamplesArray = await outputTensor.data();
        const enhancedSamples = new Float32Array(enhancedSamplesArray);
        
        tf.dispose([inputTensor, outputTensor]);
        
        if (progressCallback) {
          progressCallback((channel + 0.5) / numChannels * 100);
        }
        
        enhancedChannels.push(enhancedSamples);
        
        if (progressCallback) {
          progressCallback((channel + 1) / numChannels * 100);
        }
      }
      
      return {
        buffer: audioData.buffer, // Pass original buffer through
        enhancedChannels, // This is the primary output
        sampleRate: audioData.sampleRate,
        numChannels: audioData.numChannels,
        bitsPerSample: audioData.bitsPerSample, // Pass through for saveAudioFile
        filePath: audioData.filePath
      };
    } catch (error) {
      console.error('Error in audio processing:', error);
      // Return original data on error in case of failure during TFJS processing
      // This might need more robust error handling, e.g. propagating the error.
      return {
        ...audioData,
        enhancedChannels: audioData.samples // return original samples if processing failed
      };
    }
  }
  
  async saveAudioFile(audioData, outputPath) {
    // audioData contains: { enhancedChannels, sampleRate, numChannels, bitsPerSample (original) }
    // We will save as f32le raw PCM temporarily, then convert to WAV.
    // Output WAV will be pcm_s16le by default as it's most compatible,
    // unless original bitsPerSample suggests higher (e.g. 24 or 32 bit).

    const { enhancedChannels, sampleRate, numChannels } = audioData;

    if (!enhancedChannels || enhancedChannels.length === 0) {
      throw new Error('No enhanced audio data to save.');
    }

    const numSamplesPerChannel = enhancedChannels[0].length;
    const totalSamples = numSamplesPerChannel * numChannels;
    const interleavedSamples = new Float32Array(totalSamples);

    for (let i = 0; i < numSamplesPerChannel; i++) {
      for (let c = 0; c < numChannels; c++) {
        interleavedSamples[i * numChannels + c] = enhancedChannels[c][i];
      }
    }

    const rawPcmBuffer = Buffer.from(interleavedSamples.buffer);
    const tempRawPath = path.join(path.dirname(outputPath), `_temp_raw_audio_${Date.now()}.pcm`);

    try {
      await fs.writeFile(tempRawPath, rawPcmBuffer);

      await new Promise((resolve, reject) => {
        let outputCodec = 'pcm_s16le'; // Default to 16-bit WAV
        if (audioData.bitsPerSample === 24) {
          outputCodec = 'pcm_s24le';
        } else if (audioData.bitsPerSample === 32) {
          // Could be pcm_s32le or pcm_f32le.
          // Since our processing is float based, pcm_f32le might be better to preserve quality.
          // However, pcm_s32le is also an option for integer-based 32-bit.
          // Let's stick to what ffmpeg supports well for WAV.
          // fluent-ffmpeg might pick pcm_f32le if not specified and input is f32le.
          // For now, let's allow higher bit depth if original was high.
          outputCodec = 'pcm_s24le'; // Defaulting to 24 for >16 for wider compatibility than 32.
                                     // User can change this if specific 32-bit WAV is needed.
                                     // Or, we can use pcm_f32le if input was float32.
                                     // For simplicity with the current requirement, let's use s16/s24.
        }


        ffmpeg()
          .input(tempRawPath)
          .inputFormat('f32le')
          .inputOptions([
            `-ar ${sampleRate}`,
            `-ac ${numChannels}`
          ])
          .output(outputPath)
          .audioCodec(outputCodec) // Corrected method for fluent-ffmpeg
          .on('end', () => {
            console.log(`Successfully saved WAV file to ${outputPath} with codec ${outputCodec}`);
            resolve();
          })
          .on('error', (err) => {
            console.error(`Error saving WAV file with ffmpeg: ${err.message}`);
            reject(err);
          })
          .run();
      });
    } finally {
      try {
        await fs.unlink(tempRawPath);
      } catch (err) {
        // Log error but don't throw, as the main operation might have succeeded/failed already
        console.warn(`Failed to delete temporary raw audio file: ${tempRawPath}`, err);
      }
    }
  }
  
  /**
   * Enable or disable training mode
   * @param {boolean} enabled - Whether to enable training mode
   * @param {Object} options - Training options
   */
  setTrainingMode(enabled, options = {}) {
    this.options.trainingMode = enabled;
    
    if (enabled) {
      console.log('Training mode enabled - models will be updated with new examples');
      
      // Update training options
      if (options.learningRate) {
        this.modelTrainer.options.learningRate = options.learningRate;
      }
      
      if (options.epochs) {
        this.modelTrainer.options.epochs = options.epochs;
      }
      
      if (options.batchSize) {
        this.modelTrainer.options.batchSize = options.batchSize;
      }
    } else {
      console.log('Training mode disabled');
    }
    
    return this.options.trainingMode;
  }
  
  /**
   * Train models on a dataset of audio files
   * @param {Object} dataset - Dataset configuration
   * @param {function} progressCallback - Callback for progress updates
   */
  async trainModels(dataset, progressCallback) {
    if (!dataset || !dataset.pairs || dataset.pairs.length === 0) {
      throw new Error('Invalid dataset: must contain audio file pairs');
    }
    
    try {
      // Initialize model trainer if needed
      if (!this.modelTrainer.initialized) {
        await this.modelTrainer.initialize();
      }
      
      // Report initial progress
      if (progressCallback) progressCallback(0);
      
      console.log(`Training models on ${dataset.pairs.length} audio file pairs`);
      
      // Group file pairs by audio type
      const pairsByType = {
        general: [],
        voice: [],
        music: [],
        ambient: []
      };
      
      // Analyze each file pair to determine audio type
      for (let i = 0; i < dataset.pairs.length; i++) {
        const pair = dataset.pairs[i];
        
        if (progressCallback) {
          progressCallback(i / dataset.pairs.length * 10);
        }
        
        try {
          // Analyze low-quality file to determine type
          const audioContent = await this.contentAnalyzer.analyze(pair.lowQuality);
          const audioType = audioContent.dominantType;
          
          // Add to appropriate group
          pairsByType[audioType].push(pair);
          
          // Also add to general group for general model training
          if (audioType !== 'general') {
            pairsByType.general.push(pair);
          }
        } catch (err) {
          console.warn(`Error analyzing file pair ${i + 1}:`, err);
          // Add to general group as fallback
          pairsByType.general.push(pair);
        }
      }
      
      // Train each model type with its pairs
      const modelTypes = Object.keys(pairsByType);
      
      for (let i = 0; i < modelTypes.length; i++) {
        const modelType = modelTypes[i];
        const pairs = pairsByType[modelType];
        
        if (pairs.length === 0) {
          console.log(`No training data for ${modelType} model, skipping`);
          continue;
        }
        
        console.log(`Training ${modelType} model with ${pairs.length} file pairs`);
        
        // Get model to train
        const model = this.models[modelType] || this.createModel(modelType);
        
        // Extract file paths
        const lowQualityFiles = pairs.map(p => p.lowQuality);
        const highQualityFiles = pairs.map(p => p.highQuality);
        
        // Train the model
        const modelProgress = progress => {
          if (progressCallback) {
            // Scale progress to overall training progress
            const baseProgress = 10 + (i / modelTypes.length) * 90;
            const scaledProgress = baseProgress + (progress / 100) * (90 / modelTypes.length);
            progressCallback(scaledProgress);
          }
        };
        
        await this.modelTrainer.trainModel(
          model,
          lowQualityFiles,
          highQualityFiles,
          modelType,
          modelProgress
        );
        
        // Update model in our collection
        this.models[modelType] = model;
      }
      
      // Final progress update
      if (progressCallback) progressCallback(100);
      
      console.log('Model training completed successfully');
      
      return {
        success: true,
        modelTypes: modelTypes.filter(type => pairsByType[type].length > 0)
      };
    } catch (error) {
      console.error('Error during model training:', error);
      throw error;
    }
  }
}

module.exports = AudioUpscaler;