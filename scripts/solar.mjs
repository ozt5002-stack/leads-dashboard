// Fetches PVGIS solar estimates for each city and saves them to Airtable "Solar Estimates".
// Run by .github/workflows/solar.yml. Env: AIRTABLE_TOKEN (required).
import { CITIES, fetchPvgis, upsertSolarEstimates } from "../src/solarCore.js";
import { sleep } from "../src/scraperCore.js";

const airtableToken = process.env.AIRTABLE_TOKEN;
if (!airtableToken) {
  console.error("Missing AIRTABLE_TOKEN (set it under Settings → Secrets and variables → Actions).");
  process.exit(1);
}

const results = [];
for (const city of CITIES) {
  const result = await fetchPvgis(city);
  console.log(`${city.name}: ${Math.round(result.yearly)} kWh/year per 1 kWp (tilt ${result.slope}°, azimuth ${result.azimuth}°)`);
  results.push(result);
  await sleep(1000); // be gentle: PVGIS resets connections under back-to-back calls
}

await upsertSolarEstimates(airtableToken, results);
console.log(`Saved ${results.length} cities to Airtable "Solar Estimates".`);
