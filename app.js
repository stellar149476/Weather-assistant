/* ==========================================================
   天气出行小助手 · 业务逻辑
   天气数据请求 / 城市搜索 / 逐小时曲线 / 15 天预报 / 生活指数 / 出行规划
   ========================================================== */

"use strict";

/* ============================================================
   配置
   ============================================================ */
const API = {
  geo:      "https://geocoding-api.open-meteo.com/v1/search",
  forecast: "https://api.open-meteo.com/v1/forecast",
  air:      "https://air-quality-api.open-meteo.com/v1/air-quality",
  reverse:  "https://api.bigdatacloud.net/data/reverse-geocode-client"
};
const DEFAULT_CITY = { name: "南昌", admin: "江西省", country: "中国", lat: 28.6820, lon: 115.8579, adcode: "360100" };
const STORE_KEY = "wf.city.v3";

const $ = (s, r = document) => r.querySelector(s);
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

/* ---------- 天气代码 ---------- */
const WMO = {
  0: "晴", 1: "晴间少云", 2: "多云", 3: "阴",
  45: "雾", 48: "雾凇",
  51: "小毛毛雨", 53: "毛毛雨", 55: "浓毛毛雨", 56: "冻毛毛雨", 57: "强冻毛毛雨",
  61: "小雨", 63: "中雨", 65: "大雨", 66: "冻雨", 67: "强冻雨",
  71: "小雪", 73: "中雪", 75: "大雪", 77: "米雪",
  80: "小阵雨", 81: "阵雨", 82: "强阵雨", 85: "小阵雪", 86: "强阵雪",
  95: "雷阵雨", 96: "雷阵雨伴冰雹", 99: "雷暴伴强冰雹"
};
const desc = c => WMO[c] || "未知";
const isRain = c => (c >= 51 && c <= 67) || (c >= 80 && c <= 82);
const isSnow = c => (c >= 71 && c <= 77) || c === 85 || c === 86;
const isStorm = c => c >= 95;

/* ---------- 图标（浅色调） ---------- */
const CLOUD = `
  <g fill="var(--ic-cloud)">
    <circle cx="24" cy="33" r="10.5"/><circle cx="37" cy="28.5" r="13"/>
    <circle cx="46.5" cy="35.5" r="9"/><rect x="23" y="34" width="24" height="10.5" rx="5.2"/>
  </g>
  <rect x="23" y="38.5" width="24" height="6" rx="3" fill="var(--ic-cloud-shade)" opacity=".45"/>`;

function icon(name, cls = "wi") {
  const w = inner => `<svg class="${cls}" viewBox="0 0 64 64" width="64" height="64" aria-hidden="true">${inner}</svg>`;
  switch (name) {
    case "sun": return w(`
      <circle cx="32" cy="32" r="11.5" fill="var(--ic-sun)"/>
      <g stroke="var(--ic-sun)" stroke-width="3.4" stroke-linecap="round">
        <path d="M32 7v7.5M32 49.5V57M7 32h7.5M49.5 32H57M14.4 14.4l5.3 5.3M44.3 44.3l5.3 5.3M49.6 14.4l-5.3 5.3M19.7 44.3l-5.3 5.3"/>
      </g>`);
    case "moon": return w(`
      <path d="M41 8a24 24 0 1 0 15 43A26 26 0 0 1 41 8z" fill="var(--ic-moon)"/>
      <circle cx="47" cy="20" r="1.9" fill="var(--ic-star)"/><circle cx="54" cy="30" r="1.4" fill="var(--ic-star)"/>`);
    case "cloudSun": return w(`
      <circle cx="43" cy="21" r="8.6" fill="var(--ic-sun)"/>
      <g stroke="var(--ic-sun)" stroke-width="2.8" stroke-linecap="round">
        <path d="M43 6v4.6M43 31.4v4.6M28 21h4.6M53.4 21H58M32.5 10.5l3.2 3.2M50.3 28.3l3.2 3.2M53.5 10.5l-3.2 3.2"/>
      </g>
      <g transform="translate(-2,4)">
        <circle cx="24" cy="34" r="10.5" fill="var(--ic-cloud-rain)"/><circle cx="37" cy="29.5" r="13" fill="var(--ic-cloud-rain)"/>
        <circle cx="46.5" cy="36" r="9" fill="var(--ic-cloud-rain)"/><rect x="23" y="34.5" width="24" height="10.5" rx="5.2" fill="var(--ic-cloud-rain)"/>
        <rect x="23" y="39" width="24" height="6" rx="3" fill="var(--ic-cloud-rain-shade)" opacity=".5"/>
      </g>`);
    case "cloudMoon": return w(`
      <path d="M47 8a13 13 0 1 0 8 22 14 14 0 0 1-8-22z" fill="var(--ic-moon)"/>
      <g transform="translate(-2,4)">
        <circle cx="24" cy="34" r="10.5" fill="var(--ic-cloud-rain)"/><circle cx="37" cy="29.5" r="13" fill="var(--ic-cloud-rain)"/>
        <circle cx="46.5" cy="36" r="9" fill="var(--ic-cloud-rain)"/><rect x="23" y="34.5" width="24" height="10.5" rx="5.2" fill="var(--ic-cloud-rain)"/>
        <rect x="23" y="39" width="24" height="6" rx="3" fill="var(--ic-cloud-rain-shade)" opacity=".5"/>
      </g>`);
    case "cloud": return w(CLOUD);
    case "fog": return w(`
      ${CLOUD}
      <g stroke="var(--ic-snow)" stroke-width="3.2" stroke-linecap="round" opacity=".9">
        <path d="M17 50h22M27 57h20"/>
      </g>`);
    case "drizzle": return w(`
      ${CLOUD}
      <g fill="var(--ic-drop)"><circle cx="26" cy="50" r="2"/><circle cx="35" cy="53" r="2"/><circle cx="44" cy="50" r="2"/></g>`);
    case "rain": return w(`
      ${CLOUD}
      <g stroke="var(--ic-rain)" stroke-width="3.2" stroke-linecap="round">
        <path d="M25 47l-2.6 9M35 47l-2.6 9M45 47l-2.6 9"/>
      </g>`);
    case "rainHeavy": return w(`
      ${CLOUD}
      <g stroke="var(--ic-rain-deep)" stroke-width="3.2" stroke-linecap="round">
        <path d="M20 46l-3.4 11M29 46l-3.4 11M38 46l-3.4 11M47 46l-3.4 11"/>
      </g>`);
    case "thunder": return w(`
      ${CLOUD}
      <path d="M34 44l-9.5 13h7.5l-4 10 13-15h-7.5l4.5-8z" fill="var(--ic-sun)"/>
      <g stroke="var(--ic-rain)" stroke-width="3" stroke-linecap="round"><path d="M22 47l-2.4 8M45 47l-2.4 8"/></g>`);
    case "snow": return w(`
      ${CLOUD}
      <g stroke="var(--ic-sleet)" stroke-width="2.6" stroke-linecap="round">
        <path d="M26 48v8M22.6 50.4l6.8 3.2M29.4 50.4l-6.8 3.2"/>
        <path d="M40 52v8M36.6 54.4l6.8 3.2M43.4 54.4l-6.8 3.2"/>
      </g>`);
    case "sleet": return w(`
      ${CLOUD}
      <g stroke="var(--ic-rain)" stroke-width="3" stroke-linecap="round"><path d="M24 47l-2.4 8M46 47l-2.4 8"/></g>
      <circle cx="35" cy="52" r="2.4" fill="var(--ic-sleet)"/>`);
    default: return w(CLOUD);
  }
}
function iconFor(code, isDay) {
  if (code === 0) return isDay ? "sun" : "moon";
  if (code === 1 || code === 2) return isDay ? "cloudSun" : "cloudMoon";
  if (code === 3) return "cloud";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if (code === 66 || code === 67) return "sleet";
  if (code >= 61 && code <= 65) return code >= 65 ? "rainHeavy" : "rain";
  if (code >= 71 && code <= 77) return "snow";
  if (code >= 80 && code <= 82) return code === 82 ? "rainHeavy" : "rain";
  if (code >= 85 && code <= 86) return "snow";
  if (code >= 95) return "thunder";
  return "cloud";
}

/* ---------- 工具 ---------- */
function dateParts(iso) {
  const [d, t = "00:00"] = iso.split("T");
  const [y, m, dd] = d.split("-").map(Number);
  return { y, m, d: dd, hh: t.slice(0, 5), date: d };
}
const weekdayCN = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
function weekdayOf(isoDate) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return weekdayCN[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}
const DIRS = ["北", "东北", "东", "东南", "南", "西南", "西", "西北"];
const dirName = deg => DIRS[Math.round((deg % 360) / 45) % 8];
function beaufort(kmh) {
  const ms = kmh / 3.6;
  const t = [0.3, 1.6, 3.4, 5.5, 8, 10.8, 13.9, 17.2, 20.8, 24.5, 28.5, 32.7];
  let l = 0;
  while (l < t.length && ms >= t[l]) l++;
  return l;
}
const BF_NAME = ["无风", "软风", "轻风", "微风", "和风", "清风", "强风", "疾风", "大风", "烈风", "狂风", "暴风", "飓风"];

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 3400);
}
function hourIdx(d) {
  const nowHour = d.current.time.slice(0, 13) + ":00";
  let i = d.hourly.time.findIndex(s => s >= nowHour);
  if (i < 0) i = Math.max(0, d.hourly.time.findIndex(s => s >= d.current.time));
  return Math.max(0, i);
}

/* AQI（欧标）分级 */
function aqiInfo(v) {
  if (v == null || isNaN(v)) return { text: "—", cls: "", tone: "gray", level: -1 };
  if (v <= 20) return { text: "优", cls: "good", tone: "green", level: 0 };
  if (v <= 40) return { text: "良", cls: "good", tone: "green", level: 1 };
  if (v <= 60) return { text: "轻度污染", cls: "mid", tone: "orange", level: 2 };
  if (v <= 80) return { text: "中度污染", cls: "bad", tone: "orange", level: 3 };
  if (v <= 100) return { text: "重度污染", cls: "bad", tone: "red", level: 4 };
  return { text: "严重污染", cls: "bad", tone: "red", level: 5 };
}
function uvInfo(v) {
  if (v == null) return { text: "—", tone: "gray" };
  if (v < 0.5) return { text: "无", tone: "gray" };
  if (v < 3) return { text: "弱", tone: "green" };
  if (v < 6) return { text: "中等", tone: "blue" };
  if (v < 8) return { text: "较强", tone: "orange" };
  if (v < 11) return { text: "很强", tone: "orange" };
  return { text: "极强", tone: "red" };
}

/* ============================================================
   数据层
   ============================================================ */
async function getJSON(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}
async function fetchForecast(lat, lon) {
  const p = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_direction_10m,wind_gusts_10m",
    hourly: "temperature_2m,apparent_temperature,weather_code,precipitation_probability,precipitation,relative_humidity_2m,wind_speed_10m,visibility,uv_index,is_day",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,apparent_temperature_max,apparent_temperature_min,sunrise,sunset,uv_index_max,precipitation_sum,precipitation_probability_max,wind_speed_10m_max,wind_direction_10m_dominant",
    timezone: "auto", forecast_days: "16", wind_speed_unit: "kmh"
  });
  return getJSON(`${API.forecast}?${p}`);
}
async function fetchAir(lat, lon) {
  const p = new URLSearchParams({
    latitude: lat, longitude: lon,
    current: "european_aqi,us_aqi,pm2_5,pm10", timezone: "auto"
  });
  return getJSON(`${API.air}?${p}`);
}

/* ============================================================
   数据源切换 · Open-Meteo（默认）/ MET Norway
   ============================================================ */
const SRC_KEY = "wf.src.v2";   /* 换默认源时升版本，老用户也能拿到新默认 */
const SRC = { current: "metno" };

