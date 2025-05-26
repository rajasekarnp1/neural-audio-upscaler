#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const AudioUpscaler = require('./src/audioUpscaler');

// Parse command line arguments
const args = process.argv.slice(2);

// Help message
const showHelp = () => {
  console.log(`
Neural Audio Upscaler CLI
========================

Usage:
  node cli.js [options] <input-file> <output-file>

Options:
  --no-preprocessing     Disable audio preprocessing
  --no-postprocessing    Disable audio postprocessing
  --training-mode        Enable training mode (model will learn from this example)
  --audio-type <type>    Force audio type (voice, music, ambient, general)
  --help                 Show this help message

Examples:
  node cli.js input.mp3 output.wav
  node cli.js --no-preprocessing input.mp3 output.wav
  node cli.js --training-mode input.mp3 output.wav
`);
  process.exit(0);
};

// Show help if requested
if (args.includes('--help') || args.length === 0) {
  showHelp();
}

// Parse options
let inputPath = null;
let outputPath = null;
let usePreprocessing = true;
let usePostprocessing = true;
let trainingMode = false;
let audioType = null;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--no-preprocessing') {
    usePreprocessing = false;
  } else if (arg === '--no-postprocessing') {
    usePostprocessing = false;
  } else if (arg === '--training-mode') {
    trainingMode = true;
  } else if (arg === '--audio-type' && i + 1 < args.length) {
    audioType = args[++i];
    if (!['voice', 'music', 'ambient', 'general'].includes(audioType)) {
      console.error(`Error: Invalid audio type: ${audioType}`);
      console.error('Valid types: voice, music, ambient, general');
      process.exit(1);
    }
  } else if (!arg.startsWith('--')) {
    if (inputPath === null) {
      inputPath = arg;
    } else if (outputPath === null) {
      outputPath = arg;
    }
  }
}

// Check if we have enough arguments
if (inputPath === null || outputPath === null) {
  console.error('Error: Input and output files are required');
  showHelp();
}

async function main() {
  try {
    console.log('\nNeural Audio Upscaler CLI');
    console.log('========================\n');
    
    // Check if input file exists
    try {
      await fs.access(inputPath);
    } catch (err) {
      console.error(`Error: Input file "${inputPath}" does not exist.`);
      process.exit(1);
    }
    
    // Initialize upscaler with options
    console.log('Initializing audio upscaler...');
    const audioUpscaler = new AudioUpscaler({
      usePreprocessing,
      usePostprocessing,
      trainingMode,
      preserveQuality: true
    });
    
    // Log configuration
    console.log('\nConfiguration:');
    console.log(`- Preprocessing: ${usePreprocessing ? 'Enabled' : 'Disabled'}`);
    console.log(`- Postprocessing: ${usePostprocessing ? 'Enabled' : 'Disabled'}`);
    console.log(`- Training mode: ${trainingMode ? 'Enabled' : 'Disabled'}`);
    if (audioType) {
      console.log(`- Forced audio type: ${audioType}`);
    }
    
    // Process audio
    console.log(`\nUpscaling audio file: ${inputPath}`);
    console.log(`Output will be saved to: ${outputPath}`);
    
    // Set up progress reporting
    audioUpscaler.onProgress((progress) => {
      process.stdout.write(`\rProgress: ${progress}%`);
    });
    
    // Perform upscaling
    const result = await audioUpscaler.upscale(inputPath, outputPath, audioType);
    
    console.log('\n\nUpscaling complete!');
    
    if (result && result.audioType) {
      console.log(`Detected audio type: ${result.audioType}`);
    }
    
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

main();