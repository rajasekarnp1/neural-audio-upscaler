const express = require('express');
const path = require('path');
const cors = require('cors');
const multer = require('multer');
const fs = require('fs').promises;
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const AudioUpscaler = require('./src/audioUpscaler');

const app = express();
const port = 12000; // Using the assigned port

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

// Create uploads directory if it doesn't exist
(async () => {
  try {
    await fs.mkdir('uploads', { recursive: true });
    console.log('Uploads directory created');
  } catch (err) {
    console.error('Error creating uploads directory:', err);
  }
})();

// Enable CORS for all routes
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}));

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// Handle file upload and processing
app.post('/upscale', upload.single('audio'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const inputPath = req.file.path;
    const outputPath = `${inputPath}_upscaled${path.extname(req.file.originalname)}`;
    
    console.log(`Processing file: ${inputPath}`);
    console.log('Options:', req.body);
    
    // Parse options
    const options = {
      usePreprocessing: req.body.usePreprocessing === 'true',
      usePostprocessing: req.body.usePostprocessing === 'true',
      trainingMode: req.body.trainingMode === 'true',
      preserveQuality: req.body.preserveQuality === 'true',
      audioType: req.body.audioType === 'auto' ? null : req.body.audioType
    };
    
    console.log('Parsed options:', options);
    
    // Initialize upscaler with options
    const upscaler = new AudioUpscaler(options);
    
    // Process the audio
    const result = await upscaler.upscale(inputPath, outputPath);
    
    console.log('Upscaling result:', result);
    
    // Return the path to the processed file
    res.json({
      success: true,
      originalName: req.file.originalname,
      processedFile: `/download?file=${path.basename(outputPath)}`,
      audioType: result.audioType || 'unknown'
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: 'Error processing audio file: ' + error.message });
  }
});

// Handle file download
app.get('/download', async (req, res) => {
  try {
    const fileName = req.query.file;
    if (!fileName) {
      return res.status(400).send('File name is required');
    }
    
    const filePath = path.join(__dirname, 'uploads', fileName);
    
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch (err) {
      return res.status(404).send('File not found');
    }
    
    // Send the file
    res.download(filePath);
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).send('Error downloading file');
  }
});

// Create a simple web interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(port, '0.0.0.0', () => {
  console.log(`Server running at http://0.0.0.0:${port}`);
});