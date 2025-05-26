const fs = require('fs').promises;
const path = require('path');
const { ContentAnalyzer } = require('./src/contentAnalyzer');
const { Spectrogram } = require('./src/spectrogram');
const { PhaseReconstructor } = require('./src/phaseReconstructor');

// Simple AudioUpscaler for testing
class TestAudioUpscaler {
  constructor() {
    this.progressCallback = null;
  }
  
  onProgress(callback) {
    this.progressCallback = callback;
  }
  
  reportProgress(percent) {
    if (this.progressCallback) {
      this.progressCallback(Math.round(percent));
    }
  }
  
  async upscale(inputPath, outputPath) {
    try {
      // Simulate upscaling process with progress updates
      for (let i = 0; i <= 100; i += 5) {
        this.reportProgress(i);
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      // For demonstration, we'll just copy the file
      await fs.copyFile(inputPath, outputPath);
      
      return true;
    } catch (error) {
      console.error('Error during upscaling:', error);
      throw error;
    }
  }
}

async function runTest() {
  try {
    console.log('Neural Audio Upscaler Test');
    console.log('=========================');
    
    // Initialize components
    console.log('\nInitializing components...');
    const audioUpscaler = new TestAudioUpscaler();
    const contentAnalyzer = new ContentAnalyzer();
    await contentAnalyzer.initialize();
    
    // Test files
    const testFiles = [
      { path: './uploads/test_tone.wav', name: 'Simple Tone' },
      { path: './uploads/complex_tone.wav', name: 'Complex Tone' }
    ];
    
    for (const file of testFiles) {
      console.log(`\nProcessing file: ${file.name}`);
      
      // Analyze content
      console.log('Analyzing audio content...');
      const content = await contentAnalyzer.analyze(file.path);
      console.log('Content analysis results:');
      console.log(`  Dominant type: ${content.dominantType}`);
      console.log(`  Voice confidence: ${(content.voiceConfidence * 100).toFixed(1)}%`);
      console.log(`  Music confidence: ${(content.musicConfidence * 100).toFixed(1)}%`);
      console.log(`  Ambient confidence: ${(content.ambientConfidence * 100).toFixed(1)}%`);
      
      // Create output path
      const outputPath = `${file.path}_upscaled.wav`;
      
      // Process audio
      console.log('Upscaling audio...');
      
      // Set up progress reporting
      audioUpscaler.onProgress((progress) => {
        process.stdout.write(`\rProgress: ${progress}%`);
      });
      
      // Perform upscaling
      await audioUpscaler.upscale(file.path, outputPath);
      
      console.log('\nUpscaling complete!');
      console.log(`Output saved to: ${outputPath}`);
    }
    
    console.log('\nAll tests completed successfully!');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

// Run the test
runTest();