function readSrc() {
  try {
    const v = localStorage.getItem(SRC_KEY);
    if (v === "metno" || v === "meteo") return v;
  } catch (e) {}
  return "metno";              /* 默认：MET Norway（免 Key，国内访问更稳） */
}
function saveSrc(v) {
  try { localStorage.setItem(SRC_KEY, v === "meteo" ? "meteo" : "metno"); } catch (e) {}
}

/* 体感温度（湿热 / 风寒指数估算，MET 数据源共用） */
function feelsLike(t, rh, kmh) {
  if (t == null) return null;
  if (t >= 26) {
    const e = (rh / 100) * 6.105 * Math.exp((17.27 * t) / (237.7 + t));
    return +(t + 0.33 * e - 0.7 * (kmh / 3.6) - 4).toFixed(1);
  }
  if (t <= 10) {
    const v = Math.pow(Math.max(kmh, 4.8), 0.16);
    return +(13.12 + 0.6215 * t - 11.37 * v + 0.3965 * t * v).toFixed(1);
  }
  return t;
}

/* ---------- 时间格式化（MET 数据源共用） ---------- */
const pad2 = n => (n < 10 ? "0" : "") + n;

/* ---------- 统一取数入口 ---------- */
async function omPair(city) {
  return Promise.all([
    fetchForecast(city.lat, city.lon),
    fetchAir(city.lat, city.lon).catch(() => null)
  ]);
}

async function fetchBundle(city) {
  /* 1) MET Norway（免 Key；无空气质量与紫外线） */
  if (SRC.current === "metno") {
    try {
      const m = await fetchMetno(city.lat, city.lon);
      const d = metnoModel(m);
      const aq = await fetchAir(city.lat, city.lon).catch(() => null);
      return { d: d, aq: aq, src: "metno", supplement: aq ? "aq" : null };
    } catch (e) {
      try {
        const pair = await omPair(city);
        return { d: pair[0], aq: pair[1], src: "meteo-fallback", srcError: "MET Norway 不可用（" + e.message + "）" };
      } catch (e2) {
        throw e;
      }
    }
  }

  /* 2) Open-Meteo（默认，逐小时 + 空气质量 + 15 天最全） */
  try {
    const pair = await omPair(city);
    return { d: pair[0], aq: pair[1], src: "meteo" };
  } catch (e) {
    /* Open-Meteo 不可用 → 退到 MET Norway */
    try {
      const m = await fetchMetno(city.lat, city.lon);
      return { d: metnoModel(m), aq: null, src: "metno-fallback", srcError: "Open-Meteo 不可用（" + e.message + "）" };
    } catch (e2) {
      throw e;
    }
  }
}

/* ============================================================
   MET Norway（挪威气象局）· 免 Key 数据源
   ============================================================ */
const METNO = { url: "https://api.met.no/weatherapi/locationforecast/2.0/compact" };

/* symbol_code → WMO（去掉 _day / _night / _polartwilight 后缀后查表） */
const MET_SYMBOL = {
  clearsky: 0, fair: 1, partlycloudy: 2, cloudy: 3, fog: 45,
  lightrain: 61, rain: 63, heavyrain: 65,
  lightrainshowers: 80, rainshowers: 81, heavyrainshowers: 82,
  lightrainshowersandthunder: 95, rainshowersandthunder: 95, heavyrainshowersandthunder: 95,
  rainandthunder: 95, heavyrainandthunder: 95,
  lightrainandthunder: 95,
  lightsleet: 66, sleet: 66, heavysleet: 66,
  lightsleetshowers: 66, sleetshowers: 66, heavysleetshowers: 66,
  lightsnow: 71, snow: 73, heavysnow: 75,
  lightsnowshowers: 85, snowshowers: 86, heavysnowshowers: 86,
  sleetandthunder: 95, snowandthunder: 95
};
function metSymbol(sym) {
  const s = String(sym || "").replace(/_(day|night|polartwilight)$/, "");
  return MET_SYMBOL[s] != null ? MET_SYMBOL[s] : 2;
}
/* MET 不提供降水概率，按天气类型估一个（仅用于展示强度） */
function codePop(code) {
  if (code === 65 || code === 82) return 90;
  if (code === 63 || code === 81 || code === 80) return 72;
  if (code === 61 || code === 95) return 65;
  if (code === 71 || code === 73 || code === 75 || code === 85 || code === 86) return 70;
  if (code === 66) return 60;
  if (code === 45) return 35;
  if (code === 3) return 30;
  if (code === 2) return 18;
  if (code === 1) return 10;
  return 6;
}

