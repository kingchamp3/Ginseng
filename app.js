const dayMs = 24 * 60 * 60 * 1000;
const productAdjustments = {
  fresh: { name: "수삼", multiplier: 1, season: 0.04 },
  red: { name: "홍삼 원료삼", multiplier: 1.18, season: 0.025 },
  white: { name: "백삼", multiplier: 0.92, season: 0.03 },
};
const insamtongSource = "https://insamtong.kr/";
const insamtongSnapshot = {
  date: new Date("2026-06-21T00:00:00"),
  unit: "750g(1채)",
  grades: [
    { name: "원삼 / 대", price: 47500 },
    { name: "원삼 / 믹서", price: 39000 },
    { name: "난발삼 / 잔난", price: 35000 },
    { name: "난발삼 / 콩콩콩난", price: 30750 },
    { name: "삼계 / 삼계", price: 37333 },
    { name: "원료삼 / 파삼", price: 14000 },
  ],
};

const els = {
  productType: document.querySelector("#productType"),
  horizon: document.querySelector("#horizon"),
  sensitivity: document.querySelector("#sensitivity"),
  csvInput: document.querySelector("#csvInput"),
  marketUrl: document.querySelector("#marketUrl"),
  marketPaste: document.querySelector("#marketPaste"),
  dataMessage: document.querySelector("#dataMessage"),
  marketMessage: document.querySelector("#marketMessage"),
  modelStatus: document.querySelector("#modelStatus"),
  currentPrice: document.querySelector("#currentPrice"),
  forecast30: document.querySelector("#forecast30"),
  forecast90: document.querySelector("#forecast90"),
  volatility: document.querySelector("#volatility"),
  chart: document.querySelector("#priceChart"),
  forecastRows: document.querySelector("#forecastRows"),
  insights: document.querySelector("#insights"),
  chartCaption: document.querySelector("#chartCaption"),
  applyData: document.querySelector("#applyData"),
  loadSample: document.querySelector("#loadSample"),
  fetchMarket: document.querySelector("#fetchMarket"),
  applyMarket: document.querySelector("#applyMarket"),
  downloadCsv: document.querySelector("#downloadCsv"),
};

let actualData = [...createSampleData(), currentInsamtongPrice()];
let forecastData = [];

function createSampleData() {
  const result = [];
  const start = new Date("2025-06-22T00:00:00");
  for (let i = 0; i < 360; i += 7) {
    const date = new Date(start.getTime() + i * dayMs);
    const trend = i * 31;
    const season = Math.sin((i / 365) * Math.PI * 2 + 0.4) * 1900;
    const harvestPressure = date.getMonth() >= 8 && date.getMonth() <= 10 ? -1800 : 0;
    const noise = Math.sin(i * 1.7) * 430 + Math.cos(i * 0.23) * 260;
    result.push({
      date,
      price: Math.round(39500 + trend + season + harvestPressure + noise),
    });
  }
  return result;
}

function currentInsamtongPrice() {
  return {
    date: insamtongSnapshot.date,
    price: Math.round(average(insamtongSnapshot.grades.map((item) => item.price))),
  };
}

function toCsv(data) {
  return data
    .map((item) => `${formatDate(item.date)},${Math.round(item.price)}`)
    .join("\n");
}

function parseCsv(text) {
  const rows = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = [];

  rows.forEach((row, index) => {
    const [dateText, priceText] = row.split(",").map((part) => part.trim());
    if (index === 0 && /날짜|date/i.test(dateText)) return;

    const date = new Date(`${dateText}T00:00:00`);
    const price = Number(priceText?.replace(/,/g, ""));

    if (!Number.isFinite(date.getTime()) || !Number.isFinite(price) || price <= 0) {
      throw new Error(`${index + 1}번째 줄을 확인해주세요.`);
    }
    parsed.push({ date, price });
  });

  const deduped = new Map();
  parsed.forEach((item) => deduped.set(formatDate(item.date), item));
  return [...deduped.values()].sort((a, b) => a.date - b.date);
}

