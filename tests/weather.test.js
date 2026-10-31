// Weather strip: Open-Meteo first, MET Norway if it fails, the last saved readings if both fail.
import { test } from "node:test";
import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import fs from "node:fs";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "insightne-weather-"));
process.env.LOCAL_DB_FILE = path.join(tmp, "db.json");
delete process.env.SUPABASE_URL;

const { capitalsWeather, metIcon } = await import("../lib/weather.js");
const { db } = await import("../lib/db.js");

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const openMeteo = () => json(Array.from({ length: 8 }, (_, i) => ({ current: { temperature_2m: 20 + i, weather_code: 0 } })));
const metNorway = () => json({ properties: { timeseries: [{ data: { instant: { details: { air_temperature: 17.6 } }, next_1_hours: { summary: { symbol_code: "lightrainshowers_day" } } } }] } });
const realFetch = globalThis.fetch;
const withFetch = async (fn, run) => {
  globalThis.fetch = fn;
  try {
    return await run();
  } finally {
    globalThis.fetch = realFetch;
  }
};

test("weather: Open-Meteo when it answers", async () => {
  const weather = await withFetch(async (url) => (String(url).includes("open-meteo") ? openMeteo() : metNorway()), capitalsWeather);
  assert.equal(weather.length, 8);
  assert.equal(weather[0].city, "Agartala");
  assert.equal(weather[0].temp, 20);
  assert.equal(weather[0].icon, "☀️");
});

test("weather: MET Norway when Open-Meteo is down", async () => {
  const weather = await withFetch(async (url) => (String(url).includes("open-meteo") ? new Response("busy", { status: 429 }) : metNorway()), capitalsWeather);
  assert.equal(weather.length, 8);
  assert.equal(weather[7].city, "Gangtok");
  assert.equal(weather[7].temp, 18);
  assert.equal(weather[7].icon, "🌦️");
});

test("weather: last saved readings when both services are down", async () => {
  await db.setSetting("weather", { at: new Date().toISOString(), weather: [{ city: "Agartala", temp: 25, icon: "☁️" }] });
  const down = async () => new Response("down", { status: 503 });
  assert.deepEqual((await withFetch(down, capitalsWeather)).map((w) => w.temp), [25]);
  // Readings older than 6 hours are not shown.
  await db.setSetting("weather", { at: new Date(Date.now() - 7 * 3600 * 1000).toISOString(), weather: [{ city: "Agartala", temp: 25, icon: "☁️" }] });
  assert.deepEqual(await withFetch(down, capitalsWeather), []);
});

test("weather: MET Norway icons", () => {
  assert.equal(metIcon("clearsky_night"), "☀️");
  assert.equal(metIcon("heavyrainandthunder"), "⛈️");
  assert.equal(metIcon("cloudy"), "☁️");
  assert.equal(metIcon("rain"), "🌧️");
});