/* 本地时区的 ISO 小时串（MET 返回 UTC，页面按本地时间展示） */
function localIsoHour(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}T${pad2(date.getHours())}:00`;
}
function localDateKey(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

async function fetchMetno(lat, lon) {
  if (lat == null || lon == null) throw new Error("缺少坐标");
  const res = await fetch(`${METNO.url}?lat=${lat.toFixed(4)}&lon=${lon.toFixed(4)}`, { cache: "default" });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

/* MET compact JSON → 与 Open-Meteo 同构的模型 */
function metnoModel(json) {
  const root = (json && json.properties) || {};
  const series = root.timeseries || [];
  if (!series.length) throw new Error("MET 返回空数据");

  const pts = series.map(it => {
    const dt = new Date(it.time);
    const d = it.data || {};
    const ins = (d.instant && d.instant.details) || {};
    const h1 = (d.next_1_hours && d.next_1_hours.details) || {};
    const h1s = (d.next_1_hours && d.next_1_hours.summary) || {};
    const h6 = (d.next_6_hours && d.next_6_hours.details) || {};
    const h6s = (d.next_6_hours && d.next_6_hours.summary) || {};
    const sym = h1s.symbol_code || h6s.symbol_code || "";
    const code = metSymbol(sym);
    return {
      dt: dt,
      iso: localIsoHour(dt),
      t: ins.air_temperature != null ? ins.air_temperature : null,
      rh: ins.relative_humidity != null ? ins.relative_humidity : null,
      p: ins.air_pressure_at_sea_level != null ? ins.air_pressure_at_sea_level : null,
      cloud: ins.cloud_area_fraction != null ? ins.cloud_area_fraction : null,
      wdir: ins.wind_from_direction != null ? ins.wind_from_direction : null,
      wspd: ins.wind_speed != null ? ins.wind_speed * 3.6 : null, /* m/s → km/h */
      code: code,
      pop: codePop(code),
      prcp: h1.precipitation_amount != null ? h1.precipitation_amount : (h6.precipitation_amount != null ? h6.precipitation_amount : 0)
    };
  });

  const now = Date.now();
  let i0 = pts.findIndex(x => x.dt.getTime() >= now - 3600 * 1000);
  if (i0 < 0) i0 = 0;
  const cur = pts[i0];

  /* 逐小时：从现在起 48 小时 */
  const H = { time: [], temperature_2m: [], apparent_temperature: [], weather_code: [], precipitation_probability: [], precipitation: [], relative_humidity_2m: [], wind_speed_10m: [], visibility: [], uv_index: [], is_day: [] };
  for (let i = i0; i < Math.min(i0 + 48, pts.length); i++) {
    const x = pts[i];
    const hh = x.dt.getHours();
    const isDay = hh >= 6 && hh < 19 ? 1 : 0;
    H.time.push(x.iso);
    H.temperature_2m.push(x.t != null ? x.t : (cur.t || 0));
    H.apparent_temperature.push(feelsLike(x.t != null ? x.t : 0, x.rh != null ? x.rh : 60, x.wspd != null ? x.wspd : 10));
    H.weather_code.push(x.code);
    H.precipitation_probability.push(x.pop);
    H.precipitation.push(x.prcp || 0);
    H.relative_humidity_2m.push(x.rh != null ? x.rh : 60);
    H.wind_speed_10m.push(x.wspd != null ? x.wspd : 10);
    H.visibility.push(null);
    H.uv_index.push(null);
    H.is_day.push(isDay);
  }

  /* 按本地日期聚合日预报（MET 无日聚合，也没有紫外线/日出日落） */
  const day = { time: [], weather_code: [], temperature_2m_max: [], temperature_2m_min: [], apparent_temperature_max: [], apparent_temperature_min: [], sunrise: [], sunset: [], uv_index_max: [], precipitation_sum: [], precipitation_probability_max: [], wind_speed_10m_max: [], wind_direction_10m_dominant: [], __text: [] };
  const groups = {};
  const order = [];
  pts.forEach(x => {
    const k = localDateKey(x.dt);
    if (!groups[k]) { groups[k] = []; order.push(k); }
    groups[k].push(x);
  });
  order.forEach(k => {
    const g = groups[k];
    const temps = g.map(x => x.t).filter(v => v != null);
    if (!temps.length) return;
    const hi = Math.max.apply(null, temps), lo = Math.min.apply(null, temps);
    /* 取当地 14 点附近（没有则正午）的天气码作为白天代表 */
    let rep = g.find(x => x.dt.getHours() === 14) || g.find(x => x.dt.getHours() === 12) || g[Math.floor(g.length / 2)];
    day.time.push(k);
    day.weather_code.push(rep.code);
    day.temperature_2m_max.push(hi);
    day.temperature_2m_min.push(lo);
    day.apparent_temperature_max.push(feelsLike(hi, 55, 12));
    day.apparent_temperature_min.push(feelsLike(lo, 72, 8));
    day.sunrise.push(null);
    day.sunset.push(null);
    day.uv_index_max.push(null);
    day.precipitation_sum.push(+(g.reduce((a, x) => a + (x.prcp || 0), 0)).toFixed(1));
    day.precipitation_probability_max.push(Math.max.apply(null, g.map(x => x.pop)));
    day.wind_speed_10m_max.push(Math.max.apply(null, g.map(x => x.wspd || 0)));
    day.wind_direction_10m_dominant.push(rep.wdir != null ? rep.wdir : 0);
    day.__text.push(desc(rep.code));
  });

  const tz = (function () {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "LOCAL"; }
    catch (e) { return "LOCAL"; }
  })();

  return {
    current: {
      time: cur.iso,
      temperature_2m: cur.t != null ? cur.t : (H.temperature_2m[0] || 0),
      relative_humidity_2m: cur.rh != null ? cur.rh : 60,
      apparent_temperature: feelsLike(cur.t || 0, cur.rh || 60, cur.wspd || 10),
      is_day: cur.dt.getHours() >= 6 && cur.dt.getHours() < 19 ? 1 : 0,
      precipitation: cur.prcp || 0,
      weather_code: cur.code,
      cloud_cover: cur.cloud != null ? cur.cloud : 60,
      pressure_msl: cur.p,
      wind_speed_10m: cur.wspd != null ? cur.wspd : 10,
      wind_direction_10m: cur.wdir != null ? cur.wdir : 0,
      wind_gusts_10m: null,
      __windText: ""
    },
    hourly: H,
    daily: day,
    timezone: tz,
    timezone_abbreviation: "LOCAL",
    __src: "metno"
  };
}

/* ============================================================
   生活指数计算
   ============================================================ */
function buildContext(d, aq) {
  const c = d.current, H = d.hourly, day = d.daily;
  const i0 = hourIdx(d);
  const n24 = arr => (arr || []).slice(i0, i0 + 24);
  const pop24 = Math.max(0, ...n24(H.precipitation_probability).map(v => v ?? 0));
  const rain24 = n24(H.precipitation).reduce((a, b) => a + (b ?? 0), 0);
  /* 保留 null：MET Norway 不提供紫外线，不能当成 0 处理 */
  const uvNow = H.uv_index && H.uv_index[i0] != null ? H.uv_index[i0] : null;
  const uvMax = day.uv_index_max?.[0] != null ? day.uv_index_max[0] : uvNow;
  const tempRange = day.temperature_2m_max[0] - day.temperature_2m_min[0];
  const code = c.weather_code;
  return {
    c, day, i0,
    t: c.temperature_2m,
    feels: c.apparent_temperature,
    hum: c.relative_humidity_2m,
    wind: c.wind_speed_10m,
    cloud: c.cloud_cover ?? 0,
    code,
    rain: isRain(code) || isSnow(code) || isStorm(code),
    wet: isRain(code) || isStorm(code),
    snow: isSnow(code),
    storm: isStorm(code),
    fog: code === 45 || code === 48,
    pop24, rain24, uvNow, uvMax, tempRange,
    aqi: aq?.current?.european_aqi ?? null,
    pm25: aq?.current?.pm2_5 ?? null,
    bf: beaufort(c.wind_speed_10m),
    isDay: c.is_day === 1
  };
}

function calcIndices(ctx) {
  const { t, feels, hum, wind, cloud, pop24, rain24, uvMax, tempRange, aqi, pm25, bf } = ctx;
  const out = [];

  /* 紫外线 */
  const uv = uvMax == null ? { text: "暂无", tone: "gray" } : uvInfo(uvMax);
  const uvDesc = {
    "无": "紫外线很弱，无需特别防护，正常外出即可。",
    "弱": "紫外线较弱，长时间户外活动建议简单防晒。",
    "中等": "紫外线中等，外出建议涂 SPF15 以上防晒霜。",
    "较强": "紫外线较强，建议涂防晒霜、戴墨镜，避开 11:00-15:00 长时间暴晒。",
    "很强": "紫外线很强，务必涂高倍防晒、戴帽子墨镜，尽量避开正午户外。",
    "极强": "紫外线极强，尽量避免正午外出，裸露皮肤易被灼伤。"
  }[uv.text] || "";
  out.push({
    emoji: "🕶️", name: "紫外线指数", sub: "UV Index：0 ~ 11+",
    tag: uv.text, tone: uv.tone,
    value: uvMax == null ? "—" : uvMax.toFixed(1), unit: uvMax == null ? "该数据源不提供紫外线" : "当前紫外线强度",
    key: "uv", pct: uvMax == null ? 0 : clamp((uvMax / 12) * 100, 2, 100),
    desc: uvMax == null ? "当前数据源（MET Norway）不提供紫外线指数，请在页面上方换源或以本地预报为准。" : uvDesc,
    foot: "数值越高，皮肤与眼睛受紫外线伤害的风险越大"
  });

  /* 运动 */
  let s = 100, reasons = [];
  if (t < 0) { s -= 42; reasons.push(["气温过低", 42]); }
  else if (t < 8) { s -= 26; reasons.push(["气温偏低", 26]); }
  else if (t < 15) { s -= 12; reasons.push(["气温偏凉", 12]); }
  else if (t > 33) { s -= 38; reasons.push(["高温", 38]); }
  else if (t > 29) { s -= 22; reasons.push(["气温偏高", 22]); }
  else if (t > 26) { s -= 9; reasons.push(["略热", 9]); }
  if (pop24 > 0) { const d1 = pop24 * 0.45; s -= d1; if (d1 >= 12) reasons.push(["降水概率高", d1]); }
  if (wind > 45) { s -= 24; reasons.push(["风力过大", 24]); }
  else if (wind > 30) { s -= 14; reasons.push(["风力较大", 14]); }
  else if (wind > 20) { s -= 6; }
  if (aqi != null) {
    if (aqi > 150) { s -= 30; reasons.push(["空气质量不佳", 30]); }
    else if (aqi > 100) { s -= 20; reasons.push(["空气污染", 20]); }
    else if (aqi > 60) { s -= 10; reasons.push(["空气一般", 10]); }
    else if (aqi > 40) { s -= 4; }
  }
  if (rain24 > 5) s -= 8;
  s = clamp(Math.round(s), 0, 100);
  const sportTag = s >= 80 ? ["非常适宜", "green"] : s >= 60 ? ["适宜", "blue"] : s >= 40 ? ["一般", "orange"] : s >= 25 ? ["不太适宜", "orange"] : ["不适宜", "red"];
  const mainReason = reasons.sort((a, b) => b[1] - a[1])[0]?.[0] || "气象条件良好";
  out.push({
    emoji: "🏃", name: "运动指数", sub: "综合气温 · 空气 · 降水 · 风力",
    tag: sportTag[0], tone: sportTag[1],
    value: String(s), unit: "/100 分 · 户外运动适宜度",
    key: "sport", pct: s,
    desc: s >= 60
      ? "气象条件适合户外运动，注意热身与补水，量力而行。"
      : s >= 40
        ? "户外运动条件一般，建议缩短时长或降低强度。"
        : "不太适合户外运动，建议改为健身房、游泳馆等室内项目。",
    foot: "主要受限因素： " + mainReason
  });

  /* 穿衣 */
  const LEVELS = [
    [30, 1, "短袖短裤，注意防暑降温"],
    [26, 2, "短袖 T 恤即可，注意防晒"],
    [21, 3, "长袖衬衫或薄外套"],
    [16, 4, "薄外套、卫衣，早晚加件"],
    [11, 5, "夹克、风衣，注意保暖"],
    [6, 6, "厚外套、毛衣，出门戴围巾"],
    [1, 7, "棉服、羽绒服，做好保暖"],
    [-100, 8, "厚羽绒服 + 帽子手套，减少户外停留"]
  ];
  const lv = LEVELS.find(x => feels >= x[0]) || LEVELS[LEVELS.length - 1];
  const dressTag = lv[1] <= 2 ? ["偏热", "orange"] : lv[1] <= 4 ? ["舒适", "green"] : lv[1] <= 6 ? ["偏凉", "blue"] : ["寒冷", "purple"];
  out.push({
    emoji: "🧥", name: "穿衣指数", sub: "依据体感温度与风力",
    tag: dressTag[0], tone: dressTag[1],
    value: String(lv[1]), unit: "级 · 建议" + lv[2].split("，")[0],
    key: "dress", pct: (lv[1] / 8) * 100,
    desc: `当前体感 ${feels.toFixed(1)}℃ ，${lv[2]}。`,
    foot: "体感温度由气温、湿度与风速综合计算"
  });

  /* 洗车 */
  let w = 100;
  w -= pop24 * 0.5;
  w -= Math.min(rain24 * 12, 40);
  if (wind > 30) w -= 12;
  if (pm25 != null && pm25 > 75) w -= 12;
  if (ctx.fog) w -= 10;
  w = clamp(Math.round(w), 0, 100);
  const washTag = w >= 80 ? ["适宜", "green"] : w >= 60 ? ["较适宜", "blue"] : w >= 40 ? ["一般", "orange"] : ["不适宜", "red"];
  out.push({
    emoji: "🚗", name: "洗车指数", sub: "未来 24 小时降水与风沙",
    tag: washTag[0], tone: washTag[1],
    value: String(w), unit: "/100 分 · 洗车适宜度",
    key: "wash", pct: w,
    desc: w >= 60
      ? "未来一天降水概率不高，适合安排洗车，车身能保持较久。"
      : "近期有降水或扬尘，洗车后容易变脏，建议等天气转好。",
    foot: `未来 24 小时降水概率 ${pop24}%，累计降水 ${rain24.toFixed(1)} mm`
  });

  /* 晾晒 */
  let d2 = 100;
  d2 -= Math.max(0, hum - 45) * 0.9;
  d2 -= cloud * 0.25;
  d2 -= Math.min(rain24 * 15, 40);
  d2 += Math.min(wind, 20) * 0.5;
  d2 = clamp(Math.round(d2), 0, 100);
  const dryTag = d2 >= 80 ? ["非常适宜", "green"] : d2 >= 60 ? ["适宜", "blue"] : d2 >= 40 ? ["一般", "orange"] : ["不适宜", "red"];
  out.push({
    emoji: "👕", name: "晾晒指数", sub: "湿度 · 云量 · 风速 · 降水",
    tag: dryTag[0], tone: dryTag[1],
    value: String(d2), unit: "/100 分 · 衣物晾干速度",
    key: "dry", pct: d2,
    desc: d2 >= 60
      ? "空气相对干燥、风力合适，衣物晾晒干得快。"
      : "湿度偏高或云量较多，衣物不易干，建议室内晾晒或使用烘干机。",
    foot: `相对湿度 ${Math.round(hum)}%，云量 ${Math.round(cloud)}%，风速 ${wind.toFixed(1)} km/h`
  });

  /* 感冒 */
  let g = 100;
  g -= Math.min(tempRange * 4.5, 45);
  if (feels < 5) g -= 22; else if (feels < 12) g -= 10;
  if (hum < 35) g -= 10;
  if (wind > 25) g -= 8;
  g = clamp(Math.round(g), 0, 100);
  const coldTag = g >= 75 ? ["少发", "green"] : g >= 50 ? ["较易发", "blue"] : g >= 30 ? ["易发", "orange"] : ["极易发", "red"];
  out.push({
    emoji: "🤧", name: "感冒指数", sub: "昼夜温差 · 体感 · 湿度",
    tag: coldTag[0], tone: coldTag[1],
    value: String(g), unit: "/100 分 · 感冒风险余量",
    key: "cold", pct: g,
    desc: g >= 75
      ? "气温变化平缓，感冒风险较低，保持作息即可。"
      : tempRange >= 10
        ? `昼夜温差达 ${tempRange.toFixed(0)}℃，早晚注意增减衣物，避免受凉。`
        : "气温偏低或空气干燥，注意保暖与补水，减少熬夜。",
    foot: `今日温差 ${tempRange.toFixed(1)}℃，最高 ${ctx.day.temperature_2m_max[0].toFixed(0)}° / 最低 ${ctx.day.temperature_2m_min[0].toFixed(0)}°`
  });

  return out;
}

/* ============================================================
   天气预警
   ============================================================ */
function calcAlerts(d, aq) {
  const c = d.current, day = d.daily, out = [];
  const tmax = day.temperature_2m_max[0];

  if (c.temperature_2m > 35 || tmax > 35) {
    out.push({
      key: "heat", icon: "\u{1F321}\u{FE0F}", level: "高温预警",
      text: "当前气温 " + c.temperature_2m.toFixed(1) + "\u2103\uFF0C\u4ECA日最高 " + tmax.toFixed(0) + "\u2103\uFF0C注意防暑降温",
      tip: "避开 11:00-15:00 的户外活动，随身带水，室内备好空调与降温用品。"
    });
  }

  const rainToday = day.precipitation_sum ? (day.precipitation_sum[0] ?? 0) : 0;
  const code = c.weather_code;
  if (code === 65 || code === 67 || code === 82 || rainToday >= 50) {
    const big = code === 67 || rainToday >= 100;
    out.push({
      key: "rain", icon: "\u{1F327}\u{FE0F}", level: big ? "大暴雨预警" : "暴雨预警",
      text: (rainToday >= 10 ? "今日累计降水 " + rainToday.toFixed(0) + " mm，" : "") + "当前天气 " + desc(code),
      tip: "改约线上或推迟行程，避开低洼路段、地下车库与山区河道。"
    });
  }

  const bfMax = Math.max(beaufort(c.wind_speed_10m), beaufort(c.wind_gusts_10m ?? 0));
  if (bfMax > 6) {
    out.push({
      key: "wind", icon: "\u{1F32A}\u{FE0F}", level: "大风预警",
      text: "风力 " + bfMax + " 级（" + BF_NAME[bfMax] + "），持续风速 " + c.wind_speed_10m.toFixed(1) + " km/h",
      tip: "推迟户外行程，远离广告牌、临时搭建物与高大树木。"
    });
  }

  const usAqi = aq && aq.current ? aq.current.us_aqi : null;
  if (usAqi != null && usAqi > 200) {
    out.push({
      key: "haze", icon: "\u{1F637}", level: "雾霾预警",
      text: "空气质量指数 AQI " + Math.round(usAqi) + "，PM2.5 " + Math.round(aq.current.pm2_5 ?? 0) + " μg/m³",
      tip: "减少户外停留与剧烈运动，外出佩戴 N95 口罩，室内开启空气净化器。"
    });
  }
  return out;
}

function renderAlerts(alerts) {
  const bar = $("#alertBar");
  if (!alerts || !alerts.length) { bar.classList.remove("on"); bar.innerHTML = ""; return; }
  bar.classList.add("on");
  bar.innerHTML = alerts.map(a =>
    '<div class="alert">' +
      '<span class="al-ico">' + a.icon + "</span>" +
      '<div class="al-body">' +
        '<div class="al-title">' + a.level + '<span class="al-tag">生效中</span></div>' +
        '<div class="al-text">' + a.text + "</div>" +
      "</div>" +
      '<button class="al-btn" data-jump="1">查看备用方案</button>' +
    "</div>").join("");
  bar.querySelectorAll("[data-jump]").forEach(function (b) {
    b.addEventListener("click", function () {
      const el = $("#adviceCard");
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  });
}

/* ============================================================
   出行建议
   ============================================================ */
function buildAdvice(ctx, alerts) {
  const { c, day, t, feels, wind, bf, aqi, uvMax, pop24, code, hum } = ctx;
  const a = aqiInfo(aqi);
  const list = [];

  /* 触发预警时，自动生成出行备用方案 */
  if (alerts && alerts.length) {
    list.push({
      e: "\u{1F9F0}", tone: "bad", b: "出行备用方案：",
      s: alerts.map(function (x) { return x.tip; }).join(" ")
    });
  }

  // 1 天气
  let e = "🌤️", tone = "good", head = "天气晴好", body = "非常适合户外活动，注意补水和防晒。";
  if (code === 1) { head = "天气不错"; body = "以晴为主，适合安排出行与户外活动。"; }
  else if (code === 2) { e = "⛅"; head = "多云天气"; body = "云层较多但无降水，出行体感较为舒适。"; }
  else if (code === 3) { e = "☁️"; tone = "info"; head = "天色偏阴"; body = "光线较弱，出行不受影响，拍照效果一般。"; }
  else if (ctx.fog) { e = "🌫️"; tone = "warn"; head = "有雾"; body = "能见度较低，驾车请减速、开启雾灯，注意行车安全。"; }
  else if (ctx.snow) { e = "🌨️"; tone = "warn"; head = "有降雪"; body = "路面可能湿滑结冰，出行注意防滑保暖，驾车减速慢行。"; }
  else if (ctx.storm) { e = "⛈️"; tone = "bad"; head = "有雷雨"; body = "避免在空旷地带、树下停留，减少不必要的外出。"; }
  else if (ctx.wet) { e = "🌧️"; tone = "warn"; head = "有降水"; body = "出门记得带伞，路面湿滑，步行与骑行注意安全。"; }
  list.push({ e, tone, b: head + "：", s: body });

  // 2 温度
  const tempTone = feels >= 30 || feels <= 3 ? "bad" : feels >= 26 || feels <= 10 ? "warn" : "good";
  const tempBody = feels <= 3 ? "注意穿戴保暖，减少长时间户外停留。"
    : feels <= 10 ? "加件薄外套或长袖，早晚温差大时注意增减衣物。"
      : feels <= 18 ? "体感偏凉，外出建议带一件薄外套。"
        : feels <= 26 ? "体感舒适，穿着轻便即可。"
          : feels <= 32 ? "注意防晒补水，避免长时间暴晒。" : "高温天气，减少正午外出，及时补水。";
  list.push({
    e: "🌡️", tone: tempTone,
    b: `当前 ${t.toFixed(1)}℃（体感 ${feels.toFixed(1)}℃）：`, s: tempBody
  });

  // 3 风力
  const wTone = bf >= 5 ? "warn" : "good";
  const wBody = bf <= 2 ? "对出行几乎没有影响。" : bf === 3 ? "体感清爽，骑行与步行都比较舒服。"
    : bf <= 4 ? "外出注意固定帽子与轻便物品，骑行稍感阻力。" : "骑行、高空作业注意安全，注意远离广告牌与临时搭建物。";
  list.push({
    e: "🌬️", tone: wTone,
    b: `风力${BF_NAME[bf]}（${bf} 级，${wind.toFixed(1)} km/h）：`, s: wBody
  });

  // 4 空气
  if (aqi != null) {
    const tone = a.level <= 1 ? "good" : a.level <= 2 ? "warn" : "bad";
    const body = a.level <= 1 ? "空气清新，适宜开窗通风与户外活动。"
      : a.level === 2 ? "敏感人群减少长时间户外剧烈运动，普通人影响不大。"
        : a.level <= 3 ? "建议佩戴口罩，减少户外停留与剧烈运动。" : "尽量避免户外活动，关闭门窗，必要时使用空气净化器。";
    list.push({ e: "😷", tone, b: `空气${a.text}（AQI ${Math.round(aqi)}）：`, s: body });
  }

  // 5 紫外线 / 降水，二选一
  if (uvMax >= 5 && ctx.isDay) {
    list.push({
      e: "☀️", tone: uvMax >= 8 ? "warn" : "info",
      b: `紫外线${uvInfo(uvMax).text}（UV ${uvMax.toFixed(1)}）：`, s: "涂防晒霜、戴帽子或墨镜，正午减少暴晒。"
    });
  } else if (pop24 >= 40) {
    list.push({
      e: "☔", tone: "warn",
      b: `未来 24 小时降水概率 ${pop24}%：`, s: "随身带伞，出行前留意雷达回波变化。"
    });
  } else if (hum >= 80) {
    list.push({
      e: "💧", tone: "info",
      b: `相对湿度 ${Math.round(hum)}%：`, s: "空气偏潮，室内注意通风除湿，衣物不易晾干。"
    });
  } else {
    list.push({
      e: "🧴", tone: "info",
      b: `相对湿度 ${Math.round(hum)}%：`, s: "空气较为干爽，注意补水保湿。"
    });
  }

  return list.slice(0, 5);
}

/* ============================================================
   活动推荐
   ============================================================ */
function buildActivities(ctx) {
  const { t, feels, pop24, aqi, uvMax, wind, wet, snow, storm, fog, isDay } = ctx;
  const airGood = aqi == null || aqi <= 60;
  const airOK = aqi == null || aqi <= 100;
  const mild = feels >= 10 && feels <= 27;
  const warmish = feels >= 6 && feels <= 30;

  const pool = [
    {
      n: "城市公园散步", e: "🌳", w: "户外", d: "午后去附近的公园走走，晒晒太阳放松一下",
      f: () => 34 + (mild ? 30 : 0) + (airGood ? 22 : airOK ? 8 : -14) + (!wet && !snow ? 14 : -22) + (feels < 4 ? -18 : 0)
    },
    {
      n: "骑行兜风", e: "🚴", w: "户外", d: "沿江或环湖骑行，风景和心情都在线",
      f: () => 30 + (mild ? 26 : -8) + (wind < 20 ? 18 : wind < 32 ? 4 : -18) + (airGood ? 18 : airOK ? 4 : -20) + (!wet ? 12 : -20) + (isDay ? 0 : -12)
    },
    {
      n: "拍照打卡", e: "📷", w: "户外", d: "光线条件不错，适合出门扫街拍片",
      f: () => 32 + (ctx.c.cloud_cover <= 55 ? 24 : 12) + (fog ? -26 : 8) + (wet ? -12 : 12) + (mild ? 12 : 0) + (isDay ? 10 : 6)
    },
    {
      n: "露天市集 / 夜市", e: "🏮", w: "户外", d: "逛逛露天市集或夜市，边走边吃",
      f: () => 30 + (warmish ? 24 : -14) + (!wet && !snow ? 16 : -24) + (airOK ? 10 : -12) + (isDay ? 0 : 6)
    },
    {
      n: "慢跑有氧", e: "🏃", w: "户外", d: "温度适宜，适合来一场轻松有氧跑",
      f: () => 26 + (feels >= 12 && feels <= 24 ? 32 : feels <= 28 ? 8 : -18) + (airGood ? 20 : airOK ? 2 : -22) + (!wet ? 14 : -16) + (wind < 25 ? 6 : -8)
    },
    {
      n: "博物馆 / 美术馆", e: "🖼️", w: "室内", d: "看一场展览，室内节奏刚刚好",
      f: () => 46 + (wet || snow ? 22 : 0) + (!airOK ? 18 : 0) + (feels < 8 || feels > 30 ? 12 : 0) + 6
    },
    {
      n: "温泉 / 汗蒸", e: "♨️", w: "室内", d: "泡一泡汤，缓解一周疲劳",
      f: () => 30 + (feels < 12 ? 34 : 0) + (wet || snow ? 20 : 0) + (feels > 28 ? -22 : 0) + 8
    },
    {
      n: "书店 / 咖啡馆", e: "☕", w: "室内", d: "找个安静的角落，看书写字待一下午",
      f: () => 48 + (wet ? 16 : 0) + (!airOK ? 14 : 0) + (wind > 30 ? 8 : 0) + 4
    },
    {
      n: "健身房", e: "🏋️", w: "室内", d: "把运动搬进室内，避开天气影响",
      f: () => 40 + (wet || snow ? 20 : 0) + (!airOK ? 24 : 0) + (feels < 6 || feels > 32 ? 14 : 0)
    },
    {
      n: "游泳馆", e: "🏊", w: "室内", d: "恒温泳池，全身放松的最佳选择",
      f: () => 30 + (feels > 29 ? 30 : 0) + (wet ? 14 : 0) + 8
    }
  ];

  const scored = pool.map(a => {
    let s = Math.round(a.f());
    if (storm) s -= 12;
    return { ...a, score: clamp(s, 18, 96) };
  }).sort((a, b) => b.score - a.score);

  // 保证室内外都有，前 6 个里至少 2 个室内 / 2 个户外（条件允许时）
  const top = scored.slice(0, 6);
  const hasIn = top.filter(x => x.w === "室内").length;
  if (hasIn === 0) {
    const cand = scored.find(x => x.w === "室内");
    if (cand) { top[5] = cand; }
  }
  if (top.filter(x => x.w === "户外").length === 0) {
    const cand = scored.find(x => x.w === "户外");
    if (cand) { top[5] = cand; }
  }
  return top.sort((a, b) => b.score - a.score).slice(0, 6);
}

/* ============================================================
   渲染
   ============================================================ */
const state = { city: null, loading: false, srcErr: null };

function renderHero(d, aq) {
  const c = d.current, day = d.daily;
  $("#cityName").textContent = state.city.name;
  $("#citySub").textContent = [state.city.admin, state.city.country].filter(Boolean).join(" · ");

  const t = dateParts(c.time);
  $("#updated").textContent = `${t.m} 月 ${t.d} 日 ${t.hh} 更新`;
  $("#temp").textContent = Math.round(c.temperature_2m);
  $("#cond").textContent = c.__text || desc(c.weather_code);
  $("#tmax").textContent = Math.round(day.temperature_2m_max[0]) + "°";
  $("#tmin").textContent = Math.round(day.temperature_2m_min[0]) + "°";
  $("#feel").textContent = Math.round(c.apparent_temperature) + "°";
  $("#heroIcon").innerHTML = icon(iconFor(c.weather_code, c.is_day === 1));

  const a = aqiInfo(aq?.current?.european_aqi);
  const chips = [
    `<span class="chip">湿度 <b>${Math.round(c.relative_humidity_2m)}%</b></span>`,
    `<span class="chip">${dirName(c.wind_direction_10m)}风 <b>${c.wind_speed_10m.toFixed(1)}</b> km/h</span>`,
    `<span class="chip">降水概率 <b>${day.precipitation_probability_max[0] ?? 0}%</b></span>`,
    aq?.current?.european_aqi != null
      ? `<span class="chip ${a.cls}">空气 <b>${a.text}</b> · AQI ${Math.round(aq.current.european_aqi)}</span>` : ""
  ].filter(Boolean);
  $("#chips").innerHTML = chips.join("");
}

function renderHourly(d) {
  const H = d.hourly, i0 = hourIdx(d);
  const N = 48, CELL = 66, TOP = 44, BOT = 92, HGT = 108;
  const temps = [], times = [], codes = [], pops = [], days = [];
  for (let i = i0; i < Math.min(i0 + N, H.time.length); i++) {
    temps.push(H.temperature_2m[i]);
    times.push(H.time[i]);
    codes.push(H.weather_code[i]);
    pops.push(H.precipitation_probability?.[i] ?? 0);
    days.push(H.is_day?.[i] ?? 1);
  }
  const n = temps.length;
  const W = Math.max(n * CELL, 320);

  const mn = Math.min(...temps), mx = Math.max(...temps);
  const span = Math.max(mx - mn, 1.2);
  const pts = temps.map((v, i) => [
    +(i * CELL + CELL / 2).toFixed(1),
    +(BOT - ((v - mn) / span) * (BOT - TOP)).toFixed(1)
  ]);

  let line = pts.length ? `M ${pts[0][0]} ${pts[0][1]}` : "";
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    line += ` C ${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0]} ${p2[1]}`;
  }
  const area = `${line} L ${pts[n - 1][0]} ${HGT} L ${pts[0][0]} ${HGT} Z`;

  const labels = pts.map((p, i) =>
    `<text x="${p[0]}" y="${p[1] - 12}" text-anchor="middle" font-size="12.5" font-weight="600"
       fill="${i === 0 ? "var(--pink)" : "var(--pink-2)"}"
       font-family="system-ui,-apple-system,'PingFang SC','Microsoft YaHei',sans-serif">${Math.round(temps[i])}°</text>`).join("");
  const dots = pts.map((p, i) =>
    `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 ? 3.4 : 2.3}" fill="var(--dot-core)" stroke="${i === 0 ? "var(--pink)" : "var(--pink-2)"}" stroke-width="${i === 0 ? 2.4 : 1.6}"/>`).join("");

  const svg = $("#curve");
  svg.setAttribute("viewBox", `0 0 ${W} ${HGT}`);
  svg.setAttribute("width", W);
  svg.setAttribute("height", HGT);
  svg.innerHTML = `
    <defs>
      <linearGradient id="lg" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="var(--chart-a)"/><stop offset="52%" stop-color="var(--chart-b)"/>
        <stop offset="100%" stop-color="var(--chart-c)"/>
      </linearGradient>
      <linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="var(--chart-fill)"/><stop offset="100%" stop-color="var(--chart-fill-0)"/>
      </linearGradient>
    </defs>
    <path d="${area}" fill="url(#ag)"/>
    <path d="${line}" fill="none" stroke="url(#lg)" stroke-width="2.3" stroke-linecap="round"/>
    ${dots}${labels}`;

  const cells = [];
  for (let i = 0; i < n; i++) {
    const hh = times[i].slice(11, 13) + ":00";
    const pop = pops[i];
    cells.push(`
      <div class="hcell${i === 0 ? " now" : ""}" style="width:${CELL}px;flex:0 0 ${CELL}px">
        <div class="hh">${i === 0 ? "现在" : hh}</div>
        ${icon(iconFor(codes[i], days[i] === 1), "wi")}
        <div class="pop${pop < 5 ? " dry" : ""}">${pop < 5 ? "—" : pop + "%"}</div>
      </div>`);
  }
  $("#strip").innerHTML = cells.join("");
  $("#strip").style.width = W + "px";
  $("#hourlyInner").style.width = W + "px";
  $("#hourLabel").textContent = d.__synth ? `未来 ${n} 小时 · 高德预报推算` : `未来 ${n} 小时 · 左右滑动`;
  $("#hourlyScroll").scrollLeft = 0;
}

