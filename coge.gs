/**
 * =========================================================================
 * 🏫 강동고등학교 2학년 7반 스마트 대시보드 백엔드 (GAS)
 * 마지막 업데이트: 2026-04-21 (웹훅 응답 및 팝업 자동 종료 기능 추가)
 * =========================================================================
 */

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = (e && e.parameter) ? e.parameter.action : null;

  // =========================================================================
  // [1] 👨‍🏫 선생님 -> 학생 호출 및 공지 기능 (remote.html -> 칠판)
  // =========================================================================
  
  // 1-1. 선생님이 학생을 호출하거나 긴급 공지를 보낼 때
  if (action === 'call') {
    let callSheet = ss.getSheetByName("호출") || ss.insertSheet("호출");
    // 시트에 현재 시간과 이름(또는 [공지]메시지)을 기록합니다.
    callSheet.appendRow([new Date(), e.parameter.name]);
    return ContentService.createTextOutput("성공").setMimeType(ContentService.MimeType.TEXT);
  }
  
  // 1-2. 교실 칠판이 3초마다 "선생님이 부른 사람 있나?" 확인
  if (action === 'check_call') {
    return ContentService.createTextOutput(JSON.stringify(getRecentCallData(ss))).setMimeType(ContentService.MimeType.JSON);
  }
  
  // 1-3. 칠판 하단의 '최근 호출 내역' 시트 비우기
  if (action === 'clear_history') {
    const callSheet = ss.getSheetByName("호출");
    if (callSheet && callSheet.getLastRow() > 1) callSheet.deleteRows(2, callSheet.getLastRow() - 1);
    return ContentService.createTextOutput("삭제 완료").setMimeType(ContentService.MimeType.TEXT);
  }


  // =========================================================================
  // [2] 🙋‍♂️ 학생 -> 선생님 호출 기능 (칠판 -> remote.html)
  // =========================================================================

  // 2-1. 학생이 칠판에서 선생님을 호출할 때 (웹훅 & 이메일 동시 발송)
  if (action === 'student_call') {
    const studentName = e.parameter.name || "이름 미입력";
    const callReason = e.parameter.reason || "사유 미입력";
    
    // A. 구글 시트에 기록
    let callSheet = ss.getSheetByName("선생님호출") || ss.insertSheet("선생님호출");
    if (callSheet.getLastRow() === 0) callSheet.appendRow(["시간", "학생이름", "호출사유", "확인여부"]); 
    callSheet.appendRow([new Date(), studentName, callReason, "미확인"]);

    // B. 구글 챗 웹훅 발송 (선생님 채팅방으로 알림)
    const webhookUrl = "https://chat.googleapis.com/v1/spaces/AAQA5wh_Zy0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=vC9X63QQ4FuDBIEFfn3ryIJSTEGem-z1bM-OSh4W3cQ"; 
    const payload = { "text": `🚨 *[2학년 7반 학생 호출]*\n👤 *학생*: ${studentName}\n💬 *사유*: ${callReason}` };
    try { UrlFetchApp.fetch(webhookUrl, { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload) }); } catch(err) {}

    // C. 이메일 발송
    const myEmail = "26-207@kangdong.sen.hs.kr, leehyeonju1@gmail.com";  
    try {
      MailApp.sendEmail({
        to: myEmail,
        subject: `🚨 [2-7 대시보드] ${studentName} 학생의 긴급 호출!`,
        body: `호출한 학생: ${studentName}\n호출 사유: ${callReason}\n\n지금 리모컨 화면이나 대시보드 시트를 확인해 주세요.`
      });
    } catch(err) {}

    return ContentService.createTextOutput("호출 완료").setMimeType(ContentService.MimeType.TEXT);
  }

  // 2-2. 선생님 PC(remote.html)가 2초마다 "학생이 부른거 있나?" 확인
  if (action === 'check_teacher_alert') {
    const callSheet = ss.getSheetByName("선생님호출");
    let newCall = null;
    if (callSheet && callSheet.getLastRow() > 1) {
      const data = callSheet.getRange(2, 1, callSheet.getLastRow() - 1, 4).getValues();
      // 가장 오래된 '미확인' 내역부터 찾아서 알림
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i][3] === "미확인") {
          newCall = { name: data[i][1], reason: data[i][2] };
          callSheet.getRange(i + 2, 4).setValue("확인"); // 한 번 알린 건 '확인'으로 변경
          break; 
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify(newCall)).setMimeType(ContentService.MimeType.JSON);
  }

  // 2-3. 선생님 PC에서 학생 호출 내역 시트 비우기
  if (action === 'clear_student_call') {
    const callSheet = ss.getSheetByName("선생님호출");
    if (callSheet && callSheet.getLastRow() > 1) callSheet.deleteRows(2, callSheet.getLastRow() - 1);
    return ContentService.createTextOutput("삭제 완료").setMimeType(ContentService.MimeType.TEXT);
  }


  // =========================================================================
  // [3] 💬 학생 -> 선생님 응답 기능 (칠판에서 팝업 응답 시) - ✨ NEW!
  // =========================================================================
  
  if (action === 'student_reply') {
    const replyType = e.parameter.type; // 'call'(호출확인) 또는 'notice'(공지답장)
    const studentName = e.parameter.name || "학생";
    const replyMsg = e.parameter.reply || "";
    
    // 선생님 구글 챗으로 바로 쏴주는 웹훅 주소
    const webhookUrl = "https://chat.googleapis.com/v1/spaces/AAQA5wh_Zy0/messages?key=AIzaSyDdI0hCZtE6vySjMm-WEfRq3CPzqKqqsHI&token=vC9X63QQ4FuDBIEFfn3ryIJSTEGem-z1bM-OSh4W3cQ";
    
    // 메시지 내용 조립
    let payloadText = "";
    if (replyType === 'call') {
      payloadText = `✅ *[호출 확인 완료]*\n👤 *${studentName}* 학생이 칠판 호출을 확인했습니다! 🏃‍♂️`;
    } else if (replyType === 'notice') {
      payloadText = `💬 *[공지 학생 응답]*\n🏫 교실에서 온 메시지:\n"${replyMsg}"`;
    }

    // 웹훅 발송 실행
    const payload = { "text": payloadText };
    try { UrlFetchApp.fetch(webhookUrl, { "method": "post", "contentType": "application/json", "payload": JSON.stringify(payload) }); } catch(err) {}

    // ✨ 핵심: 응답을 완료했으므로 칠판에 떠있는 팝업을 자동으로 닫습니다.
    let callSheet = ss.getSheetByName("호출");
    if (callSheet) {
      callSheet.appendRow([new Date(), "🛑 호출 종료"]); // 종료 신호를 줘서 칠판이 팝업을 내리게 함
    }

    return ContentService.createTextOutput("응답 완료").setMimeType(ContentService.MimeType.TEXT);
  }


  // =========================================================================
  // [4] 📢 알림판 & 종례 리스트 관리 (추가 / 수정 / 삭제)
  // =========================================================================
  
  // 4-1. 항목 추가
  if (action === 'add_item') {
    const type = e.parameter.type;
    const content = e.parameter.content;

    if (type === 'notice') {
      let ntSheet = ss.getSheetByName("공지사항");
      let col = getNoticeColumnIndex(ntSheet); // 오늘 요일 열 찾기
      // 해당 요일 열의 맨 밑 빈칸 찾아서 넣기
      let colData = ntSheet.getRange(1, col, Math.max(1, ntSheet.getLastRow()), 1).getValues();
      let lastRowInCol = 1;
      for(let i=0; i<colData.length; i++) { if(colData[i][0]) lastRowInCol = i + 1; }
      ntSheet.getRange(lastRowInCol + 1, col).setValue(content);
    } else {
      let targetSheet = ss.getSheetByName("종례") || ss.insertSheet("종례");
      targetSheet.appendRow([content]); 
    }
    return ContentService.createTextOutput("추가 완료").setMimeType(ContentService.MimeType.TEXT);
  }

  // 4-2. 항목 수정 (클릭 시)
  if (action === 'edit_item') {
    const type = e.parameter.type;
    const index = parseInt(e.parameter.index);
    const content = e.parameter.content;

    if (type === 'notice') {
      let ntSheet = ss.getSheetByName("공지사항");
      let col = getNoticeColumnIndex(ntSheet);
      let maxRow = Math.max(2, ntSheet.getLastRow());

      const colData = ntSheet.getRange(2, col, maxRow - 1, 1).getValues();
      let validCount = 0; let targetRow = -1;
      for (let i = 0; i < colData.length; i++) {
        if (colData[i][0] !== "") {
          if (validCount === index) { targetRow = i + 2; break; }
          validCount++;
        }
      }
      if (targetRow !== -1) ntSheet.getRange(targetRow, col).setValue(content);
    } else {
      let sheet = ss.getSheetByName("종례");
      if (sheet && !isNaN(index) && index >= 0) sheet.getRange(index + 1, 1).setValue(content);
    }
    return ContentService.createTextOutput("수정 완료").setMimeType(ContentService.MimeType.TEXT);
  }

  // 4-3. 항목 삭제 (길게 누르기)
  if (action === 'delete_item') {
    const type = e.parameter.type;
    const index = parseInt(e.parameter.index);

    if (type === 'notice') {
      let ntSheet = ss.getSheetByName("공지사항");
      let col = getNoticeColumnIndex(ntSheet);
      let maxRow = Math.max(2, ntSheet.getLastRow());

      const colData = ntSheet.getRange(2, col, maxRow - 1, 1).getValues();
      let validCount = 0; let targetRow = -1;
      for (let i = 0; i < colData.length; i++) {
        if (colData[i][0] !== "") {
          if (validCount === index) { targetRow = i + 2; break; }
          validCount++;
        }
      }
      
      if (targetRow !== -1) {
        ntSheet.getRange(targetRow, col).clearContent(); // 지우고
        let newData = ntSheet.getRange(2, col, maxRow - 1, 1).getValues().filter(row => row[0] !== ""); // 빈칸 땡기기
        ntSheet.getRange(2, col, maxRow - 1, 1).clearContent(); 
        if(newData.length > 0) ntSheet.getRange(2, col, newData.length, 1).setValues(newData); 
      }
    } else {
      let sheet = ss.getSheetByName("종례");
      if (sheet && !isNaN(index) && index >= 0) sheet.deleteRow(index + 1);
    }
    return ContentService.createTextOutput("삭제 완료").setMimeType(ContentService.MimeType.TEXT);
  }


  // =========================================================================
  // [5] 📊 대시보드 화면 렌더링용 기본 데이터 전체 조회 (fetchData 대응)
  // =========================================================================
  
  if (!action) {
    // 5-1. 시간표 데이터 가져오기
    let weeklyTimetable = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    let ttSheet = ss.getSheetByName("시간표");
    if (ttSheet) {
        const timetableData = ttSheet.getDataRange().getValues();
        for(let i = 1; i < timetableData.length; i++) {
          let row = timetableData[i];
          if(row[0] !== "") { for(let j=1; j<=5; j++) weeklyTimetable[j].push({ period: row[0], subject: row[j] }); }
        }
    }

    // 5-2. 오늘 요일에 맞는 알림판 데이터 가져오기
    let noticeList = [];
    let ntSheet = ss.getSheetByName("공지사항");
    if (ntSheet) {
      let col = getNoticeColumnIndex(ntSheet);
      let maxRow = Math.max(2, ntSheet.getLastRow());
      noticeList = ntSheet.getRange(2, col, maxRow - 1, 1).getValues()
                          .map(row => row[0])
                          .filter(val => val !== "");
    }

    // 5-3. 종례 데이터 가져오기
    let closingList = [];
    let closingSheet = ss.getSheetByName("종례");
    if (closingSheet && closingSheet.getLastRow() > 0) {
      closingList = closingSheet.getRange(1, 1, closingSheet.getLastRow(), 1).getValues().map(row => row[0]).filter(val => val !== "");
    }

    // 5-4. 구글 캘린더에서 학급 일정 및 공휴일 가져오기
    const calendarIds = ["26-207@kangdong.sen.hs.kr", "ko.south_korea#holiday@group.v.calendar.google.com"];
    const now = new Date();
    const startTime = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endTime = new Date(now.getFullYear(), now.getMonth() + 2, 0);
    let allSchedules = [];
    
    calendarIds.forEach(id => {
      try {
          const cal = CalendarApp.getCalendarById(id);
          if (cal) {
            const calColor = cal.getColor(); 
            const events = cal.getEvents(startTime, endTime);
            const schedules = events.map(event => {
              let isAllDay = event.isAllDayEvent();
              let startDateStr = ""; let endDateStr = "";
              if (isAllDay) {
                startDateStr = Utilities.formatDate(event.getAllDayStartDate(), "GMT+9", "yyyy-MM-dd'T'00:00:00");
                let rawEndDate = event.getAllDayEndDate();
                rawEndDate.setDate(rawEndDate.getDate() - 1); 
                endDateStr = Utilities.formatDate(rawEndDate, "GMT+9", "yyyy-MM-dd'T'23:59:59");
              } else {
                startDateStr = Utilities.formatDate(event.getStartTime(), "GMT+9", "yyyy-MM-dd'T'HH:mm:ss");
                endDateStr = Utilities.formatDate(event.getEndTime(), "GMT+9", "yyyy-MM-dd'T'HH:mm:ss");
              }
              return { date: startDateStr, endDate: endDateStr, event: event.getTitle(), color: event.getColor() || calColor, isAllDay: isAllDay };
            });
            allSchedules = allSchedules.concat(schedules);
          }
      } catch(e) {}
    });

    // 5-5. 모든 데이터를 JSON 형태로 묶어서 칠판으로 전송
    const data = {
      weeklyTimetable: weeklyTimetable,
      noticeList: noticeList,      
      closingList: closingList,   
      lunchMenu: getNeisMeal(), // 헬퍼 함수 3번 호출
      callStudent: getRecentCallData(ss).callStudent,
      callHistory: getRecentCallData(ss).callHistory,
      schedules: allSchedules
    };

    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
}


