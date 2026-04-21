/**
 * 강동고등학교 2학년 7반 대시보드 서버 스크립트 (ver.20026-04-21-13:33)
 */

function doGet(e) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const action = (e && e.parameter) ? e.parameter.action : null;

  // --- 기존 호출 관련 기능 유지 ---
  if (action === 'call') {
    let callSheet = ss.getSheetByName("호출") || ss.insertSheet("호출");
    callSheet.appendRow([new Date(), e.parameter.name]);
    return ContentService.createTextOutput("성공").setMimeType(ContentService.MimeType.TEXT);
  }
  if (action === 'check_call') {
    return ContentService.createTextOutput(JSON.stringify(getRecentCallData(ss))).setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'clear_history') {
    const callSheet = ss.getSheetByName("호출");
    if (callSheet && callSheet.getLastRow() > 1) callSheet.deleteRows(2, callSheet.getLastRow() - 1);
    return ContentService.createTextOutput("삭제 완료").setMimeType(ContentService.MimeType.TEXT);
  }
  if (action === 'clear_student_call') {
    const callSheet = ss.getSheetByName("선생님호출");
    if (callSheet && callSheet.getLastRow() > 1) callSheet.deleteRows(2, callSheet.getLastRow() - 1);
    return ContentService.createTextOutput("삭제 완료").setMimeType(ContentService.MimeType.TEXT);
  }
  if (action === 'check_teacher_alert') {
    const callSheet = ss.getSheetByName("선생님호출");
    let newCall = null;
    if (callSheet && callSheet.getLastRow() > 1) {
      const data = callSheet.getRange(2, 1, callSheet.getLastRow() - 1, 4).getValues();
      for (let i = data.length - 1; i >= 0; i--) {
        if (data[i][3] === "미확인") {
          newCall = { name: data[i][1], reason: data[i][2] };
          callSheet.getRange(i + 2, 4).setValue("확인"); 
          break; 
        }
      }
    }
    return ContentService.createTextOutput(JSON.stringify(newCall)).setMimeType(ContentService.MimeType.JSON);
  }
  if (action === 'student_call') {
    const studentName = e.parameter.name || "이름 미입력";
    const callReason = e.parameter.reason || "사유 미입력";
    let callSheet = ss.getSheetByName("선생님호출") || ss.insertSheet("선생님호출");
    if (callSheet.getLastRow() === 0) callSheet.appendRow(["시간", "학생이름", "호출사유", "확인여부"]); 
    callSheet.appendRow([new Date(), studentName, callReason, "미확인"]);
    return ContentService.createTextOutput("호출 완료").setMimeType(ContentService.MimeType.TEXT);
  }

  // --- ✨ [수정] 알림판 & 종례 리스트 추가 기능 ---
  if (action === 'add_item') {
    const type = e.parameter.type;
    const content = e.parameter.content;

    if (type === 'notice') {
      let ntSheet = ss.getSheetByName("공지사항");
      let col = getNoticeColumnIndex(ntSheet); // 1행에서 오늘 요일 열 번호 찾기
      
      // 해당 요일 열의 가장 마지막 빈칸 찾아서 추가
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

  // --- ✨ [수정] 알림판 & 종례 리스트 롱프레스 삭제 기능 ---
  if (action === 'delete_item') {
    const type = e.parameter.type;
    const index = parseInt(e.parameter.index);

    if (type === 'notice') {
      let ntSheet = ss.getSheetByName("공지사항");
      let col = getNoticeColumnIndex(ntSheet);
      let maxRow = Math.max(2, ntSheet.getLastRow());

      // 2행부터 오늘 요일 데이터를 읽어 인덱스에 해당하는 행 찾기
      const colData = ntSheet.getRange(2, col, maxRow - 1, 1).getValues();
      let validCount = 0; let targetRow = -1;
      for (let i = 0; i < colData.length; i++) {
        if (colData[i][0] !== "") {
          if (validCount === index) { targetRow = i + 2; break; }
          validCount++;
        }
      }
      
      // 해당 행 내용 지우고, 중간 빈칸 당기기
      if (targetRow !== -1) {
        ntSheet.getRange(targetRow, col).clearContent();
        let newData = ntSheet.getRange(2, col, maxRow - 1, 1).getValues().filter(row => row[0] !== "");
        ntSheet.getRange(2, col, maxRow - 1, 1).clearContent(); 
        if(newData.length > 0) ntSheet.getRange(2, col, newData.length, 1).setValues(newData); 
      }
    } else {
      let sheet = ss.getSheetByName("종례");
      if (sheet && !isNaN(index) && index >= 0) sheet.deleteRow(index + 1);
    }
    return ContentService.createTextOutput("삭제 완료").setMimeType(ContentService.MimeType.TEXT);
  }

  // --- 기본 데이터 전송 영역 ---
  if (!action) {
    let weeklyTimetable = { 1: [], 2: [], 3: [], 4: [], 5: [] };
    let ttSheet = ss.getSheetByName("시간표");
    if (ttSheet) {
        const timetableData = ttSheet.getDataRange().getValues();
        for(let i = 1; i < timetableData.length; i++) {
          let row = timetableData[i];
          if(row[0] !== "") { for(let j=1; j<=5; j++) weeklyTimetable[j].push({ period: row[0], subject: row[j] }); }
        }
    }

    // ✨ [수정] 알림판(공지사항)을 1행의 요일을 검색하여 해당 열 2행부터 추출!
    let noticeList = [];
    let ntSheet = ss.getSheetByName("공지사항");
    if (ntSheet) {
      let col = getNoticeColumnIndex(ntSheet);
      let maxRow = Math.max(2, ntSheet.getLastRow());
      noticeList = ntSheet.getRange(2, col, maxRow - 1, 1).getValues()
                          .map(row => row[0])
                          .filter(val => val !== "");
    }

    let closingList = [];
    let closingSheet = ss.getSheetByName("종례");
    if (closingSheet && closingSheet.getLastRow() > 0) {
      closingList = closingSheet.getRange(1, 1, closingSheet.getLastRow(), 1).getValues().map(row => row[0]).filter(val => val !== "");
    }

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

    const data = {
      weeklyTimetable: weeklyTimetable,
      noticeList: noticeList,     // 정확하게 오늘 요일 열만 뽑힌 데이터
      closingList: closingList,   
      lunchMenu: getNeisMeal(),
      callStudent: getRecentCallData(ss).callStudent,
      callHistory: getRecentCallData(ss).callHistory,
      schedules: allSchedules
    };

    return ContentService.createTextOutput(JSON.stringify(data)).setMimeType(ContentService.MimeType.JSON);
  }
}

// ✨ 공지사항 1행에서 오늘 요일에 해당하는 열(Column) 번호를 찾아주는 헬퍼 함수
function getNoticeColumnIndex(sheet) {
  let dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  let actualDay = new Date().getDay();
  if(actualDay === 0 || actualDay === 6) actualDay = 1; // 주말은 월요일(1)로 취급
  let targetDayStr = dayNames[actualDay]; 
  
  let colIndex = actualDay; // 기본값
  if(sheet && sheet.getLastColumn() > 0) {
     let headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
     for(let i=0; i<headers.length; i++) {
         if(headers[i] && headers[i].toString().includes(targetDayStr)) {
             colIndex = i + 1; // 구글시트 열 번호는 1부터 시작
             break;
         }
     }
  }
  return colIndex;
}

function getRecentCallData(ss) {
  let callStudent = null; let history = [];
  const callSheet = ss.getSheetByName("호출"); 
  if (callSheet) {
    const lastRow = callSheet.getLastRow();
    if (lastRow > 1) {
      const startRow = Math.max(2, lastRow - 19); 
      const numRows = lastRow - startRow + 1;
      const data = callSheet.getRange(startRow, 1, numRows, 2).getValues();
      const lastName = data[data.length - 1][1];
      if (lastName !== "🛑 호출 종료") callStudent = lastName;
      for (let i = data.length - 1; i >= 0; i--) {
        const time = data[i][0]; const name = data[i][1];
        if (name && name !== "🛑 호출 종료") {
          const d = new Date(time);
          const hh = String(d.getHours()).padStart(2, '0'); const mm = String(d.getMinutes()).padStart(2, '0');
          history.push({ time: `${hh}:${mm}`, text: `선생님 ➔ ${name}` });
        }
        if (history.length >= 4) break; 
      }
    }
  }
  return { callStudent: callStudent, callHistory: history };
}

function getNeisMeal() {
  let today = Utilities.formatDate(new Date(), "GMT+9", "yyyyMMdd");
  const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?Type=json&ATPT_OFCDC_SC_CODE=B10&SD_SCHUL_CODE=7010117&MLSV_YMD=${today}`;
  try {
    const response = UrlFetchApp.fetch(url);
    const json = JSON.parse(response.getContentText());
    if (json.mealServiceDietInfo) {
      const mealList = json.mealServiceDietInfo[1].row;
      const lunch = mealList.find(meal => meal.MMEAL_SC_CODE === "2");
      if (lunch) return lunch.DDISH_NM.replace(/\([^)]*\)/g, "").replace(/[0-9.*]/g, "").split("<br/>").map(s => s.trim()).filter(Boolean);
    }
  } catch(e) { }
  return ["오늘은 식단이 없는 날이거나,", "나이스에 아직 등록되지 않았습니다."];
}