function renderIndices(ctx) {
  const items = calcIndices(ctx);
  $("#indices").innerHTML = items.map(it => `
    <div class="ix">
      <div class="ix-top">
        <span class="ix-emoji">${it.emoji}</span>
        <div>
          <div class="ix-name">${it.name}</div>
          <div class="ix-sub">${it.sub}</div>
        </div>
        <span class="pill p-${it.tone}">${it.tag}</span>
      </div>
      <div class="ix-val"><b>${it.value}</b><i>${it.unit}</i></div>
      <div class="bar"><i class="f-${it.key}" style="width:${it.pct.toFixed(1)}%"></i></div>
      <div class="ix-desc">${it.desc}</div>
      <div class="ix-foot">${it.foot}</div>
    </div>`).join("");
}

function renderAdvice(ctx, alerts) {
  const list = buildAdvice(ctx, alerts);
  $("#advice").innerHTML = list.map(a => `
    <div class="adv ${a.tone}">
      <span class="ae">${a.e}</span>
      <div><b>${a.b}</b>${a.s}</div>
    </div>`).join("");
  $("#adviceTag").innerHTML =
    (alerts && alerts.length ? '<span class="plan-warn">⚠ 已生成备用方案</span> · ' : "") +
    `共 ${list.length} 条 · 实时生成`;
}