function parseMarketText(text) {
  const normalized = text
    .replace(/\u00a0/g, " ")
    .replace(/원\/?kg|원\s*\/\s*채|원\s*\/\s*근/g, "원")
    .replace(/[|]/g, " ");
  const lines = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const parsed = [];
  const today = new Date();

  lines.forEach((line) => {
    const dateMatch = line.match(/(20\d{2})[.\-/년\s]+(\d{1,2})[.\-/월\s]+(\d{1,2})/);
    const compactDateMatch = line.match(/\b(20\d{2})(\d{2})(\d{2})\b/);
    const priceMatches = [...line.matchAll(/(\d{1,3}(?:,\d{3})+|\d{4,7})\s*원?/g)]
      .map((match) => Number(match[1].replace(/,/g, "")))
      .filter((value) => value >= 1000 && value <= 1000000);

    if (!priceMatches.length) return;

    let date = null;
    if (dateMatch) {
      date = new Date(`${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}T00:00:00`);
    } else if (compactDateMatch) {
      date = new Date(`${compactDateMatch[1]}-${compactDateMatch[2]}-${compactDateMatch[3]}T00:00:00`);
    }

    if (!date || !Number.isFinite(date.getTime())) {
      date = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    }

    const representativePrice = Math.round(average(priceMatches));
    parsed.push({ date, price: representativePrice });
  });

  const dailyPrices = new Map();
  parsed.forEach((item) => {
    const key = formatDate(item.date);
    const existing = dailyPrices.get(key) ?? [];
    existing.push(item.price);
    dailyPrices.set(key, existing);
  });

  return [...dailyPrices.entries()]
    .map(([date, prices]) => ({
      date: new Date(`${date}T00:00:00`),
      price: Math.round(average(prices)),
    }))
    .sort((a, b) => a.date - b.date);
}

function mergeMarketData(marketData) {
  const merged = new Map(actualData.map((item) => [formatDate(item.date), item]));
  marketData.forEach((item) => merged.set(formatDate(item.date), item));
  actualData = [...merged.values()].sort((a, b) => a.date - b.date);
  els.csvInput.value = toCsv(actualData);
}

function buildForecast(data, horizon, productType, sensitivity) {
  const adjustedData = data.map((item) => ({
    date: item.date,
    price: item.price * productAdjustments[productType].multiplier,
  }));
  const n = adjustedData.length;
  const recentWindow = Math.min(Math.max(8, Math.round(n * (0.25 + sensitivity * 0.45))), n);
  const recent = adjustedData.slice(-recentWindow);
  const firstDate = recent[0].date;
  const xs = recent.map((item) => (item.date - firstDate) / dayMs);
  const ys = recent.map((item) => item.price);
  const meanX = average(xs);
  const meanY = average(ys);
  const slope =
    sum(xs.map((x, i) => (x - meanX) * (ys[i] - meanY))) /
    Math.max(1, sum(xs.map((x) => (x - meanX) ** 2)));
  const intercept = meanY - slope * meanX;
  const residuals = recent.map((item, i) => item.price - (intercept + slope * xs[i]));
  const sigma = Math.max(350, standardDeviation(residuals));
  const seasonalStrength = productAdjustments[productType].season;
  const last = adjustedData[adjustedData.length - 1];
  const step = data.length > 1 ? medianStepDays(adjustedData) : 7;
  const points = [];

  for (let day = step; day <= horizon; day += step) {
    const date = new Date(last.date.getTime() + day * dayMs);
    const x = (date - firstDate) / dayMs;
    const seasonal = Math.sin(((date.getMonth() + 1) / 12) * Math.PI * 2) * last.price * seasonalStrength;
    const estimate = Math.max(1000, intercept + slope * x + seasonal);
    const spread = sigma * (1 + day / 210);
    points.push({
      date,
      price: Math.round(estimate),
      low: Math.round(Math.max(1000, estimate - spread)),
      high: Math.round(estimate + spread),
    });
  }
  return { adjustedData, points, slope, sigma, recentWindow };
}

