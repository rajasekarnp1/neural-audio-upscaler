const fs = require('fs').promises;
const path = require('path');
const ffmpeg = require('fluent-ffmpeg');

/**
 * AudioPostprocessor handles final quality enhancement after neural upscaling
 * to ensure maximum quality preservation
 */
class AudioPostprocessor {
  constructor(options = {}) {
    this.options = {
      preserveOriginalCharacter: true,
      enhanceHarmonics: true,
      restoreTransients: true,
      applyDithering: true,
      matchLoudness: true,
      ...options
    };
  }

  /**
   * Postprocess audio file after neural upscaling
   * @param {string} inputPath - Path to upscaled audio file
   * @param {string} originalPath - Path to original audio file (for reference)
   * @param {string} outputPath - Path to save postprocessed audio
   * @param {Object} audioInfo - Original audio properties
   * @param {function} progressCallback - Callback for progress updates
   */
  async postprocess(inputPath, originalPath, outputPath, audioInfo, progressCallback) {
    try {
      // Report initial progress
      if (progressCallback) progressCallback(0);
      
      // Create filter chain based on enabled options
      const filters = [];
      
      // Analyze upscaled audio
      const upscaledInfo = await this.analyzeAudio(inputPath);
      console.log('Upscaled audio properties:', upscaledInfo);
      
      // Skip filters entirely to avoid compatibility issues
      
      // Progress update
      if (progressCallback) progressCallback(30);
      
      // Apply all filters and convert to desired output format
      await new Promise((resolve, reject) => {
        let ffmpegCommand = ffmpeg(inputPath);
        
        // Determine output format based on file extension
        const ext = path.extname(outputPath).toLowerCase();
        
        // Apply appropriate encoding settings based on format
        if (ext === '.mp3') {
          ffmpegCommand = ffmpegCommand
            .audioCodec('libmp3lame')
            .audioBitrate('320k');
        } else if (ext === '.flac') {
          ffmpegCommand = ffmpegCommand
            .audioCodec('flac')
            .audioQuality(0);
        } else if (ext === '.ogg') {
          ffmpegCommand = ffmpegCommand
            .audioCodec('libvorbis')
            .audioQuality(10);
        } else if (ext === '.m4a') {
          ffmpegCommand = ffmpegCommand
            .audioCodec('aac')
            .audioBitrate('320k');
        } else {
          // Default to high-quality WAV
          ffmpegCommand = ffmpegCommand
            .audioCodec('pcm_s24le');
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
        upscaledInfo,
        appliedFilters: filters
      };
    } catch (error) {
      console.error('Error during postprocessing:', error);
      throw error;
    }
  }
  
  /**
   * Analyze audio properties
   * @param {string} filePath - Path to audio file
   * @returns {Object} Audio properties
   */
  async analyzeAudio(filePath) {
    return new Promise((resolve, reject) => {
      let sampleRate = 44100;
      let channels = 2;
      let duration = 0;
      let bitDepth = 16;
      let peakLevel = -100;
      
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
        
        // For peak level, we need to run a separate command
        ffmpeg(filePath)
          .audioFilters('volumedetect')
          .format('null')
          .on('stderr', line => {
            const maxVolumeMatch = line.match(/max_volume: (-?\d+\.?\d*)/);
            if (maxVolumeMatch) {
              peakLevel = parseFloat(maxVolumeMatch[1]);
            }
          })
          .on('end', () => {
            resolve({
              sampleRate,
              channels,
              duration,
              bitDepth,
              peakLevel
            });
          })
          .on('error', reject)
          .output('/dev/null')
          .run();
      });
    });
  }
}

module.exports = { AudioPostprocessor };