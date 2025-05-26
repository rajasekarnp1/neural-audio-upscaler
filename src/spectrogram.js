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
    // Simplified FFT implementation
    // In a real implementation, we would use a proper FFT library
    const n = signal.length;
    const real = new Float32Array(n);
    const imag = new Float32Array(n);
    
    // Initialize with signal
    for (let i = 0; i < n; i++) {
      real[i] = signal[i];
    }
    
    // Perform FFT (very simplified)
    // This is just a placeholder - in a real implementation we would use a proper FFT algorithm
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const angle = -2 * Math.PI * i * j / n;
        real[i] += signal[j] * Math.cos(angle);
        imag[i] += signal[j] * Math.sin(angle);
      }
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
    // Simplified inverse FFT implementation
    const n = real.length;
    const result = new Float32Array(n);
    
    // Perform inverse FFT (very simplified)
    // This is just a placeholder - in a real implementation we would use a proper IFFT algorithm
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const angle = 2 * Math.PI * i * j / n;
        result[i] += real[j] * Math.cos(angle) - imag[j] * Math.sin(angle);
      }
      result[i] /= n;
    }
    
    return result;
  }
}

module.exports = { Spectrogram };