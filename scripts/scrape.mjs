// Scheduled scrape for the "Forum Leads" table, run by .github/workflows/scrape.yml.
// Runs on GitHub's servers, so it doesn't depend on a browser or the local network.
//
// Env: APIFY_TOKEN, AIRTABLE_TOKEN (required); SOURCES (comma-separated), ARIEL_PAGES (optional).
import { SOURCE_ARIEL, SOURCE_PRO, runApifyScraper, upsertToAirtable } from "../src/scraperCore.js";

const apifyToken = process.env.APIFY_TOKEN;
const airtableToken = process.env.AIRTABLE_TOKEN;
if (!apifyToken || !airtableToken) {
  console.error("Missing APIFY_TOKEN or AIRTABLE_TOKEN (set them under Settings → Secrets and variables → Actions).");
  process.exit(1);
}

const sources = (process.env.SOURCES || `${SOURCE_ARIEL},${SOURCE_PRO}`)
  .split(",")
  .map((s) => s.trim())
  .filter((s) => s === SOURCE_ARIEL || s === SOURCE_PRO);
const arielPages = Math.min(20, Math.max(1, Number(process.env.ARIEL_PAGES) || 3));

console.log(`Scraping ${sources.join(", ")} (forum pages: ${arielPages})`);
const items = await runApifyScraper(apifyToken, sources, arielPages, (msg) => console.log(msg));
for (const source of sources) {
  console.log(`${source}: ${items.filter((i) => i.source === source).length} items`);
}
if (items.length === 0) {
  console.error("Apify returned 0 items — the site structure may have changed. Check the run log in the Apify Console.");
  process.exit(1);
}
await upsertToAirtable(airtableToken, items);
console.log(`Saved ${items.length} items to Airtable "Forum Leads".`);
