

import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import archiver from "archiver";
import { Faker, de, en_US, en, base } from "@faker-js/faker";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));


const localesDir = path.join(__dirname, "locales");
const localeCache = {};
function loadLocale(code) {
  if (localeCache[code]) return localeCache[code];
  const p = path.join(localesDir, `${code}.json`);
  if (!fs.existsSync(p)) throw new Error(`Locale JSON not found for ${code}`);
  localeCache[code] = JSON.parse(fs.readFileSync(p, "utf-8"));
  return localeCache[code];
}

// Faker must have a fallback chain to avoid "person.first_name missing".
function getFakerForRegion(region) {
  const primary = region === "de-DE" ? de : en_US;

  return new Faker({ locale: [primary, en, base] });
}


function toBigInt64(seedStr) {
  try {
    if (typeof seedStr === "bigint") return seedStr;
    if (typeof seedStr === "number") return BigInt(seedStr >>> 0);
    const s = String(seedStr).trim();
    if (s.startsWith("0x") || s.startsWith("0X")) return BigInt(s);
    return BigInt(s);
  } catch {
    let h = 0n;
    for (const ch of String(seedStr)) {
      h = (h * 131n + BigInt(ch.codePointAt(0) || 0)) & ((1n << 64n) - 1n);
    }
    return h;
  }
}

function makeRng64(seedBig, pageNum) {
  const GOLDEN = 0x9e3779b97f4a7c15n;
  let s = (seedBig ^ (BigInt(pageNum) * GOLDEN)) & ((1n << 64n) - 1n);
  if (s === 0n) s = 0x106689d45497fdb5n;
  return () => {
    s ^= s >> 12n; s ^= s << 25n; s ^= s >> 27n;
    const x = (s * 0x2545f4914f6cdd1dn) & ((1n << 64n) - 1n);
    return Number(x >> 11n) / 9007199254740992; 
  };
}
const rngInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)] || arr[0];


function makeTitle(rng, loc) {
  const { adjectives, nouns, suffixes } = loc.title_words;
  const pattern = rng() < 0.5 ? 1 : rng() < 0.75 ? 2 : 3;
  if (pattern === 1) return `${pick(rng, adjectives)} ${pick(rng, nouns)}`;
  if (pattern === 2) return `${pick(rng, nouns)} of ${pick(rng, nouns)}`;
  return `${pick(rng, adjectives)} ${pick(rng, nouns)} ${pick(rng, suffixes)}`;
}

const FALLBACK_FIRST = ["Alex","Jamie","Taylor","Sam","Jordan","Casey","Riley","Avery"];
const FALLBACK_LAST  = ["Keller","Meyer","Fischer","Schmidt","Brown","Johnson","Lee","Davis"];

function makeArtist(rng, faker) {
  const isBand = rng() < 0.5;
  if (isBand) {
    const baseName =
      faker.company?.name?.() ||
      faker.company?.companyName?.() ||
      `${pick(rng, FALLBACK_LAST)} GmbH`;
    const tails = ["Collective","Trio","Quartet","Band","Project","Club","Ensemble","Syndicate","Unit","Crew"];
    return `${baseName} ${pick(rng, tails)}`;
  }
  const first =
    faker.person?.firstName?.() ||
    faker.name?.firstName?.() ||
    pick(rng, FALLBACK_FIRST);
  const last =
    faker.person?.lastName?.() ||
    faker.name?.lastName?.() ||
    pick(rng, FALLBACK_LAST);
  return `${first} ${last}`;
}

function makeAlbumOrSingle(rng, loc) {
  if (rng() < 0.28) return loc.single_label || "Single";
  const aw = loc.album_words || loc.title_words || {};
  const adjectives = aw.adjectives || ["Golden","Neon","Hidden","Loud","Quiet","Liquid","Sacred","Soft","Cold","Burning","Noisy","Deep","Early","Late"];
  const nouns = aw.nouns || ["Rooms","Signals","Stories","Hearts","Lights","Waves","Skies","Windows","Machines","Echoes","Sparks","Shadows"];
  const suffixes = aw.suffixes || ["Vol. I","Vol. II","Deluxe","(EP)","Sessions","Tapes","Stories","Diary"];
  return rng() < 0.6
    ? `${pick(rng, adjectives)} ${pick(rng, nouns)}`
    : `${pick(rng, nouns)} ${pick(rng, suffixes)}`;
}

function likesFromAvg(rng, avg) {
  if (avg <= 0) return 0;
  if (avg >= 10) return 10;
  const base = Math.floor(avg);
  const p = avg - base;
  return base + (rng() < p ? 1 : 0);
}


