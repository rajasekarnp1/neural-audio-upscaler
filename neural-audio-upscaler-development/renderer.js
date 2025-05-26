document.addEventListener('DOMContentLoaded', () => {
  const uploadBtn = document.getElementById('upload-btn');
  const terminal = document.getElementById('terminal');
  
  let isProcessing = false;
  
  // Add a log line to the terminal
  function log(message, type = 'info') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    line.textContent = message;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  }
  
  // Create a progress bar
  function createProgressBar() {
    const container = document.createElement('div');
    container.className = 'progress-container';
    
    const bar = document.createElement('div');
    bar.className = 'progress-bar';
    
    container.appendChild(bar);
    terminal.appendChild(container);
    
    return bar;
  }
  
  // Update progress bar
  function updateProgress(bar, percent) {
    bar.style.width = `${percent}%`;
  }
  
  // Handle file selection and upscaling
  uploadBtn.addEventListener('click', async () => {
    if (isProcessing) return;
    
    try {
      // Select input file
      const inputPath = await window.audioUpscaler.selectFile();
      if (!inputPath) return;
      
      const fileName = window.audioUpscaler.path.basename(inputPath);
      log(`Selected file: ${fileName}`);
      
      // Select save location
      log('Select where to save the upscaled file...', 'info');
      const outputPath = await window.audioUpscaler.selectSaveLocation(inputPath);
      if (!outputPath) {
        log('Save location selection cancelled.', 'info');
        return;
      }
      
      const outputName = window.audioUpscaler.path.basename(outputPath);
      log(`Output will be saved as: ${outputName}`);
      
      // Start upscaling process
      isProcessing = true;
      uploadBtn.disabled = true;
      
      log('Starting audio upscaling process...', 'info');
      
      // Create progress bar
      const progressBar = createProgressBar();
      
      // Set up progress handler
      const progressHandler = window.audioUpscaler.onProgress((progress) => {
        updateProgress(progressBar, progress);
        
        // Add informative messages at key points
        if (progress === 25) {
          log('Analyzing audio frequencies...', 'info');
        } else if (progress === 50) {
          log('Applying neural upscaling...', 'info');
        } else if (progress === 75) {
          log('Finalizing audio enhancement...', 'info');
        }
      });
      
      // Perform upscaling
      const result = await window.audioUpscaler.upscaleAudio(inputPath, outputPath);
      
      // Clean up progress handler
      progressHandler();
      
      // Show result
      if (result.success) {
        log('Upscaling completed successfully!', 'success');
        log(`Enhanced audio saved to: ${outputPath}`, 'success');
      } else {
        log(`Error: ${result.error}`, 'error');
      }
      
    } catch (err) {
      log(`Error: ${err.message}`, 'error');
    } finally {
      isProcessing = false;
      uploadBtn.disabled = false;
    }
  });
});