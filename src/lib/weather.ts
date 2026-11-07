// Weather from Open-Meteo (free, no account or key). Used so the jacket only shows up when it is
// actually cold and the umbrella only when rain is likely. If anything fails we return null,
// and weather items simply show as normal.

import type { Weather } from './types';

const cache = new Map<string, { at: number; w: Weather }>();
const TTL = 30 * 60_000;

/** Pure: turn an Open-Meteo response into our Weather. Exported for tests. */
export function parseOpenMeteo(json: unknown): Weather | null {
  const j = json as { current?: { temperature_2m?: number }; hourly?: { precipitation_probability?: (number | null)[] } };
  const tempF = j?.current?.temperature_2m;
  if (typeof tempF !== 'number') return null;
  const probs = (j.hourly?.precipitation_probability ?? []).filter((n): n is number => typeof n === 'number');
  return { tempF, rainChance: probs.length ? Math.max(...probs) : 0 };
}

/** Test Lab hook: force a weather answer (undefined = use the real forecast). */
let override: Weather | null | undefined;
export function setWeatherOverride(w: Weather | null | undefined) {
  override = w;
}

export async function getWeather(loc: { latitude: number; longitude: number } | null): Promise<Weather | null> {
  if (override !== undefined) return override;
  if (!loc) return null;
  // ~1 km grid so nearby places share a cached answer.
  const key = `${loc.latitude.toFixed(2)},${loc.longitude.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.w;

  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude.toFixed(3)}&longitude=${loc.longitude.toFixed(3)}` +
    '&current=temperature_2m&hourly=precipitation_probability&forecast_hours=6&temperature_unit=fahrenheit&timezone=auto';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 4000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const w = parseOpenMeteo(await res.json());
    if (w) cache.set(key, { at: Date.now(), w });
    return w;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export function weatherLine(w: Weather): string {
  const icon = w.rainChance >= 60 ? '🌧️' : w.rainChance >= 30 ? '🌦️' : w.tempF < 40 ? '🥶' : w.tempF < 55 ? '🌥️' : '☀️';
  return `${icon} ${Math.round(w.tempF)}°F · ${w.rainChance}% rain in the next few hours`;
}
