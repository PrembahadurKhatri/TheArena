// Generates the illustrated SVG images used by the demo data (seedDemo.ts):
// player avatars, team crests and covers, a shop logo, product shots and
// ground photos. Writes them to frontend/public/demo/, which the frontend
// serves at /demo/... (no upload service needed).
//
//   (run via: npm run seed:demo -- --images)
import fs from "fs";
import path from "path";

const OUT = path.resolve(__dirname, "../../../frontend/public/demo");

// Small deterministic PRNG so the art is the same on every run.
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = <T,>(r: () => number, a: readonly T[]) => a[Math.floor(r() * a.length)];

const SKIN = ["#f1c7a3", "#e0ac83", "#c98e65", "#a8714c", "#8a5a3b"];
const HAIR = ["#1d1a17", "#2b2119", "#3b2a1e", "#4a3424", "#14110f"];
const BG = [
  ["#0f766e", "#14b8a6"], ["#1d4ed8", "#60a5fa"], ["#7c3aed", "#c084fc"], ["#b91c1c", "#f87171"],
  ["#c2410c", "#fb923c"], ["#15803d", "#4ade80"], ["#0e7490", "#22d3ee"], ["#be185d", "#f472b6"],
] as const;

export function avatar(seed: string, opts: { jersey?: string; female?: boolean } = {}) {
  const r = rng(seed);
  const skin = pick(r, SKIN);
  const hair = pick(r, HAIR);
  const [b1, b2] = pick(r, BG);
  const jersey = opts.jersey ?? pick(r, ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#111827", "#f8fafc"]);
  const style = Math.floor(r() * 3);
  const beard = !opts.female && r() < 0.3;
  const shirtNum = 1 + Math.floor(r() * 23);
  const hairBack = opts.female
    ? `<path d="M78 112c0-40 24-64 50-64s50 24 50 64v66c-12 6-24 8-34 6l-2-40h-28l-2 40c-10 2-22 0-34-6z" fill="${hair}"/>`
    : "";
  const hairTop = [
    `<path d="M84 104c2-34 22-52 44-52s42 18 44 52c-8-14-22-22-44-22s-36 8-44 22z" fill="${hair}"/>`,
    `<path d="M82 108c-2-40 20-60 46-60 30 0 48 22 46 60-6-20-18-26-28-26-6 8-30 10-40 4-12 4-20 12-24 22z" fill="${hair}"/>`,
    `<path d="M86 100c4-30 22-44 42-44s38 14 42 44c-10-8-26-12-42-12s-32 4-42 12z" fill="${hair}"/><rect x="86" y="94" width="84" height="8" rx="4" fill="${jersey}" opacity=".9"/>`,
  ][style];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${b1}"/><stop offset="1" stop-color="${b2}"/></linearGradient>
<linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".25"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<rect width="256" height="256" fill="url(#g)"/>
<circle cx="200" cy="52" r="70" fill="#fff" opacity=".07"/><circle cx="40" cy="220" r="60" fill="#000" opacity=".07"/>
${hairBack}
<path d="M40 256c4-52 40-78 88-78s84 26 88 78z" fill="${jersey}"/>
<path d="M40 256c4-52 40-78 88-78s84 26 88 78z" fill="url(#s)"/>
<path d="M108 178h40l-6 18c-6 6-22 6-28 0z" fill="${skin}"/>
<path d="M104 180l24 22 24-22" fill="none" stroke="#000" stroke-opacity=".18" stroke-width="4"/>
<text x="128" y="244" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="34" fill="#000" fill-opacity=".22">${shirtNum}</text>
<rect x="112" y="150" width="32" height="36" rx="12" fill="${skin}"/>
<ellipse cx="128" cy="116" rx="44" ry="50" fill="${skin}"/>
<ellipse cx="84" cy="120" rx="7" ry="11" fill="${skin}"/><ellipse cx="172" cy="120" rx="7" ry="11" fill="${skin}"/>
${beard ? `<path d="M88 124c4 30 20 42 40 42s36-12 40-42c-6 14-22 18-40 18s-34-4-40-18z" fill="${hair}" opacity=".85"/>` : ""}
<ellipse cx="111" cy="118" rx="4.5" ry="5.5" fill="#1f1a17"/><ellipse cx="145" cy="118" rx="4.5" ry="5.5" fill="#1f1a17"/>
<path d="M103 106q8-5 16 0M137 106q8-5 16 0" stroke="${hair}" stroke-width="4" stroke-linecap="round" fill="none"/>
<path d="M128 122v14l-5 3" stroke="#000" stroke-opacity=".2" stroke-width="3" fill="none" stroke-linecap="round"/>
<path d="M114 146q14 10 28 0" stroke="#7a2e2a" stroke-width="4" fill="none" stroke-linecap="round"/>
${hairTop}
</svg>`;
}

const TEAM_STYLE: Record<string, { c1: string; c2: string; icon: string; motto: string }> = {
  "thamel-strikers": { c1: "#dc2626", c2: "#fbbf24", motto: "EST. 2019", icon: `<path d="M128 70l14 30 33 4-24 23 6 33-29-16-29 16 6-33-24-23 33-4z" fill="#fbbf24"/>` },
  "patan-panthers": { c1: "#111827", c2: "#a855f7", motto: "LALITPUR", icon: `<path d="M86 132c6-34 24-56 42-56s36 22 42 56c-8-6-14-8-20-8l-10 22h-24l-10-22c-6 0-12 2-20 8z" fill="#a855f7"/><circle cx="114" cy="112" r="5" fill="#fde047"/><circle cx="142" cy="112" r="5" fill="#fde047"/><path d="M86 82l10 18M170 82l-10 18" stroke="#a855f7" stroke-width="8" stroke-linecap="round"/>` },
  "bhaktapur-bulls": { c1: "#9a3412", c2: "#f97316", motto: "BHAKTAPUR", icon: `<path d="M74 84c4 22 20 34 36 34M182 84c-4 22-20 34-36 34" stroke="#f8fafc" stroke-width="10" fill="none" stroke-linecap="round"/><path d="M104 110h48l-6 44c-4 10-12 14-18 14s-14-4-18-14z" fill="#f97316"/><circle cx="118" cy="132" r="4" fill="#111"/><circle cx="138" cy="132" r="4" fill="#111"/><ellipse cx="128" cy="154" rx="12" ry="7" fill="#fdba74"/>` },
  "lakeside-united": { c1: "#075985", c2: "#38bdf8", motto: "POKHARA", icon: `<path d="M84 120l26-40 18 26 12-16 32 30z" fill="#f8fafc"/><path d="M78 136q12-10 25 0t25 0 25 0 25 0M78 154q12-10 25 0t25 0 25 0 25 0" stroke="#38bdf8" stroke-width="7" fill="none" stroke-linecap="round"/>` },
};

export function teamLogo(slug: string, name: string) {
  const t = TEAM_STYLE[slug];
  const initials = name.split(/\s+/).map((w) => w[0]).join("").toUpperCase();
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${t.c1}"/><stop offset="1" stop-color="#0b0f17"/></linearGradient></defs>
<rect width="256" height="256" rx="40" fill="#0b0f17"/>
<path d="M128 18l92 30v70c0 62-40 104-92 122-52-18-92-60-92-122V48z" fill="url(#g)" stroke="${t.c2}" stroke-width="8"/>
<path d="M128 34l78 26v58c0 52-32 88-78 104-46-16-78-52-78-104V60z" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="3"/>
${t.icon}
<text x="128" y="204" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="34" letter-spacing="3" fill="#fff">${initials}</text>
<text x="128" y="226" text-anchor="middle" font-family="Arial,sans-serif" font-weight="700" font-size="11" letter-spacing="3" fill="${t.c2}">${t.motto}</text>
</svg>`;
}

export function teamCover(slug: string, name: string) {
  const t = TEAM_STYLE[slug];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1500 500" width="1500" height="500" preserveAspectRatio="xMidYMid slice">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${t.c1}"/><stop offset=".6" stop-color="#0b0f17"/><stop offset="1" stop-color="#020617"/></linearGradient>
<radialGradient id="l" cx=".8" cy="0" r=".8"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>
<rect width="1500" height="500" fill="url(#g)"/>
<g fill="none" stroke="#fff" stroke-opacity=".13" stroke-width="4">
<rect x="120" y="60" width="1260" height="520" rx="8"/><line x1="750" y1="60" x2="750" y2="580"/><circle cx="750" cy="320" r="110"/>
<path d="M120 200h120a120 120 0 0 1 0 240H120"/><path d="M1380 200h-120a120 120 0 0 0 0 240h120"/></g>
<g stroke="${t.c2}" stroke-opacity=".5" stroke-width="18">${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${900 + i * 110}" y1="500" x2="${1180 + i * 110}" y2="0"/>`).join("")}</g>
<rect width="1500" height="500" fill="url(#l)"/>
<text x="1440" y="460" text-anchor="end" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="72" letter-spacing="6" fill="#fff" fill-opacity=".14">${name.toUpperCase()}</text>
</svg>`;
}

export function storeLogo() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0ea5e9"/><stop offset="1" stop-color="#1e3a8a"/></linearGradient></defs>
<rect width="256" height="256" rx="56" fill="url(#g)"/>
<path d="M30 176l62-92 30 42 22-30 82 80z" fill="#f8fafc"/><path d="M92 84l-14 20 10-4 8 10 8-12zM144 96l-10 14 8-2 6 8 8-8z" fill="#bae6fd"/>
<circle cx="190" cy="70" r="18" fill="#fde047"/>
<text x="128" y="222" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="30" letter-spacing="2" fill="#fff">HIMAL</text>
</svg>`;
}

// Product shots: one object on a soft studio background.
const studio = (inner: string, c1 = "#f1f5f9", c2 = "#cbd5e1") => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
<defs><radialGradient id="bg" cx=".5" cy=".4" r=".75"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient>
<radialGradient id="sh" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#000" stop-opacity=".28"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="hi" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
<rect width="800" height="800" fill="url(#bg)"/><ellipse cx="400" cy="690" rx="250" ry="34" fill="url(#sh)"/>
${inner}</svg>`;

export const PRODUCT_ART: Record<string, string> = {
  ball: studio(`<circle cx="400" cy="400" r="250" fill="#fefce8"/>
<g fill="#1e3a8a"><path d="M400 290l70 50-26 82h-88l-26-82z"/><path d="M250 250l60 20 6 60-60 44-60-30q4-58 54-94z"/><path d="M550 250q50 36 54 94l-60 30-60-44 6-60z"/><path d="M330 600l20-80h100l20 80q-70 28-140 0z"/></g>
<g stroke="#1e3a8a" stroke-width="6" fill="none"><path d="M400 290v-140M470 340l84-40M444 422l60 60M356 422l-60 60M330 340l-84-40"/></g>
<circle cx="400" cy="400" r="250" fill="none" stroke="#1e293b" stroke-width="8"/>
<ellipse cx="320" cy="260" rx="120" ry="60" fill="url(#hi)" transform="rotate(-30 320 260)"/>
<circle cx="400" cy="400" r="250" fill="none" stroke="#facc15" stroke-width="14" stroke-dasharray="40 70" opacity=".8"/>`, "#e0f2fe", "#7dd3fc"),
  jersey: studio(`<path d="M290 160l-150 70 50 140 70-30v330h280V340l70 30 50-140-150-70q-30 50-110 50t-110-50z" fill="#dc2626"/>
<path d="M290 160q30 50 110 50t110-50l-20-8q-26 36-90 36t-90-36z" fill="#fbbf24"/>
<g fill="#b91c1c">${[0, 1, 2, 3].map((i) => `<rect x="${250 + i * 80}" y="220" width="30" height="450"/>`).join("")}</g>
<path d="M140 230l50 140 18-8-48-138z" fill="#fbbf24"/><path d="M660 230l-50 140-18-8 48-138z" fill="#fbbf24"/>
<text x="400" y="470" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-weight="900" font-size="170" fill="#fff">10</text>
<rect x="430" y="250" width="56" height="56" rx="10" fill="#fff" opacity=".9"/><path d="M458 262l6 14 15 2-11 10 3 15-13-8-13 8 3-15-11-10 15-2z" fill="#dc2626"/>`, "#fef2f2", "#fecaca"),
  shoes: studio(`<path d="M130 520q-10-90 40-120l120-30q50 10 90 60l60 50q120 10 210 50 30 20 20 70H140q-14-30-10-80z" fill="#111827"/>
<path d="M140 600h540q8 26-12 46H156q-20-16-16-46z" fill="#f59e0b"/>
<path d="M300 380l40 60M330 372l40 60M360 380l36 50M390 400l30 40" stroke="#f8fafc" stroke-width="10" stroke-linecap="round"/>
<path d="M190 470q120-20 230 40 120 20 240 50" stroke="#22d3ee" stroke-width="22" fill="none" stroke-linecap="round"/>
<path d="M180 420q40-30 110-40" stroke="#fff" stroke-opacity=".35" stroke-width="12" fill="none" stroke-linecap="round"/>`, "#ecfeff", "#a5f3fc"),
  bat: studio(`<g transform="rotate(-35 400 400)"><rect x="380" y="60" width="40" height="230" rx="14" fill="#1f2937"/>
<g stroke="#ef4444" stroke-width="10">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="380" y1="${90 + i * 28}" x2="420" y2="${100 + i * 28}"/>`).join("")}</g>
<path d="M340 290h120l10 420q-70 30-140 0z" fill="#e9c58f"/><path d="M400 300v400" stroke="#c89b5c" stroke-width="10"/>
<path d="M350 300h20l-4 400h-18z" fill="#fff" opacity=".3"/>
<rect x="352" y="380" width="96" height="70" rx="8" fill="#111827"/><text x="400" y="426" text-anchor="middle" font-family="Arial Black,Arial,sans-serif" font-size="30" fill="#fbbf24">HW</text></g>`, "#fefce8", "#fde68a"),
  gloves: studio(`${[[-1, 290], [1, 510]].map(([d, x]) => `<g transform="translate(${x} 0) scale(${d} 1)">
<path d="M-110 640v-200q-40-40-30-100 6-30 30-30v-150q0-30 30-30t30 30v-20q0-30 30-30t30 30v10q0-30 30-30t30 30v40q0-26 26-26t26 30v260q0 80-60 120v66z" fill="#16a34a"/>
<path d="M-110 560h196v80h-196z" fill="#111827"/><path d="M-80 200v160M-20 170v180M40 190v170" stroke="#fff" stroke-opacity=".4" stroke-width="8" stroke-linecap="round"/>
<rect x="-100" y="580" width="176" height="20" fill="#facc15"/></g>`).join("")}`, "#f0fdf4", "#bbf7d0"),
  bands: studio(`${["#ef4444", "#f59e0b", "#22c55e", "#3b82f6", "#111827"].map((c, i) => `<ellipse cx="${250 + i * 75}" cy="${420 - (i % 2) * 30}" rx="${150 - i * 10}" ry="${60 + i * 4}" fill="none" stroke="${c}" stroke-width="34" transform="rotate(${-20 + i * 12} ${250 + i * 75} 420)"/>`).join("")}`, "#faf5ff", "#e9d5ff"),
  shinguards: studio(`${[300, 500].map((x) => `<path d="M${x - 90} 200q90-60 180 0v340q-10 90-90 110-80-20-90-110z" fill="#0f172a"/>
<path d="M${x - 70} 230q70-40 140 0v300q-10 70-70 90-60-20-70-90z" fill="#2563eb"/>
<path d="M${x - 40} 260v260M${x} 250v300M${x + 40} 260v260" stroke="#93c5fd" stroke-width="10" stroke-linecap="round" opacity=".6"/>`).join("")}`, "#eff6ff", "#bfdbfe"),
};

