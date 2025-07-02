const fs = require('fs').promises;
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const { Spectrogram } = require('./spectrogram'); // Added
const WaveFile = require('wavefile').WaveFile; // Added

class ContentAnalyzer {
  constructor() {
    this.model = null;
    this.initialized = false;
  }
  
  async initialize() {
    try {
      // Load content classification model if available
      const modelPath = path.join(__dirname, '../models/content-classifier/model.json');
      
      try {
        this.model = await tf.loadLayersModel(`file://${modelPath}`);
        console.log('Loaded content classifier model');
      } catch (err) {
        console.log('Creating simple content classifier model');
        this.model = this.createClassifierModel();
      }
      
      this.initialized = true;
    } catch (err) {
      console.error('Error initializing content analyzer:', err);
    }
  }
  
  createClassifierModel() {
    // Simple model to classify audio content
    const model = tf.sequential();
    
    // Input layer expects spectral features
    model.add(tf.layers.dense({
      inputShape: [40], // 40 MFCCs or similar features
      units: 128,
      activation: 'relu'
    }));
    
    model.add(tf.layers.dropout({ rate: 0.3 }));
    
    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu'
    }));
    
    // Output layer with content type probabilities
    model.add(tf.layers.dense({
      units: 3, // voice, music, ambient
      activation: 'softmax'
    }));
    
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    return model;
  }
  
  async analyze(filePath) {
    if (!this.initialized || !this.model) {
      console.error('ContentAnalyzer: Model not initialized.');
      return {
        voiceConfidence: 0.33, musicConfidence: 0.33, ambientConfidence: 0.33,
        dominantType: 'unknown', error: 'Model not initialized'
      };
    }

    try {
      const buffer = await fs.readFile(filePath);
      const wav = new WaveFile(buffer);

      // Ensure wav is Float32 and get samples
      wav.toSampleRate(44100); // Resample if needed, or ensure model expects certain rate
      wav.toBitDepth('32f'); // Convert to Float32
      const samplesInterleaved = wav.getSamples(true, Float32Array);

      let monoSamples;
      if (wav.fmt.numChannels > 1) {
        monoSamples = new Float32Array(samplesInterleaved.length / wav.fmt.numChannels);
        for (let i = 0; i < monoSamples.length; i++) {
          monoSamples[i] = samplesInterleaved[i * wav.fmt.numChannels]; // Take first channel
        }
      } else {
        monoSamples = samplesInterleaved;
      }

      // Feature Extraction (Simplified Spectrogram Features)
      const spectrogramUtil = new Spectrogram({ fftSize: 1024, hopSize: 512 });
      const spec = spectrogramUtil.fromTimeDomain(monoSamples);

      const numFrames = spec.timeFrames;
      const numBins = spec.freqBins;
      const features = new Float32Array(40).fill(0);

      const binsToAverage = Math.min(40, numBins);
      for (let j = 0; j < binsToAverage; j++) {
        let sumMag = 0;
        for (let i = 0; i < numFrames; i++) {
          sumMag += spec.magnitude[i * numBins + j];
        }
        features[j] = sumMag / numFrames;
      }

      // Model Prediction
      const inputTensor = tf.tensor2d([features], [1, 40]);
      const prediction = await this.model.predict(inputTensor);
      const probabilities = await prediction.data();

      inputTensor.dispose();
      prediction.dispose();

      // Format Results
      const voiceConfidence = probabilities[0]; // Assuming order: voice, music, ambient
      const musicConfidence = probabilities[1];
      const ambientConfidence = probabilities[2];
      let dominantType = 'unknown';

      if (voiceConfidence > musicConfidence && voiceConfidence > ambientConfidence) {
        dominantType = 'voice';
      } else if (musicConfidence > voiceConfidence && musicConfidence > ambientConfidence) {
        dominantType = 'music';
      } else if (ambientConfidence > voiceConfidence && ambientConfidence > musicConfidence) {
        dominantType = 'ambient';
      } else {
        // Could be due to very close probabilities or all low probabilities
        // Default to the highest or handle as 'unknown'
        if (voiceConfidence >= musicConfidence && voiceConfidence >= ambientConfidence) dominantType = 'voice';
        else if (musicConfidence >= voiceConfidence && musicConfidence >= ambientConfidence) dominantType = 'music';
        else if (ambientConfidence >= voiceConfidence && ambientConfidence >= musicConfidence) dominantType = 'ambient';
      }

      return {
        voiceConfidence,
        musicConfidence,
        ambientConfidence,
        dominantType,
        harmonicContent: 0.5, // Placeholder - not derived from this simple model
        transientContent: 0.5, // Placeholder
        noiseContent: 0.5      // Placeholder
      };

    } catch (error) {
      console.error(`ContentAnalyzer: Error analyzing file ${filePath}:`, error);
      return {
        voiceConfidence: 0.33, musicConfidence: 0.33, ambientConfidence: 0.33,
        dominantType: 'unknown', error: error.message
      };
    }
  }
}

module.exports = { ContentAnalyzer };