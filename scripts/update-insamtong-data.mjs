import { mkdir, writeFile } from "node:fs/promises";

const sourceUrl = "https://insamtong.kr/";
const outputPath = new URL("../data/insamtong-latest.json", import.meta.url);
const gradeNames = ["원삼 / 대", "원삼 / 믹서", "난발삼 / 잔난", "난발삼 / 콩콩콩난", "삼계 / 삼계", "원료삼 / 파삼"];

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
    updatedAt: new Date().toISOString(),
    date: dateMatch
      ? `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`
      : new Date().toISOString().slice(0, 10),
    unit: unitMatch?.[1] ?? "750g(1채)",
    grades,
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

await mkdir(new URL("../data/", import.meta.url), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.log(`Updated ${outputPath.pathname} with ${data.grades.length} grades from ${data.date}.`);
