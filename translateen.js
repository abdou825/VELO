const audioUpload = document.getElementById('audio-upload');
const fileNameDisplay = document.getElementById('file-name');
const processBtn = document.getElementById('process-btn');
const resultsBox = document.getElementById('results-box');
const compressionStatus = document.getElementById('compression-status');
const originalTextArea = document.getElementById('original-text');
const translatedTextArea = document.getElementById('translated-text');
const transDirection = document.getElementById('translation-direction');

const translatedAudioElement = document.getElementById('translated-audio-element');
const downloadTranslatedBtn = document.getElementById('download-translated-btn');

let originalAudioFile = null;
let audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let translatedAudioUrl = "";

audioUpload.addEventListener('change', (e) => {
    originalAudioFile = e.target.files[0];
    if (originalAudioFile) {
        fileNameDisplay.textContent = originalAudioFile.name;
        processBtn.style.display = 'block';
        resultsBox.style.display = 'none';
        processBtn.textContent = "Start Audio Translation ⚡";
        processBtn.disabled = false;
    }
});

processBtn.addEventListener('click', async () => {
    if (!originalAudioFile) return;

    try {
        processBtn.disabled = true;
        resultsBox.style.display = 'block';
        compressionStatus.textContent = "Compressing audio file to optimize size... ⏳";
        processBtn.textContent = "Processing audio... ⏳";

        // 1. In-browser audio compression (Mono, 16000Hz)
        const arrayBuffer = await originalAudioFile.arrayBuffer();
        const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const targetSampleRate = 16000;

        const offlineCtx = new OfflineAudioContext(
            1, 
            decodedBuffer.duration * targetSampleRate,
            targetSampleRate
        );

        const bufferSource = offlineCtx.createBufferSource();
        bufferSource.buffer = decodedBuffer;
        bufferSource.connect(offlineCtx.destination);
        bufferSource.start();

        const compressedBuffer = await offlineCtx.startRendering();
        const compressedBlob = bufferToWav(compressedBuffer);

        compressionStatus.textContent = "Compression complete! Recognizing speech using AI... 🤖";
        processBtn.textContent = "Transcribing speech... ⏳";

        // 2. Extract speech text using Hugging Face's free Whisper-v3 API
        const speechToTextUrl = "https://api-inference.huggingface.co/models/openai/whisper-large-v3";
        const speechResponse = await fetch(speechToTextUrl, {
            method: "POST",
            body: compressedBlob
        });

        const speechResult = await speechResponse.json();
        if (!speechResult.text) {
            throw new Error("Could not detect any clear speech from the audio file.");
        }

        const transcriptText = speechResult.text;
        originalTextArea.value = transcriptText;

        // 3. Translate transcribed text using free Google Translate gateway
        compressionStatus.textContent = "Translating text instantly... 🌐";
        processBtn.textContent = "Translating... ⏳";

        const direction = transDirection.value;
        const sourceLang = direction === 'ar-to-en' ? 'ar' : 'en';
        const targetLang = direction === 'ar-to-en' ? 'en' : 'ar';

        const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(transcriptText)}`;
        const translateResponse = await fetch(translateUrl);
        const translateData = await translateResponse.json();
        
        let translatedText = "";
        if (translateData && translateData[0]) {
            translateData[0].forEach(sentence => {
                if (sentence[0]) translatedText += sentence[0];
            });
        }
        translatedTextArea.value = translatedText;

        // 4. Generate new translated audio (TTS) for free
        compressionStatus.textContent = "Generating new translated audio file... 🗣️";
        processBtn.textContent = "Generating voice... ⏳";

        // Using Google TTS Open API
        translatedAudioUrl = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${targetLang}&client=tw-ob&q=${encodeURIComponent(translatedText)}`;
        
        // Load generated audio to player
        translatedAudioElement.src = translatedAudioUrl;
        
        // Setup download button
        downloadTranslatedBtn.onclick = () => {
            const a = document.createElement('a');
            a.href = translatedAudioUrl;
            a.download = `Velo_Translated_${targetLang}_${Date.now()}.mp3`;
            a.target = "_blank";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        };

        compressionStatus.textContent = "Audio translation completed successfully! 🎉";
        processBtn.textContent = "Translate New File 🔄";
        processBtn.disabled = false;

    } catch (error) {
        console.error(error);
        compressionStatus.textContent = "Process failed ❌";
        alert("An error occurred: " + error.message);
        processBtn.textContent = "Retry 🔄";
        processBtn.disabled = false;
    }
});

// Helper function: Convert buffer to compressed WAV file
function bufferToWav(buffer) {
    let numOfChan = buffer.numberOfChannels,
        btwLength = buffer.length * numOfChan * 2 + 44,
        bufferArr = new ArrayBuffer(btwLength),
        view = new DataView(bufferArr),
        channels = [], i, sample, offset = 0, pos = 0;

    setUint32(0x46464952); // "RIFF"
    setUint32(btwLength - 8);
    setUint32(0x45564157); // "WAVE"
    setUint32(0x20746d66); // "fmt "
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * numOfChan * 2);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164); // "data"
    setUint32(btwLength - pos - 4);

    for (i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

    while (pos < btwLength) {
        for (i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (sample < 0 ? sample * 0x8000 : sample * 0x7FFF);
            view.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([bufferArr], { type: "audio/wav" });

    function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }
}