# Project Knowledge Base: Neural Audio Upscaler Enhancement

## 1. Overview & Goals
    - Initial project state summary.
    - User-defined goals for enhancement (multi-technique exploration, iterative improvement).

## 2. Core Neural Network (NN) Implementation Details
    - ### 2.1 Spectrogram Module (`Spectrogram.js`)
        - **FFT/STFT Implementation Choice:**
            - The module now uses the `fft.js` library (version specified in `package.json`) for Fast Fourier Transform (FFT) and Inverse Fast Fourier Transform (IFFT) operations.
            - This replaces the previous placeholder implementations which were not functional.
            - `fft.js` was chosen as it's an existing project dependency.
        - **Input/Output Specifications & Integration Details:**
            - `performFFT(signal)`:
                - Takes a `Float32Array` (real time-domain signal frame) as input.
                - Uses `fft.js`'s `FFT` class and its `realTransform` method (or equivalent).
                - Output from `fft.js` (interleaved complex spectrum) is de-interleaved into separate `real` and `imag` `Float32Array`s of size `fftSize / 2 + 1`.
            - `performInverseFFT(real, imag)`:
                - Takes two `Float32Array`s (`real` and `imag` parts of the spectrum, assumed to be full length `fftSize` due to prior symmetric reconstruction in `toTimeDomain`).
                - These are interleaved into a complex array format suitable for `fft.js`.
                - Uses `fft.js`'s `inverseTransform` method.
                - The real part of the output from `fft.js` is extracted as the resulting time-domain signal frame.
                - Normalization by `1/N` (where N is `fftSize`) is applied to the IFFT output, as is standard for many FFT libraries to correctly scale the signal.
    - ### 2.2 Content Analyzer (`ContentAnalyzer.js`)
        - **Feature Extraction Method:**
            - The `analyze(filePath)` method now processes WAV audio files.
            - It computes a magnitude spectrogram using `Spectrogram.js` (with FFT size 1024, hop size 512 for this purpose).
            - **Simplified Features:** A 40-element feature vector is derived by averaging the magnitudes over time for each of the first 40 frequency bins of the spectrogram.
            - **Note:** This feature extraction method is preliminary and chosen for simplicity to enable end-to-end model prediction. For more accurate classification, industry-standard features like MFCCs (Mel-Frequency Cepstral Coefficients) would typically be used, as originally suggested by the model's input layer naming (`40 MFCCs or similar features`). This is a candidate for future improvement.
        - **Model Input/Output:**
            - The 40-element feature vector is fed as a tensor `[1, 40]` to the loaded TFJS model.
            - The model's softmax output (a 3-element probability vector) is used to determine `voiceConfidence`, `musicConfidence`, `ambientConfidence`, and the `dominantType`.
            - Other analysis fields (e.g., `harmonicContent`) remain placeholders as they are not directly derived from this classification model.
    - ### 2.3 Audio Upscaler (`AudioUpscaler.js`)
        - **`processAudio` Pipeline:**
            - The method now processes audio in the **time-domain**, aligning with the `conv1d` model architecture (`inputShape: [null, 1]`).
            - **Input:** Takes audio data (samples, sampleRate, etc.) from the revised `readAudioFile`. Audio is converted to mono.
            - **Segmentation:** Input mono samples are divided into fixed-length segments (e.g., 4096 samples) with overlap (e.g., 2048 samples). Shorter final segments are padded with zeros.
            - **Model Inference:** Each segment is passed as a tensor `[1, segmentLength, 1]` to the `model.predict()` method.
            - **Output Reconstruction:**
                - Enhanced segments from the model are concatenated.
                - **Note on Overlap-Add (OLA):** The current implementation uses a simplified concatenation/slicing approach for output segments. For higher quality and to avoid discontinuities with overlapping segments, a proper OLA method with windowing (e.g., Hann window on output segments before adding) should be implemented in the future.
            - **Output:** Returns an object containing the enhanced mono audio samples, sample rate, and bit depth, suitable for `saveAudioFile`.
        - **Model Input/Output Specifications:**
            - **Input to Model:** Time-domain audio segments (e.g., `tf.tensor3d([1, segmentLength, 1])`).
            - **Output from Model:** Assumed to be time-domain audio segments of the same length as the input. If the model is intended for super-resolution that changes sample count, this assumption and the subsequent processing logic would need to change.
            - **Spectrogram/PhaseReconstructor modules:** These are currently NOT used by `processAudio` with the time-domain `conv1d` models. They may be relevant for other upscaling techniques.
    - ### 2.4 Audio I/O (`readAudioFile`, `saveAudioFile`)
        - **Library Usage:** Both methods now utilize the `wavefile` library for robust parsing and creation of WAV files.
        - **`readAudioFile(filePath)`:**
            - Parses WAV files using `wavefile`.
            - Returns an object containing normalized `Float32Array` samples, `sampleRate`, `numChannels`, and `bitDepth`.
            - **FFmpeg Fallback:** Includes a basic fallback mechanism using `fluent-ffmpeg` to attempt conversion of non-PCM/non-Float WAV files to 16-bit PCM WAV before parsing. This increases robustness but adds an external dependency on FFmpeg being available.
        - **`saveAudioFile(enhancedAudioData, outputPath)`:**
            - Takes an object with `samples` (Float32Array), `sampleRate`, `numChannels` (typically 1 for mono output), and `bitDepth`.
            - Uses `wavefile.fromScratch()` to construct a new WAV buffer.
            - Converts Float32 samples to Int16 if `bitDepth` is 16. Handles 32-bit float ('32f') directly. 24-bit original audio is currently saved as 16-bit PCM.
    - ### 2.5 Testing Strategy
        - Basic unit and integration tests are implemented in `test.js`.
        - The script can be run using `node test.js`.
        - It uses `console.assert` for verifying conditions. No external test framework is currently used.
        - **Components Covered:**
            - **`Spectrogram.js`**: Includes a round-trip test (signal -> STFT -> ISTFT -> signal) checking for signal length and content similarity (via MSE).
            - **`ContentAnalyzer.js`**: Tests the `analyze` method with actual audio files. Checks for valid output structure, sensible confidence values (0-1, sum to ~1), and no crashes.
            - **`AudioUpscaler.js`**: Tests the `upscale` method using the real upscaler. Verifies that the process completes successfully, progress is reported, an output file is created, and the output WAV is mono.
        - **Test Files:** Uses audio files from the `uploads/` directory (e.g., `test_tone.wav`, `complex_tone.wav`).