function renderActivities(ctx) {
  const list = buildActivities(ctx);
  const label = s => s >= 80 ? "强烈推荐" : s >= 66 ? "值得一去" : s >= 52 ? "可以考虑" : "不太推荐";
  $("#acts").innerHTML = list.map(a => `
    <div class="act">
      <div class="act-top">
        <span class="ae">${a.e}</span>
        <span class="an">${a.n}</span>
        <span class="pill ${a.w === "室内" ? "p-purple" : "p-orange"}">${a.w}</span>
      </div>
      <div class="ad">${a.d}</div>
      <div class="as">${label(a.score)} · ${a.score} 分</div>
    </div>`).join("");
}

function renderMetrics(d, aq) {
  const c = d.current, H = d.hourly, day = d.daily;
  const idx = hourIdx(d);
  const vis = H.visibility?.[idx];
  const uv = day.uv_index_max[0];
  const items = [
    { k: "风向风速", v: `${dirName(c.wind_direction_10m)} ${c.wind_speed_10m.toFixed(1)}`, u: "km/h" },
    { k: "阵风", v: c.wind_gusts_10m != null ? c.wind_gusts_10m.toFixed(1) : "—", u: "km/h" },
    { k: "气压", v: c.pressure_msl != null ? Math.round(c.pressure_msl) : "—", u: "hPa" },
    { k: "能见度", v: vis != null ? (vis / 1000).toFixed(1) : "—", u: "km" },
    { k: "紫外线", v: uv != null ? uv.toFixed(1) : "—", u: uv != null ? uvInfo(uv).text : "" },
    { k: "云量", v: c.cloud_cover != null ? Math.round(c.cloud_cover) : "—", u: "%" },
    { k: "今日降水", v: (day.precipitation_sum?.[0] ?? 0).toFixed(1), u: "mm" },
    { k: "PM2.5", v: aq?.current?.pm2_5 != null ? Math.round(aq.current.pm2_5) : "—", u: "μg/m³" },
    { k: "日出", v: day.sunrise?.[0] ? day.sunrise[0].slice(11, 16) : "—", u: "" },
    { k: "日落", v: day.sunset?.[0] ? day.sunset[0].slice(11, 16) : "—", u: "" }
  ];
  $("#metrics").innerHTML = items.map(it => `
    <div class="metric">
      <div class="k">${it.k}</div>
      <div class="v">${it.v}${it.u ? `<span>${it.u}</span>` : ""}</div>
    </div>`).join("");
}

function renderDaily(d) {
  const day = d.daily;
  const days = Math.min(15, day.time.length);
  const allMin = Math.min(...day.temperature_2m_min.slice(0, days));
  const allMax = Math.max(...day.temperature_2m_max.slice(0, days));
  const range = Math.max(allMax - allMin, 1);

  const rows = [];
  for (let i = 0; i < days; i++) {
    const dt = dateParts(day.time[i]);
    const lo = day.temperature_2m_min[i], hi = day.temperature_2m_max[i];
    const left = ((lo - allMin) / range) * 100;
    const width = Math.max(((hi - lo) / range) * 100, 6);
    const pop = day.precipitation_probability_max?.[i] ?? 0;
    const label = i === 0 ? "今天" : i === 1 ? "明天" : weekdayOf(dt.date);
    const posX = width >= 100 ? 0 : (left / (100 - width)) * 100;

    rows.push(`
      <div class="drow${i === 0 ? " today" : ""}">
        <div class="d1">${label}<em>${dt.m}/${dt.d}</em></div>
        ${icon(iconFor(day.weather_code[i], true), "wi")}
        <div class="dsc">${(day.__text && day.__text[i]) || desc(day.weather_code[i])}</div>
        <div class="dp">${pop >= 5 ? pop + "%" : "<em>—</em>"}</div>
        <div class="barbox">
          <i style="left:${left}%;width:${width}%;
             background-size:${(100 / width) * 100}% 100%;
             background-position:${posX}% center"></i>
        </div>
        <div class="dt"><span class="mx">${Math.round(hi)}°</span><span class="mn">${Math.round(lo)}°</span></div>
      </div>`);
  }
  $("#daily").innerHTML = rows.join("");
  const titleEl = $("#dailyTitle");
  if (titleEl) titleEl.textContent = `未来 ${days} 天`;
  const srcName = d.__src === "metno" ? "MET 预报" : "";
  $("#rangeLabel").textContent = days <= 5 && srcName
    ? `${srcName} · ${days} 天`
    : `${allMin.toFixed(0)}° ~ ${allMax.toFixed(0)}° 区间`;
  $("#tzInfo").textContent = d.timezone ? `${d.timezone} · ${d.timezone_abbreviation}` : "";
}

/* ============================================================
   出行智能规划：目的 / 时段 / 装备
   ============================================================ */
const PURPOSES = [
  { k: "trip",  name: "旅游观光", emoji: "🗺️" },
  { k: "biz",   name: "商务出差", emoji: "💼" },
  { k: "sport", name: "户外运动", emoji: "🏃" },
  { k: "date",  name: "约会逛街", emoji: "💝" }
];
const SLOTS = [
  { k: "s1", name: "早上", time: "6:00 - 9:00",   from: 6,  to: 9,  emoji: "🌅" },
  { k: "s2", name: "上午", time: "9:00 - 12:00",  from: 9,  to: 12, emoji: "🌤️" },
  { k: "s3", name: "下午", time: "12:00 - 18:00", from: 12, to: 18, emoji: "☀️" },
  { k: "s4", name: "晚上", time: "18:00 - 22:00", from: 18, to: 22, emoji: "🌙" }
];
const PLAN = { purpose: "trip", slot: null, d: null, ctx: null, date: "", slots: [] };

/* 18:00 之后规划默认看明天，否则看今天 */
function planBaseDate(d) {
  const nowH = +d.current.time.slice(11, 13);
  const today = d.current.time.slice(0, 10);
  const i = d.daily.time.indexOf(today);
  if (nowH >= 18 && i >= 0 && d.daily.time[i + 1]) return d.daily.time[i + 1];
  return today;
}

