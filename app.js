let audioContext;
let analyser;
let microphone;
let javascriptNode;
let isRecording = false;

const startBtn = document.getElementById('start-btn');
const stopBtn = document.getElementById('stop-btn');
const dbDisplay = document.getElementById('db-display');
const sirenSound = document.getElementById('siren-sound');
const threshold = 70; // 경고를 울릴 기준 데시벨

startBtn.addEventListener('click', async () => {
    try {
        // 마이크 권한 요청
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
            
            // 평균 소음 값 계산
            let values = 0;
            const length = array.length;
            for (let i = 0; i < length; i++) {
                values += (array[i]);
            }
            const average = values / length;
            const decibel = Math.round(average); // 보기 쉽게 반올림

            dbDisplay.innerText = decibel + " dB";

            // 데시벨 초과 시 이벤트 처리
            if (decibel > threshold) {
                triggerAlarm();
            } else {
                stopAlarm();
            }
        };
    } catch (err) {
        alert('마이크 접근 권한이 필요합니다.');
        console.error(err);
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
    if (sirenSound.paused) {
        sirenSound.play();
        sendTeacherAlert(); // 교사 알림 함수 호출
    }
}

function stopAlarm() {
    document.body.classList.remove('warning');
    sirenSound.pause();
    sirenSound.currentTime = 0;
}

// 3단계에서 사용할 알림 전송 함수
function sendTeacherAlert() {
    // 알림이 너무 자주 가는 것을 방지하는 타이머 로직이 추가되면 좋습니다.
    console.log("교사에게 알림 전송!"); 
}

function sendTeacherAlert() {
    const gasUrl = "https://script.google.com/macros/s/AKfycbwdExiVmGNk2diA0gq-ZQ4HSNuickE0tty6gmLoGlfNDGJW_IY4Wi8gWQZDC2rtnYMPVg/execL";
    fetch(gasUrl, {
        method: "POST",
    }).catch(error => console.error('알림 전송 실패:', error));
}