const FFT = require('fft.js');

class Spectrogram {
  constructor(options = {}) {
    this.fftSize = options.fftSize || 2048;
    this.hopSize = options.hopSize || this.fftSize / 4;
  }
  
  hannWindow(length) {
    const window = new Float32Array(length);
    for (let i = 0; i < length; i++) {
      window[i] = 0.5 * (1 - Math.cos(2 * Math.PI * i / (length - 1)));
    }
    return window;
  }
  
  fromTimeDomain(samples) {
    // Create spectrogram from time domain samples
    const window = this.hannWindow(this.fftSize);
    
    // Calculate number of frames
    const numFrames = Math.floor((samples.length - this.fftSize) / this.hopSize) + 1;
    
    // Allocate memory for spectrogram
    const magnitude = new Float32Array(numFrames * (this.fftSize / 2 + 1));
    const phase = new Float32Array(numFrames * (this.fftSize / 2 + 1));
    
    // Process each frame
    for (let frame = 0; frame < numFrames; frame++) {
      const startSample = frame * this.hopSize;
      
      // Apply window function and prepare frame
      const frameData = new Float32Array(this.fftSize);
      for (let i = 0; i < this.fftSize; i++) {
        if (startSample + i < samples.length) {
          frameData[i] = samples[startSample + i] * window[i];
        }
      }
      
      // Perform FFT (simplified implementation)
      const { real, imag } = this.performFFT(frameData);
      
      // Convert to magnitude and phase
      for (let i = 0; i <= this.fftSize / 2; i++) {
        const index = frame * (this.fftSize / 2 + 1) + i;
        magnitude[index] = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
        phase[index] = Math.atan2(imag[i], real[i]);
      }
    }
    
    return {
      magnitude,
      phase,
      timeFrames: numFrames,
      freqBins: this.fftSize / 2 + 1,
      fftSize: this.fftSize,
      hopSize: this.hopSize
    };
  }
  
  performFFT(signal) {
    // Ensure signal is Float32Array
    if (!(signal instanceof Float32Array)) {
      signal = new Float32Array(signal);
    }

    const f = new FFT(this.fftSize);
    const complexSpectrum = f.createComplexArray();
    f.realTransform(complexSpectrum, signal);
    // f.dispose(); // Consider if fft.js has a dispose method for WASM/memory management

    // De-interleave complexSpectrum into real and imag arrays
    // The output of realTransform is half-spectrum: [r0, i0, r1, i1, ..., r(N/2), i(N/2)]
    // where N is fftSize. The length of complexSpectrum is N.
    // real part has N/2 + 1 components, imag part has N/2 + 1 components.
    const real = new Float32Array(this.fftSize / 2 + 1);
    const imag = new Float32Array(this.fftSize / 2 + 1);

    for (let i = 0; i <= this.fftSize / 2; i++) {
      real[i] = complexSpectrum[2 * i];
      imag[i] = complexSpectrum[2 * i + 1];
    }
    
    return { real, imag };
  }
  
  toTimeDomain(spectrogramData) {
    // Convert spectrogram back to time domain
    const { magnitude, phase, timeFrames, freqBins } = spectrogramData;
    
    // Calculate output length
    const outputLength = (timeFrames - 1) * this.hopSize + this.fftSize;
    const output = new Float32Array(outputLength).fill(0);
    
    const window = this.hannWindow(this.fftSize);
    
    // Process each frame
    for (let frame = 0; frame < timeFrames; frame++) {
      // Convert magnitude and phase to real and imaginary
      const real = new Float32Array(this.fftSize);
      const imag = new Float32Array(this.fftSize);
      
      for (let i = 0; i <= this.fftSize / 2; i++) {
        const index = frame * freqBins + i;
        const mag = magnitude[index];
        const phs = phase[index];
        
        real[i] = mag * Math.cos(phs);
        imag[i] = mag * Math.sin(phs);
        
        // Mirror for negative frequencies (except DC and Nyquist)
        if (i > 0 && i < this.fftSize / 2) {
          real[this.fftSize - i] = real[i];
          imag[this.fftSize - i] = -imag[i]; // Conjugate
        }
      }
      
      // Perform inverse FFT
      const frameData = this.performInverseFFT(real, imag);
      
      // Overlap-add to output
      const startSample = frame * this.hopSize;
      for (let i = 0; i < this.fftSize; i++) {
        if (startSample + i < outputLength) {
          output[startSample + i] += frameData[i] * window[i] / (this.fftSize / 2);
        }
      }
    }
    
    return output;
  }
  
  performInverseFFT(real, imag) {
    // real and imag are full spectrum (length this.fftSize) as prepared by toTimeDomain
    if (real.length !== this.fftSize || imag.length !== this.fftSize) {
      throw new Error(`performInverseFFT: real and imag arrays must have length equal to fftSize (${this.fftSize}). Got ${real.length}`);
    }

    const f = new FFT(this.fftSize);
    const complexSpectrumInput = f.createComplexArray();

    // Interleave real and imag into complexSpectrumInput
    for (let i = 0; i < this.fftSize; i++) {
      complexSpectrumInput[2 * i] = real[i];
      complexSpectrumInput[2 * i + 1] = imag[i];
    }

    // Output array for the time-domain signal (will be complex interleaved)
    const timeDomainComplexOutput = f.createComplexArray();
    
    // Perform the inverse transform
    f.inverseTransform(timeDomainComplexOutput, complexSpectrumInput);
    // f.dispose(); // Consider if fft.js has a dispose method

    // Extract the real part as the result
    const result = new Float32Array(this.fftSize);
    for (let i = 0; i < this.fftSize; i++) {
      result[i] = timeDomainComplexOutput[2 * i];
    }
    
    // Normalize the output (common practice for IFFT)
    for (let i = 0; i < this.fftSize; i++) {
      result[i] = result[i] / this.fftSize;
    }

    return result;
  }
}

module.exports = { Spectrogram };