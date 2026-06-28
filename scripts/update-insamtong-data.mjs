import { mkdir, writeFile } from "node:fs/promises";

const sourceUrl = "https://insamtong.kr/";
const reportUrl = "https://insamtong.kr/priceReport.do";
const reportApiUrl = "https://insamtong.kr/priceReport.json";
const outputPath = new URL("../data/insamtong-latest.json", import.meta.url);
const gradeNames = ["원삼 / 대", "원삼 / 믹서", "난발삼 / 잔난", "난발삼 / 콩콩콩난", "삼계 / 삼계", "원료삼 / 파삼"];
const visibleParentIds = ["1", "2", "3", "92", "6"];
const excludedDetailIds = new Set(["8", "68", "18", "19", "28", "29", "30", "31", "32", "33", "34", "35", "91"]);
const gradeUnitMap = {
  9: "750g [1채(3~4뿌리)]",
  10: "750g [1채(4뿌리)]",
  11: "750g [1채(5뿌리)]",
  12: "750g [1채(6뿌리)]",
  13: "750g [1채(7뿌리)]",
  14: "750g [1채(8~9뿌리)]",
  15: "750g [1채(10~11뿌리)]",
  16: "750g [1채(12~14뿌리)]",
  17: "750g [1채]",
  20: "750g [1채(5뿌리)]",
  21: "750g [1채(6~7뿌리)]",
  22: "750g [1채(8~9뿌리)]",
  23: "750g [1채(10~11뿌리)]",
  24: "750g [1채(12~14뿌리)]",
  25: "750g [1채(15~18뿌리)]",
  26: "750g [1채(19~20뿌리)]",
  27: "750g [1채(21~25뿌리)]",
  48: "750g [1채]",
  93: "750g [1채(5뿌리)]",
  94: "750g [1채(6뿌리)]",
  95: "750g [1채(7뿌리)]",
  96: "750g [1채(8~9뿌리)]",
  97: "750g [1채(9~10뿌리)]",
  98: "750g [1채(11~13뿌리)]",
  99: "750g [1채(14뿌리 이하)]",
};

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
  const grades = gradeNames
    .map((name) => {
      const escaped = name.replace("/", "\\/");
      const pattern = new RegExp(`${escaped}\\s*(\\d{1,3}(?:,\\d{3})+|\\d{4,7})\\s*원(?:[\\s\\S]{0,100}?(상승|하락)\\s*(\\d+(?:\\.\\d+)?)%)?`);
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

  if (grades.length < 3) {
    throw new Error(`Could not parse enough grades from ${sourceUrl}. Parsed ${grades.length}.`);
  }

  return {
    sourceUrl,
    reportUrl,
    updatedAt: new Date().toISOString(),
    date: dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : new Date().toISOString().slice(0, 10),
    unit: unitMatch?.[1] ?? "750g(1채)",
    grades,
  };
}

function parseGradeCodeMap(html) {
  const match = html.match(/const gradeCodeMap\s*=\s*(\{[\s\S]*?\n\s*\});/);
  if (!match) throw new Error("Could not find gradeCodeMap.");

  const map = Function(`"use strict"; return (${match[1]});`)();
  return visibleParentIds.flatMap((parentId) => {
    const parent = map[parentId];
    if (!parent?.children) return [];

    return parent.children
      .filter((child) => !excludedDetailIds.has(String(child.id)))
      .map((child) => ({
        id: String(child.id),
        parentId: String(parent.id),
        parentName: parent.name,
        name: child.name,
        label: `${parent.name} / ${child.name}`,
        description: child.description || "",
        unit: gradeUnitMap[child.id] ?? "750g [1채]",
      }));
  });
}

function dateOffset(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function numberOrNull(value) {
  if (value === null || typeof value === "undefined") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; GinsengForecastBot/1.0)",
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

async function fetchDetailGrade(grade) {
  const params = new URLSearchParams({
    grade: grade.id,
    startDate: dateOffset(-120),
    endDate: dateOffset(0),
    search: "1",
    parents: grade.parentId,
    baseYear: "",
    startBaseYear: "",
    endBaseYear: "",
    startDate2: "",
    endDate2: "",
    page: "1",
    pageSize: "40",
  });
  const response = await fetch(`${reportApiUrl}?${params}`, {
    headers: {
      "user-agent": "Mozilla/5.0 (compatible; GinsengForecastBot/1.0)",
      referer: reportUrl,
      "x-requested-with": "XMLHttpRequest",
    },
  });

  if (!response.ok) throw new Error(`Failed detail fetch for ${grade.label}: ${response.status}`);

  const payload = await response.json();
  if (payload.errCd !== "00") throw new Error(`Detail API error for ${grade.label}: ${payload.errMsg}`);

  const records = payload.result
    .map((item) => ({
      date: item.latest_date,
      unit: item.units ?? "750g",
      minPrice: numberOrNull(item.latest_min_price),
      maxPrice: numberOrNull(item.latest_max_price),
      price: numberOrNull(item.latest_price),
      previousDayPrice: numberOrNull(item.previous_day_price),
      previousDayPct: numberOrNull(item.previous_day_per),
      previousMonthPrice: numberOrNull(item.previous_month_price),
      previousMonthPct: numberOrNull(item.previous_month_per),
      previousYearPrice: numberOrNull(item.previous_year_price),
      previousYearPct: numberOrNull(item.previous_year_per),
      qtyTon: numberOrNull(item.qty),
      qtyMonthPct: numberOrNull(item.qtyMonthPer),
      qtyYearPct: numberOrNull(item.qtyYearPer),
    }))
    .filter((item) => item.date && item.price);

  const latest = records[0];
  if (!latest) return null;

  return {
    ...grade,
    date: latest.date,
    price: latest.price,
    minPrice: latest.minPrice,
    maxPrice: latest.maxPrice,
    changePct: latest.previousDayPct ?? 0,
    previousDayPct: latest.previousDayPct,
    previousMonthPct: latest.previousMonthPct,
    previousYearPct: latest.previousYearPct,
    qtyTon: latest.qtyTon,
    qtyMonthPct: latest.qtyMonthPct,
    qtyYearPct: latest.qtyYearPct,
    records,
  };
}

const response = await fetch(sourceUrl, {
  headers: {
    "user-agent": "Mozilla/5.0 (compatible; GinsengForecastBot/1.0)",
  },
});

if (!response.ok) {
  throw new Error(`Failed to fetch ${sourceUrl}: ${response.status}`);
}

const html = await response.text();
const data = parseInsamtong(html);
const reportHtml = await fetchText(reportUrl);
const detailGradeCodes = parseGradeCodeMap(reportHtml);
const detailGrades = (await Promise.all(detailGradeCodes.map(fetchDetailGrade))).filter(Boolean);

data.detailGrades = detailGrades;

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(
  `Updated ${outputPath.pathname} with ${data.grades.length} summary grades and ${data.detailGrades.length} detail grades from ${data.date}.`
);
