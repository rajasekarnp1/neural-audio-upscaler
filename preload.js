const { contextBridge, ipcRenderer } = require('electron');
const path = require('path');

contextBridge.exposeInMainWorld('audioUpscaler', {
  selectFile: () => ipcRenderer.invoke('select-file'),
  selectSaveLocation: (originalPath) => ipcRenderer.invoke('select-save-location', originalPath),
  upscaleAudio: (inputPath, outputPath) => ipcRenderer.invoke('upscale-audio', inputPath, outputPath),
  onProgress: (callback) => {
    ipcRenderer.on('upscaling-progress', (_, progress) => callback(progress));
    return () => ipcRenderer.removeAllListeners('upscaling-progress');
  },
  path: {
    basename: (p, ext) => path.basename(p, ext),
    extname: (p) => path.extname(p)
  }
});