export function groundPhoto(variant: "futsal" | "indoor") {
  const turf = variant === "futsal" ? ["#15803d", "#166534"] : ["#b45309", "#92400e"];
  const lines = variant === "futsal" ? "#ecfccb" : "#fde68a";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900">
<defs><linearGradient id="sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b1026"/><stop offset="1" stop-color="#312e81"/></linearGradient>
<radialGradient id="glow" cx=".5" cy="0" r=".6"><stop offset="0" stop-color="#fef9c3" stop-opacity=".9"/><stop offset="1" stop-color="#fef9c3" stop-opacity="0"/></radialGradient></defs>
<rect width="1600" height="900" fill="url(#sky)"/>
${Array.from({ length: 40 }, (_, i) => `<circle cx="${(i * 389) % 1600}" cy="${(i * 97) % 260}" r="${1 + (i % 3)}" fill="#fff" opacity=".6"/>`).join("")}
<path d="M0 330l180-90 160 60 220-120 200 110 180-80 240 120 220-100 200 90v100H0z" fill="#1e1b4b"/>
${[200, 1400].map((x) => `<rect x="${x - 6}" y="150" width="12" height="300" fill="#334155"/><rect x="${x - 60}" y="130" width="120" height="40" rx="6" fill="#e2e8f0"/><ellipse cx="${x}" cy="180" rx="380" ry="260" fill="url(#glow)" opacity=".5"/>`).join("")}
<path d="M0 430h1600v470H0z" fill="#0f172a"/>
<path d="M120 900L320 440h960l200 460z" fill="${turf[0]}"/>
${Array.from({ length: 8 }, (_, i) => `<path d="M${120 + i * 170} 900L${320 + i * 120} 440h60L${120 + (i + 1) * 170 - 85} 900z" fill="${turf[1]}" opacity=".6"/>`).join("")}
<g fill="none" stroke="${lines}" stroke-width="6" opacity=".9"><path d="M160 880L340 460h920l180 420z"/><path d="M800 460v420"/><ellipse cx="800" cy="640" rx="140" ry="60"/>
<path d="M610 460q190 70 380 0"/><path d="M500 880q300-120 600 0"/></g>
<rect x="740" y="410" width="120" height="50" fill="none" stroke="#f8fafc" stroke-width="6"/>
<path d="M0 430h120v470H0zM1480 430h120v470h-120z" fill="#1e293b"/>
<g stroke="#64748b" stroke-width="2" opacity=".5">${Array.from({ length: 18 }, (_, i) => `<line x1="${i * 90}" y1="250" x2="${i * 90}" y2="440"/>`).join("")}<line x1="0" y1="300" x2="1600" y2="300"/><line x1="0" y1="370" x2="1600" y2="370"/></g>
<circle cx="900" cy="700" r="22" fill="#fefce8" stroke="#1e3a8a" stroke-width="4"/>
</svg>`;
}

export const AVATAR_JERSEY: Record<string, string> = {
  "thamel-strikers": "#dc2626", "patan-panthers": "#111827", "bhaktapur-bulls": "#ea580c", "lakeside-united": "#0284c7",
};

function write(file: string, svg: string) {
  fs.writeFileSync(path.join(OUT, file), svg.replace(/\n/g, ""));
}

export function generateDemoArt(people: { key: string; team?: string; female?: boolean }[], teams: { slug: string; name: string }[]) {
  fs.mkdirSync(OUT, { recursive: true });
  for (const p of people) write(`avatar-${p.key}.svg`, avatar(p.key, { jersey: p.team ? AVATAR_JERSEY[p.team] : undefined, female: p.female }));
  for (const t of teams) {
    write(`team-${t.slug}.svg`, teamLogo(t.slug, t.name));
    write(`cover-${t.slug}.svg`, teamCover(t.slug, t.name));
  }
  write("store-himal.svg", storeLogo());
  for (const [k, svg] of Object.entries(PRODUCT_ART)) write(`product-${k}.svg`, svg);
  write("ground-futsal.svg", groundPhoto("futsal"));
  write("ground-indoor.svg", groundPhoto("indoor"));
  return OUT;
}