function render() {
  const horizon = Number(els.horizon.value);
  const productType = els.productType.value;
  const sensitivity = Number(els.sensitivity.value) / 100;
  const model = buildForecast(actualData, horizon, productType, sensitivity);
  forecastData = model.points;

  const current = model.adjustedData.at(-1).price;
  const price30 = nearestForecast(30)?.price ?? forecastData.at(-1)?.price;
  const price90 = nearestForecast(90)?.price ?? forecastData.at(-1)?.price;
  const volPct = (model.sigma / current) * 100;

  els.currentPrice.textContent = money(current);
  els.forecast30.textContent = money(price30);
  els.forecast90.textContent = money(price90);
  els.volatility.textContent = `${volPct.toFixed(1)}%`;
  els.chartCaption.textContent = `${productAdjustments[productType].name} 기준, 최근 ${model.recentWindow}개 관측값을 더 크게 반영했습니다.`;
  els.modelStatus.textContent = `인삼통 ${formatDate(insamtongSnapshot.date)} 반영`;

  renderRows();
  renderInsights(model, current);
  drawChart(model.adjustedData, forecastData);
}

function nearestForecast(day) {
  if (!forecastData.length) return null;
  const base = actualData.at(-1).date;
  return forecastData.reduce((best, item) => {
    const itemDay = Math.round((item.date - base) / dayMs);
    const bestDay = Math.round((best.date - base) / dayMs);
    return Math.abs(itemDay - day) < Math.abs(bestDay - day) ? item : best;
  }, forecastData[0]);
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

function renderInsights(model, current) {
  const lastForecast = forecastData.at(-1);
  const change = lastForecast ? ((lastForecast.price - current) / current) * 100 : 0;
  const direction = change >= 1 ? "상승" : change <= -1 ? "하락" : "보합";
  const confidence =
    model.sigma / current < 0.045 ? "높음" : model.sigma / current < 0.08 ? "보통" : "낮음";
  const trendText =
    model.slope > 25
      ? "최근 가격 기울기가 강한 편입니다."
      : model.slope < -25
      ? "최근 가격 기울기가 약한 편입니다."
      : "최근 가격 기울기는 완만합니다.";

  els.insights.innerHTML = [
    `${els.horizon.value}일 전망은 ${direction} 쪽으로 ${Math.abs(change).toFixed(1)}% 움직입니다.`,
    `예측 신뢰도는 ${confidence}입니다. 변동성이 커질수록 하한과 상한 폭이 넓어집니다.`,
    trendText,
  ]
    .map((text) => `<li>${text}</li>`)
    .join("");
}

function drawChart(actual, forecast) {
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
  const all = [...actual, ...forecast];
  const minDate = actual[0].date.getTime();
  const maxDate = forecast.at(-1)?.date.getTime() ?? actual.at(-1).date.getTime();
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
  drawLine(ctx, actual, x, y, "#2f7d5b", 3);
  drawLine(ctx, forecast, x, y, "#3867a6", 3);

  const splitX = x(actual.at(-1).date);
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = "#b7c2bb";
  ctx.beginPath();
  ctx.moveTo(splitX, pad.top);
  ctx.lineTo(splitX, height - pad.bottom);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.textAlign = "left";
  ctx.textBaseline = "top";
  ctx.fillStyle = "#718079";
  ctx.fillText(formatDate(actual[0].date), pad.left, height - 29);
  ctx.textAlign = "right";
  ctx.fillText(formatDate(forecast.at(-1)?.date ?? actual.at(-1).date), width - pad.right, height - 29);
}

function drawLine(ctx, data, x, y, color, width) {
  if (!data.length) return;
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

function medianStepDays(data) {
  const steps = [];
  for (let i = 1; i < data.length; i++) {
    steps.push(Math.max(1, Math.round((data[i].date - data[i - 1].date) / dayMs)));
  }
  steps.sort((a, b) => a - b);
  return steps[Math.floor(steps.length / 2)] || 7;
}

function average(values) {
  return sum(values) / Math.max(1, values.length);
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function standardDeviation(values) {
  const mean = average(values);
  return Math.sqrt(average(values.map((value) => (value - mean) ** 2)));
}

function money(value) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

function shortMoney(value) {
  return `${Math.round(value / 1000).toLocaleString("ko-KR")}천`;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

els.applyData.addEventListener("click", () => {
  try {
    const parsed = parseCsv(els.csvInput.value);
    if (parsed.length < 6) throw new Error("최소 6개 이상의 가격 데이터가 필요합니다.");
    actualData = parsed;
    els.dataMessage.textContent = `${parsed.length}개 데이터를 반영했습니다.`;
    render();
  } catch (error) {
    els.dataMessage.textContent = error.message;
  }
});

els.loadSample.addEventListener("click", () => {
  actualData = [...createSampleData(), currentInsamtongPrice()];
  els.csvInput.value = toCsv(actualData);
  els.dataMessage.textContent = `샘플 데이터와 인삼통 ${formatDate(insamtongSnapshot.date)} 기준 시세를 불러왔습니다.`;
  render();
});

els.fetchMarket.addEventListener("click", async () => {
  const url = els.marketUrl.value.trim();
  if (!url) {
    els.marketMessage.textContent = "인삼통 시세 페이지 URL을 입력해주세요.";
    return;
  }

  try {
    els.marketMessage.textContent = "시세 페이지를 가져오는 중입니다.";
    const response = await fetch(url, { mode: "cors" });
    if (!response.ok) throw new Error(`요청 실패: ${response.status}`);
    els.marketPaste.value = await response.text();
    els.marketMessage.textContent = "페이지 내용을 가져왔습니다. 추출 반영을 눌러주세요.";
  } catch (error) {
    els.marketMessage.textContent =
      "브라우저 보안 정책으로 직접 가져오기가 막혔습니다. 인삼통 시세 표를 복사해 아래 입력칸에 붙여넣어 주세요.";
  }
});

els.applyMarket.addEventListener("click", () => {
  try {
    const marketData = parseMarketText(els.marketPaste.value);
    if (!marketData.length) throw new Error("시세 데이터를 찾지 못했습니다. 날짜와 가격이 보이도록 표 내용을 붙여넣어 주세요.");
    mergeMarketData(marketData);
    els.marketMessage.textContent = `인삼통 시세 ${marketData.length}건을 반영했습니다.`;
    render();
  } catch (error) {
    els.marketMessage.textContent = error.message;
  }
});

els.downloadCsv.addEventListener("click", () => {
  const header = "date,forecast,low,high";
  const body = forecastData
    .map((item) => `${formatDate(item.date)},${item.price},${item.low},${item.high}`)
    .join("\n");
  const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "ginseng-forecast.csv";
  link.click();
  URL.revokeObjectURL(url);
});

[els.productType, els.horizon, els.sensitivity].forEach((el) => {
  el.addEventListener("input", render);
});

window.addEventListener("resize", render);

els.csvInput.value = toCsv(actualData);
els.marketUrl.value = insamtongSource;
els.marketPaste.value = [
  `${formatDate(insamtongSnapshot.date)} 기준`,
  `단위 : ${insamtongSnapshot.unit}`,
  ...insamtongSnapshot.grades.map((item) => `${item.name} ${item.price.toLocaleString("ko-KR")} 원`),
].join("\n");
els.dataMessage.textContent = `인삼통 ${formatDate(insamtongSnapshot.date)} 기준 주요등급 평균가를 현재 시세로 반영했습니다.`;
render();