function evalSlot(d, date, slot) {
  const H = d.hourly, idxs = [];
  for (let i = 0; i < H.time.length; i++) {
    const t = H.time[i];
    if (t.slice(0, 10) !== date) continue;
    const h = +t.slice(11, 13);
    if (h >= slot.from && h < slot.to) idxs.push(i);
  }
  if (!idxs.length) return null;

  const temps = idxs.map(i => H.temperature_2m[i]);
  const pops  = idxs.map(i => H.precipitation_probability ? (H.precipitation_probability[i] ?? 0) : 0);
  const rains = idxs.map(i => H.precipitation ? (H.precipitation[i] ?? 0) : 0);
  const codes = idxs.map(i => H.weather_code[i]);
  const winds = idxs.map(i => H.wind_speed_10m ? (H.wind_speed_10m[i] ?? 0) : 0);

  const tAvg = temps.reduce((a, b) => a + b, 0) / temps.length;
  const popMax = Math.max(...pops);
  const rainSum = rains.reduce((a, b) => a + b, 0);
  const windMax = Math.max(...winds);
  const storm = codes.some(c => isStorm(c));
  const snow = codes.some(c => isSnow(c));
  const wet = codes.some(c => isRain(c));

  let score = 100; const rs = [];
  if (storm) { score -= 38; rs.push("有雷阵雨"); }
  else {
    if (popMax >= 70) { score -= 40; rs.push("降水概率 " + popMax + "%"); }
    else if (popMax >= 40) { score -= 20; rs.push("降水概率 " + popMax + "%"); }
    if (rainSum > 1) { score -= 12; rs.push("降水较明显"); }
    if (wet && !rs.length) rs.push("有降雨");
  }
  if (snow) { score -= 15; rs.push("有降雪"); }
  if (tAvg <= 0) { score -= 24; rs.push("气温过低"); }
  else if (tAvg < 5) { score -= 18; rs.push("气温较低"); }
  else if (tAvg < 10) { score -= 10; rs.push("气温偏低"); }
  else if (tAvg < 15) { score -= 4; }
  else if (tAvg > 33) { score -= 26; rs.push("高温"); }
  else if (tAvg > 30) { score -= 16; rs.push("气温偏高"); }
  else if (tAvg > 27) { score -= 6; }
  if (windMax > 40) { score -= 12; rs.push("风力较大"); }
  score = clamp(Math.round(score), 0, 100);

  return {
    score,
    level: score >= 75 ? "合适" : score >= 50 ? "较合适" : "不合适",
    tone: score >= 75 ? "ok" : score >= 50 ? "mid" : "no",
    reasons: rs, tAvg, popMax
  };
}

function buildSlots(d) {
  const date = planBaseDate(d);
  const nowDate = d.current.time.slice(0, 10);
  const nowH = +d.current.time.slice(11, 13);
  return SLOTS.map(s => {
    const r = evalSlot(d, date, s);
    if (!r) return null;
    return Object.assign({}, s, r, { past: date === nowDate && s.to <= nowH });
  }).filter(Boolean);
}

/* 子功能一：按出行目的给出差异化建议 */
function buildPurposeTip(ctx, purpose, bestName, bestTime) {
  const A = (e, html) => ({ e, html });
  const bestLine = bestName
    ? '<div class="tip-sub">当前最合适的时段：' + bestName + " " + bestTime + "</div>"
    : "";

  if (purpose === "trip") {
    if (ctx.storm) return A("⛈️", "<b>建议改为室内行程：</b>博物馆、美术馆、商场或古镇室内街区更稳妥，避开山区、水边与开阔地，雷雨时段不要久留户外。" + bestLine);
    if (ctx.wet) return A("🌧️", "<b>以室内人文景点为主：</b>博物馆、美术馆、展览馆，或带遮蔽的古镇街巷；随身带伞，选一双防滑的鞋。" + bestLine);
    if (ctx.snow) return A("❄️", "<b>雪景正当时：</b>公园、古镇、山地雪场都很出片，注意防滑保暖，自驾提前确认路况。" + bestLine);
    if (ctx.fog) return A("🌫️", "<b>能见度偏低：</b>不建议登山、观景台等远景项目，改走城市街区与室内展馆更稳妥。" + bestLine);
    if (ctx.feels >= 30) return A("🌊", "<b>以避暑为主：</b>水上乐园、山地景区、室内展馆；避开 11:00-15:00 暴晒时段。" + bestLine);
    if (ctx.feels <= 5) return A("♨️", "<b>天气寒冷：</b>温泉、室内展馆、人文街区更舒适；户外景点建议缩短停留时间。" + bestLine);
    return A("🏞️", "<b>户外景点正合适：</b>公园、湖畔、城市地标、观景台都值得一去，光线条件好，出片率高。" + bestLine);
  }

  if (purpose === "biz") {
    const dress = ctx.feels <= 9 ? "厚外套 + 正装内搭，注意保暖"
      : ctx.feels <= 16 ? "正装 + 薄外套，兼顾室内外温差"
      : ctx.feels <= 26 ? "正装或衬衫即可"
      : "轻薄衬衫，注意补水";
    const tips = [];
    if (ctx.wet || ctx.snow) tips.push("预留 15-20 分钟交通缓冲");
    if (ctx.wet) tips.push("重要会面尽量安排在室内");
    if (ctx.feels >= 30) tips.push("正午拜访改约线上或室内");
    if (ctx.aqi != null && ctx.aqi > 60) tips.push("步行路段备口罩");
    if (!tips.length) tips.push("各时段交通与拜访基本不受影响，可正常排期");
    return A("💼", "<b>着装：</b>" + dress + "。<b>行程：</b>" + tips.join("，") + "。" + bestLine);
  }

  if (purpose === "sport") {
    if (ctx.storm || ctx.wet) return A("🏸", "<b>改为室内运动：</b>健身房、游泳馆、羽毛球馆、攀岩馆都是好选择，避开露天球场与山野路线。" + bestLine);
    if (ctx.aqi != null && ctx.aqi > 100) return A("🏋️", "<b>空气不佳，转室内：</b>健身房、游泳馆等室内项目更合适，减少户外大口呼吸的有氧训练。" + bestLine);
    if (ctx.feels >= 30) return A("🌅", "<b>避开高温时段：</b>选清晨或日落后运动，注意补水并控制强度。" + bestLine);
    if (ctx.feels <= 3) return A("🧣", "<b>低温注意：</b>充分热身，穿防风层，运动后及时更换干爽衣物。" + bestLine);
    return A("🏃", "<b>条件适合户外：</b>公园跑步、骑行、球类都合适，注意热身与补水。" + bestLine);
  }

  if (ctx.wet || ctx.storm) return A("🎬", "<b>室内约会更稳妥：</b>商场、影院、咖啡馆、展览馆；带把伞，路上不至于狼狈。" + bestLine);
  if (ctx.feels >= 29) return A("🛍️", "<b>白天以室内为主：</b>商场、咖啡馆、展览；傍晚转凉后再逛夜市或江边。" + bestLine);
  if (ctx.feels <= 8) return A("☕", "<b>室内更舒适：</b>书店、咖啡馆、商场、温泉；户外停留时间不宜过长。" + bestLine);
  return A("🌆", "<b>适合户外漫步：</b>街区散步、公园、露天市集、露台餐厅都很合适，光线好也适合拍照。" + bestLine);
}

/* 子功能三：装备清单 */
function buildGear(ctx) {
  const common = [];
  const f = ctx.feels;
  if (f <= 3) common.push(["🧥", "厚羽绒服"]);
  else if (f <= 9) common.push(["🧥", "棉服 / 厚外套"]);
  else if (f <= 15) common.push(["🧥", "夹克 / 风衣"]);
  else if (f <= 21) common.push(["👕", "薄外套 / 卫衣"]);
  else if (f <= 27) common.push(["👔", "长袖衬衫"]);
  else common.push(["👕", "短袖 / 透气衣物"]);

  if (ctx.wet || ctx.pop24 >= 30) common.push(["☂️", "折叠伞"]);
  if (ctx.snow) common.push(["🥾", "防滑鞋"]);
  if (ctx.uvMax >= 3) common.push(["🧴", "防晒霜"]);
  if (ctx.uvMax >= 6) common.push(["🕶️", "墨镜 / 遮阳帽"]);
  if (ctx.aqi != null && ctx.aqi > 60) common.push(["😷", "口罩"]);
  if (ctx.wind >= 30) common.push(["🧣", "防风外套"]);
  if (ctx.hum < 40) common.push(["💧", "保湿 / 润唇膏"]);
  if (ctx.tempRange >= 10) common.push(["🎒", "备用薄外套"]);
  if (ctx.fog) common.push(["🔦", "照明 / 反光条"]);

  const SPECIAL = {
    trip:  [["📷", "相机"], ["🎒", "双肩包"], ["🔋", "充电宝"], ["👟", "舒适步行鞋"], ["🗺️", "行程单 / 地图"], ["💧", "保温杯"]],
    biz:   [["💼", "公文包"], ["👔", "正装 / 皮鞋"], ["💻", "笔记本电脑"], ["🪪", "证件 / 名片"], ["🔋", "充电宝"], ["📄", "会议资料"]],
    sport: [["👟", "运动鞋"], ["💧", "运动水壶"], ["🎽", "速干衣 / 毛巾"], ["🍌", "能量补给"], ["⌚", "运动手表"], ["🩹", "创可贴"]],
    date:  [["👜", "小挎包"], ["💄", "补妆用品"], ["👟", "舒适的鞋"], ["🔋", "充电宝"], ["🌹", "小惊喜"], ["🧥", "夜间薄外套"]]
  };
  const spec = (SPECIAL[PLAN.purpose] || []).slice();
  if (PLAN.purpose === "trip" && (ctx.wet || ctx.pop24 >= 30)) spec.push(["🎒", "防雨背包罩"]);
  if (PLAN.purpose === "sport" && (ctx.wet || ctx.storm)) spec[0] = ["🏸", "室内运动装备"];
  if (PLAN.purpose === "date" && ctx.wet) spec.push(["🌂", "长柄伞"]);
  if (PLAN.purpose === "biz" && ctx.wet) spec.push(["👞", "备用鞋袜"]);

  return { common: common.slice(0, 7), spec: spec.slice(0, 7) };
}

function paintPlan() {
  const d = PLAN.d, ctx = PLAN.ctx, slots = PLAN.slots;
  if (!d || !ctx) return;

  const dt = dateParts(PLAN.date);
  const isToday = PLAN.date === d.current.time.slice(0, 10);
  $("#planTag").textContent = "基于" + (isToday ? "今天" : "明天") + " " + dt.m + "/" + dt.d + " 的逐小时趋势";

  $("#purposeSegs").innerHTML = PURPOSES.map(p =>
    '<button class="seg' + (PLAN.purpose === p.k ? " active" : "") + '" data-p="' + p.k + '">' +
      '<span class="se">' + p.emoji + "</span>" + p.name + "</button>").join("");

  const avail = slots.filter(s => !s.past);
  const best = avail.slice().sort((a, b) => b.score - a.score)[0] || slots[0];
  const tip = buildPurposeTip(ctx, PLAN.purpose, best ? best.name : "", best ? best.time : "");
  $("#purposeTip").innerHTML = '<span class="te">' + tip.e + "</span><div>" + tip.html + "</div>";

  $("#slots").innerHTML = slots.map(s =>
    '<div class="slot' + (PLAN.slot === s.k ? " active" : "") + (s.past ? " past" : "") + '" data-s="' + s.k + '">' +
      '<div class="slot-top"><span>' + s.emoji + "</span>" + s.name + "</div>" +
      '<div class="slot-time">' + s.time + "</div>" +
      '<div class="slot-mid"><span class="slot-t">' + Math.round(s.tAvg) + "°</span>" +
        '<span class="slot-pop">💧 ' + s.popMax + "%</span></div>" +
      '<span class="slot-lv lv-' + s.tone + '">' + (s.past ? "已过" : s.level) + "</span>" +
    "</div>").join("");

  const cur = slots.find(s => s.k === PLAN.slot) || best;
  let html;
  if (!cur) {
    html = "暂无该时段的逐小时数据，参考上方整体建议即可。";
  } else if (cur.past) {
    html = "<b>" + cur.name + " " + cur.time + "</b> 已经过去，仅作参考。";
  } else {
    const rs = cur.reasons.slice(0, 2).join("、");
    html = "<b>" + cur.name + " " + cur.time + "</b> · " + cur.level + "（" + cur.score + " 分）：" +
      (cur.tone === "ok"
        ? "天气条件良好，气温约 " + Math.round(cur.tAvg) + "℃、降水概率 " + cur.popMax + "%，适合安排出行。"
        : cur.tone === "mid"
          ? (rs ? rs + "，" : "") + "条件一般，可以出行，但建议留好备选方案。"
          : (rs ? rs + "，" : "") + "不太适合出行，建议改到更合适的时段。");
    if (best && !best.past && cur.k !== best.k && best.score - cur.score >= 10) {
      html += '<div class="tip-sub">更推荐：' + best.name + " " + best.time + "（" + best.score + " 分）</div>";
    }
  }
  $("#slotTip").innerHTML = '<span class="te">🕒</span><div>' + html + "</div>";

  const g = buildGear(ctx);
  $("#gearCommon").innerHTML = g.common.map(x =>
    '<span class="gear"><span class="ge">' + x[0] + "</span>" + x[1] + "</span>").join("");
  const pn = PURPOSES.find(p => p.k === PLAN.purpose);
  $("#gearSpecialH").textContent = "专属装备 · " + (pn ? pn.name : "");
  $("#gearSpecial").innerHTML = g.spec.map(x =>
    '<span class="gear spec"><span class="ge">' + x[0] + "</span>" + x[1] + "</span>").join("");
}

