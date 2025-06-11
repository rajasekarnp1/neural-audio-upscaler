const fs = require('fs').promises;
const path = require('path');
const AudioUpscaler = require('./src/audioUpscaler'); // Use the real AudioUpscaler
const { ContentAnalyzer } = require('./src/contentAnalyzer');
// Spectrogram and PhaseReconstructor might not be directly used in test.js anymore
// const { Spectrogram } = require('./src/spectrogram');
// const { PhaseReconstructor } = require('./src/phaseReconstructor');


async function runTest() {
  try {
    console.log('Neural Audio Upscaler - Standard Test');
    console.log('====================================');
    
    // Initialize components
    console.log('\nInitializing components for standard test...');
    const audioUpscaler = new AudioUpscaler({ trainingMode: false }); // Ensure training mode is off for standard test
    await audioUpscaler.initialize(); // Wait for async initialization

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
    
    console.log('\nAll standard tests completed successfully!');

  } catch (error) {
    console.error('Error during standard test:', error);
    // Decide if this should throw to stop all tests or just log
  }
}

async function runFineTuningTest() {
  console.log('\n\nNeural Audio Upscaler - Fine-Tuning Test');
  console.log('=========================================');
  const inputPath = './uploads/test_tone.wav'; // Ensure this file exists
  const outputPath = './uploads/test_tone_finetuned_output.wav';

  try {
    // Ensure the input file exists before running the test
    await fs.access(inputPath);
    console.log(`Input file ${inputPath} found.`);
  } catch (e) {
    console.error(`Error: Input file ${inputPath} not found. Skipping fine-tuning test.`);
    console.log("Please create a simple WAV file (e.g., a short tone) at ./uploads/test_tone.wav to run this test.");
    return;
  }

  try {
    console.log('\nInitializing components for fine-tuning test...');
    // Disable pre/post processing to directly test model output for fine-tuning
    const ftUpscaler = new AudioUpscaler({
      trainingMode: true,
      usePreprocessing: false,
      usePostprocessing: false
    });
    await ftUpscaler.initialize(); // Wait for async initialization

    console.log(`\nProcessing file for fine-tuning: ${inputPath}`);

    // Set up progress reporting
    ftUpscaler.onProgress((progress) => {
      process.stdout.write(`\rFine-tuning test progress: ${progress}%`);
    });

    await ftUpscaler.upscale(inputPath, outputPath);
    console.log('\nFine-tuning upscale complete!');

    // Verify output file creation
    await fs.access(outputPath);
    console.log(`Output file for fine-tuning test created successfully: ${outputPath}`);
    
    console.log('\nFine-tuning test completed successfully!');

  } catch (error) {
    console.error('Error during fine-tuning test:', error);
  }
}


// Run the tests
(async () => {
  await runTest();
  await runFineTuningTest();
})();