## 3. Alternative Audio Upscaling Techniques
    - (Sections for each technique will be added here in Phase 3)

### 3.1 Classical DSP: Windowed Sinc Interpolation & Spectral Reshaping

-   **Basic Principle:**
    -   *Interpolation:* Increases the sampling rate by inserting zero samples between original samples, then applying a low-pass filter (ideally a sinc filter, approximated by a windowed sinc filter like Hann-windowed sinc) to remove spectral images and reconstruct the upsampled signal.
    -   *Spectral Reshaping/High-Frequency Enhancement (Optional):* After interpolation, the spectrum is band-limited to the original Nyquist frequency. To add new high-frequency content, techniques like spectral translation, noise/harmonic synthesis guided by lower frequency content, or psychoacoustic modeling can be applied.
-   **Potential Pros:**
    -   Well-understood and deterministic signal processing.
    -   Can be computationally efficient for moderate upsampling factors.
    -   Good for high-fidelity upsampling if the original signal was merely downsampled or if only bandwidth extension (not true detail generation from scratch) is the primary goal.
    -   Can serve as a predictable baseline.
-   **Potential Cons:**
    -   Cannot generate truly "new" information or details not present in the original signal's bandwidth; any high-frequency synthesis part is often heuristic or rule-based.
    -   May introduce ringing artifacts if filter design is not optimal.
    -   Synthesized high-frequency content can sound artificial if not carefully implemented.
-   **Key Components or Algorithms Involved:**
    -   Zero-padding (upsampling in time domain).
    -   Digital filter design (e.g., FIR filters, windowed sinc method).
    -   Optionally, spectral analysis (STFT), spectral manipulation algorithms for high-frequency synthesis.
-   **Complementation with Existing NN Approach:**
    -   Could be used as a preprocessing step to ensure a consistent sample rate before feeding into the NN.
    -   The NN could learn to refine the output of a DSP-based upsampler.
    -   The NN might predict parameters for a DSP-based high-frequency synthesis module.

### 3.2 Machine Learning: Generative Adversarial Networks (GANs) for Audio Super-Resolution