function renderPlan(d, ctx) {
  PLAN.d = d; PLAN.ctx = ctx;
  PLAN.date = planBaseDate(d);
  PLAN.slots = buildSlots(d);
  const ok = PLAN.slots.some(s => s.k === PLAN.slot && !s.past);
  if (!ok) {
    const best = PLAN.slots.filter(s => !s.past).sort((a, b) => b.score - a.score)[0];
    PLAN.slot = best ? best.k : (PLAN.slots[0] ? PLAN.slots[0].k : null);
  }
  paintPlan();
}

$("#purposeSegs").addEventListener("click", e => {
  const b = e.target.closest(".seg");
  if (!b) return;
  PLAN.purpose = b.dataset.p;
  paintPlan();
});
$("#slots").addEventListener("click", e => {
  const el = e.target.closest(".slot");
  if (!el || el.classList.contains("past")) return;
  PLAN.slot = el.dataset.s;
  paintPlan();
});

/* ============================================================
   最近搜索历史
   ============================================================ */
const HIST_KEY = "wf.history.v1";

function readHistory() {
  try {
    const v = JSON.parse(localStorage.getItem(HIST_KEY) || "[]");
    return Array.isArray(v) ? v : [];
  } catch (e) { return []; }
}
function pushHistory(city) {
  const same = x => x.name === city.name ||
    (Math.abs(x.lat - city.lat) < 0.03 && Math.abs(x.lon - city.lon) < 0.03);
  const list = readHistory().filter(x => !same(x));
  list.unshift({
    name: city.name, admin: city.admin || "", country: city.country || "",
    lat: city.lat, lon: city.lon
  });
  try { localStorage.setItem(HIST_KEY, JSON.stringify(list.slice(0, 5))); } catch (e) {}
  renderHistory();
}
function renderHistory() {
  const box = $("#history"), list = readHistory();
  if (!list.length) { box.classList.remove("on"); box.innerHTML = ""; return; }
  box.classList.add("on");
  box.innerHTML =
    '<div class="hist-head"><span>\u{1F550} 最近搜索</span>' +
      '<button class="h-clear" id="hClear">清除历史</button></div>' +
    '<div class="hist-list">' +
      list.map((c, i) => '<button class="h-city" data-h="' + i + '">' + c.name +
        (c.admin ? "<em>" + c.admin.split(" \u00B7 ")[0] + "</em>" : "") + "</button>").join("") +
    "</div>";
  box.querySelectorAll("[data-h]").forEach(function (b) {
    b.addEventListener("click", function () {
      const c = list[+b.dataset.h];
      requestCity({ name: c.name, admin: c.admin, country: c.country, lat: c.lat, lon: c.lon }, true);
    });
  });
  const clr = $("#hClear");
  if (clr) clr.addEventListener("click", function () {
    try { localStorage.removeItem(HIST_KEY); } catch (e) {}
    renderHistory();
    toast("已清除搜索历史");
  });
}

/* ============================================================
   城市天气对比
   ============================================================ */
const CMP = { on: false, pending: false, city: null, data: null, aq: null };
let MAIN = { d: null, aq: null };

function enterCompareMode() {
  $("#cmpRow").classList.add("on");
  $("#cmpBtn").classList.add("active");
  const q2 = $("#q2");
  if (q2) q2.focus();
}
function exitCompare() {
  CMP.on = false; CMP.pending = false;
  CMP.city = null; CMP.data = null; CMP.aq = null;
  $("#compareCard").hidden = true;
  $("#cmpBtn").classList.remove("active");
  $("#cmpRow").classList.remove("on");
  const q2 = $("#q2");
  if (q2) q2.value = "";
}

/* 取第一条匹配结果的坐标 */
async function geocodeFirst(kw) {
  try {
    const p = new URLSearchParams({ name: kw, count: "3", language: "zh", format: "json" });
    const data = await getJSON(`${API.geo}?${p}`);
    const r = (data.results || [])[0];
    if (r) {
      return {
        name: r.name,
        admin: [r.admin2 && r.admin2 !== r.name ? r.admin2 : r.admin1, r.country].filter(Boolean).join(" \u00B7 "),
        country: "",
        lat: r.latitude, lon: r.longitude
      };
    }
  } catch (e) { /* Open-Meteo 不可达时走下面的高德 */ }
  return null;
}

async function searchAndLoad(kw) {
  const k = (kw || "").trim();
  if (!k) { toast("请输入城市名"); return; }
  try {
    const r = await geocodeFirst(k);
    if (!r) { toast("没有找到「" + k + "」"); return; }
    $("#q").value = "";
    requestCity(r, true);
  } catch (e) { toast("搜索失败：" + e.message); }
}

async function startCompare() {
  const k = ($("#q2").value || "").trim();
  if (!k) { toast("请输入要对比的城市"); $("#q2").focus(); return; }
  const btn = $("#cmpStart"), old = btn.textContent;
  btn.textContent = "对比中…"; btn.disabled = true;
  try {
    const r = await geocodeFirst(k);
    if (!r) { toast("没有找到「" + k + "」"); return; }
    await loadCompare(r);
    $("#cmpRow").classList.remove("on");
    $("#q2").value = "";
  } catch (e) {
    toast("对比失败：" + e.message);
  } finally {
    btn.textContent = old; btn.disabled = false;
  }
}
async function loadCompare(city) {
  try {
    const b = await fetchBundle(city);
    CMP.on = true; CMP.city = city; CMP.data = b.d; CMP.aq = b.aq;
    $("#cmpBtn").classList.add("active");
    renderCompare();
    const card = $("#compareCard");
    if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
  } catch (e) {
    toast("对比城市数据获取失败：" + e.message);
    exitCompare();
  }
}
function compareCard(d, aq, city, tag) {
  const ctx = buildContext(d, aq);
  const alerts = calcAlerts(d, aq);
  const adv = buildAdvice(ctx, alerts).slice(0, 4);
  const c = d.current;
  const sub = [city.admin, city.country].filter(Boolean).join(" \u00B7 ");
  const note = alerts.length ? "\u26A0 " + alerts.map(function (a) { return a.level; }).join(" \u00B7 ") : "暂无天气预警";
  return '<div class="cmp-card">' +
    '<div class="cmp-top">' +
      '<span class="cmp-ab' + (tag === "B" ? " b" : "") + '">' + tag + "</span>" +
      '<div><div class="cmp-cname">' + city.name + "</div>" +
        '<div class="cmp-csub">' + sub + "</div></div>" +
    "</div>" +
    '<div class="cmp-temp">' + Math.round(c.temperature_2m) + "\u00B0<span>C</span></div>" +
    '<div class="cmp-cond">' + (c.__text || desc(c.weather_code)) + "</div>" +
    '<div class="cmp-note' + (alerts.length ? " has" : "") + '">' + note + "</div>" +
    '<div class="cmp-line"></div>' +
    '<div class="cmp-at">出行建议</div>' +
    adv.map(function (a) {
      return '<div class="cmp-item ' + a.tone + '"><span class="ce">' + a.e + "</span>" +
        "<div><b>" + a.b + "</b>" + a.s + "</div></div>";
    }).join("") +
    "</div>";
}
function renderCompare() {
  const card = $("#compareCard");
  if (!CMP.on || !CMP.data || !MAIN.d) { card.hidden = true; return; }
  card.hidden = false;
  $("#cmpGrid").innerHTML =
    compareCard(MAIN.d, MAIN.aq, state.city, "A") +
    compareCard(CMP.data, CMP.aq, CMP.city, "B");
}

/* ---------- 核心指标卡片组：温度 / 天气 / 风力 / 空气质量 / 出行建议 ---------- */
function renderStats(ctx, d, aq) {
  const { c, day, t, feels, wind, bf, aqi, pm25, pop24, uvMax, code } = ctx;
  const a = aqiInfo(aqi);
  const alerts = calcAlerts(d, aq);
  const advice = buildAdvice(ctx, alerts);
  const first = advice[0] || { b: "", s: "" };
  const subText = ((first.b || "") + (first.s || "")).replace(/\s+/g, "");
  const clip = (s, n) => (s.length > n ? s.slice(0, n) + "…" : s);

  /* 出行结论 */
  let verdict = "适宜出行", vTone = "lime";
  if (ctx.storm) { verdict = "避免外出"; vTone = "mag"; }
  else if (ctx.snow) { verdict = "防滑保暖"; vTone = "blue"; }
  else if (ctx.wet) { verdict = "记得带伞"; vTone = "blue"; }
  else if (ctx.fog) { verdict = "减速慢行"; vTone = "amber"; }
  else if (feels >= 33) { verdict = "防暑降温"; vTone = "amber"; }
  else if (feels <= 2) { verdict = "防寒保暖"; vTone = "amber"; }
  if (aqi != null && aqi > 60 && !ctx.storm) { verdict = aqi > 80 ? "减少外出" : "佩戴口罩"; vTone = "mag"; }

  const items = [
    {
      k: "温度", tag: "TEMP", ico: "◈", tone: "cyan",
      v: Math.round(t), u: "°C",
      s: `体感 <b>${Math.round(feels)}°</b> · 今日 ${Math.round(day.temperature_2m_min[0])}° ~ ${Math.round(day.temperature_2m_max[0])}°`,
      pct: clamp(((t + 10) / 50) * 100, 5, 100)
    },
    {
      k: "天气状况", tag: "COND", ico: "◐", tone: "violet", small: true,
      v: c.__text || desc(code), u: "",
      s: `云量 <b>${Math.round(ctx.cloud)}%</b> · 降水概率 <b>${pop24}%</b> · UV ${uvMax != null ? uvMax.toFixed(1) : "—"}`,
      pct: clamp(pop24, 3, 100)
    },
    {
      k: "风力", tag: "WIND", ico: "⌁", tone: "blue",
      v: bf, u: `级 · ${BF_NAME[bf]}`,
      s: `<b>${dirName(c.wind_direction_10m)}风</b> ${c.wind_speed_10m.toFixed(1)} km/h · 阵风 ${Math.round(c.wind_gusts_10m ?? 0)}`,
      pct: clamp((c.wind_speed_10m / 60) * 100, 4, 100)
    },
    {
      k: "空气质量", tag: aqi == null ? "AIR" : "AQI " + Math.round(aqi), ico: "◎",
      tone: aqi == null ? "cyan" : a.level <= 1 ? "lime" : a.level <= 2 ? "amber" : "mag",
      small: true,
      v: aqi == null ? "暂无" : a.text, u: "",
      s: aqi == null
        ? "空气质量数据暂不可用"
        : `PM2.5 <b>${pm25 != null ? Math.round(pm25) : "—"}</b> μg/m³ · 欧标 AQI ${Math.round(aqi)}`,
      pct: aqi == null ? 30 : clamp((1 - Math.min(aqi, 140) / 140) * 100, 6, 100)
    },
    {
      k: "出行建议", tag: "ADVICE", ico: "➤", tone: vTone, small: true,
      v: verdict, u: "",
      s: clip(subText, 30),
      pct: clamp(100 - alerts.length * 18 - (ctx.wet ? 12 : 0), 32, 100)
    }
  ];

  $("#statGrid").innerHTML = items.map((it, i) => `
    <div class="stat" data-tone="${it.tone}" style="--i:${i}">
      <div class="st-top">
        <span class="st-ico">${it.ico}</span>
        <span class="st-k">${it.k}</span>
        <span class="st-tag">${it.tag}</span>
      </div>
      <div class="st-v${it.small ? " sm" : ""}">${it.v}${it.u ? `<span>${it.u}</span>` : ""}</div>
      <div class="st-sub">${it.s}</div>
      <div class="st-bar"><i style="width:${it.pct.toFixed(1)}%"></i></div>
    </div>`).join("");
}

