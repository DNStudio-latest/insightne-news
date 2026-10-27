// Current weather in the eight state capitals, from the free Open-Meteo service (no key, checked every 30 minutes).
const CAPITALS = [
  ["Agartala", "আগরতলা", 23.8315, 91.2868],
  ["Guwahati", "গুয়াহাটি", 26.1445, 91.7362],
  ["Shillong", "শিলং", 25.5788, 91.8933],
  ["Imphal", "ইম্ফল", 24.817, 93.9368],
  ["Aizawl", "আইজল", 23.7271, 92.7176],
  ["Kohima", "কোহিমা", 25.6751, 94.1086],
  ["Itanagar", "ইটানগর", 27.0844, 93.6053],
  ["Gangtok", "গ্যাংটক", 27.3389, 88.6065],
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
      cityBn: CAPITALS[i][1],
      temp: Math.round(d.current.temperature_2m),
      icon: weatherIcon(d.current.weather_code),
    }));
  } catch {
    return []; // If the weather service is slow or down, the page simply shows no weather.
  }
}
