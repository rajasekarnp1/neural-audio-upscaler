const fs = require('fs').promises;
const path = require('path');
const { Spectrogram } = require('./src/spectrogram.js');
const { ContentAnalyzer } = require('./src/contentAnalyzer.js');
const { AudioUpscaler } = require('./src/audioUpscaler.js'); // Real AudioUpscaler
const { WaveFile } = require('wavefile'); // For checking output WAVs

// Helper function for comparing Float32Arrays
function compareFloatArrays(arr1, arr2, tolerance = 1e-5) {
    if (!arr1 || !arr2) {
        console.error("One of the arrays is undefined or null.");
        return false;
    }
    if (arr1.length !== arr2.length) {
        console.error(`Array length mismatch: ${arr1.length} !== ${arr2.length}`);
        return false;
    }
    let mse = 0;
    for (let i = 0; i < arr1.length; i++) {
        mse += (arr1[i] - arr2[i]) ** 2;
    }
    mse /= arr1.length;
    console.log(`MSE for array comparison: ${mse}`);
    return mse < tolerance;
}

async function testSpectrogram() {
    console.log('\n--- Testing Spectrogram ---');
    const specUtil = new Spectrogram({ fftSize: 1024, hopSize: 256 });

    const signalLength = 2048;
    const originalSignal = new Float32Array(signalLength);
    for (let i = 0; i < signalLength; i++) {
        originalSignal[i] = Math.sin(2 * Math.PI * 440 * i / 44100); // A4 note
    }

    const specData = specUtil.fromTimeDomain(originalSignal);
    const reconstructedSignal = specUtil.toTimeDomain(specData);

    console.assert(reconstructedSignal.length === originalSignal.length, `Spectrogram test: Length mismatch. Expected ${originalSignal.length}, got ${reconstructedSignal.length}`);
    // Adjust comparison to account for potential length differences due to STFT/ISTFT windowing/padding if any
    const effectiveLength = Math.min(originalSignal.length, reconstructedSignal.length);
    console.assert(compareFloatArrays(originalSignal.slice(0, effectiveLength), reconstructedSignal.slice(0, effectiveLength)), 'Spectrogram test: Content mismatch (STFT/ISTFT)');
    console.log('Spectrogram test completed.');
}

async function testContentAnalyzer(analyzer, filePath, fileName) {
    console.log(`\n--- Testing ContentAnalyzer for ${fileName} ---`);
    const content = await analyzer.analyze(filePath);
    console.log('Analysis result:', content);

    console.assert(content && typeof content === 'object', 'ContentAnalyzer test: Result is not an object');
    if (content && typeof content === 'object') { // Proceed only if content is an object
        console.assert(typeof content.dominantType === 'string', 'ContentAnalyzer test: dominantType missing or not a string');
        console.assert(typeof content.voiceConfidence === 'number' && content.voiceConfidence >= 0 && content.voiceConfidence <= 1, 'ContentAnalyzer test: voiceConfidence invalid');
        console.assert(typeof content.musicConfidence === 'number' && content.musicConfidence >= 0 && content.musicConfidence <= 1, 'ContentAnalyzer test: musicConfidence invalid');
        console.assert(typeof content.ambientConfidence === 'number' && content.ambientConfidence >= 0 && content.ambientConfidence <= 1, 'ContentAnalyzer test: ambientConfidence invalid');

        if (content.error) {
            console.warn(`ContentAnalyzer reported an error for ${fileName}: ${content.error}`);
        } else {
            const sumConf = content.voiceConfidence + content.musicConfidence + content.ambientConfidence;
            console.assert(Math.abs(sumConf - 1.0) < 0.01, `ContentAnalyzer test: Confidences do not sum to ~1. Sum: ${sumConf}`);
        }
    }
    console.log(`ContentAnalyzer test for ${fileName} completed.`);
}

