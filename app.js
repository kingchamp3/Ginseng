const dayMs = 24 * 60 * 60 * 1000;
const sourceUrl = "https://insamtong.kr/";
const latestDataUrl = "data/insamtong-latest.json";

const fallbackMarket = {
  sourceUrl,
  updatedAt: "2026-06-21T00:00:00.000Z",
  date: new Date("2026-06-21T00:00:00"),
  unit: "750g(1채)",
  grades: [
    { name: "원삼 / 대", price: 47500, changePct: 0 },
    { name: "원삼 / 믹서", price: 39000, changePct: -3 },
    { name: "난발삼 / 잔난", price: 35000, changePct: 0 },
    { name: "난발삼 / 콩콩콩난", price: 30750, changePct: -3 },
    { name: "삼계 / 삼계", price: 37333, changePct: -4 },
    { name: "원료삼 / 파삼", price: 14000, changePct: -2 },
  ],
};

const els = {
  gradeSelect: document.querySelector("#gradeSelect"),
  horizon: document.querySelector("#horizon"),
  sensitivity: document.querySelector("#sensitivity"),
  seasonality: document.querySelector("#seasonality"),
  purchasePressure: document.querySelector("#purchasePressure"),
  sourceText: document.querySelector("#sourceText"),
  refreshMarket: document.querySelector("#refreshMarket"),
  refreshMessage: document.querySelector("#refreshMessage"),
  modelStatus: document.querySelector("#modelStatus"),
  currentPrice: document.querySelector("#currentPrice"),
  forecast30: document.querySelector("#forecast30"),
  forecast90: document.querySelector("#forecast90"),
  volatility: document.querySelector("#volatility"),
  chart: document.querySelector("#priceChart"),
  chartCaption: document.querySelector("#chartCaption"),
  forecastRows: document.querySelector("#forecastRows"),
  gradeList: document.querySelector("#gradeList"),
  insights: document.querySelector("#insights"),
  downloadCsv: document.querySelector("#downloadCsv"),
};

let market = cloneMarket(fallbackMarket);
let forecastData = [];

function cloneMarket(value) {
  return {
    sourceUrl: value.sourceUrl ?? sourceUrl,
    updatedAt: value.updatedAt ?? null,
    date: new Date(value.date),
    unit: value.unit,
    grades: value.grades.map((grade) => ({ ...grade })),
  };
}

