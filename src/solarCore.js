// Solar production estimates from PVGIS (European Commission JRC), stored in Airtable
// "Solar Estimates". PVGIS blocks browser (CORS) calls, so this runs from
// scripts/solar.mjs in GitHub Actions; the dashboard only reads the Airtable table.
//
// Every city is fetched for a 1 kWp system: production scales linearly with system
// size, so the dashboard multiplies by the size the user picks instead of calling PVGIS again.
import { MR_AIRTABLE_BASE_ID, fetchJson, sleep } from "./scraperCore.js";

export const SOLAR_TABLE_ID = "tblc0DLvSqZmbuT94"; // "Solar Estimates"
const PVGIS_URL = "https://re.jrc.ec.europa.eu/api/v5_3/PVcalc";
const SYSTEM_LOSS_PERCENT = 14; // PVGIS default: cables, inverter, dirt

export const MONTHS = ["ינואר", "פברואר", "מרץ", "אפריל", "מאי", "יוני", "יולי", "אוגוסט", "ספטמבר", "אוקטובר", "נובמבר", "דצמבר"];

export const CITIES = [
  { name: "קריית שמונה", lat: 33.2073, lon: 35.5697 },
  { name: "חיפה", lat: 32.794, lon: 34.9896 },
  { name: "טבריה", lat: 32.7922, lon: 35.5312 },
  { name: "תל אביב", lat: 32.0853, lon: 34.7818 },
  { name: "ירושלים", lat: 31.7683, lon: 35.2137 },
  { name: "אשדוד", lat: 31.8044, lon: 34.6553 },
  { name: "באר שבע", lat: 31.252, lon: 34.7915 },
  { name: "אילת", lat: 29.5577, lon: 34.9519 },
];

// PVGIS sometimes drops the connection between back-to-back requests (ECONNRESET).
// Network-level failures (fetch throws a TypeError) are retried with a growing pause;
// HTTP errors like 400 are not, since retrying a bad request can't help.
async function withRetry(fn, attempts = 4) {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!(err instanceof TypeError) || attempt >= attempts) throw err;
      console.log(`  retry ${attempt}/${attempts - 1} after network error: ${err.cause?.code || err.message}`);
      await sleep(2000 * attempt);
    }
  }
}

// PVGIS picks the optimal tilt and azimuth itself (optimalangles=1).
export async function fetchPvgis(city) {
  const params = new URLSearchParams({
    lat: String(city.lat),
    lon: String(city.lon),
    peakpower: "1",
    loss: String(SYSTEM_LOSS_PERCENT),
    optimalangles: "1",
    outputformat: "json",
  });
  const data = await withRetry(() => fetchJson(`PVGIS (${city.name})`, `${PVGIS_URL}?${params}`));
  const monthly = data?.outputs?.monthly?.fixed;
  const yearly = data?.outputs?.totals?.fixed?.E_y;
  if (!Array.isArray(monthly) || monthly.length !== 12 || typeof yearly !== "number") {
    throw new Error(`PVGIS (${city.name}): unexpected response shape: ${JSON.stringify(data).slice(0, 200)}`);
  }
  const mounting = data.inputs?.mounting_system?.fixed || {};
  return {
    city,
    yearly,
    monthly: monthly.map((m) => m.E_m),
    slope: mounting.slope?.value,
    azimuth: mounting.azimuth?.value,
    database: data.inputs?.meteo_data?.radiation_db || "",
  };
}

export function toSolarFields(result, updatedAt) {
  const fields = {
    "עיר": result.city.name,
    "קו רוחב": result.city.lat,
    "קו אורך": result.city.lon,
    'קוט"ש לשנה ל-1kWp': Math.round(result.yearly),
    "זווית": result.slope,
    "אזימוט": result.azimuth,
    "מאגר קרינה": result.database,
    "עודכן ב": updatedAt,
  };
  MONTHS.forEach((month, i) => {
    fields[month] = Math.round(result.monthly[i] * 10) / 10;
  });
  return fields;
}

// Upsert on "עיר" so re-running updates each city's row instead of adding a new one.
export async function upsertSolarEstimates(token, results) {
  const updatedAt = new Date().toISOString();
  for (let i = 0; i < results.length; i += 10) {
    const records = results.slice(i, i + 10).map((r) => ({ fields: toSolarFields(r, updatedAt) }));
    await fetchJson("Airtable (שמירת סולארי)", `https://api.airtable.com/v0/${MR_AIRTABLE_BASE_ID}/${SOLAR_TABLE_ID}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ["עיר"] }, records }),
    });
    await sleep(250);
  }
}
