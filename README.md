# Neural Audio Upscaler

This project is a Node.js application designed to upscale audio quality using neural network models. It offers multiple interfaces: a Command Line Interface (CLI) for direct processing, an Electron-based GUI application, and a web server for browser-based interaction. The system aims to preprocess audio, analyze its content to select an appropriate model, apply neural upscaling, and then postprocess the audio for final output.

## Key Features (Intended)

*   **Audio Upscaling:** Enhances the perceived quality of audio files using AI models.
*   **Content-Specific Models:** Utilizes different models based on audio content (e.g., voice, music, ambient).
*   **Multi-Interface:** Accessible via CLI, Electron GUI, and a Web interface.
*   **Preprocessing & Postprocessing:** Includes steps to prepare audio for upscaling and to refine it afterward.
*   **Model Training Capabilities:** (Partially implemented) Infrastructure for training and fine-tuning upscaling models.

## Technical Details

The audio processing pipeline involves several key components and stages:

1.  **Input & Interface Handling:**
    *   **`cli.js`**: Manages command-line arguments and orchestrates the upscaling process for CLI users.
    *   **`main.js` (Electron Main Process)**: Handles Electron app lifecycle, window creation, and inter-process communication (IPC) with `renderer.js`.
    *   **`renderer.js` (Electron Renderer Process)**: Manages the GUI interaction within the Electron app.
    *   **`server.js`**: Provides a web server (likely Express.js based on typical Node.js patterns) to serve the web interface (`public/index.html`) and handle API requests.
    *   **`index.html` / `public/index.html`**: The front-end for the web interface and Electron GUI.

2.  **Audio Preprocessing (`src/audioPreprocessor.js`):**
    *   Takes an input audio file.
    *   Intended to normalize audio, remove noise, preserve transients, and enhance dynamics using ffmpeg filters.
    *   **Current Status:** Most filter applications are **placeholders/skipped**. The `filters` array in `preprocess()` remains empty, meaning no actual ffmpeg audio filtering (noise reduction, normalization, etc.) is currently applied beyond format conversion. Audio analysis (`analyzeAudio`) is performed.

3.  **Content Analysis (`src/contentAnalyzer.js`):**
    *   Aims to determine the dominant type of audio content (e.g., voice, music, ambient) to select the most suitable upscaling model.
    *   It initializes or creates a TensorFlow.js model (`this.model`) for classification.
    *   **Current Status:** The actual analysis logic in the `analyze(filePath)` method is **simulated**. It returns predefined results based on keywords in the filename and does **not** currently use the TensorFlow.js model for prediction.

4.  **Core Upscaling (`src/audioUpscaler.js`):**
    *   **Model Loading/Creation**: Loads or creates different TensorFlow.js models for various audio types (general, voice, music, ambient) during initialization.
    *   **Model Selection**: Selects an AI model based on the (currently simulated) output of the `ContentAnalyzer`.
    *   **`processAudio(audioData, model, progressCallback)`**: This is the core method intended to perform the neural network-based upscaling.
        *   **Current Status:** This method is a **placeholder**. It reads WAV file data but **does not apply any AI model or actual upscaling algorithm**. It currently simulates processing delay and copies the original audio samples to the output (`enhancedChannels.push(samples)`).
    *   **Spectrogram & Phase Reconstruction (Intended but not fully integrated into `processAudio`):**
        *   **`src/spectrogram.js`**: Contains methods for FFT (`performFFT`) and IFFT (`performInverseFFT`).
            *   **Current Status:** Both `performFFT` and `performInverseFFT` are **placeholders** using simplified, non-performant calculations and do not represent true FFT/IFFT operations.
        *   **`src/phaseReconstructor.js`**: Intended to reconstruct audio phase information after magnitude-based spectrogram processing.
            *   **Current Status:** The `reconstruct()` method is a **placeholder**. It does not implement a valid phase reconstruction algorithm (like Griffin-Lim) and instead simulates phase updates.
        *   **Integration Note:** While `Spectrogram` and `PhaseReconstructor` classes exist, their placeholder methods are not effectively utilized within the current placeholder logic of `AudioUpscaler.processAudio` for actual audio transformation.

5.  **Audio Postprocessing (`src/audioPostprocessor.js`):**
    *   Takes the (supposedly) upscaled audio.
    *   Intended to apply final enhancements like harmonic restoration, transient shaping, dithering, and loudness matching using ffmpeg.
    *   **Current Status:** Similar to the preprocessor, filter applications are **placeholders/skipped**. The `filters` array remains empty, and no actual ffmpeg audio filtering is applied during this stage beyond format conversion.

6.  **Model Training (`src/modelTrainer.js`, `train.js`):**
    *   `src/modelTrainer.js`: Contains logic for training and fine-tuning the AI models.
    *   `train.js`: Likely the script to initiate the model training process.
    *   **Current Status:** Fine-tuning capabilities within the `AudioUpscaler.upscale()` method are explicitly **commented out/disabled** (`this.modelTrainer.fineTuneModel` is not called). The `trainModels` method in `AudioUpscaler` exists to orchestrate training, but its effectiveness depends on the actual implementation in `ModelTrainer` and the quality of (placeholder) data processing steps.

## Known Issues & Limitations

