#!/usr/bin/env node
/**
 * Generates the profile assets:
 *   assets/header.svg            elegant, static letterhead
 *   assets/stats/github-stats.svg
 *   assets/stats/top-languages.svg
 *
 * Usage:
 *   node scripts/generate-assets.mjs              # header + stats
 *   node scripts/generate-assets.mjs --stats-only # stats only (used by CI)
 *
 * GITHUB_TOKEN is optional. Without it the public API is used and the
 * numbers come from live public data (subject to rate limits). When a
 * request fails, the previous values are reused so the cards never break.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LOGIN = process.env.GITHUB_LOGIN || "JoHaile";
const TOKEN = process.env.GITHUB_TOKEN || "";
const STATS_ONLY = process.argv.includes("--stats-only");

const CORE = {
  commits: 792,
  stars: 21,
  prs: 25,
  repos: 17,
  since: 2024,
  languages: [
    { name: "TypeScript", pct: 84.7 },
    { name: "JavaScript", pct: 7.7 },
    { name: "CSS", pct: 3.3 },
    { name: "Java", pct: 2.3 },
    { name: "Jupyter Notebook", pct: 1.5 },
    { name: "HTML", pct: 0.5 },
  ],
};

const headers = {
  Accept: "application/vnd.github+json",
  "User-Agent": `${LOGIN}-profile-readme`,
  ...(TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
};

async function api(path) {
  const res = await fetch(`https://api.github.com${path}`, { headers });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return res.json();
}

function fmt(n) {
  if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, "") + "m";
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

async function collectStats() {
  const out = { ...CORE };
  try {
    const user = await api(`/users/${LOGIN}`);
    out.repos = user.public_repos;
    out.since = new Date(user.created_at).getUTCFullYear();

    const repos = (await api(`/users/${LOGIN}/repos?per_page=100&sort=pushed`)).filter((r) => !r.fork);
    out.stars = repos.reduce((sum, r) => sum + r.stargazers_count, 0);

    const [commits, prs] = await Promise.all([
      api(`/search/commits?q=author:${LOGIN}&per_page=1`),
      api(`/search/issues?q=author:${LOGIN}+type:pr&per_page=1`),
    ]);
    out.commits = commits.total_count;
    out.prs = prs.total_count;

    const totals = {};
    for (const repo of repos) {
      try {
        const langs = await api(`/repos/${LOGIN}/${repo.name}/languages`);
        for (const [name, bytes] of Object.entries(langs)) totals[name] = (totals[name] || 0) + bytes;
      } catch {
        /* skip a single unreadable repo */
      }
    }
    const sum = Object.values(totals).reduce((a, b) => a + b, 0);
    if (sum > 0) {
      out.languages = Object.entries(totals)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([name, bytes]) => ({ name, pct: +((bytes / sum) * 100).toFixed(1) }));
    }
  } catch (err) {
    console.warn(`stats unavailable (${err.message}); keeping previous values`);
  }
  return out;
}

/* ---------- fonts ---------- */

const fontCache = new Map();
async function font(file) {
  if (!fontCache.has(file)) {
    const b64 = (await readFile(join(ROOT, "scripts", "fonts", file))).toString("base64");
    fontCache.set(file, b64);
  }
  return fontCache.get(file);
}

async function faces(which) {
  const inter = await font("inter-var.woff2");
  const corm = await font("cormorant-garamond-var.woff2");
  const cormItalic = await font("cormorant-garamond-italic-var.woff2");
  const face = (family, data, style = "normal", weight = "100 900") =>
    `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${data}) format('woff2');font-style:${style};font-weight:${weight};`;
  const parts = [face("Inter", inter)];
  if (which === "header") {
    parts.push(face("Cormorant", corm, "normal", "300 700"));
    parts.push(face("Cormorant", cormItalic, "italic", "300 700"));
  }
  return parts.join("");
}

/* ---------- palette ---------- */

const P = {
  paper: "#F7F4EC",
  paperDeep: "#F1EBDD",
  line: "#E4DBC7",
  ink: "#221F1B",
  muted: "#7A7062",
  gold: "#9C7B31",
  goldLight: "#C9A85E",
};

const GOLD_RAMP = ["#A8863C", "#BD9E55", "#CDB273", "#D9C69A", "#E5D7B8", "#EEE4CF"];

/* ---------- header ---------- */

