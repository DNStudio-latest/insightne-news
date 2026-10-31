// Current weather in the eight state capitals, checked every 30 minutes. Free services, no keys:
// Open-Meteo first; if it does not answer, MET Norway; if neither does, the last readings saved in the database
// (up to 6 hours old), so the strip does not disappear when a weather service has a bad hour.
import { db } from "./db.js";
import { settings } from "./config.js";

const CAPITALS = [
  ["Agartala", { bn: "আগরতলা", hi: "अगरतला", as: "আগৰতলা", ne: "अगरतला" }, 23.8315, 91.2868],
  ["Guwahati", { bn: "গুয়াহাটি", hi: "गुवाहाटी", as: "গুৱাহাটী", ne: "गुवाहाटी" }, 26.1445, 91.7362],
  ["Shillong", { bn: "শিলং", hi: "शिलांग", as: "শ্বিলং", ne: "शिलङ" }, 25.5788, 91.8933],
  ["Imphal", { bn: "ইম্ফল", hi: "इंफाल", as: "ইম্ফল", ne: "इम्फाल" }, 24.817, 93.9368],
  ["Aizawl", { bn: "আইজল", hi: "आइज़ोल", as: "আইজল", ne: "आइजोल" }, 23.7271, 92.7176],
  ["Kohima", { bn: "কোহিমা", hi: "कोहिमा", as: "কোহিমা", ne: "कोहिमा" }, 25.6751, 94.1086],
  ["Itanagar", { bn: "ইটানগর", hi: "ईटानगर", as: "ইটানগৰ", ne: "इटानगर" }, 27.0844, 93.6053],
  ["Gangtok", { bn: "গ্যাংটক", hi: "गंगटोक", as: "গেংটক", ne: "गान्तोक" }, 27.3389, 88.6065],
];

// World Meteorological Organization weather codes → a small picture.
export function weatherIcon(code) {
  if (code === 0) return "☀️";
  if (code <= 2) return "🌤️";
  if (code === 3) return "☁️";
  if (code === 45 || code === 48) return "🌫️";
  if (code >= 95) return "⛈️";
  if (code >= 80) return "🌦️";
  if (code >= 71 && code <= 77) return "❄️";
  if (code >= 51) return "🌧️";
  return "🌡️";
}

// MET Norway's weather names ("lightrainshowers_day", "partlycloudy_night" …) → the same small pictures.
export function metIcon(symbol = "") {
  const name = symbol.replace(/_(day|night|polartwilight)$/, "");
  if (name === "clearsky") return "☀️";
  if (name === "fair") return "🌤️";
  if (name === "partlycloudy") return "🌤️";
  if (name === "cloudy") return "☁️";
  if (name === "fog") return "🌫️";
  if (name.includes("thunder")) return "⛈️";
  if (name.includes("snow") || name.includes("sleet")) return "❄️";
  if (name.includes("showers")) return "🌦️";
  if (name.includes("rain")) return "🌧️";
  return "🌡️";
}

const reading = (i, temp, icon) => ({ city: CAPITALS[i][0], names: CAPITALS[i][1], temp: Math.round(temp), icon });

async function fromOpenMeteo() {
  const lat = CAPITALS.map((c) => c[2]).join(",");
  const lon = CAPITALS.map((c) => c[3]).join(",");
  const res = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FKolkata`,
    { next: { revalidate: 1800 }, signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);
  const data = await res.json();
  return (Array.isArray(data) ? data : [data]).map((d, i) => reading(i, d.current.temperature_2m, weatherIcon(d.current.weather_code)));
}

// MET Norway asks every website to say who it is.
async function fromMetNorway() {
  const agent = `${settings.siteName.replace(/\s+/g, "")}/1.0 ${settings.siteUrl}`;
  return Promise.all(
    CAPITALS.map(async ([, , lat, lon], i) => {
      const res = await fetch(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${lat.toFixed(3)}&lon=${lon.toFixed(3)}`, {
        headers: { "user-agent": agent },
        next: { revalidate: 1800 },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) throw new Error(`MET Norway ${res.status}`);
      const now = (await res.json()).properties.timeseries[0].data;
      return reading(i, now.instant.details.air_temperature, metIcon(now.next_1_hours?.summary?.symbol_code));
    }),
  );
}

const SAVED_KEY = "weather";
const SAVED_FOR = 6 * 3600 * 1000;
let lastSaved = 0; // the readings are saved at most every 20 minutes, not on every page view

export async function capitalsWeather() {
  for (const source of [fromOpenMeteo, fromMetNorway]) {
    try {
      const weather = await source();
      if (weather.length === CAPITALS.length && weather.every((w) => Number.isFinite(w.temp))) {
        if (Date.now() - lastSaved > 20 * 60 * 1000) {
          lastSaved = Date.now();
          db.setSetting(SAVED_KEY, { at: new Date().toISOString(), weather }).catch(() => {});
        }
        return weather;
      }
    } catch (err) {
      console.error("Weather:", err.message);
    }
  }
  // Both services failed: the last good readings, if they are recent.
  const saved = await db.getSetting(SAVED_KEY).catch(() => null);
  if (saved?.weather?.length && Date.now() - new Date(saved.at).getTime() < SAVED_FOR) return saved.weather;
  return []; // nothing recent: the page simply shows no weather
}
