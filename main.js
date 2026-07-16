document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('audio-upload');
    const dropzone = document.getElementById('dropzone');
    const audio = document.getElementById('main-audio');
    const playBtn = document.getElementById('play-btn');
    const progressBar = document.getElementById('progress-bar');
    const progressFill = document.getElementById('progress-fill');
    const currentTimeText = document.getElementById('current-time');
    const durationText = document.getElementById('duration');
    const speedSlider = document.getElementById('speed-slider');
    const speedVal = document.getElementById('speed-val');
    const downloadBtn = document.getElementById('download-btn');
    const playerContainer = document.getElementById('player-container');
    const fileNameDiv = document.getElementById('file-name');

    let audioBuffer = null;

    // --- 1. ميزة السحب والإفلات (Drag & Drop) ---
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--primary-color)';
        dropzone.style.background = 'rgba(88, 166, 255, 0.05)';
    });

    dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = 'rgba(255, 255, 255, 0.01)';
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = 'var(--border-color)';
        dropzone.style.background = 'rgba(255, 255, 255, 0.01)';
        
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('audio/')) {
            fileInput.files = files;
            handleAudioFile(files[0]);
        } else {
            alert('عذراً، يرجى سحب ملف صوتي صالح فقط!');
        }
    });

    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) handleAudioFile(file);
    });

    // --- 2. معالجة وتجهيز الملف الصوتي ---
    function handleAudioFile(file) {
        fileNameDiv.textContent = 'جاري تحليل الملف الصوتي... ⏳';
        playerContainer.style.display = 'none';
        
        // ربط ملف الصوت بالمشغل الأساسي للمتصفح (للتشغيل المباشر)
        const fileURL = URL.createObjectURL(file);
        audio.src = fileURL;
        
        // قراءة الـ ArrayBuffer لمعالجة البيانات عند التحميل والتصدير
        const reader = new FileReader();
        reader.onload = function(evt) {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            ctx.decodeAudioData(evt.target.result, function(buffer) {
                audioBuffer = buffer;
                fileNameDiv.textContent = `🎵 ${file.name}`;
                playerContainer.style.display = 'flex';
            }, function(err) {
                fileNameDiv.textContent = '❌ خطأ في قراءة ملف الصوت';
                alert('عذراً، لم نتمكن من تحليل هذا النوع من الملفات الصوتية.');
            });
        };
        reader.readAsArrayBuffer(file);
    }

    // --- 3. تشغيل وإيقاف الصوت ---
    playBtn.addEventListener('click', () => {
        if (audio.paused) {
            audio.play();
            playBtn.textContent = '⏸';
        } else {
            audio.pause();
            playBtn.textContent = '▶';
        }
    });

    audio.addEventListener('timeupdate', () => {
        const pct = (audio.currentTime / audio.duration) * 100;
        progressFill.style.width = pct + '%';
        currentTimeText.textContent = formatTime(audio.currentTime);
        durationText.textContent = formatTime(audio.duration);
    });

    progressBar.addEventListener('click', (e) => {
        const rect = progressBar.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const pct = clickX / rect.width;
        audio.currentTime = pct * audio.duration;
    });

    function formatTime(secs) {
        if (isNaN(secs)) return "00:00";
        const m = Math.floor(secs / 60).toString().padStart(2, '0');
        const s = Math.floor(secs % 60).toString().padStart(2, '0');
        return `${m}:${s}`;
    }

    // --- 4. التحكم في سرعة التشغيل الفورية ---
    function updateSpeed(val) {
        audio.playbackRate = val;
        speedSlider.value = val;
        speedVal.textContent = parseFloat(val).toFixed(1);
        
        document.querySelectorAll('.speed-opt').forEach(btn => {
            if (parseFloat(btn.dataset.speed) === parseFloat(val)) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
    }

    speedSlider.addEventListener('input', (e) => {
        updateSpeed(e.target.value);
    });

    document.querySelectorAll('.speed-opt').forEach(btn => {
        btn.addEventListener('click', () => {
            updateSpeed(btn.dataset.speed);
        });
    });

    // --- 5. تصدير وتنزيل الملف الصوتي بالسرعة الجديدة ---
    downloadBtn.addEventListener('click', async () => {
        if (!audioBuffer) {
            alert('الرجاء اختيار ملف صوتي أولاً!');
            return;
        }

        downloadBtn.textContent = 'جاري معالجة السرعة وتصدير الملف... ⚡';
        downloadBtn.disabled = true;

        try {
            const rate = parseFloat(speedSlider.value);
            const numChannels = audioBuffer.numberOfChannels;
            const oldLength = audioBuffer.length;
            
            // حساب دقيق جداً لطول الملف الجديد لمنع الفراغات أو الثواني الصامتة
            const newLength = Math.round(oldLength / rate);
            const sampleRate = audioBuffer.sampleRate;

            // استخدام بيئة رندرة خارج المتصفح (Offline Audio Context)
            const offlineCtx = new OfflineAudioContext(numChannels, newLength, sampleRate);

            const source = offlineCtx.createBufferSource();
            source.buffer = audioBuffer;
            
            // تطبيق السرعة المطلوبة بشكل مباشر في المعالجة
            source.playbackRate.setValueAtTime(rate, offlineCtx.currentTime);
            source.connect(offlineCtx.destination);
            source.start(0);

            // بدء رندرة وتجميع البايتات الصوتية بالسرعة الجديدة
            const renderedBuffer = await offlineCtx.startRendering();
            
            // تحويل البفر الناتج إلى Blob بصيغة WAV
            const wavBlob = bufferToWav(renderedBuffer);
            
            // تنزيل الملف فورًا للمستخدم
            const link = document.createElement('a');
            link.href = URL.createObjectURL(wavBlob);
            link.download = `velo_speed_${rate}x.wav`;
            link.click();

        } catch (e) {
            console.error(e);
            alert('حدث خطأ غير متوقع أثناء معالجة وتنزيل الملف.');
        } finally {
            downloadBtn.textContent = '💾 تحميل الملف الصوتي المعدل';
            downloadBtn.disabled = false;
        }
    });

    // دالة تحويل قنوات الصوت (PCM Buffer) إلى هيكل ملف WAV رسمي وصالح للتشغيل الخارجي
    function bufferToWav(buffer) {
        const numOfChan = buffer.numberOfChannels,
            length = buffer.length * numOfChan * 2 + 44,
            bufferArr = new ArrayBuffer(length),
            view = new DataView(bufferArr),
            channels = [], i, sample,
            pos = 0;

        function setUint16(data) { view.setUint16(pos, data, true); pos += 2; }
        function setUint32(data) { view.setUint32(pos, data, true); pos += 4; }

        setUint32(0x46464952); // "RIFF"
        setUint32(length - 8); 
        setUint32(0x45564157); // "WAVE"
        setUint32(0x20746d66); // "fmt " subchunk
        setUint32(16);         // Chunk size
        setUint16(1);          // Linear PCM
        setUint16(numOfChan);
        setUint32(buffer.sampleRate);
        setUint32(buffer.sampleRate * 2 * numOfChan); 
        setUint16(numOfChan * 2); 
        setUint16(16);         // Bits per sample (16-bit)
        setUint32(0x61746164); // "data" subchunk
        setUint32(length - pos - 4);

        for (i = 0; i < buffer.numberOfChannels; i++) {
            channels.push(buffer.getChannelData(i));
        }

        let writeOffset = pos;
        for (i = 0; i < buffer.length; i++) {
            for (let channel = 0; channel < numOfChan; channel++) {
                sample = Math.max(-1, Math.min(1, channels[channel][i]));
                // تحويل لـ 16-bit signed integer
                sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
                view.setInt16(writeOffset, sample, true);
                writeOffset += 2;
            }
        }
        return new Blob([bufferArr], { type: 'audio/wav' });
    }
});