async function headerSvg() {
  const css = await faces("header");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="190" viewBox="0 0 1200 190" role="img" aria-label="Yohannes Haile">
  <defs>
    <style>${css}</style>
    <linearGradient id="paper" x1="0" y1="0" x2="1200" y2="190" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F9F6EF"/><stop offset="1" stop-color="${P.paperDeep}"/>
    </linearGradient>
    <linearGradient id="gold" x1="380" y1="0" x2="820" y2="0" gradientUnits="userSpaceOnUse">
      <stop stop-color="${P.goldLight}"/><stop offset=".5" stop-color="${P.gold}"/><stop offset="1" stop-color="${P.goldLight}"/>
    </linearGradient>
    <linearGradient id="rule" x1="0" y1="0" x2="1" y2="0">
      <stop stop-color="${P.gold}" stop-opacity="0"/><stop offset=".5" stop-color="${P.gold}" stop-opacity=".65"/><stop offset="1" stop-color="${P.gold}" stop-opacity="0"/>
    </linearGradient>
  </defs>

  <rect x="0.5" y="0.5" width="1199" height="189" rx="18" fill="url(#paper)" stroke="${P.line}"/>

  <circle cx="72" cy="95" r="2" fill="${P.goldLight}" opacity=".55"/>
  <circle cx="1128" cy="95" r="2" fill="${P.goldLight}" opacity=".55"/>

  <text x="600" y="94" text-anchor="middle" fill="url(#gold)"
        font-family="Cormorant, Georgia, serif" font-size="66" font-weight="600" letter-spacing="1.5">Yohannes Haile</text>

  <g>
    <rect x="486" y="116.5" width="98" height="1" fill="url(#rule)"/>
    <rect x="616" y="116.5" width="98" height="1" fill="url(#rule)"/>
    <rect x="596" y="113" width="8" height="8" rx="1" transform="rotate(45 600 117)" fill="${P.gold}"/>
  </g>

  <text x="600" y="149" text-anchor="middle" fill="${P.muted}"
        font-family="Inter, system-ui, sans-serif" font-size="12" font-weight="500" letter-spacing="4.2">FULL-STACK DEVELOPER · NEXT.JS · REACT · TYPESCRIPT</text>
</svg>
`;
}

/* ---------- stats card ---------- */

async function statsSvg(d) {
  const css = await faces("stats");
  const metrics = [
    [d.commits, "Commits"],
    [d.stars, "Stars"],
    [d.prs, "Pull requests"],
    [d.repos, "Repositories"],
  ];
  const cells = metrics
    .map(([value, label], i) => {
      const x = i % 2 === 0 ? 30 : 258;
      const y = i < 2 ? 118 : 184;
      return `<text x="${x}" y="${y}" fill="${P.ink}" font-family="Inter, system-ui, sans-serif" font-size="36" font-weight="600" letter-spacing="-1">${fmt(value)}</text>
  <text x="${x}" y="${y + 20}" fill="${P.muted}" font-family="Inter, system-ui, sans-serif" font-size="9.5" font-weight="600" letter-spacing="2.2">${label.toUpperCase()}</text>`;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="220" viewBox="0 0 495 220" role="img" aria-label="GitHub stats">
  <defs>
    <style>${css}</style>
    <linearGradient id="paper" x1="0" y1="0" x2="495" y2="220" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F9F6EF"/><stop offset="1" stop-color="${P.paperDeep}"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="494" height="219" rx="16" fill="url(#paper)" stroke="${P.line}"/>
  <text x="30" y="43" fill="${P.gold}" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="600" letter-spacing="2.6">GITHUB STATS</text>
  <text x="465" y="43" text-anchor="end" fill="${P.muted}" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="500" letter-spacing="1.6">SINCE ${d.since}</text>
  <rect x="30" y="60.5" width="435" height="1" fill="${P.line}"/>
  ${cells}
</svg>
`;
}

/* ---------- languages card ---------- */

async function languagesSvg(d) {
  const css = await faces("stats");
  const rows = d.languages
    .map((lang, i) => {
      const y = 96 + i * 21;
      const barY = y - 8;
      const width = Math.max(4, (lang.pct / 100) * 240);
      return `<text x="30" y="${y}" fill="${P.ink}" font-family="Inter, system-ui, sans-serif" font-size="11.5" font-weight="500">${esc(lang.name)}</text>
  <rect x="152" y="${barY}" width="240" height="5" rx="2.5" fill="#E8DFCC"/>
  <rect x="152" y="${barY}" width="${width.toFixed(1)}" height="5" rx="2.5" fill="${GOLD_RAMP[i % GOLD_RAMP.length]}"/>
  <text x="465" y="${y}" text-anchor="end" fill="${P.muted}" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="600">${lang.pct.toFixed(1)}%</text>`;
    })
    .join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="495" height="220" viewBox="0 0 495 220" role="img" aria-label="Top languages">
  <defs>
    <style>${css}</style>
    <linearGradient id="paper" x1="0" y1="0" x2="495" y2="220" gradientUnits="userSpaceOnUse">
      <stop stop-color="#F9F6EF"/><stop offset="1" stop-color="${P.paperDeep}"/>
    </linearGradient>
  </defs>
  <rect x="0.5" y="0.5" width="494" height="219" rx="16" fill="url(#paper)" stroke="${P.line}"/>
  <text x="30" y="43" fill="${P.gold}" font-family="Inter, system-ui, sans-serif" font-size="10.5" font-weight="600" letter-spacing="2.6">TOP LANGUAGES</text>
  <text x="465" y="43" text-anchor="end" fill="${P.muted}" font-family="Inter, system-ui, sans-serif" font-size="9" font-weight="500" letter-spacing="1.6">BY CODE VOLUME</text>
  <rect x="30" y="60.5" width="435" height="1" fill="${P.line}"/>
  ${rows}
</svg>
`;
}

/* ---------- main ---------- */

await mkdir(join(ROOT, "assets", "stats"), { recursive: true });

if (!STATS_ONLY) {
  await writeFile(join(ROOT, "assets", "header.svg"), await headerSvg());
  console.log("wrote assets/header.svg");
}

const data = await collectStats();
await writeFile(join(ROOT, "assets", "stats", "github-stats.svg"), await statsSvg(data));
await writeFile(join(ROOT, "assets", "stats", "top-languages.svg"), await languagesSvg(data));
console.log(
  `wrote stats cards — ${data.commits} commits, ${data.stars} stars, ${data.prs} PRs, ${data.repos} repos; languages: ${data.languages
    .map((l) => `${l.name} ${l.pct}%`)
    .join(", ")}`
);
