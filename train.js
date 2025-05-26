#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const AudioUpscaler = require('./src/audioUpscaler');

// Parse command line arguments
const args = process.argv.slice(2);

// Help message
const showHelp = () => {
  console.log(`
Neural Audio Upscaler Training Tool
==================================

Usage:
  node train.js [options] <dataset-dir>

Options:
  --epochs <number>       Number of training epochs (default: 10)
  --learning-rate <rate>  Learning rate (default: 0.001)
  --batch-size <size>     Batch size (default: 32)
  --help                  Show this help message

Examples:
  node train.js ./training_data
  node train.js --epochs 20 --learning-rate 0.0005 ./training_data

Dataset Directory Structure:
  The dataset directory should contain pairs of audio files:
  - low_quality/file1.wav and high_quality/file1.wav
  - low_quality/file2.mp3 and high_quality/file2.mp3
  - etc.
`);
  process.exit(0);
};

// Show help if requested
if (args.includes('--help') || args.length === 0) {
  showHelp();
}

// Parse options
let datasetDir = null;
let epochs = 10;
let learningRate = 0.001;
let batchSize = 32;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--epochs' && i + 1 < args.length) {
    epochs = parseInt(args[++i]);
  } else if (arg === '--learning-rate' && i + 1 < args.length) {
    learningRate = parseFloat(args[++i]);
  } else if (arg === '--batch-size' && i + 1 < args.length) {
    batchSize = parseInt(args[++i]);
  } else if (!arg.startsWith('--')) {
    datasetDir = arg;
  }
}

if (!datasetDir) {
  console.error('Error: Dataset directory is required');
  showHelp();
}

// Main function
async function main() {
  try {
    console.log('\nNeural Audio Upscaler Training Tool');
    console.log('==================================\n');
    
    // Initialize upscaler
    console.log('Initializing audio upscaler...\n');
    const upscaler = new AudioUpscaler({
      trainingMode: true
    });
    
    // Set training options
    upscaler.modelTrainer.options.epochs = epochs;
    upscaler.modelTrainer.options.learningRate = learningRate;
    upscaler.modelTrainer.options.batchSize = batchSize;
    
    console.log(`Training configuration:`);
    console.log(`- Epochs: ${epochs}`);
    console.log(`- Learning rate: ${learningRate}`);
    console.log(`- Batch size: ${batchSize}\n`);
    
    // Scan dataset directory
    console.log(`Scanning dataset directory: ${datasetDir}`);
    
    // Check if directory exists
    try {
      await fs.access(datasetDir);
    } catch (err) {
      console.error(`Error: Dataset directory does not exist: ${datasetDir}`);
      process.exit(1);
    }
    
    // Check for low_quality and high_quality subdirectories
    const lowQualityDir = path.join(datasetDir, 'low_quality');
    const highQualityDir = path.join(datasetDir, 'high_quality');
    
    try {
      await fs.access(lowQualityDir);
      await fs.access(highQualityDir);
    } catch (err) {
      console.error(`Error: Dataset directory must contain 'low_quality' and 'high_quality' subdirectories`);
      process.exit(1);
    }
    
    // Get files from low_quality directory
    const lowQualityFiles = await fs.readdir(lowQualityDir);
    
    // Create dataset pairs
    const pairs = [];
    
    for (const file of lowQualityFiles) {
      const lowQualityPath = path.join(lowQualityDir, file);
      const highQualityPath = path.join(highQualityDir, file);
      
      try {
        // Check if high-quality file exists
        await fs.access(highQualityPath);
        
        // Add to pairs
        pairs.push({
          lowQuality: lowQualityPath,
          highQuality: highQualityPath
        });
      } catch (err) {
        console.warn(`Warning: No matching high-quality file for: ${file}`);
      }
    }
    
    if (pairs.length === 0) {
      console.error('Error: No valid file pairs found in dataset');
      process.exit(1);
    }
    
    console.log(`Found ${pairs.length} valid file pairs for training\n`);
    
    // Train models
    console.log('Starting model training...\n');
    
    // Progress bar
    let lastProgress = 0;
    const progressCallback = (progress) => {
      const percent = Math.round(progress);
      if (percent > lastProgress) {
        process.stdout.write(`Progress: ${percent}%\r`);
        lastProgress = percent;
      }
    };
    
    const result = await upscaler.trainModels({ pairs }, progressCallback);
    
    console.log('\n\nTraining complete!');
    console.log(`Trained models: ${result.modelTypes.join(', ')}`);
    console.log(`Models saved to: ${path.join(__dirname, 'models')}`);
    
  } catch (error) {
    console.error('Error during training:', error);
    process.exit(1);
  }
}

// Run main function
main();