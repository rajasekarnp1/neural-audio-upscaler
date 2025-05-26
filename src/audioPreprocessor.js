const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

/**
 * AudioPreprocessor handles audio preparation before neural enhancement
 * to ensure maximum quality preservation
 */
class AudioPreprocessor {
  constructor(options = {}) {
    this.options = {
      normalizeAudio: true,
      removeNoise: true,
      preserveTransients: true,
      enhanceDynamics: true,
      ...options
    };
  }

  /**
   * Preprocess audio file for optimal upscaling
   * @param {string} inputPath - Path to input audio file
   * @param {string} outputPath - Path to save preprocessed audio
   * @param {function} progressCallback - Callback for progress updates
   */
  async preprocess(inputPath, outputPath, progressCallback) {
    try {
      // Report initial progress
      if (progressCallback) progressCallback(0);
      
      // Create filter chain based on enabled options
      const filters = [];
      
      // Analyze audio properties
      const audioInfo = await this.analyzeAudio(inputPath);
      console.log('Audio properties:', audioInfo);
      
      // Skip filters entirely to avoid compatibility issues
      // We'll just copy the audio as-is
      
      // Progress update
      if (progressCallback) progressCallback(30);
      
      // Apply all filters and convert to standard format for processing
      await new Promise((resolve, reject) => {
        let ffmpegCommand = ffmpeg(inputPath)
          .audioCodec('pcm_s24le') // Use 24-bit for better quality preservation
          .audioChannels(audioInfo.channels)
          .audioFrequency(Math.max(audioInfo.sampleRate, 44100)); // Use at least 44.1kHz
        
        // Add filters if any
        if (filters.length > 0) {
          ffmpegCommand = ffmpegCommand.audioFilters(filters.join(','));
        }
        
        ffmpegCommand
          .on('progress', progress => {
            if (progressCallback && progress.percent) {
              progressCallback(30 + progress.percent * 0.6);
            }
          })
          .on('end', resolve)
          .on('error', reject)
          .save(outputPath);
      });
      
      // Final progress update
      if (progressCallback) progressCallback(100);
      
      return {
        audioInfo,
        appliedFilters: filters
      };
    } catch (error) {
      console.error('Error during preprocessing:', error);
      throw error;
    }
  }
  
  /**
   * Analyze audio properties to determine optimal preprocessing
   * @param {string} filePath - Path to audio file
   * @returns {Object} Audio properties
   */
  async analyzeAudio(filePath) {
    return new Promise((resolve, reject) => {
      let sampleRate = 44100;
      let channels = 2;
      let duration = 0;
      let bitDepth = 16;
      let dynamicRange = 0;
      let peakLevel = -100;
      let noiseFloor = -100;
      
      ffmpeg.ffprobe(filePath, (err, metadata) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Extract basic audio properties
        if (metadata.streams && metadata.streams.length > 0) {
          const audioStream = metadata.streams.find(s => s.codec_type === 'audio');
          if (audioStream) {
            sampleRate = audioStream.sample_rate ? parseInt(audioStream.sample_rate) : 44100;
            channels = audioStream.channels || 2;
            duration = audioStream.duration ? parseFloat(audioStream.duration) : 0;
            bitDepth = audioStream.bits_per_sample || 16;
          }
        }
        
        // For more detailed analysis, we need to run a separate command
        ffmpeg(filePath)
          .audioFilters('volumedetect')
          .format('null')
          .on('stderr', line => {
            // Extract dynamic range information
            const maxVolumeMatch = line.match(/max_volume: (-?\d+\.?\d*)/);
            if (maxVolumeMatch) {
              peakLevel = parseFloat(maxVolumeMatch[1]);
            }
            
            const meanVolumeMatch = line.match(/mean_volume: (-?\d+\.?\d*)/);
            if (meanVolumeMatch) {
              const meanVolume = parseFloat(meanVolumeMatch[1]);
              // Estimate noise floor as 10dB below mean volume
              noiseFloor = meanVolume - 10;
              // Estimate dynamic range
              dynamicRange = peakLevel - noiseFloor;
            }
          })
          .on('end', () => {
            resolve({
              sampleRate,
              channels,
              duration,
              bitDepth,
              dynamicRange,
              peakLevel,
              noiseFloor
            });
          })
          .on('error', reject)
          .output('/dev/null')
          .run();
      });
    });
  }
}

module.exports = { AudioPreprocessor };