function makeCoverSvg({ title, artist, w=512, h=512, hue=200, sat=60, lum=20 }) {
  const bg1 = `hsl(${hue}, ${sat}%, ${lum + 20}%)`;
  const bg2 = `hsl(${(hue + 60) % 360}, ${Math.max(40, sat - 10)}%, ${lum + 30}%)`;
  const txt = "#111";
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${bg1}"/>
      <stop offset="100%" stop-color="${bg2}"/>
    </linearGradient>
  </defs>
  <rect width="100%" height="100%" fill="url(#g)"/>
  <text x="32" y="${h/2 - 20}" font-family="Arial, Helvetica, sans-serif" font-size="28" font-weight="700" fill="${txt}">${escapeXml(title)}</text>
  <text x="32" y="${h/2 + 20}" font-family="Arial, Helvetica, sans-serif" font-size="18" fill="${txt}">by ${escapeXml(artist)}</text>
</svg>`;
}
const escapeXml = s => String(s).replace(/[<>&'"]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;'}[c]));


const SAMPLE_RATE = 44100;
function noteFreq(semitonesFromA4) { return 440 * Math.pow(2, semitonesFromA4 / 12); }
const SCALES = { C_major: [0,2,4,5,7,9,11], A_minor: [0,2,3,5,7,8,10] };

function oscSample(type, f, t) {
  const x = 2 * Math.PI * f * t;
  if (type === "sine") return Math.sin(x);
  if (type === "triangle") return (2 * Math.asin(Math.sin(x))) / Math.PI;
  if (type === "square") return Math.sign(Math.sin(x));
  return Math.sin(x);
}

function synthSongPcm(rng, seconds = 10) {
  const sr = SAMPLE_RATE;
  seconds = Math.min(15, Math.max(1, Number(seconds) || 10));
  const length = seconds * sr;
  const pcm = new Float32Array(length);

  const bpm = 110 + Math.floor(rng() * 40);
  const spb = 60 / bpm;
  const bar = 4 * spb;
  const scale = rng() < 0.5 ? SCALES.C_major : SCALES.A_minor;
  const root = rngInt(rng, -12, 12);
  const oscTypes = ["sine","triangle","square"];
  const osc = pick(rng, oscTypes);
  const prog = [0, 5, 3, 4];
  const bars = Math.ceil(seconds / bar);

  let t = 0;
  const envAttack = 0.01, envRelease = 0.2;

  for (let b = 0; b < bars; b++) {
    const degree = prog[b % prog.length];
    const chord = [0,4,7].map(i => i + degree);
    const chordFreqs = chord.map(d => noteFreq(root + (scale[d % scale.length] - 9)));

    for (let step = 0; step < 8; step++) {
      const dur = spb / 2;
      const start = Math.floor(t * sr);
      const end = Math.min(length, start + Math.floor(dur * sr));
      const melDegree = degree + (rngInt(rng, 0, 3) - 1);
      const melFreq = noteFreq(root + (scale[((melDegree % 7) + 7) % 7] - 9));

      for (let i = start; i < end; i++) {
        const tt = (i - start) / (end - start + 1);
        const env = tt < envAttack ? tt / envAttack : Math.max(0, 1 - (tt - (1 - envRelease)));
        let v = 0;
        for (const f of chordFreqs) v += oscSample(osc, f, i / sr);
        v = (v / 3) * 0.25;
        const lead = oscSample(osc, melFreq, i / sr) * 0.5;
        pcm[i] += (v + lead) * env;
      }
      t += dur;
    }
  }

  
  let max = 0; for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(pcm[i]));
  const gain = max > 0 ? 0.98 / max : 1;
  const out = new Int16Array(length);
  for (let i = 0; i < length; i++) out[i] = Math.max(-1, Math.min(1, pcm[i] * gain)) * 32767;
  return out;
}

function encodeWav(int16, sampleRate = SAMPLE_RATE) {
  const bytesPerSample = 2;
  const numChannels = 1;
  const dataSize = int16.length * bytesPerSample;

  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);             
  header.writeUInt16LE(1, 20);             
  header.writeUInt16LE(numChannels, 22);  
  header.writeUInt32LE(sampleRate, 24);     
  header.writeUInt32LE(sampleRate * numChannels * bytesPerSample, 28); 
  header.writeUInt16LE(numChannels * bytesPerSample, 32);              
  header.writeUInt16LE(8 * bytesPerSample, 34);                       
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  const pcmBuf = Buffer.from(int16.buffer, int16.byteOffset, int16.byteLength);
  return Buffer.concat([header, pcmBuf]);
}


app.get("/api/random-seed", (req,res) => {
  const a = BigInt(Math.floor(Math.random() * 2 ** 32));
  const b = BigInt(Math.floor(Math.random() * 2 ** 32));
  const seed = (a << 32n) ^ b;
  res.json({ seed: "0x" + seed.toString(16) });
});

app.get("/api/cover.svg", (req,res) => {
  const { title="", artist="", hue="210", sat="60", lum="20", w="512", h="512" } = req.query;
  const svg = makeCoverSvg({ title, artist, w:Number(w), h:Number(h), hue:Number(hue), sat:Number(sat), lum:Number(lum) });
  res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
  res.send(svg);
});

app.get("/api/audio.wav", (req,res) => {
  const { seed="1", page="1", index="1", seconds="10" } = req.query;
  const rng = makeRng64(toBigInt64(seed), Number(page) * 1000 + Number(index));
  const pcm = synthSongPcm(rng, Number(seconds));
  const wav = encodeWav(pcm);
  res.setHeader("Content-Type", "audio/wav");
  res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
  res.send(wav);
});

function buildSongs({ lang, seed, page, pageSize, likes }) {
  const loc = loadLocale(lang);
  const faker = getFakerForRegion(lang);
  const seedBig = toBigInt64(seed);
  const rng = makeRng64(seedBig, Number(page));

  const pageN = Math.max(1, Number(page) || 1);
  const size = Math.min(100, Math.max(1, Number(pageSize) || 20));
  const likesAvg = Math.max(0, Math.min(10, Number(likes) || 0));

  const items = [];
  for (let i = 0; i < size; i++) {
    const idx = (pageN - 1) * size + i + 1;
    rng(); rng(); rng();                        
    const title  = makeTitle(rng, loc);
    const artist = makeArtist(rng, faker);
    const album  = makeAlbumOrSingle(rng, loc);
    const genre  = pick(rng, loc.genres);
const likeRng = makeRng64(seedBig ^ 0xBEEFn, idx + 17); 
    const likeCount = likesFromAvg(likeRng, likesAvg);
    const hue = rngInt(rng, 0, 359);
    const sat = 50 + rngInt(rng, -10, 10);
    const lum = 20 + rngInt(rng, 0, 20);

    items.push({
      index: idx,
      title, artist, album, genre,
      likes: likeCount,
      coverUrl: `/api/cover.svg?title=${encodeURIComponent(title)}&artist=${encodeURIComponent(artist)}&hue=${hue}&sat=${sat}&lum=${lum}`,
      audioUrl: `/api/audio.wav?seed=${encodeURIComponent(seed)}&page=${pageN}&index=${idx}&seconds=10`,
      review: pick(rng, loc.review_phrases),
    });
  }

  return { page: pageN, pageSize: size, totalCount: 1000000, items };
}

app.get("/api/songs", (req,res,next) => {
  try {
    const { lang="en-US", seed="1", page="1", pageSize="20", likes="3.7" } = req.query;
    const payload = buildSongs({ lang, seed, page, pageSize, likes });
    res.json(payload);
  } catch (err) { next(err); }
});

// ZIP export of WAVs
app.get("/api/exportZip", async (req,res,next) => {
  try {
    const { lang="en-US", seed="1", page="1", pageSize="10", likes="3.7" } = req.query;
    const size = Math.min(40, Math.max(1, Number(pageSize) || 10));
    const payload = buildSongs({ lang, seed, page, pageSize: String(size), likes });

    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="songs_${seed}_${page}.zip"`);

    const archive = archiver("zip", { zlib: { level: 9 } });
    archive.on("error", err => { throw err; });
    archive.pipe(res);

    for (const it of payload.items) {

      const u = new URL("http://x" + it.audioUrl);
      const seedQ = u.searchParams.get("seed");
      const pageQ = Number(u.searchParams.get("page"));
      const indexQ = Number(u.searchParams.get("index"));
      const secondsQ = Number(u.searchParams.get("seconds")) || 10;

      const rng = makeRng64(toBigInt64(seedQ), pageQ * 1000 + indexQ);
      const pcm = synthSongPcm(rng, secondsQ);
      const wav = encodeWav(pcm);

      const safe = s => s.replace(/[^a-z0-9\-_. ]/gi, "_");
      const name = `${safe(it.title)} - ${safe(it.artist)} - ${safe(it.album)}.wav`;
      archive.append(wav, { name });
    }

    await archive.finalize();
  } catch (err) {
    res.status(500).send("ZIP error: " + err.message);
  }
});


app.get("*", (req,res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});


const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Music Store generator running on http://localhost:${PORT}`);
});
