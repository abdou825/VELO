document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('audio-upload');
    const compressBtn = document.querySelector('.action-btn') || document.getElementById('compress-btn');
    const targetSizeInput = document.getElementById('target-size'); // مدخل النص لرقم الحجم المطلوب
    const sizeUnitSelect = document.getElementById('size-unit');   // قائمة اختيار (B, KB, MB, GB)
    
    let audioBuffer = null;
    let selectedFile = null;

    // --- 1. قراءة وتحليل ملف الصوت المرفوع ---
    fileInput.addEventListener('change', (e) => {
        selectedFile = e.target.files[0];
        if (selectedFile) {
            const reader = new FileReader();
            reader.onload = function(evt) {
                const ctx = new (window.AudioContext || window.webkitAudioContext)();
                ctx.decodeAudioData(evt.target.result, function(buffer) {
                    audioBuffer = buffer;
                    console.log("تم تحميل الملف بنجاح، المدة بالثواني:", buffer.duration);
                }, function(err) {
                    alert("عذراً، لم نتمكن من قراءة هذا الملف الصوتي.");
                });
            };
            reader.readAsArrayBuffer(selectedFile);
        }
    });

    // --- 2. بدء عملية الضغط والتصدير ---
    compressBtn.addEventListener('click', async () => {
        if (!audioBuffer || !selectedFile) {
            alert('الرجاء اختيار ملف صوتي لضغطه أولاً!');
            return;
        }

        // التأكد من وجود مكتبة lamejs
        if (typeof lamejs === 'undefined') {
            alert('جاري تحميل محرك التصدير، يرجى المحاولة بعد ثوانٍ قليلة.');
            return;
        }

        const rawSizeValue = parseFloat(targetSizeInput.value);
        if (isNaN(rawSizeValue) || rawSizeValue <= 0) {
            alert('الرجاء إدخال حجم مستهدف صحيح أكبر من الصفر!');
            return;
        }

        compressBtn.textContent = 'جاري ضغط الملف بالحجم المطلوب... 📉';
        compressBtn.disabled = true;

        try {
            // تحويل الحجم المطلوب إلى وحدة البايت (Bytes) كقيمة مرجعية
            const unit = sizeUnitSelect.value; // 'B', 'KB', 'MB', 'GB'
            let targetSizeBytes = rawSizeValue;

            if (unit === 'KB') targetSizeBytes = rawSizeValue * 1024;
            else if (unit === 'MB') targetSizeBytes = rawSizeValue * 1024 * 1024;
            else if (unit === 'GB') targetSizeBytes = rawSizeValue * 1024 * 1024 * 1024;

            const duration = audioBuffer.duration;

            // حساب الـ Bitrate المطلوب (بالـ kbps) بناءً على الحجم المستهدف والمدة
            // المعادلة: Bitrate = (Size_in_bytes * 8) / (Duration * 1000)
            let targetBitrate = Math.round((targetSizeBytes * 8) / (duration * 1000));

            // وضع حدود منطقية للـ MP3 Bitrate لضمان عمل ملف الصوت وسماع جودة مقبولة
            // (الحد الأدنى 32kbps للصوت البشري، والحد الأقصى الممتاز 320kbps)
            if (targetBitrate < 32) {
                targetBitrate = 32; 
                console.warn("الحجم المطلوب صغير جداً مقارنة بطول الملف، تم تعيين أقل Bitrate ممكن (32kbps).");
            } else if (targetBitrate > 320) {
                targetBitrate = 320;
                console.warn("الحجم المطلوب أكبر من سعة الملف القصوى، تم تعيين أعلى Bitrate ممكن (320kbps).");
            }

            console.log(`الـ Bitrate المحسوب لتغطية الحجم: ${targetBitrate} kbps`);

            // ضغط وتجميع ملف الـ MP3 بالـ Bitrate الجديد
            const mp3Blob = bufferToMp3(audioBuffer, targetBitrate);

            // تحميل الملف التلقائي للمستخدم
            const link = document.createElement('a');
            link.href = URL.createObjectURL(mp3Blob);
            link.download = `compressed_${targetBitrate}kbps_${selectedFile.name.split('.')[0]}.mp3`;
            link.click();

        } catch (err) {
            console.error(err);
            alert('حدث خطأ غير متوقع أثناء عملية الضغط.');
        } finally {
            compressBtn.textContent = 'بدء عملية الضغط';
            compressBtn.disabled = false;
        }
    });

    // --- 3. دالة التحويل والترميز بالـ Bitrate المتغير ---
    function bufferToMp3(buffer, bitrate) {
        const channels = buffer.numberOfChannels;
        const sampleRate = buffer.sampleRate;
        
        // تمرير الـ Bitrate المحسوب هنا دايناميكياً لتحديد حجم الملف النهائي بدقة
        const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, bitrate);
        const mp3Data = [];
        const sampleBlockSize = 1152; 

        if (channels === 2) {
            const leftData = buffer.getChannelData(0);
            const rightData = buffer.getChannelData(1);
            
            const leftInt16 = new Int16Array(leftData.length);
            const rightInt16 = new Int16Array(rightData.length);
            
            for (let i = 0; i < leftData.length; i++) {
                leftInt16[i] = leftData[i] < 0 ? leftData[i] * 0x8000 : leftData[i] * 0x7FFF;
                rightInt16[i] = rightData[i] < 0 ? rightData[i] * 0x8000 : rightData[i] * 0x7FFF;
            }

            for (let i = 0; i < leftInt16.length; i += sampleBlockSize) {
                const leftChunk = leftInt16.subarray(i, i + sampleBlockSize);
                const rightChunk = rightInt16.subarray(i, i + sampleBlockSize);
                const mp3buf = mp3encoder.encodeBuffer(leftChunk, rightChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Int8Array(mp3buf));
                }
            }
        } else {
            const monoData = buffer.getChannelData(0);
            const monoInt16 = new Int16Array(monoData.length);
            
            for (let i = 0; i < monoData.length; i++) {
                monoInt16[i] = monoData[i] < 0 ? monoData[i] * 0x8000 : monoData[i] * 0x7FFF;
            }

            for (let i = 0; i < monoInt16.length; i += sampleBlockSize) {
                const monoChunk = monoInt16.subarray(i, i + sampleBlockSize);
                const mp3buf = mp3encoder.encodeBuffer(monoChunk);
                if (mp3buf.length > 0) {
                    mp3Data.push(new Int8Array(mp3buf));
                }
            }
        }

        const endBuf = mp3encoder.flush();
        if (endBuf.length > 0) {
            mp3Data.push(new Int8Array(endBuf));
        }

        return new Blob(mp3Data, { type: 'audio/mp3' });
    }
});