async function loadLatestMarket(showMessage = false) {
  if (showMessage) els.refreshMessage.textContent = "저장소의 최신 인삼통 수치를 확인하는 중입니다.";

  try {
    const response = await fetch(`${latestDataUrl}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) throw new Error(`JSON 요청 실패: ${response.status}`);
    const payload = await response.json();
    market = normalizeMarketPayload(payload);
    syncGradeOptions();
    render();
    if (showMessage) els.refreshMessage.textContent = "최신 인삼통 저장 데이터를 반영했습니다.";
  } catch (error) {
    if (showMessage) {
      els.refreshMessage.textContent = "최신 저장 데이터를 불러오지 못해 내장 기준 수치를 사용합니다.";
    }
  }
}

async function refreshFromInsamtong() {
  els.refreshMessage.textContent = "인삼통 수치를 직접 가져오는 중입니다.";

  try {
    const response = await fetch(sourceUrl, { cache: "no-store" });
    if (!response.ok) throw new Error(`요청 실패: ${response.status}`);
    const html = await response.text();
    const parsed = parseInsamtong(html);
    if (parsed.grades.length < 3) throw new Error("주요등급 가격을 충분히 찾지 못했습니다.");

    market = parsed;
    syncGradeOptions();
    render();
    els.refreshMessage.textContent = "인삼통 최신 수치를 반영했습니다.";
  } catch (error) {
    await loadLatestMarket(true);
  }
}

function normalizeMarketPayload(payload) {
  return {
    sourceUrl: payload.sourceUrl ?? sourceUrl,
    updatedAt: payload.updatedAt ?? null,
    date: new Date(`${payload.date}T00:00:00`),
    unit: payload.unit ?? "750g(1채)",
    grades: payload.grades.map((grade) => ({
      name: grade.name,
      price: Number(grade.price),
      changePct: Number(grade.changePct ?? 0),
    })),
  };
}

function parseInsamtong(html) {
  const text = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const dateMatch = text.match(/(20\d{2})년\s*(\d{1,2})월\s*(\d{1,2})일\s*기준/);
  const unitMatch = text.match(/단위\s*:\s*([^\s]+(?:\([^)]+\))?)/);
  const names = ["원삼 / 대", "원삼 / 믹서", "난발삼 / 잔난", "난발삼 / 콩콩콩난", "삼계 / 삼계", "원료삼 / 파삼"];
  const grades = names
    .map((name) => {
      const escaped = name.replace("/", "\\/");
      const pattern = new RegExp(`${escaped}\\s*(\\d{1,3}(?:,\\d{3})+|\\d{4,7})\\s*원(?:[\\s\\S]{0,80}?(상승|하락)\\s*(\\d+(?:\\.\\d+)?)%)?`);
      const match = text.match(pattern);
      if (!match) return null;
      const direction = match[2];
      const change = Number(match[3] ?? 0);
      return {
        name,
        price: Number(match[1].replace(/,/g, "")),
        changePct: direction === "하락" ? -change : change,
      };
    })
    .filter(Boolean);

  return {
    sourceUrl,
    updatedAt: new Date().toISOString(),
    date: dateMatch
      ? new Date(`${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}T00:00:00`)
      : new Date(),
    unit: unitMatch?.[1] ?? "750g(1채)",
    grades,
  };
}

function syncGradeOptions() {
  const selected = els.gradeSelect.value || market.grades[0].name;
  els.gradeSelect.innerHTML = market.grades
    .map((grade) => `<option value="${grade.name}">${grade.name}</option>`)
    .join("");
  els.gradeSelect.value = market.grades.some((grade) => grade.name === selected) ? selected : market.grades[0].name;
}

function buildForecast(grade, horizon, sensitivity, seasonality, purchasePressure) {
  const step = 7;
  const strength = sensitivity / 100;
  const seasonalStrength = seasonality / 100;
  const purchaseStrength = purchasePressure / 100;
  const spreadBase = dispersion(market.grades.map((item) => item.price));
  const changeDrift = grade.price * (grade.changePct / 100) * strength;
  const current = { date: market.date, price: grade.price };
  const points = [];

  for (let day = step; day <= horizon; day += step) {
    const date = new Date(market.date.getTime() + day * dayMs);
    const trendDecay = Math.exp(-day / 75);
    const seasonal = grade.price * seasonalFactor(date) * seasonalStrength;
    const purchase = grade.price * purchaseFactor(date) * purchaseStrength;
    const estimate = Math.max(1000, grade.price + changeDrift * trendDecay + seasonal + purchase);
    const purchaseRisk = Math.abs(purchaseFactor(date)) * purchaseStrength;
    const spread = Math.max(450, spreadBase * 0.18) * (1 + day / 180 + purchaseRisk * 0.35);
    points.push({
      date,
      price: Math.round(estimate),
      low: Math.round(Math.max(1000, estimate - spread)),
      high: Math.round(estimate + spread),
      seasonalPct: seasonalFactor(date) * seasonalStrength * 100,
      purchasePct: purchaseFactor(date) * purchaseStrength * 100,
    });
  }

  return { current, points, spreadBase };
}

function render() {
  const grade = currentGrade();
  const horizon = Number(els.horizon.value);
  const sensitivity = Number(els.sensitivity.value);
  const seasonality = Number(els.seasonality.value);
  const purchasePressure = Number(els.purchasePressure.value);
  const model = buildForecast(grade, horizon, sensitivity, seasonality, purchasePressure);
  forecastData = model.points;

  els.modelStatus.textContent = `인삼통 ${formatDate(market.date)} 기준`;
  els.sourceText.textContent = `출처: 인삼통 주요등급 가격동향, ${formatDate(market.date)} 기준, 단위 ${market.unit}${market.updatedAt ? `, 갱신 ${formatDateTime(market.updatedAt)}` : ""}`;
  els.currentPrice.textContent = money(grade.price);
  els.forecast30.textContent = money(nearestForecast(30)?.price ?? forecastData.at(-1).price);
  els.forecast90.textContent = money(nearestForecast(90)?.price ?? forecastData.at(-1).price);
  els.volatility.textContent = changeLabel(grade.changePct);
  els.chartCaption.textContent = `${grade.name} 현재가 ${money(grade.price)}에 전장 대비, 계절성, 수매기 공급 압력을 함께 반영했습니다.`;

  renderGradeList();
  renderRows();
  renderInsights(grade, model);
  drawChart(model.current, forecastData);
}

function currentGrade() {
  return market.grades.find((grade) => grade.name === els.gradeSelect.value) ?? market.grades[0];
}

function nearestForecast(day) {
  return forecastData.reduce((best, item) => {
    const itemDay = Math.round((item.date - market.date) / dayMs);
    const bestDay = Math.round((best.date - market.date) / dayMs);
    return Math.abs(itemDay - day) < Math.abs(bestDay - day) ? item : best;
  }, forecastData[0]);
}

function renderGradeList() {
  els.gradeList.innerHTML = market.grades
    .map(
      (grade) => `<button class="grade-row${grade.name === currentGrade().name ? " active" : ""}" type="button" data-grade="${grade.name}">
        <span>${grade.name}</span>
        <strong>${money(grade.price)}</strong>
        <em>${changeLabel(grade.changePct)}</em>
      </button>`
    )
    .join("");

  els.gradeList.querySelectorAll("button").forEach((button) => {
    button.addEventListener("click", () => {
      els.gradeSelect.value = button.dataset.grade;
      render();
    });
  });
}

function renderRows() {
  els.forecastRows.innerHTML = forecastData
    .map(
      (item) => `<tr>
        <td>${formatDate(item.date)}</td>
        <td>${money(item.price)}</td>
        <td>${money(item.low)}</td>
        <td>${money(item.high)}</td>
      </tr>`
    )
    .join("");
}

function renderInsights(grade, model) {
  const last = forecastData.at(-1);
  const change = ((last.price - grade.price) / grade.price) * 100;
  const marketAverage = average(market.grades.map((item) => item.price));
  const premium = ((grade.price - marketAverage) / marketAverage) * 100;
  const maxPurchase = forecastData.reduce((target, item) =>
    item.purchasePct < target.purchasePct ? item : target
  , forecastData[0]);

  els.insights.innerHTML = [
    `${els.horizon.value}일 예측은 현재가 대비 ${signedPct(change)}입니다.`,
    `선택 등급은 주요등급 평균 대비 ${signedPct(premium)} 위치입니다.`,
    `${formatDate(maxPurchase.date)} 부근 수매기 보정은 ${signedPct(maxPurchase.purchasePct)}로 반영됩니다.`,
    `예측 범위는 인삼통 주요등급 가격 분산 ${money(model.spreadBase)}와 수매기 변동 위험을 기준으로 계산했습니다.`,
  ]
    .map((text) => `<li>${text}</li>`)
    .join("");
}

function drawChart(current, forecast) {
  const canvas = els.chart;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.round(rect.width * dpr);
  canvas.height = Math.round(rect.height * dpr);
  ctx.scale(dpr, dpr);

  const width = rect.width;
  const height = rect.height;
  const pad = { top: 22, right: 28, bottom: 42, left: 72 };
  const all = [current, ...forecast];
  const minDate = current.date.getTime();
  const maxDate = forecast.at(-1)?.date.getTime() ?? current.date.getTime() + dayMs;
  const prices = all.flatMap((item) => [item.price, item.low ?? item.price, item.high ?? item.price]);
  const minPrice = Math.min(...prices) * 0.96;
  const maxPrice = Math.max(...prices) * 1.04;
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const x = (date) => pad.left + ((date.getTime() - minDate) / (maxDate - minDate || 1)) * plotW;
  const y = (price) => pad.top + (1 - (price - minPrice) / (maxPrice - minPrice || 1)) * plotH;

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.strokeStyle = "#e5ebe5";
  ctx.lineWidth = 1;
  ctx.fillStyle = "#718079";
  ctx.font = "12px Segoe UI, sans-serif";
  ctx.textAlign = "right";
  ctx.textBaseline = "middle";

  for (let i = 0; i <= 4; i++) {
    const value = minPrice + ((maxPrice - minPrice) * i) / 4;
    const py = y(value);
    ctx.beginPath();
    ctx.moveTo(pad.left, py);
    ctx.lineTo(width - pad.right, py);
    ctx.stroke();
    ctx.fillText(shortMoney(value), pad.left - 10, py);
  }

  drawBand(ctx, forecast, x, y);
  drawLine(ctx, [current, ...forecast], x, y, "#3867a6", 3);
  drawPoint(ctx, x(current.date), y(current.price));

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#718079";
  ctx.fillText(formatDate(current.date), pad.left, height - 29);
  ctx.textAlign = "right";
  ctx.fillText(formatDate(forecast.at(-1)?.date ?? current.date), width - pad.right, height - 29);
}

function drawLine(ctx, data, x, y, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.beginPath();
  data.forEach((item, index) => {
    const px = x(item.date);
    const py = y(item.price);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.stroke();
}

function drawBand(ctx, data, x, y) {
  if (!data.length) return;
  ctx.fillStyle = "rgba(56, 103, 166, 0.12)";
  ctx.beginPath();
  data.forEach((item, index) => {
    const px = x(item.date);
    const py = y(item.high);
    if (index === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  [...data].reverse().forEach((item) => ctx.lineTo(x(item.date), y(item.low)));
  ctx.closePath();
  ctx.fill();
}

function drawPoint(ctx, x, y) {
  ctx.fillStyle = "#2f7d5b";
  ctx.beginPath();
  ctx.arc(x, y, 5, 0, Math.PI * 2);
  ctx.fill();
}

function average(values) {
  return values.reduce((total, value) => total + value, 0) / Math.max(1, values.length);
}

function dispersion(values) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function seasonalFactor(date) {
  const month = date.getMonth() + 1;
  const demandByMonth = {
    1: 0.014,
    2: 0.016,
    3: 0.004,
    4: 0,
    5: 0.003,
    6: 0.004,
    7: 0.006,
    8: -0.004,
    9: -0.014,
    10: -0.018,
    11: -0.012,
    12: 0.012,
  };
  return demandByMonth[month] ?? 0;
}

function purchaseFactor(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();

  if (month === 9) return day < 15 ? -0.012 : -0.022;
  if (month === 10) return -0.032;
  if (month === 11) return day < 20 ? -0.026 : -0.014;
  if (month === 12) return 0.006;
  return 0;
}

function money(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function shortMoney(value) {
  return `${Math.round(value / 1000).toLocaleString("ko-KR")}천`;
}

function signedPct(value) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

function changeLabel(value) {
  if (value > 0) return `상승 ${value}%`;
  if (value < 0) return `하락 ${Math.abs(value)}%`;
  return "보합";
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateTime(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "Asia/Seoul",
  }).format(date);
}

els.gradeSelect.addEventListener("input", render);
els.horizon.addEventListener("input", render);
els.sensitivity.addEventListener("input", render);
els.seasonality.addEventListener("input", render);
els.purchasePressure.addEventListener("input", render);
els.refreshMarket.addEventListener("click", refreshFromInsamtong);
window.addEventListener("resize", render);

els.downloadCsv.addEventListener("click", () => {
  const grade = currentGrade();
  const header = "source_date,grade,date,forecast,low,high";
  const body = forecastData
    .map((item) => `${formatDate(market.date)},${grade.name},${formatDate(item.date)},${item.price},${item.low},${item.high}`)
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "insamtong-forecast.csv";
  link.click();
  URL.revokeObjectURL(url);
});

syncGradeOptions();
render();
loadLatestMarket();