// =========================================================================
// 🛠️ 헬퍼 함수 영역 (내부 계산용 보조 함수들)
// =========================================================================

// 헬퍼 함수 1: 알림판 시트에서 '오늘 요일'에 해당하는 열(Column) 번호 찾기
function getNoticeColumnIndex(sheet) {
  let dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  let actualDay = new Date().getDay();
  if(actualDay === 0 || actualDay === 6) actualDay = 1; // 주말은 월요일(1) 데이터 표시
  let targetDayStr = dayNames[actualDay]; 
  
  let colIndex = actualDay; 
  if(sheet && sheet.getLastColumn() > 0) {
     let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
     for(let i=0; i<headers.length; i++) {
         if(headers[i] && headers[i].toString().includes(targetDayStr)) {
             colIndex = i + 1; 
             break;
         }
     }
  }
  return colIndex;
}

// 헬퍼 함수 2: 최근 선생님 -> 학생 호출 내역 추출 및 [공지] 태그 구분 
function getRecentCallData(ss) {
  let callStudent = null; let history = [];
  const callSheet = ss.getSheetByName("호출"); 
  if (callSheet) {
    const lastRow = callSheet.getLastRow();
    if (lastRow > 1) {
      // 성능을 위해 최근 20줄만 읽어옵니다.
      const startRow = Math.max(2, lastRow - 19); 
      const numRows = lastRow - startRow + 1;
      const data = callSheet.getRange(startRow, 1, numRows, 2).getValues();
      
      // 맨 마지막에 기록된 사람이 누군지 확인 (팝업용)
      const lastName = data[data.length - 1][1];
      if (lastName !== "🛑 호출 종료") callStudent = lastName;
      
      // 하단 히스토리 리스트 역순 생성 (최근 4개까지만)
      for (let i = data.length - 1; i >= 0; i--) {
        const time = data[i][0]; const name = data[i][1];
        if (name && name !== "🛑 호출 종료") {
          const d = new Date(time);
          const hh = String(d.getHours()).padStart(2, '0'); const mm = String(d.getMinutes()).padStart(2, '0');
          
          // 긴급 공지인지 일반 호출인지 구분해서 히스토리에 기록
          if(name.startsWith("[공지]")) {
             history.push({ time: `${hh}:${mm}`, text: `✉️ 공지 ➔ ${name.replace("[공지]", "")}` });
          } else {
             history.push({ time: `${hh}:${mm}`, text: `선생님 ➔ ${name}` });
          }
        }
        if (history.length >= 4) break; 
      }
    }
  }
  return { callStudent: callStudent, callHistory: history };
}

// 헬퍼 함수 3: 나이스(NEIS) API에서 오늘 중식 급식 정보 가져오기
function getNeisMeal() {
  let today = Utilities.formatDate(new Date(), "GMT+9", "yyyyMMdd");
  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010117&MLSV_YMD=${today}`;
  try {
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());
    if (json.mealServiceDietInfo) {
      const mealList = json.mealServiceDietInfo[1].row;
      const lunch = mealList.find(meal => meal.MMEAL_SC_CODE === "2"); // 2는 중식을 의미
      // 알러지 번호나 괄호 내용 싹 지우고 깔끔한 음식 이름만 배열로 리턴
      if (lunch) return lunch.DDISH_NM.replace(/\([^)]*\)/g, "").replace(/[0-9.*]/g, "").split("<br/>").map(s => s.trim()).filter(Boolean);
    }
  } catch(e) { }
  return ["오늘은 식단이 없는 날이거나,", "나이스에 아직 등록되지 않았습니다."];
}
