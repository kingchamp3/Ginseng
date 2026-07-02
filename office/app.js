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
    todos: "ginsengOfficeTodos",
    orders: "ginsengOfficeOrders",
    factoryTasks: "ginsengOfficeFactoryTasks",
    contacts: "ginsengOfficeContacts",
    prices: "ginsengOfficePrices",
    market: "ginsengOfficeMarket",
    favorites: "ginsengOfficeFavorites",
    recent: "ginsengOfficeRecent",
    theme: "ginsengOfficeTheme"
  };

  const inventoryBranches = [
    { id: "ganghwa", name: "강화농협" },
    { id: "ganghwa-nambu", name: "강화남부농협" },
    { id: "gyeyang", name: "계양농협" },
    { id: "geomdan", name: "검단농협" },
    { id: "namdong", name: "남동농협" },
    { id: "singanseok", name: "신간석지점" }
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
    inventory: loadInventory(),
    activeInventoryBranch: inventoryBranches[0].id,
    schedule: loadList(storageKeys.schedule, initialSchedule),
    memos: loadObject(storageKeys.memos, {}),
    todos: loadList(storageKeys.todos, []),
    orders: loadList(storageKeys.orders, []),
    factoryTasks: loadList(storageKeys.factoryTasks, []),
    contacts: loadList(storageKeys.contacts, []),
    prices: loadList(storageKeys.prices, initialPrices),
    market: loadMarket(),
    favorites: loadList(storageKeys.favorites, []),
    recent: loadList(storageKeys.recent, [])
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
    favoriteButton: document.getElementById("favoriteButton"),
    darkModeButton: document.getElementById("darkModeButton"),
    printViewButton: document.getElementById("printViewButton"),
    dashboardTodoProgress: document.getElementById("dashboardTodoProgress"),
    dashboardPendingOrders: document.getElementById("dashboardPendingOrders"),
    dashboardLowStock: document.getElementById("dashboardLowStock"),
    dashboardFactoryOpen: document.getElementById("dashboardFactoryOpen"),
    globalSearchInput: document.getElementById("globalSearchInput"),
    globalSearchResults: document.getElementById("globalSearchResults"),
    favoriteList: document.getElementById("favoriteList"),
    recentActivityList: document.getElementById("recentActivityList"),
    todoForm: document.getElementById("todoForm"),
    addTodoButton: document.getElementById("addTodoButton"),
    todoList: document.getElementById("todoList"),
    todoProgressBar: document.getElementById("todoProgressBar"),
    orderForm: document.getElementById("orderForm"),
    addOrderButton: document.getElementById("addOrderButton"),
    orderStats: document.getElementById("orderStats"),
    orderRows: document.getElementById("orderRows"),
    factoryForm: document.getElementById("factoryForm"),
    addFactoryButton: document.getElementById("addFactoryButton"),
    factoryList: document.getElementById("factoryList"),
    inventoryBranchTabs: document.getElementById("inventoryBranchTabs"),
    activeInventoryBranchName: document.getElementById("activeInventoryBranchName"),
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
    nextRefreshAt: document.getElementById("nextRefreshAt"),
    contactForm: document.getElementById("contactForm"),
    addContactButton: document.getElementById("addContactButton"),
    contactList: document.getElementById("contactList"),
    calcQuantity: document.getElementById("calcQuantity"),
    calcUnitPrice: document.getElementById("calcUnitPrice"),
    calcTotal: document.getElementById("calcTotal"),
    exchangeAmount: document.getElementById("exchangeAmount"),
    exchangeRate: document.getElementById("exchangeRate"),
    exchangeTotal: document.getElementById("exchangeTotal"),
    exportDataButton: document.getElementById("exportDataButton"),
    importDataInput: document.getElementById("importDataInput"),
    downloadReportButton: document.getElementById("downloadReportButton"),
    printDataButton: document.getElementById("printDataButton"),
    dataStatus: document.getElementById("dataStatus")
  };

  boot();

  function boot() {
    applySavedTheme();
    startLiveClock();
    bindEvents();
    renderAll();
    if (sessionStorage.getItem(storageKeys.authed) === "1") {
      showWorkspace();
    }
  }

  function startLiveClock() {
    updateLiveClock();
    setInterval(updateLiveClock, 1000);
  }

  function updateLiveClock() {
    els.todayStamp.textContent = formatDateTimeWithSeconds(new Date());
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

    els.favoriteButton.addEventListener("click", toggleCurrentFavorite);
    els.darkModeButton.addEventListener("click", toggleDarkMode);
    els.printViewButton.addEventListener("click", printCurrentView);
    els.globalSearchInput.addEventListener("input", renderSearchResults);

    els.addTodoButton.addEventListener("click", addTodoFromForm);
    els.todoForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addTodoFromForm();
    });

    els.addOrderButton.addEventListener("click", addOrderFromForm);
    els.orderForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addOrderFromForm();
    });

    els.addFactoryButton.addEventListener("click", addFactoryFromForm);
    els.factoryForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addFactoryFromForm();
    });

    renderInventoryBranchTabs();

    els.addInventoryButton.addEventListener("click", function () {
      addInventoryFromForm();
    });
    els.inventoryForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addInventoryFromForm();
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

    els.addContactButton.addEventListener("click", addContactFromForm);
    els.contactForm.addEventListener("submit", function (event) {
      event.preventDefault();
      addContactFromForm();
    });
    [els.calcQuantity, els.calcUnitPrice].forEach(function (input) {
      input.addEventListener("input", updateCalculators);
    });
    [els.exchangeAmount, els.exchangeRate].forEach(function (input) {
      input.addEventListener("input", updateCalculators);
    });
    els.exportDataButton.addEventListener("click", exportData);
    els.importDataInput.addEventListener("change", importData);
    els.downloadReportButton.addEventListener("click", downloadMonthlyReport);
    els.printDataButton.addEventListener("click", printCurrentView);
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
    recordActivity(title + " 메뉴 열람");
    updateFavoriteButton(viewId);
    renderDashboard();
    if (viewId === "marketView") {
      maybeAutoRefreshMarket();
    }
  }

  function renderAll() {
    renderTodos();
    renderOrders();
    renderFactoryTasks();
    renderInventory();
    renderSchedule();
    renderMemos();
    renderPrices();
    renderMarket();
    renderContacts();
    updateCalculators();
    renderDashboard();
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

  function addTodoFromForm() {
    if (!els.todoForm.reportValidity()) return;
    const data = Object.fromEntries(new FormData(els.todoForm).entries());
    state.todos.push(Object.assign(data, { done: false, createdAt: new Date().toISOString() }));
    saveList(storageKeys.todos, state.todos);
    els.todoForm.reset();
    recordActivity("할 일 추가: " + data.title);
    renderTodos();
  }

  function renderTodos() {
    els.todoList.innerHTML = "";
    const doneCount = state.todos.filter(function (todo) { return todo.done; }).length;
    const progress = state.todos.length ? Math.round((doneCount / state.todos.length) * 100) : 0;
    els.todoProgressBar.style.width = progress + "%";
    els.todoProgressBar.textContent = progress + "%";
    if (!state.todos.length) {
      els.todoList.appendChild(emptyNotice("등록된 할 일이 없습니다."));
      renderDashboard();
      return;
    }
    state.todos.forEach(function (todo, index) {
      const item = document.createElement("article");
      item.className = "task-item" + (todo.done ? " completed" : "");
      item.innerHTML = '<label><input type="checkbox"><span></span></label><div class="task-meta"></div><div></div>';
      item.querySelector("input").checked = todo.done;
      item.querySelector("input").addEventListener("change", function (event) {
        todo.done = event.target.checked;
        saveList(storageKeys.todos, state.todos);
        recordActivity((todo.done ? "완료: " : "미완료: ") + todo.title);
        renderTodos();
      });
      item.querySelector("span").textContent = todo.title;
      item.querySelector(".task-meta").textContent = [todo.period, todo.priority, todo.dueDate].filter(Boolean).join(" · ");
      item.lastElementChild.appendChild(deleteButton(function () {
        state.todos.splice(index, 1);
        saveList(storageKeys.todos, state.todos);
        renderTodos();
      }));
      els.todoList.appendChild(item);
    });
    renderDashboard();
  }

  function addOrderFromForm() {
    if (!els.orderForm.reportValidity()) return;
    const data = Object.fromEntries(new FormData(els.orderForm).entries());
    data.quantity = Number(data.quantity);
    data.amount = Number(data.amount || 0);
    data.createdAt = new Date().toISOString();
    state.orders.push(data);
    saveList(storageKeys.orders, state.orders);
    els.orderForm.reset();
    recordActivity("발주 추가: " + data.client + " / " + data.item);
    renderOrders();
  }

  function renderOrders() {
    els.orderRows.innerHTML = "";
    const currentMonth = localISODate(new Date()).slice(0, 7);
    const monthOrders = state.orders.filter(function (order) {
      return (order.createdAt || "").slice(0, 7) === currentMonth;
    });
    const monthAmount = monthOrders.reduce(function (sum, order) { return sum + Number(order.amount || 0); }, 0);
    els.orderStats.textContent = "이번 달 발주 " + monthOrders.length + "건 · 합계 " + formatWon(monthAmount);
    if (!state.orders.length) {
      els.orderRows.appendChild(emptyRow(7, "등록된 발주가 없습니다."));
      renderDashboard();
      return;
    }
    state.orders.forEach(function (order, index) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td><td></td><td></td>";
      tr.children[0].textContent = order.client;
      tr.children[1].textContent = order.item;
      tr.children[2].textContent = Number(order.quantity || 0).toLocaleString("ko-KR");
      tr.children[3].textContent = formatWon(order.amount);
      tr.children[4].textContent = order.dueDate || "-";
      tr.children[5].appendChild(statusSelect(order.status, ["대기", "진행", "완료"], function (value) {
        order.status = value;
        saveList(storageKeys.orders, state.orders);
        renderOrders();
      }));
      tr.children[6].appendChild(deleteButton(function () {
        state.orders.splice(index, 1);
        saveList(storageKeys.orders, state.orders);
        renderOrders();
      }));
      els.orderRows.appendChild(tr);
    });
    renderDashboard();
  }

  function addFactoryFromForm() {
    if (!els.factoryForm.reportValidity()) return;
    const data = Object.fromEntries(new FormData(els.factoryForm).entries());
    state.factoryTasks.push(Object.assign(data, { done: false, createdAt: new Date().toISOString() }));
    saveList(storageKeys.factoryTasks, state.factoryTasks);
    els.factoryForm.reset();
    recordActivity("공장 업무 추가: " + data.product);
    renderFactoryTasks();
  }

  function renderFactoryTasks() {
    els.factoryList.innerHTML = "";
    if (!state.factoryTasks.length) {
      els.factoryList.appendChild(emptyNotice("등록된 공장 업무가 없습니다."));
      renderDashboard();
      return;
    }
    state.factoryTasks.forEach(function (task, index) {
      const item = document.createElement("article");
      item.className = "task-item" + (task.done ? " completed" : "");
      item.innerHTML = '<label><input type="checkbox"><span></span></label><div class="task-meta"></div><div></div>';
      item.querySelector("input").checked = task.done;
      item.querySelector("input").addEventListener("change", function (event) {
        task.done = event.target.checked;
        saveList(storageKeys.factoryTasks, state.factoryTasks);
        renderFactoryTasks();
      });
      item.querySelector("span").textContent = task.product;
      item.querySelector(".task-meta").textContent = [task.date, task.process, task.quality].filter(Boolean).join(" · ");
      item.lastElementChild.appendChild(deleteButton(function () {
        state.factoryTasks.splice(index, 1);
        saveList(storageKeys.factoryTasks, state.factoryTasks);
        renderFactoryTasks();
      }));
      els.factoryList.appendChild(item);
    });
    renderDashboard();
  }

  function addInventoryFromForm() {
    if (!els.inventoryForm.reportValidity()) return;
    const data = Object.fromEntries(new FormData(els.inventoryForm).entries());
    data.quantity = Number(data.quantity);
    currentInventoryList().push(data);
    saveObject(storageKeys.inventory, state.inventory);
    els.inventoryForm.reset();
    renderInventory();
  }

  function renderInventory() {
    const branch = currentInventoryBranch();
    const list = currentInventoryList();
    els.activeInventoryBranchName.textContent = branch.name;
    els.inventoryRows.innerHTML = "";
    if (!list.length) {
      els.inventoryRows.appendChild(emptyRow(5, branch.name + "에 등록된 재고가 없습니다."));
      return;
    }
    list.forEach(function (row, index) {
      const tr = document.createElement("tr");
      tr.innerHTML = "<td></td><td></td><td></td><td></td><td></td>";
      tr.children[0].textContent = row.item;
      tr.children[1].textContent = row.grade;
      tr.children[2].textContent = Number(row.quantity).toLocaleString("ko-KR");
      tr.children[3].textContent = row.location || "-";
      tr.children[4].appendChild(deleteButton(function () {
        list.splice(index, 1);
        saveObject(storageKeys.inventory, state.inventory);
        renderInventory();
      }));
      els.inventoryRows.appendChild(tr);
    });
  }

  function renderInventoryBranchTabs() {
    els.inventoryBranchTabs.innerHTML = "";
    inventoryBranches.forEach(function (branch) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "branch-tab";
      button.textContent = branch.name;
      button.dataset.branch = branch.id;
      button.addEventListener("click", function () {
        state.activeInventoryBranch = branch.id;
        renderInventoryBranchTabs();
        renderInventory();
      });
      button.classList.toggle("active", branch.id === state.activeInventoryBranch);
      els.inventoryBranchTabs.appendChild(button);
    });
  }

  function currentInventoryBranch() {
    return inventoryBranches.find(function (branch) {
      return branch.id === state.activeInventoryBranch;
    }) || inventoryBranches[0];
  }

  function currentInventoryList() {
    if (!Array.isArray(state.inventory[state.activeInventoryBranch])) {
      state.inventory[state.activeInventoryBranch] = [];
    }
    return state.inventory[state.activeInventoryBranch];
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
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
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
      els.voiceMemoButton.textContent = "듣는 중";
      els.memoStatus.textContent = "듣고 있습니다. 한 문장을 말하면 메모에 추가됩니다.";
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
        els.memoStatus.textContent = "음성 입력이 종료되었습니다. 다음 문장은 음성 입력을 다시 눌러 주세요.";
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

  function addContactFromForm() {
    if (!els.contactForm.reportValidity()) return;
    const data = Object.fromEntries(new FormData(els.contactForm).entries());
    state.contacts.push(data);
    saveList(storageKeys.contacts, state.contacts);
    els.contactForm.reset();
    recordActivity("연락처 추가: " + data.name);
    renderContacts();
  }

  function renderContacts() {
    els.contactList.innerHTML = "";
    if (!state.contacts.length) {
      els.contactList.appendChild(emptyNotice("등록된 연락처가 없습니다."));
      return;
    }
    state.contacts.forEach(function (contact, index) {
      const card = document.createElement("article");
      card.className = "contact-card";
      card.innerHTML = "<strong></strong><p></p><div></div><div></div>";
      card.querySelector("strong").textContent = contact.name;
      card.querySelector("p").textContent = contact.memo || "특이사항 없음";
      const links = card.children[2];
      if (contact.phone) links.appendChild(contactLink("전화", "tel:" + contact.phone));
      if (contact.email) links.appendChild(contactLink("이메일", "mailto:" + contact.email));
      card.lastElementChild.appendChild(deleteButton(function () {
        state.contacts.splice(index, 1);
        saveList(storageKeys.contacts, state.contacts);
        renderContacts();
      }));
      els.contactList.appendChild(card);
    });
  }

  function updateCalculators() {
    const total = Number(els.calcQuantity.value || 0) * Number(els.calcUnitPrice.value || 0);
    const exchange = Number(els.exchangeAmount.value || 0) * Number(els.exchangeRate.value || 0);
    els.calcTotal.textContent = formatWon(total);
    els.exchangeTotal.textContent = formatWon(exchange);
  }

  function renderDashboard() {
    const doneTodos = state.todos.filter(function (todo) { return todo.done; }).length;
    const todoProgress = state.todos.length ? Math.round((doneTodos / state.todos.length) * 100) : 0;
    const pendingOrders = state.orders.filter(function (order) { return order.status !== "완료"; }).length;
    const lowStock = inventoryBranches.reduce(function (count, branch) {
      return count + (state.inventory[branch.id] || []).filter(function (row) { return Number(row.quantity || 0) <= 5; }).length;
    }, 0);
    const openFactory = state.factoryTasks.filter(function (task) { return !task.done; }).length;
    els.dashboardTodoProgress.textContent = todoProgress + "%";
    els.dashboardPendingOrders.textContent = pendingOrders + "건";
    els.dashboardLowStock.textContent = lowStock + "건";
    els.dashboardFactoryOpen.textContent = openFactory + "건";
    renderQuickList(els.favoriteList, state.favorites, "즐겨찾기 메뉴가 없습니다.", function (viewId) {
      const button = els.menuButtons.find(function (menuButton) { return menuButton.dataset.view === viewId; });
      if (button) button.click();
    });
    renderQuickList(els.recentActivityList, state.recent, "최근 활동이 없습니다.");
    renderSearchResults();
  }

  function renderSearchResults() {
    const keyword = els.globalSearchInput.value.trim().toLowerCase();
    els.globalSearchResults.innerHTML = "";
    if (!keyword) {
      els.globalSearchResults.appendChild(emptyNotice("검색어를 입력하면 발주, 제품, 메모, 연락처를 찾습니다."));
      return;
    }
    const results = [];
    state.orders.forEach(function (order) { pushSearchResult(results, "발주", order.client + " " + order.item + " " + order.status, keyword); });
    Object.keys(state.memos).forEach(function (date) { pushSearchResult(results, "메모 " + date, state.memos[date].text, keyword); });
    state.contacts.forEach(function (contact) { pushSearchResult(results, "연락처", contact.name + " " + contact.phone + " " + contact.memo, keyword); });
    inventoryBranches.forEach(function (branch) {
      (state.inventory[branch.id] || []).forEach(function (row) { pushSearchResult(results, branch.name, row.item + " " + row.grade + " " + row.location, keyword); });
    });
    if (!results.length) {
      els.globalSearchResults.appendChild(emptyNotice("검색 결과가 없습니다."));
      return;
    }
    results.slice(0, 8).forEach(function (result) {
      const item = document.createElement("div");
      item.className = "search-result";
      item.innerHTML = "<strong></strong><span></span>";
      item.querySelector("strong").textContent = result.title;
      item.querySelector("span").textContent = result.text;
      els.globalSearchResults.appendChild(item);
    });
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

  function statusSelect(current, options, onChange) {
    const select = document.createElement("select");
    options.forEach(function (option) {
      const element = document.createElement("option");
      element.value = option;
      element.textContent = option;
      select.appendChild(element);
    });
    select.value = current || options[0];
    select.addEventListener("change", function () {
      onChange(select.value);
    });
    return select;
  }

  function emptyNotice(text) {
    const item = document.createElement("div");
    item.className = "empty-state memo-empty";
    item.textContent = text;
    return item;
  }

  function contactLink(label, href) {
    const link = document.createElement("a");
    link.href = href;
    link.textContent = label;
    return link;
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

  function loadInventory() {
    const emptyInventory = inventoryBranches.reduce(function (result, branch) {
      result[branch.id] = [];
      return result;
    }, {});
    try {
      const parsed = JSON.parse(localStorage.getItem(storageKeys.inventory));
      if (Array.isArray(parsed)) {
        emptyInventory[inventoryBranches[0].id] = parsed;
        localStorage.setItem(storageKeys.inventory, JSON.stringify(emptyInventory));
        return emptyInventory;
      }
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        inventoryBranches.forEach(function (branch) {
          if (!Array.isArray(parsed[branch.id])) {
            parsed[branch.id] = [];
          }
        });
        return parsed;
      }
    } catch (error) {
      return emptyInventory;
    }
    return emptyInventory;
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

  function toggleCurrentFavorite() {
    const activeView = document.querySelector(".active-view");
    if (!activeView) return;
    const viewId = activeView.id;
    if (state.favorites.includes(viewId)) {
      state.favorites = state.favorites.filter(function (favorite) { return favorite !== viewId; });
    } else {
      state.favorites.push(viewId);
    }
    saveList(storageKeys.favorites, state.favorites);
    updateFavoriteButton(viewId);
    renderDashboard();
  }

  function updateFavoriteButton(viewId) {
    els.favoriteButton.textContent = state.favorites.includes(viewId) ? "★" : "☆";
  }

  function toggleDarkMode() {
    document.body.classList.toggle("dark-mode");
    localStorage.setItem(storageKeys.theme, document.body.classList.contains("dark-mode") ? "dark" : "light");
  }

  function applySavedTheme() {
    document.body.classList.toggle("dark-mode", localStorage.getItem(storageKeys.theme) === "dark");
  }

  function recordActivity(text) {
    state.recent.unshift(formatDateTime(new Date()) + " · " + text);
    state.recent = state.recent.slice(0, 8);
    saveList(storageKeys.recent, state.recent);
  }

  function renderQuickList(container, list, emptyText, onClick) {
    container.innerHTML = "";
    if (!list.length) {
      container.appendChild(emptyNotice(emptyText));
      return;
    }
    list.forEach(function (item) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "quick-item";
      button.textContent = viewLabel(item) || item;
      if (onClick) button.addEventListener("click", function () { onClick(item); });
      container.appendChild(button);
    });
  }

  function viewLabel(viewId) {
    const button = els.menuButtons.find(function (menuButton) { return menuButton.dataset.view === viewId; });
    return button ? button.textContent : "";
  }

  function pushSearchResult(results, title, text, keyword) {
    const value = String(text || "");
    if (value.toLowerCase().includes(keyword)) {
      results.push({ title: title, text: previewText(value) });
    }
  }

  function printCurrentView() {
    window.print();
  }

  function exportData() {
    const data = {};
    Object.keys(storageKeys).forEach(function (name) {
      if (name !== "authed") data[name] = localStorage.getItem(storageKeys[name]);
    });
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, "ganghwa-office-backup-" + todayISO() + ".json");
    els.dataStatus.textContent = "백업 파일을 내보냈습니다.";
  }

  function importData(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", function () {
      try {
        const data = JSON.parse(reader.result);
        Object.keys(data).forEach(function (name) {
          if (storageKeys[name] && data[name] !== null) localStorage.setItem(storageKeys[name], data[name]);
        });
        els.dataStatus.textContent = "가져오기가 완료되었습니다. 새로고침하면 반영됩니다.";
      } catch (error) {
        els.dataStatus.textContent = "가져오기 파일을 확인해 주세요.";
      }
    });
    reader.readAsText(file);
  }

  function downloadMonthlyReport() {
    const lines = [
      "강화인삼농협 월간 업무 보고서",
      "작성일," + formatDateTime(new Date()),
      "할 일," + state.todos.length + "건",
      "발주," + state.orders.length + "건",
      "공장 업무," + state.factoryTasks.length + "건",
      "연락처," + state.contacts.length + "건"
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    downloadBlob(blob, "monthly-report-" + todayISO() + ".csv");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
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
      return "인식 오류: 브라우저 음성 인식 서비스 연결에 실패했습니다. Chrome 또는 Edge에서 새로고침 후 다시 시도해 주세요.";
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

  function formatDateTimeWithSeconds(date) {
    return date.toLocaleString("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
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
