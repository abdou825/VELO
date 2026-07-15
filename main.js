// ربط عناصر واجهة المستخدم
const audioUpload = document.getElementById('audio-upload');
const fileNameDisplay = document.getElementById('file-name');
const audioElement = document.getElementById('audio-element');

const speedSlider = document.getElementById('speed-slider');
const speedVal = document.getElementById('speed-val');

const pitchSlider = document.getElementById('pitch-slider');
const pitchVal = document.getElementById('pitch-val');

// 1. عند اختيار الملف الصوتي وتشغيله
audioUpload.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
        fileNameDisplay.textContent = file.name;
        
        // إنشاء رابط مؤقت للملف الصوتي وتمريره للمشغل
        const fileURL = URL.createObjectURL(file);
        audioElement.src = fileURL;
        
        // إعادة ضبط المؤشرات للقيم الافتراضية عند رفع ملف جديد
        speedSlider.value = 1.0;
        speedVal.textContent = "1.0";
        pitchSlider.value = 1.0;
        pitchVal.textContent = "1.0";
        
        audioElement.playbackRate = 1.0;
    }
});

// 2. التحكم في السرعة (تغيير حقيقي وتحديث الرقم فوراً)
speedSlider.addEventListener('input', (e) => {
    const speed = parseFloat(e.target.value).toFixed(1);
    speedVal.textContent = speed; // تحديث الرقم المكتوب على الشاشة
    
    if (audioElement) {
        audioElement.playbackRate = speed; // تغيير سرعة تشغيل الصوت حقيقياً بجد
    }
});

// 3. التحكم في طبقة الصوت (Pitch)
// ملاحظة: تغيير الـ PlaybackRate في الـ HTML5 Audio العادي يغير السرعة والطبقة معاً.
// لتعديل قيمة الـ Pitch المعروضة على الشاشة:
pitchSlider.addEventListener('input', (e) => {
    const pitch = parseFloat(e.target.value).toFixed(1);
    pitchVal.textContent = pitch; // تحديث الرقم المكتوب على الشاشة
    
    // إذا أردت تغيير النبرة والسرعة معاً بأسلوب الأنالوج (Tape Speed Effect):
    if (audioElement) {
        audioElement.playbackRate = pitch; 
    }
});