const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const AudioUpscaler = require('./src/audioUpscaler');

let mainWindow;
let audioUpscaler;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 700,
    height: 500,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);
  
  // Initialize audio upscaler
  audioUpscaler = new AudioUpscaler();
}

app.whenReady().then(() => {
  createWindow();
});

app.on('window-all-closed', () => {
  app.quit();
});

// Handle file selection
ipcMain.handle('select-file', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Select Audio File',
    properties: ['openFile'],
    filters: [
      { name: 'Audio Files', extensions: ['mp3', 'wav', 'flac', 'aac', 'm4a', 'ogg'] }
    ]
  });
  
  if (canceled || filePaths.length === 0) {
    return null;
  }
  
  return filePaths[0];
});

// Handle save location selection
ipcMain.handle('select-save-location', async (event, originalPath) => {
  const ext = path.extname(originalPath);
  const baseName = path.basename(originalPath, ext);
  const suggestedName = `${baseName}_upscaled${ext}`;
  
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Save Upscaled Audio',
    defaultPath: suggestedName,
    filters: [
      { name: 'Audio File', extensions: [ext.replace('.', '')] }
    ]
  });
  
  if (canceled || !filePath) {
    return null;
  }
  
  return filePath;
});

// Handle audio upscaling
ipcMain.handle('upscale-audio', async (event, inputPath, outputPath) => {
  try {
    // Set up progress reporting
    audioUpscaler.onProgress((progress) => {
      mainWindow.webContents.send('upscaling-progress', progress);
    });
    
    // Perform upscaling
    await audioUpscaler.upscale(inputPath, outputPath);
    
    return { success: true };
  } catch (error) {
    console.error('Upscaling error:', error);
    return { 
      success: false, 
      error: error.message 
    };
  }
});