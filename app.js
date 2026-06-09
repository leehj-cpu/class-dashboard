let audioContext;
let analyser;
let microphone;
let javascriptNode;
let isRecording = false;
let lastAlertTime = 0; // 알림 중복 방지 타이머

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const dbDisplay = document.getElementById('db-display');
const sirenSound = document.getElementById('siren-sound');
const threshold = 70; // 70dB 기준

startBtn.addEventListener('click', async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        microphone = audioContext.createMediaStreamSource(stream);
        javascriptNode = audioContext.createScriptProcessor(2048, 1, 1);

        analyser.smoothingTimeConstant = 0.8;
        analyser.fftSize = 1024;

        microphone.connect(analyser);
        analyser.connect(javascriptNode);
        javascriptNode.connect(audioContext.destination);

        isRecording = true;
        startBtn.disabled = true;
        stopBtn.disabled = false;

        javascriptNode.onaudioprocess = () => {
            const array = new Uint8Array(analyser.frequencyBinCount);
            analyser.getByteFrequencyData(array);
            
            let values = 0;
            for (let i = 0; i < array.length; i++) { values += array[i]; }
            const decibel = Math.round(values / array.length); 

            dbDisplay.innerText = decibel + " dB";

            if (decibel > threshold) {
                triggerAlarm();
            } else {
                stopAlarm();
            }
        };
    } catch (err) {
        alert('마이크 접근 권한이 필요합니다.');
    }
});

stopBtn.addEventListener('click', () => {
    if (audioContext) {
        audioContext.close();
        isRecording = false;
        startBtn.disabled = false;
        stopBtn.disabled = true;
        stopAlarm();
        dbDisplay.innerText = "0 dB";
    }
});

function triggerAlarm() {
    document.body.classList.add('warning');
    if (sirenSound.paused) sirenSound.play();
    
    // 10초(10000ms)마다 한 번씩만 알림 발송
    const now = Date.now();
    if (now - lastAlertTime > 10000) {
        sendTeacherAlert();
        lastAlertTime = now;
    }
}

function stopAlarm() {
    document.body.classList.remove('warning');
    sirenSound.pause();
    sirenSound.currentTime = 0;
}

// 선생님께 알림을 보내는 함수
function sendTeacherAlert() {
    // 여기에 선생님 대시보드 GAS 웹앱 주소를 넣으세요
    const gasUrl = "https://script.google.com/macros/s/AKfycbxJCsXcX9o4TcrLxNBTgQDzG6nk0i2MRE51tIPr0FXe6dYDisoRvjlhULk39UEs5LEgHg/exec";
    
    // 긴급 공지 형태("[공지]...")로 보내면 대시보드 칠판에 바로 팝업이 뜹니다!
    fetch(`${gasUrl}?action=call&name=${encodeURIComponent("[공지] 🤫 교실이 시끄러워요! 조용히 해주세요!")}`)
        .then(() => console.log("선생님께 알림 전송 완료"))
        .catch(error => console.error('알림 전송 실패:', error));
}
