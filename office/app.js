(function () {
  const PASSWORD_HASH = "03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4";
  const INSAMTONG_URL = "https://insamtong.kr/";
  const MARKET_PROXY_URL = "https://api.allorigins.win/raw?url=" + encodeURIComponent(INSAMTONG_URL);
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  const storageKeys = {
    authed: "ginsengOfficeAuthed",
    inventory: "ginsengOfficeInventory",
    schedule: "ginsengOfficeSchedule",
    memos: "ginsengOfficeMemos",
    prices: "ginsengOfficePrices",
    market: "ginsengOfficeMarket"
  };

  const initialInventory = [
    { item: "수삼", grade: "특대", quantity: 24, location: "저온창고 A" },
    { item: "수삼", grade: "대", quantity: 38, location: "저온창고 B" },
    { item: "홍삼 제품", grade: "선물세트", quantity: 16, location: "매장 진열" }
  ];

  const initialSchedule = [
    { date: todayISO(), time: "09:00", title: "출고 재고 확인", owner: "업무팀" },
    { date: addDaysISO(1), time: "14:00", title: "가격표 점검", owner: "판매팀" }
  ];

  const initialPrices = [
    { name: "강화 수삼", unit: "1채", price: 58000, memo: "등급별 변동" },
    { name: "홍삼정", unit: "240g", price: 120000, memo: "매장 기준" },
    { name: "홍삼 절편", unit: "10팩", price: 45000, memo: "행사 제외" }
  ];

  const fallbackMarket = [
    { label: "수삼 특대", price: "시세 확인 필요", source: "인삼통" },
    { label: "수삼 대", price: "시세 확인 필요", source: "인삼통" },
    { label: "수삼 중", price: "시세 확인 필요", source: "인삼통" }
  ];

  const state = {
    inventory: loadList(storageKeys.inventory, initialInventory),
    schedule: loadList(storageKeys.schedule, initialSchedule),
    memos: loadObject(storageKeys.memos, {}),
    prices: loadList(storageKeys.prices, initialPrices),
    market: loadMarket()
  };

  const els = {
    loginScreen: document.getElementById("loginScreen"),
    workspace: document.getElementById("workspace"),
    loginForm: document.getElementById("loginForm"),
    passwordInput: document.getElementById("passwordInput"),
    loginMessage: document.getElementById("loginMessage"),
    logoutButton: document.getElementById("logoutButton"),
    menuButtons: Array.from(document.querySelectorAll(".menu-button")),
    views: Array.from(document.querySelectorAll(".view")),
    viewTitle: document.getElementById("viewTitle"),
    todayStamp: document.getElementById("todayStamp"),
    inventoryForm: document.getElementById("inventoryForm"),
    addInventoryButton: document.getElementById("addInventoryButton"),
    inventoryRows: document.getElementById("inventoryRows"),
    scheduleForm: document.getElementById("scheduleForm"),
    addScheduleButton: document.getElementById("addScheduleButton"),
    scheduleList: document.getElementById("scheduleList"),
    memoDate: document.getElementById("memoDate"),
    memoText: document.getElementById("memoText"),
    saveMemoButton: document.getElementById("saveMemoButton"),
    voiceMemoButton: document.getElementById("voiceMemoButton"),
    deleteMemoButton: document.getElementById("deleteMemoButton"),
    memoStatus: document.getElementById("memoStatus"),
    memoList: document.getElementById("memoList"),
    priceForm: document.getElementById("priceForm"),
    addPriceButton: document.getElementById("addPriceButton"),
    priceRows: document.getElementById("priceRows"),
    refreshMarketButton: document.getElementById("refreshMarketButton"),
    marketRows: document.getElementById("marketRows"),
    marketMessage: document.getElementById("marketMessage"),
    marketUpdatedAt: document.getElementById("marketUpdatedAt"),
    nextRefreshAt: document.getElementById("nextRefreshAt")
  };

  boot();

  function boot() {
    els.todayStamp.textContent = formatDateTime(new Date());
    bindEvents();
    renderAll();
    if (sessionStorage.getItem(storageKeys.authed) === "1") {
      showWorkspace();
    }
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const passwordHash = await sha256(els.passwordInput.value);
      if (passwordHash === PASSWORD_HASH) {
        sessionStorage.setItem(storageKeys.authed, "1");
        els.loginMessage.textContent = "";
        showWorkspace();
        return;
      }
      els.loginMessage.textContent = "비밀번호가 맞지 않습니다.";
      els.passwordInput.select();
    });

    els.logoutButton.addEventListener("click", function () {
      sessionStorage.removeItem(storageKeys.authed);
      els.workspace.hidden = true;
      els.loginScreen.hidden = false;
      els.passwordInput.value = "";
      els.passwordInput.focus();
    });

    els.menuButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        switchView(button.dataset.view, button.textContent);
      });
    });

    els.addInventoryButton.addEventListener("click", function () {
      addFromForm(els.inventoryForm, state.inventory, storageKeys.inventory, renderInventory);
    });
    els.inventoryForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addFromForm(els.inventoryForm, state.inventory, storageKeys.inventory, renderInventory);
    });

    els.addScheduleButton.addEventListener("click", function () {
      addFromForm(els.scheduleForm, state.schedule, storageKeys.schedule, renderSchedule);
    });
    els.scheduleForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addFromForm(els.scheduleForm, state.schedule, storageKeys.schedule, renderSchedule);
    });

    els.addPriceButton.addEventListener("click", function () {
      addFromForm(els.priceForm, state.prices, storageKeys.prices, renderPrices);
    });
    els.priceForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addFromForm(els.priceForm, state.prices, storageKeys.prices, renderPrices);
    });

    els.memoDate.value = todayISO();
    els.memoDate.addEventListener("change", loadSelectedMemo);
    els.saveMemoButton.addEventListener("click", saveCurrentMemo);
    els.deleteMemoButton.addEventListener("click", deleteCurrentMemo);
    setupVoiceMemo();

    els.refreshMarketButton.addEventListener("click", function () {
      refreshMarket(true);
    });
  }

  function showWorkspace() {
    els.loginScreen.hidden = true;
    els.workspace.hidden = false;
    maybeAutoRefreshMarket();
  }

  function switchView(viewId, title) {
    els.menuButtons.forEach(function (button) {
      button.classList.toggle("active", button.dataset.view === viewId);
    });
    els.views.forEach(function (view) {
      view.classList.toggle("active-view", view.id === viewId);
    });
    els.viewTitle.textContent = title;
    if (viewId === "marketView") {
      maybeAutoRefreshMarket();
    }
  }

  function renderAll() {
    renderInventory();
    renderSchedule();
    renderMemos();
    renderPrices();
    renderMarket();
  }

  function addFromForm(form, list, key, render) {
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries());
    if (data.quantity) data.quantity = Number(data.quantity);
    if (data.price) data.price = Number(data.price);
    list.push(data);
    saveList(key, list);
    form.reset();
    render();
  }

  function renderInventory() {
    els.inventoryRows.innerHTML = "";
    if (!state.inventory.length) {
      els.inventoryRows.appendChild(emptyRow(5, "등록된 재고가 없습니다."));
      return;
    }
    state.inventory.forEach(function (row, index) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td>";
      tr.children[0].textContent = row.item;
      tr.children[1].textContent = row.grade;
      tr.children[2].textContent = Number(row.quantity).toLocaleString("ko-KR");
      tr.children[3].textContent = row.location || "-";
      tr.children[4].appendChild(deleteButton(function () {
        state.inventory.splice(index, 1);
        saveList(storageKeys.inventory, state.inventory);
        renderInventory();
      }));
      els.inventoryRows.appendChild(tr);
    });
  }

  function renderSchedule() {
    els.scheduleList.innerHTML = "";
    if (!state.schedule.length) {
      const empty = document.createElement("div");
      empty.className = "notice";
      empty.textContent = "등록된 일정이 없습니다.";
      els.scheduleList.appendChild(empty);
      return;
    }
    state.schedule
      .slice()
      .sort(function (a, b) {
        return (a.date + " " + (a.time || "")).localeCompare(b.date + " " + (b.time || ""));
      })
      .forEach(function (row) {
        const index = state.schedule.indexOf(row);
        const item = document.createElement("article");
        item.className = "schedule-item";
        item.innerHTML = '<div class="schedule-date"></div><div><div class="schedule-title"></div><div class="schedule-owner"></div></div><div></div>';
        item.querySelector(".schedule-date").textContent = row.date + (row.time ? " " + row.time : "");
        item.querySelector(".schedule-title").textContent = row.title;
        item.querySelector(".schedule-owner").textContent = row.owner || "담당자 미지정";
        item.lastElementChild.appendChild(deleteButton(function () {
          state.schedule.splice(index, 1);
          saveList(storageKeys.schedule, state.schedule);
          renderSchedule();
        }));
        els.scheduleList.appendChild(item);
      });
  }

  function loadSelectedMemo() {
    const date = els.memoDate.value || todayISO();
    const memo = state.memos[date];
    els.memoText.value = memo ? memo.text : "";
    els.memoStatus.textContent = memo
      ? "마지막 저장: " + formatDateTime(new Date(memo.updatedAt))
      : "선택한 날짜에 저장된 메모가 없습니다.";
  }

  function saveCurrentMemo() {
    const date = els.memoDate.value || todayISO();
    const text = els.memoText.value.trim();
    if (!text) {
      els.memoStatus.textContent = "메모 내용을 입력한 뒤 저장해 주세요.";
      return;
    }
    state.memos[date] = {
      text: text,
      updatedAt: new Date().toISOString()
    };
    saveObject(storageKeys.memos, state.memos);
    renderMemos();
    els.memoStatus.textContent = "저장되었습니다: " + formatDateTime(new Date(state.memos[date].updatedAt));
  }

  function deleteCurrentMemo() {
    const date = els.memoDate.value || todayISO();
    if (!state.memos[date]) {
      els.memoStatus.textContent = "삭제할 메모가 없습니다.";
      return;
    }
    delete state.memos[date];
    saveObject(storageKeys.memos, state.memos);
    els.memoText.value = "";
    renderMemos();
    els.memoStatus.textContent = "선택한 날짜의 메모를 삭제했습니다.";
  }

  function renderMemos() {
    els.memoList.innerHTML = "";
    loadSelectedMemo();
    const dates = Object.keys(state.memos).sort(function (a, b) {
      return b.localeCompare(a);
    });
    if (!dates.length) {
      const empty = document.createElement("div");
      empty.className = "empty-state memo-empty";
      empty.textContent = "저장된 메모가 없습니다.";
      els.memoList.appendChild(empty);
      return;
    }
    dates.forEach(function (date) {
      const memo = state.memos[date];
      const button = document.createElement("button");
      button.type = "button";
      button.className = "memo-list-item";
      button.innerHTML = "<strong></strong><span></span>";
      button.querySelector("strong").textContent = date;
      button.querySelector("span").textContent = previewText(memo.text);
      button.addEventListener("click", function () {
        els.memoDate.value = date;
        loadSelectedMemo();
      });
      els.memoList.appendChild(button);
    });
  }

  function setupVoiceMemo() {
    if (!SpeechRecognition) {
      els.voiceMemoButton.disabled = true;
      els.voiceMemoButton.textContent = "음성 입력 불가";
      els.memoStatus.textContent = "이 브라우저는 음성 입력을 지원하지 않습니다. Chrome 또는 Edge에서 이용해 주세요.";
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "ko-KR";
    recognition.continuous = true;
    recognition.interimResults = true;
    let isListening = false;
    let processedFinalResults = new Set();

    els.voiceMemoButton.addEventListener("click", function () {
      if (isListening) {
        recognition.stop();
        return;
      }
      processedFinalResults = new Set();
      recognition.start();
    });

    recognition.addEventListener("start", function () {
      isListening = true;
      els.voiceMemoButton.classList.add("listening");
      els.voiceMemoButton.textContent = "음성 입력 중지";
      els.memoStatus.textContent = "듣고 있습니다. 말한 내용이 메모에 추가됩니다.";
    });

    recognition.addEventListener("result", function (event) {
      const finalParts = [];
      let interimTranscript = "";
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const transcript = event.results[index][0].transcript.trim();
        if (event.results[index].isFinal) {
          if (transcript && !processedFinalResults.has(index)) {
            processedFinalResults.add(index);
            finalParts.push(transcript);
          }
        } else {
          interimTranscript += transcript + " ";
        }
      }
      if (finalParts.length) {
        appendMemoText(finalParts.join(" "));
        els.memoStatus.textContent = "음성 문장을 메모에 추가했습니다.";
      }
      if (interimTranscript) {
        els.memoStatus.textContent = "인식 중: " + interimTranscript.trim();
      }
    });

    recognition.addEventListener("end", function () {
      isListening = false;
      els.voiceMemoButton.classList.remove("listening");
      els.voiceMemoButton.textContent = "음성 입력";
      if (!els.memoStatus.textContent.startsWith("인식 오류")) {
        els.memoStatus.textContent = "음성 입력이 종료되었습니다. 필요하면 저장 버튼을 눌러 주세요.";
      }
    });

    recognition.addEventListener("error", function (event) {
      isListening = false;
      els.voiceMemoButton.classList.remove("listening");
      els.voiceMemoButton.textContent = "음성 입력";
      els.memoStatus.textContent = voiceErrorMessage(event.error);
    });
  }

  function renderPrices() {
    els.priceRows.innerHTML = "";
    if (!state.prices.length) {
      els.priceRows.appendChild(emptyRow(5, "등록된 가격표가 없습니다."));
      return;
    }
    state.prices.forEach(function (row, index) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td>";
      tr.children[0].textContent = row.name;
      tr.children[1].textContent = row.unit;
      tr.children[2].textContent = formatWon(row.price);
      tr.children[3].textContent = row.memo || "-";
      tr.children[4].appendChild(deleteButton(function () {
        state.prices.splice(index, 1);
        saveList(storageKeys.prices, state.prices);
        renderPrices();
      }));
      els.priceRows.appendChild(tr);
    });
  }

  function renderMarket() {
    const rows = state.market.rows && state.market.rows.length ? state.market.rows : fallbackMarket;
    els.marketRows.innerHTML = "";
    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td>";
      tr.children[0].textContent = row.label;
      tr.children[1].textContent = row.price;
      tr.children[2].textContent = row.source;
      els.marketRows.appendChild(tr);
    });
    els.marketUpdatedAt.textContent = state.market.updatedAt ? formatDateTime(new Date(state.market.updatedAt)) : "-";
    els.nextRefreshAt.textContent = formatDateTime(nextEightAM());
    els.marketMessage.textContent = state.market.message || "시세표 화면을 열면 오늘 오전 8시 이후 갱신 여부를 확인합니다.";
  }

  function maybeAutoRefreshMarket() {
    if (shouldRefreshMarket()) {
      refreshMarket(false);
    }
  }

  function shouldRefreshMarket() {
    const last = state.market.updatedAt ? new Date(state.market.updatedAt) : null;
    const todayEight = todayEightAM();
    return new Date() >= todayEight && (!last || last < todayEight);
  }

  async function refreshMarket(manual) {
    els.marketMessage.textContent = "인삼통 시세를 불러오는 중입니다.";
    try {
      const response = await fetch(MARKET_PROXY_URL, { cache: "no-store" });
      if (!response.ok) throw new Error("proxy response " + response.status);
      const html = await response.text();
      const parsedRows = parseMarketRows(html);
      state.market = {
        updatedAt: new Date().toISOString(),
        rows: parsedRows.length ? parsedRows : fallbackMarket,
        message: parsedRows.length
          ? "인삼통 사이트에서 읽은 텍스트를 기준으로 시세 후보를 갱신했습니다."
          : "인삼통 접속은 되었지만 가격 항목을 자동 식별하지 못했습니다. 사이트를 열어 직접 확인해 주세요."
      };
    } catch (error) {
      state.market = {
        updatedAt: manual ? new Date().toISOString() : state.market.updatedAt,
        rows: state.market.rows && state.market.rows.length ? state.market.rows : fallbackMarket,
        message: "브라우저에서 인삼통 시세를 바로 가져오지 못했습니다. 네트워크 또는 사이트 보안 정책 때문일 수 있습니다."
      };
    }
    localStorage.setItem(storageKeys.market, JSON.stringify(state.market));
    renderMarket();
  }

  function parseMarketRows(html) {
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    const pricePattern = /((?:수삼|인삼|원삼|난발|파삼|특대|대|중|소|왕대)[^0-9]{0,20})([0-9]{1,3}(?:,[0-9]{3})+|[0-9]{4,7})\s*원?/g;
    const rows = [];
    const seen = new Set();
    let match = pricePattern.exec(text);
    while (match && rows.length < 12) {
      const label = match[1].trim().replace(/[|:·-]+$/g, "") || "인삼 시세";
      const price = match[2].replace(/\B(?=(\d{3})+(?!\d))/g, ",") + "원";
      const key = label + price;
      if (!seen.has(key)) {
        seen.add(key);
        rows.push({ label: label, price: price, source: "인삼통" });
      }
      match = pricePattern.exec(text);
    }
    return rows;
  }

  function deleteButton(onClick) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "delete-button";
    button.textContent = "삭제";
    button.addEventListener("click", onClick);
    return button;
  }

  function emptyRow(colspan, text) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");
    td.colSpan = colspan;
    td.className = "empty-state";
    td.textContent = text;
    tr.appendChild(td);
    return tr;
  }

  function loadList(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return Array.isArray(parsed) ? parsed : fallback.slice();
    } catch (error) {
      return fallback.slice();
    }
  }

  function loadObject(key, fallback) {
    try {
      const parsed = JSON.parse(localStorage.getItem(key));
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : Object.assign({}, fallback);
    } catch (error) {
      return Object.assign({}, fallback);
    }
  }

  function loadMarket() {
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKeys.market));
      return parsed && Array.isArray(parsed.rows) ? parsed : { rows: fallbackMarket, updatedAt: "", message: "" };
    } catch (error) {
      return { rows: fallbackMarket, updatedAt: "", message: "" };
    }
  }

  function saveList(key, list) {
    localStorage.setItem(key, JSON.stringify(list));
  }

  function saveObject(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function appendMemoText(text) {
    if (!text) return;
    const current = els.memoText.value.trim();
    const separator = current ? "\n" : "";
    els.memoText.value = current + separator + text;
  }

  function voiceErrorMessage(errorCode) {
    if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
      return "인식 오류: 마이크 권한이 허용되지 않았습니다.";
    }
    if (errorCode === "no-speech") {
      return "인식 오류: 들리는 음성이 없습니다. 다시 눌러 말해 주세요.";
    }
    if (errorCode === "network") {
      return "인식 오류: 음성 인식 네트워크 연결을 확인해 주세요.";
    }
    return "인식 오류: 음성 입력을 다시 시도해 주세요.";
  }

  function previewText(text) {
    const singleLine = text.replace(/\s+/g, " ").trim();
    return singleLine.length > 46 ? singleLine.slice(0, 46) + "..." : singleLine;
  }

  function formatWon(value) {
    return Number(value || 0).toLocaleString("ko-KR") + "원";
  }

  function formatDateTime(date) {
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function todayEightAM() {
    const date = new Date();
    date.setHours(8, 0, 0, 0);
    return date;
  }

  function nextEightAM() {
    const date = todayEightAM();
    if (new Date() >= date) {
      date.setDate(date.getDate() + 1);
    }
    return date;
  }

  function todayISO() {
    return localISODate(new Date());
  }

  function addDaysISO(days) {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return localISODate(date);
  }

  function localISODate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return year + "-" + month + "-" + day;
  }

  async function sha256(value) {
    if (!window.crypto || !window.crypto.subtle) {
      els.loginMessage.textContent = "이 브라우저에서는 보안 로그인을 사용할 수 없습니다. 로컬 서버 또는 HTTPS 주소로 접속해 주세요.";
      return "";
    }
    const bytes = new TextEncoder().encode(value);
    const hashBuffer = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(hashBuffer))
      .map(function (byte) {
        return byte.toString(16).padStart(2, "0");
      })
      .join("");
  }
})();