*   **Core Upscaling is Simulated:** The central `AudioUpscaler.processAudio()` method **does not perform any actual AI-based audio upscaling**. It currently acts as a passthrough or simple copier of the original audio data.
*   **Placeholder FFT/IFFT:** The FFT and IFFT implementations in `src/spectrogram.js` are non-functional placeholders.
*   **Placeholder Phase Reconstruction:** The phase reconstruction in `src/phaseReconstructor.js` is a non-functional placeholder.
*   **Simulated Content Analysis:** `src/contentAnalyzer.js` simulates content type detection and does not use its underlying AI model for this purpose.
*   **Skipped Preprocessing Filters:** Audio preprocessing filters (noise reduction, normalization) are defined as options but are **not applied** in `src/audioPreprocessor.js`.
*   **Skipped Postprocessing Filters:** Audio postprocessing filters (gain adjustment, dithering, mastering touches) are defined as options but are **not applied** in `src/audioPostprocessor.js`.
*   **AI Models Status:** While the system loads or creates stubbed TensorFlow.js models, these models are **not actually used** for upscaling in the current placeholder `processAudio` logic. Their architecture is defined, but they are not applied to the audio signal.
*   **Disabled Fine-Tuning:** The fine-tuning step within the `AudioUpscaler.upscale()` method (using `modelTrainer.fineTuneModel`) is currently **commented out and thus disabled**.
*   **Unused Dependencies (Potentially):**
    *   The project includes `fft.js` and `wavefile` in `package.json`. Given the placeholder nature of `src/spectrogram.js` and direct WAV buffer manipulation in `AudioUpscaler.processAudio`, these specific libraries might be **unused or underutilized** currently. A proper implementation would likely leverage them.
*   **Error Handling & Robustness:** Error handling might be basic in many placeholder sections.
*   **Resource Management:** Temporary file management (`.temp` directory) exists but overall resource handling for large files or intensive processing needs review in a real implementation.

## File Overview

*   **`main.js`**: Entry point for the Electron application (main process).
*   **`cli.js`**: Entry point for the Command Line Interface.
*   **`train.js`**: Script for initiating model training processes.
*   **`server.js`**: Implements the web server for the browser-based interface.
*   **`src/`**: Directory containing the core application logic:
    *   `audioPreprocessor.js`: Handles audio preprocessing.
    *   `contentAnalyzer.js`: Handles audio content analysis.
    *   `audioUpscaler.js`: Core class for the upscaling process.
    *   `spectrogram.js`: For FFT/IFFT operations (currently placeholder).
    *   `phaseReconstructor.js`: For phase reconstruction (currently placeholder).
    *   `audioPostprocessor.js`: Handles audio postprocessing.
    *   `modelTrainer.js`: Logic for training AI models.
*   **`public/`**: Contains static assets for the web interface, including `index.html`.
*   **`models/`**: (Assumed directory, based on `modelPath` in `AudioUpscaler`) Intended to store the neural network models.
*   **`index.html`**: Main HTML file for the Electron app's renderer process (GUI).
*   **`renderer.js`**: JavaScript for the Electron app's GUI logic.
*   **`preload.js`**: Electron script for securely exposing Node.js functionalities to the renderer process.
*   **`package.json`**: Node.js project manifest, listing dependencies and scripts.
*   **`*.sh` scripts (`start-web.sh`, `upscale.sh`):** Shell scripts for utility functions, likely for starting the web server or running CLI upscaling tasks.
*   **`research_tools/`**: Contains Python tools for research, including an arXiv API client. This seems somewhat separate from the core Node.js audio upscaling application but is part of the repository.

## Installation

1.  **Clone the repository:**
    ```bash
    git clone <repository-url>
    cd <repository-directory>
    ```
2.  **Install Node.js dependencies:**
    ```bash
    npm install
    ```
3.  **Install Python dependencies for research tools (optional):**
    ```bash
    cd research_tools
    pip install -r requirements.txt
    cd ..
    ```
4.  **Ensure FFmpeg is installed and in your system's PATH.** FFmpeg is used for audio file operations by `fluent-ffmpeg`.

## Usage

The application can be used via three different interfaces:

### 1. Electron GUI Application

*   **To run:**
    ```bash
    npm start
    ```
*   This will launch the desktop application. Use the GUI to select audio files, choose options, and start the upscaling process.
*   **(Note: Given the placeholder nature of core functions, the GUI might not produce genuinely upscaled audio yet.)**

### 2. Command Line Interface (CLI)

*   **Basic usage:**
    ```bash
    node cli.js upscale --input <path/to/input.wav> --output <path/to/output.wav> [options]
    ```
*   **Example:**
    ```bash
    node cli.js upscale --input ./uploads/test_tone.wav --output ./upscaled_test_tone.wav --audioType music
    ```
*   Run `node cli.js --help` to see available commands and options.
*   The `upscale.sh` script might provide a more convenient way to use the CLI.
*   **(Note: CLI will also use the placeholder core upscaling logic.)**

### 3. Web Interface

*   **Start the web server:**
    ```bash
    npm run start-web  # Or: node server.js or sh start-web.sh
    ```
*   Open your web browser and navigate to the address provided (e.g., `http://localhost:3000`).
*   Use the web interface to upload audio and initiate upscaling.
*   **(Note: The web interface will also rely on the same placeholder backend logic.)**

### Training Models

*   To initiate model training (if implemented and configured):
    ```bash
    node train.js --dataset <path/to/dataset_config.json> [options]
    ```
*   **(Note: Training effectiveness is subject to the actual implementation of `ModelTrainer.js` and data processing pipelines.)**

---