async function testAudioUpscaler(upscaler, filePath, fileName) {
    console.log(`\n--- Testing AudioUpscaler for ${fileName} ---`);
    const outputDir = 'test_outputs'; // Store test outputs in a sub-directory
    await fs.mkdir(outputDir, { recursive: true });
    const outputPath = path.join(outputDir, `${path.basename(fileName, '.wav')}_test_upscaled.wav`);

    let progressReceived = false;
    upscaler.onProgress(percent => {
        progressReceived = true;
        process.stdout.write(`\rUpscaler Progress for ${fileName}: ${percent}%`);
    });

    let result;
    try {
        result = await upscaler.upscale(filePath, outputPath);
        process.stdout.write(`\rUpscaler Progress for ${fileName}: Done.          \n`);
    } catch (error) {
        console.error(`\nError during upscaling ${fileName}:`, error);
        console.assert(false, `AudioUpscaler test: Upscale operation threw an error for ${fileName}`);
        return;
    }

    console.assert(result && result.success, `AudioUpscaler test: Upscale operation failed for ${fileName}`);
    console.assert(progressReceived, `AudioUpscaler test: No progress reported for ${fileName}`);

    try {
        const stat = await fs.stat(outputPath);
        console.assert(stat.isFile() && stat.size > 0, `AudioUpscaler test: Output file not created or empty for ${fileName}`);
    } catch (e) {
        console.error(`AudioUpscaler test: Output file error for ${fileName}`, e);
        console.assert(false, `AudioUpscaler test: Output file error for ${fileName}`);
    }

    try {
        const wavBuffer = await fs.readFile(outputPath);
        const wav = new WaveFile(wavBuffer);
        wav.parseHeader(); // Ensure header is parsed
        console.assert(parseInt(wav.fmt.numChannels) === 1, `AudioUpscaler test: Output channels not mono for ${fileName}. Got ${wav.fmt.numChannels}`);
    } catch (e) {
        console.error(`AudioUpscaler test: Error reading or parsing output WAV for ${fileName}`, e);
        console.assert(false, `AudioUpscaler test: Error with output WAV for ${fileName}`);
    }
    
    console.log(`AudioUpscaler test for ${fileName} completed. Output: ${outputPath}`);
}

async function runTests() {
    console.log('Neural Audio Upscaler - Enhanced Test Suite');
    console.log('=========================================');

    // Ensure uploads directory exists
    const uploadsDir = 'uploads';
    try {
        await fs.access(uploadsDir);
    } catch (error) {
        console.error(`Error: The '${uploadsDir}' directory does not exist. Please create it and add test audio files.`);
        console.error('Expected files like ./uploads/test_tone.wav and ./uploads/complex_tone.wav');
        return; // Stop tests if critical directory is missing
    }

    const audioUpscaler = new AudioUpscaler(); // Using real upscaler
    const contentAnalyzer = new ContentAnalyzer();
    
    try {
        await contentAnalyzer.initialize(); // Initialize content analyzer models
        // Note: AudioUpscaler initializes its own models in its constructor/initialize method
    } catch (error) {
        console.error("Failed to initialize components:", error);
        return;
    }

    await testSpectrogram();

    const testFiles = [
        { path: path.join(uploadsDir, 'test_tone.wav'), name: 'test_tone.wav' },
        { path: path.join(uploadsDir, 'complex_tone.wav'), name: 'complex_tone.wav' }
    ];

    for (const file of testFiles) {
        try {
            await fs.access(file.path); // Check if file exists before testing
            await testContentAnalyzer(contentAnalyzer, file.path, file.name);
            await testAudioUpscaler(audioUpscaler, file.path, file.name);
        } catch (error) {
            console.warn(`\nSkipping tests for ${file.name} as file is not accessible at ${file.path} or a test failed catastrophically.`);
            console.warn(error.message);
        }
    }
    
    console.log('\nAll tests initiated. Check assertions for results.');
}

runTests().catch(error => {
    console.error("Critical error during test execution:", error);
});