// Current weather in the eight state capitals, from the free Open-Meteo service (no key, checked every 30 minutes).
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

export async function capitalsWeather() {
  try {
    const lat = CAPITALS.map((c) => c[2]).join(",");
    const lon = CAPITALS.map((c) => c[3]).join(",");
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&timezone=Asia%2FKolkata`,
      { next: { revalidate: 1800 }, signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (Array.isArray(data) ? data : [data]).map((d, i) => ({
      city: CAPITALS[i][0],
      names: CAPITALS[i][1], // the city's name in each language
      temp: Math.round(d.current.temperature_2m),
      icon: weatherIcon(d.current.weather_code),
    }));
  } catch {
    return []; // If the weather service is slow or down, the page simply shows no weather.
  }
}
