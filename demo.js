#!/usr/bin/env node

/**
 * Neural Audio Upscaler - Demo Script
 * 
 * This script demonstrates all the features of the Neural Audio Upscaler
 * by processing a test file with different settings and comparing the results.
 */

const fs = require('fs').promises;
const path = require('path');
const AudioUpscaler = require('./src/audioUpscaler');
const { ContentAnalyzer } = require('./src/contentAnalyzer');
const { AudioPreprocessor } = require('./src/audioPreprocessor');
const { AudioPostprocessor } = require('./src/audioPostprocessor');
const { ModelTrainer } = require('./src/modelTrainer');

// Test configurations
const configurations = [
  {
    name: 'Default Settings',
    options: {
      usePreprocessing: true,
      usePostprocessing: true,
      trainingMode: false,
      preserveQuality: true,
      audioType: null // Auto-detect
    }
  },
  {
    name: 'Voice Optimization',
    options: {
      usePreprocessing: true,
      usePostprocessing: true,
      trainingMode: false,
      preserveQuality: true,
      audioType: 'voice'
    }
  },
  {
    name: 'Music Optimization',
    options: {
      usePreprocessing: true,
      usePostprocessing: true,
      trainingMode: false,
      preserveQuality: true,
      audioType: 'music'
    }
  },
  {
    name: 'Training Mode',
    options: {
      usePreprocessing: true,
      usePostprocessing: true,
      trainingMode: true,
      preserveQuality: true,
      audioType: null // Auto-detect
    }
  },
  {
    name: 'No Processing',
    options: {
      usePreprocessing: false,
      usePostprocessing: false,
      trainingMode: false,
      preserveQuality: true,
      audioType: null // Auto-detect
    }
  },
  {
    name: 'Quality Focus',
    options: {
      usePreprocessing: true,
      usePostprocessing: true,
      trainingMode: false,
      preserveQuality: true,
      qualityLevel: 'maximum',
      audioType: null // Auto-detect
    }
  }
];

// Main function
async function main() {
  try {
    console.log('Neural Audio Upscaler - Feature Demonstration');
    console.log('===========================================\n');
    
    // Create test directory
    const testDir = path.join(__dirname, 'demo_results');
    await fs.mkdir(testDir, { recursive: true });
    
    // Use test tone as input
    const inputFile = path.join(__dirname, 'uploads', 'test_tone.wav');
    
    // Check if input file exists
    try {
      await fs.access(inputFile);
      console.log(`Using test file: ${inputFile}\n`);
    } catch (err) {
      console.error(`Error: Test file not found at ${inputFile}`);
      console.log('Please create a test file first using:');
      console.log('  node cli.js --create-test-file');
      process.exit(1);
    }
    
    // Initialize content analyzer
    console.log('Initializing content analyzer...');
    const contentAnalyzer = new ContentAnalyzer();
    await contentAnalyzer.initialize();
    
    // Analyze test file
    console.log('Analyzing test file content...');
    const content = await contentAnalyzer.analyze(inputFile);
    console.log('Content analysis results:');
    console.log(`  Dominant type: ${content.dominantType}`);
    console.log(`  Voice confidence: ${(content.voiceConfidence * 100).toFixed(1)}%`);
    console.log(`  Music confidence: ${(content.musicConfidence * 100).toFixed(1)}%`);
    console.log(`  Ambient confidence: ${(content.ambientConfidence * 100).toFixed(1)}%\n`);
    
    // Process with each configuration
    for (const [index, config] of configurations.entries()) {
      console.log(`\nConfiguration ${index + 1}: ${config.name}`);
      console.log('Options:');
      Object.entries(config.options).forEach(([key, value]) => {
        console.log(`  ${key}: ${value === null ? 'auto' : value}`);
      });
      
      // Create output file path
      const outputFile = path.join(testDir, `result_${index + 1}_${config.name.toLowerCase().replace(/\s+/g, '_')}.wav`);
      
      // Initialize upscaler with configuration
      const upscaler = new AudioUpscaler(config.options);
      
      // Set up progress reporting
      upscaler.onProgress((progress) => {
        process.stdout.write(`\rProgress: ${progress}%`);
      });
      
      // Process audio
      console.log('Processing audio...');
      const result = await upscaler.upscale(inputFile, outputFile);
      
      console.log('\nProcessing complete!');
      if (result && result.audioType) {
        console.log(`Detected audio type: ${result.audioType}`);
      }
      console.log(`Output saved to: ${outputFile}`);
    }
    
    console.log('\nAll configurations processed successfully!');
    console.log(`Results saved to: ${testDir}`);
    console.log('\nYou can compare the results to hear the differences between configurations.');
    
  } catch (error) {
    console.error('\nError:', error.message);
    process.exit(1);
  }
}

// Run main function
main();