function render(d, aq) {
  const ctx = buildContext(d, aq);
  const alerts = calcAlerts(d, aq);
  MAIN = { d: d, aq: aq };
  renderAlerts(alerts);
  renderHero(d, aq);
  renderStats(ctx, d, aq);
  renderHourly(d);
  renderIndices(ctx);
  renderAdvice(ctx, alerts);
  renderActivities(ctx);
  renderMetrics(d, aq);
  renderDaily(d);
  renderPlan(d, ctx);
  if (CMP.on) renderCompare();
}

/* ============================================================
   加载流程
   ============================================================ */
function setLoading(on) {
  state.loading = on;
  $("#sk").classList.toggle("on", on);
  $("#refreshBtn").classList.toggle("spin", on);
}

async function loadCity(city, record) {
  if (!city) return;
  state.city = city;
  setLoading(true);
  try {
    const b = await fetchBundle(city);
    render(b.d, b.aq);
    paintSource(b);
    const errMsg = b.srcError;
    if (errMsg && (b.src === "meteo-fallback" || b.src === "metno-fallback")) {
      if (state.srcErr !== errMsg) {
        state.srcErr = errMsg;
        toast(errMsg + "，已自动回退到 " + (b.src === "metno-fallback" ? "MET Norway" : "Open-Meteo"));
      }
    } else {
      state.srcErr = null;
    }
    saveCity(city);
    if (record) pushHistory(city);
  } catch (e) {
    console.error(e);
    const nice = /Key|调用量|平台|城市|权限|过期|停用/.test(e.message);
    toast("天气数据获取失败：" + e.message + (nice ? "" : "，请检查网络后重试"));
    $("#cityName").textContent = city.name;
    $("#cond").textContent = "数据加载失败";
    const hud = $("#hudSrc");
    if (hud) { hud.textContent = "// DATA ERROR"; hud.style.color = "var(--n-amber)"; }
  } finally {
    setLoading(false);
  }
}

/* ---------- 数据源状态展示 ---------- */
function paintSource(b) {
  const hud = $("#hudSrc");
  const note = $("#srcNote");
  const src = b.src;
  const fb = src === "meteo-fallback" || src === "metno-fallback";

  const mb = document.querySelector('#srcSwitch .src-btn[data-src="metno"]');
  if (mb) mb.classList.toggle("fail", fb && SRC.current === "metno");

  const hudMap = {
    "metno": b.supplement ? "// MET + AQI" : "// MET NORWAY",
    "meteo": "// OPEN-METEO",
    "meteo-fallback": "// METNO · FALLBACK",
    "metno-fallback": "// METEO · FALLBACK"
  };
  if (hud) {
    hud.textContent = hudMap[src] || "// ONLINE";
    hud.style.color = fb ? "var(--n-amber)" : "";
  }
  if (note) {
    let txt;
    if (src === "metno") {
      txt = b.supplement
        ? "当前数据源：MET Norway（挪威气象局 · 免 Key）+ Open-Meteo（仅空气质量）"
        : "当前数据源：MET Norway（挪威气象局 · 免 Key；不含空气质量与紫外线）";
    } else if (src === "meteo") {
      txt = "当前数据源：Open-Meteo（ECMWF / GFS 模型 · 含逐小时、空气质量、15 天）";
    } else {
      txt = "当前数据源：" + (src === "metno-fallback" ? "MET Norway" : "Open-Meteo") +
        "（" + (b.srcError || "主数据源不可用") + "，已自动回退）";
    }
    note.textContent = txt;
    note.style.color = fb ? "var(--n-amber)" : "";
  }
}
let chain = Promise.resolve();
function requestCity(city, record) {
  chain = chain.then(() => loadCity(city, record)).catch(() => {});
  return chain;
}

function saveCity(c) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(c)); } catch (e) {}
}
function readCity() {
  try { const s = localStorage.getItem(STORE_KEY); return s ? JSON.parse(s) : null; }
  catch (e) { return null; }
}

/* ---------- 城市搜索 ---------- */
let searchTimer = null, searchSeq = 0;
async function doSearch(kw) {
  const box = $("#results");
  if (!kw.trim()) { box.classList.remove("open"); box.innerHTML = ""; return; }
  const seq = ++searchSeq;
  box.classList.add("open");
  box.innerHTML = `<div class="empty">搜索中…</div>`;
  try {
    let list = [];
    try {
      const p = new URLSearchParams({ name: kw.trim(), count: "8", language: "zh", format: "json" });
      const data = await getJSON(`${API.geo}?${p}`);
      list = (data.results || []).map(r => ({
        name: r.name,
        admin: [r.admin2, r.admin1, r.country].filter(Boolean).filter((v, k, a) => a.indexOf(v) === k).join(" · "),
        country: "",
        lat: r.latitude, lon: r.longitude
      }));
    } catch (e) { /* 落到高德联想 */ }
    if (seq !== searchSeq) return;
    if (!list.length) { box.innerHTML = `<div class="empty">没有找到「${kw}」</div>`; return; }
    box.innerHTML = list.map((r, i) => `
      <button data-i="${i}">
        ${r.name}<span class="sub">${r.admin || r.country || ""}</span>
      </button>`).join("");
    box.querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => {
        const r = list[+btn.dataset.i];
        box.classList.remove("open");
        $("#q").value = "";
        const city = {
          name: r.name,
          admin: r.admin || [r.country].filter(Boolean).join(" · "),
          country: r.country || "",
          lat: r.lat, lon: r.lon
        };
        if (r.adcode) city.adcode = r.adcode;
        if (CMP.pending) {
          CMP.pending = false;
          $("#cmpBtn").classList.remove("active");
          $("#q").placeholder = "搜索城市，如 杭州 / 上海 / Tokyo";
          loadCompare(city);
        } else {
          requestCity(city, true);
        }
      });
    });
  } catch (e) {
    if (seq === searchSeq) box.innerHTML = `<div class="empty">搜索失败：${e.message}</div>`;
  }
}

/* ---------- 定位 ---------- */
function currentPosition(timeout = 8000) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("浏览器不支持定位"));
    navigator.geolocation.getCurrentPosition(
      p => resolve(p.coords),
      e => reject(new Error(e.code === 1 ? "定位权限被拒绝" : "定位失败")),
      { timeout, maximumAge: 600000, enableHighAccuracy: false }
    );
  });
}
async function reverseName(lat, lon) {
  try {
    const p = new URLSearchParams({ latitude: lat, longitude: lon, localityLanguage: "zh" });
    const d = await getJSON(`${API.reverse}?${p}`);
    return {
      name: d.city || d.locality || d.principalSubdivision || "当前位置",
      admin: [d.principalSubdivision, d.countryName].filter(Boolean).join(" · ")
    };
  } catch (e) {
    return { name: "当前位置", admin: `${lat.toFixed(2)}, ${lon.toFixed(2)}` };
  }
}
const GEO_KEY = "wf.geo.v1";
function readGeo() { try { return localStorage.getItem(GEO_KEY) || ""; } catch (e) { return ""; } }
function saveGeo(city) {
  const txt = city.name + (city.admin ? " \u00B7 " + city.admin.split(" \u00B7 ")[0] : "");
  try { localStorage.setItem(GEO_KEY, txt); } catch (e) {}
  const el = $("#geoText");
  if (el) el.textContent = "当前定位：" + txt;
}

async function useMyLocation() {
  try {
    const coords = await currentPosition();
    const info = await reverseName(coords.latitude, coords.longitude);
    saveGeo(info);
    await requestCity({ ...info, lat: coords.latitude, lon: coords.longitude }, true);
  } catch (e) {
    toast(e.message + "，可手动搜索城市。若通过 file:// 打开页面，浏览器会禁用定位，请用本地服务器访问。");
  }
}

/* ============================================================
   数据源切换
   ============================================================ */
function paintSwitch() {
  document.querySelectorAll("#srcSwitch .src-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.src === SRC.current);
    b.setAttribute("aria-pressed", b.dataset.src === SRC.current ? "true" : "false");
  });
}

function setSource(src, silent) {
  const next = src === "metno" ? "metno" : "meteo";
  if (next === SRC.current && !silent) return;
  SRC.current = next;
  saveSrc(next);
  paintSwitch();
  if (silent) return;
  toast(next === "metno" ? "已切换数据源：MET Norway（免 Key）" : "已切换数据源：Open-Meteo");
  if (state.city) requestCity(state.city);
  if (CMP.on && CMP.city) loadCompare(CMP.city);
}

$("#srcSwitch").addEventListener("click", e => {
  const b = e.target.closest(".src-btn");
  if (!b) return;
  setSource(b.dataset.src);
});

/* ============================================================
   事件 & 启动
   ============================================================ */
const HOT_CITIES = {
  "南昌": { name: "南昌", admin: "江西省", country: "中国", lat: 28.6820, lon: 115.8579, adcode: "360100" },
  "北京": { name: "北京", admin: "北京市", country: "中国", lat: 39.9042, lon: 116.4074, adcode: "110000" },
  "上海": { name: "上海", admin: "上海市", country: "中国", lat: 31.2304, lon: 121.4737, adcode: "310000" },
  "广州": { name: "广州", admin: "广东省", country: "中国", lat: 23.1291, lon: 113.2644, adcode: "440100" },
  "杭州": { name: "杭州", admin: "浙江省", country: "中国", lat: 30.2741, lon: 120.1551, adcode: "330100" },
  "成都": { name: "成都", admin: "四川省", country: "中国", lat: 30.5728, lon: 104.0668, adcode: "510100" }
};

$("#q").addEventListener("input", e => {
  const v = e.target.value;
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => doSearch(v), 320);
});
$("#q").addEventListener("focus", e => { if (e.target.value.trim()) doSearch(e.target.value); });
$("#q").addEventListener("keydown", e => {
  if (e.key === "Enter") { $("#results").classList.remove("open"); searchAndLoad(e.target.value); }
});
$("#q2").addEventListener("keydown", e => { if (e.key === "Enter") startCompare(); });
$("#searchBtn").addEventListener("click", () => searchAndLoad($("#q").value));
$("#cmpStart").addEventListener("click", startCompare);
$("#cmpCancel").addEventListener("click", () => {
  $("#cmpRow").classList.remove("on");
  $("#q2").value = "";
  if (!CMP.on) $("#cmpBtn").classList.remove("active");
});
document.querySelectorAll(".hot-chip").forEach(b => {
  b.addEventListener("click", () => {
    const c = HOT_CITIES[b.dataset.hot];
    if (c) requestCity({ name: c.name, admin: c.admin, country: c.country, lat: c.lat, lon: c.lon, adcode: c.adcode }, true);
  });
});
document.addEventListener("click", e => {
  if (!e.target.closest(".sbox")) $("#results").classList.remove("open");
});
$("#refreshBtn").addEventListener("click", () => { if (state.city) requestCity(state.city); });
$("#geoBtn").addEventListener("click", useMyLocation);
$("#cmpBtn").addEventListener("click", () => { if (CMP.on) exitCompare(); else enterCompareMode(); });
$("#cmpClose").addEventListener("click", exitCompare);
renderHistory();
setInterval(() => { if (state.city && !document.hidden) requestCity(state.city); }, 10 * 60 * 1000);

(function init() {
  SRC.current = readSrc();
  paintSwitch();
  const saved = readCity();
  requestCity(saved && saved.lat ? saved : DEFAULT_CITY);
  const g = readGeo();
  if (g) $("#geoText").textContent = "当前定位：" + g;
})();