-   **Basic Principle:**
    -   A GAN framework involves two neural networks: a *Generator* and a *Discriminator*, trained in competition.
    -   The *Generator* takes low-resolution audio (or its representation, like a spectrogram) and attempts to produce a high-resolution version.
    -   The *Discriminator* is trained to distinguish between real high-resolution audio samples and the (fake) high-resolution samples produced by the Generator.
    -   Through adversarial training, the Generator learns to produce increasingly realistic high-resolution audio that can fool the Discriminator.
-   **Potential Pros:**
    -   Capable of generating highly realistic and detailed high-frequency content that sounds plausible, often surpassing traditional methods in perceptual quality.
    -   Can learn very complex mappings from low-resolution to high-resolution audio.
    -   Effective for tasks where generating plausible new information is key.
-   **Potential Cons:**
    -   Training GANs is notoriously unstable and difficult, requiring careful hyperparameter tuning, architectural design, and choice of loss functions.
    -   Can sometimes introduce artifacts or "hallucinations" (undesired sounds not related to the input).
    -   Typically computationally more expensive than simpler CNNs or classical DSP methods, both for training and inference.
    -   Evaluation can be challenging, often relying heavily on subjective listening tests.
-   **Key Components or Algorithms Involved:**
    -   Two distinct neural networks (Generator and Discriminator), often based on CNN architectures (e.g., U-Nets for spectrogram-based GANs).
    -   Specialized loss functions: adversarial loss (e.g., minimax or least squares), often combined with content-based losses (e.g., L1/L2 difference in time or frequency domain, perceptual losses).
-   **Complementation with Existing NN Approach:**
    -   The current simple CNN architecture could potentially serve as a building block within a GAN's generator or discriminator.
    -   A GAN could be a more advanced, higher-quality alternative to the current approach if perceptual realism is the primary goal.

### 3.3 Machine Learning: Autoencoders for Audio Denoising & Enhancement (adapted for Upscaling)

-   **Basic Principle:**
    -   An autoencoder consists of an *Encoder* network that maps input data to a lower-dimensional latent representation (bottleneck), and a *Decoder* network that reconstructs the original data (or a target version of it) from this latent representation.
    -   For upscaling/enhancement:
        -   It could be trained to take low-quality audio (or its features) as input and reconstruct a high-quality version as output.
        -   Variations like Denoising Autoencoders are explicitly trained to remove noise or artifacts.
        -   For bandwidth extension (a form of upscaling), the autoencoder might learn to predict missing frequency components based on the available lower frequencies.
    -   Can operate on time-domain segments or time-frequency representations like spectrograms.
-   **Potential Pros:**
    -   Generally simpler to train than GANs.
    -   Effective for tasks like denoising, compression, and learning meaningful representations.
    -   Can be adapted for tasks like artifact removal or bandwidth extension.
-   **Potential Cons:**
    -   May produce overly smooth or conservative results if not designed carefully, potentially losing some subtle details or textures.
    -   Generating entirely new high-frequency content might be less effective than GANs unless specifically designed for super-resolution tasks (e.g., by having the decoder output a higher resolution or more frequency bins than the encoder input).
    -   The "upscaling" capability depends heavily on the training data and how the "low quality" vs "high quality" versions are defined.
-   **Key Components or Algorithms Involved:**
    -   Encoder neural network.
    -   Decoder neural network (often symmetric to the encoder).
    -   Architectures can include CNNs, LSTMs, or Transformers.
    -   A well-defined loss function (e.g., Mean Squared Error between reconstructed and target high-quality audio).
-   **Complementation with Existing NN Approach:**
    -   Could be used for preprocessing (e.g., denoising the input) before the current upscaling model.
    -   The latent space representation learned by an autoencoder could potentially be used as input to another model or to guide a generative process.
    -   The current CNN models have a somewhat autoencoder-like structure (input -> processing -> output), but dedicated autoencoder architectures often have a more pronounced and deliberately engineered bottleneck layer to force learning of salient features.

## 4. Comparative Analysis & Hybrid Concepts
    - (This section will be developed in Phase 3)

## 5. Design Decisions & Rationale
    - (Key decisions made throughout the project will be logged here)

## 6. Open Questions & Future Research Areas
    - (Questions that arise and areas needing more investigation)

## 7. Glossary
    - (Definitions of key terms used in the project)
