// Scraping + Airtable logic shared by the dashboard (src/MarketResearch.jsx) and the
// scheduled GitHub Actions job (scripts/scrape.mjs). Plain JS, no React, so Node can import it.
// index.html carries an inline copy of this file: keep the two in sync.

export const MR_AIRTABLE_BASE_ID = "app1J5xG4dxtt52N9";
export const MR_FORUM_TABLE_ID = "tblQkWESz9jWhbt0i"; // "Forum Leads"

export const APIFY_ACTOR = "apify~cheerio-scraper";

export const SOURCE_ARIEL = "arielsegal.co.il";
export const SOURCE_PRO = "pro.co.il";
export const TYPE_QUESTION = "שאלה בפורום";
export const TYPE_COMPETITOR = "חשמלאי מתחרה";

// Keyword buckets used to tag every scraped title with a topic.
export const TOPIC_KEYWORDS = [
  ["סולארי", ["סולאר", "ממיר", "פאנל", "אינוורטר", "pv", "פוטו"]],
  ["רכב חשמלי", ["רכב חשמלי", "עמדת טעינה", "טעינה"]],
  ["הארקה ואיפוס", ["הארק", "איפוס", "אפס", "tn-c", "אלקטרודה"]],
  ["ממסר פחת", ["פחת", "rcd", "ממסר"]],
  ["לוח ומפסקים", ["לוח", "מפסק", "מאמ\"ת", "מאמת", "נתיך", "פאזה"]],
  ["כבלים וחתכים", ["כבל", "חתך", "מוליך", "ממ\"ר", "ממר", "מפל מתח"]],
  ["מנועים והנעה", ["מנוע", "משנה תדר", "vfd", "מדחס"]],
  ["תאורה", ["תאורה", "נורה", "led", "גוף תאורה"]],
  ["בדיקה ורישוי", ["בודק", "בדיקה", "רישיון", "רישוי", "מבחן", "הסמכה"]],
  ["תקנות", ["תקנה", "תקנות", "חוק"]],
];

export function classifyTopic(text) {
  const lower = (text || "").toLowerCase();
  for (const [topic, words] of TOPIC_KEYWORDS) {
    if (words.some((w) => lower.includes(w))) return topic;
  }
  return "אחר";
}

// Runs inside Apify's cheerio-scraper (not in the browser), so it must be self-contained.
export const APIFY_PAGE_FUNCTION = `async function pageFunction(context) {
  const { $, request, log } = context;
  const url = request.url;
  const clean = (s) => (s || "").replace(/\\s+/g, " ").trim();
  const results = [];

  if (url.includes("arielsegal.co.il")) {
    $("ul.topic, li.bbp-body > ul").each((i, el) => {
      const link = $(el).find("a.bbp-topic-permalink").first();
      if (!link.length) return;
      results.push({
        source: "arielsegal.co.il",
        type: "question",
        title: clean(link.text()),
        url: link.attr("href"),
        author: clean($(el).find(".bbp-topic-started-by .bbp-author-name").first().text()),
        forum: clean($(el).find(".bbp-topic-started-in a").first().text()),
        replies: parseInt(clean($(el).find(".bbp-topic-reply-count").first().text()), 10) || 0,
        date: clean($(el).find(".bbp-topic-freshness a").first().text()),
      });
    });
  } else {
    // pro.co.il: read structured data (JSON-LD / Next.js payload) and pick objects that look like businesses.
    const blobs = [];
    $('script[type="application/ld+json"], script#__NEXT_DATA__').each((i, el) => {
      try { blobs.push(JSON.parse($(el).contents().text())); } catch (e) {}
    });
    const seen = new Set();
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.forEach(walk);
      const rating = node.aggregateRating || node.rating || node.ratingValue || node.reviewsCount || node.reviewCount;
      if (typeof node.name === "string" && rating !== undefined) {
        const r = node.aggregateRating || {};
        const link = node.url || node.link || node.slug || "";
        const key = node.name + "|" + link;
        if (!seen.has(key)) {
          seen.add(key);
          results.push({
            source: "pro.co.il",
            type: "competitor",
            title: clean(node.name),
            url: link ? new URL(String(link), "https://www.pro.co.il/").href : url + "#" + encodeURIComponent(node.name),
            rating: parseFloat(r.ratingValue || node.ratingValue || node.rating) || null,
            replies: parseInt(r.reviewCount || r.ratingCount || node.reviewsCount || node.reviewCount, 10) || 0,
            details: clean([node.description, node.address && (node.address.addressLocality || node.address), node.areaServed].filter((x) => typeof x === "string").join(" | ")),
          });
        }
      }
      Object.values(node).forEach(walk);
    };
    blobs.forEach(walk);
  }

  log.info(url + " -> " + results.length + " items");
  return results;
}`;

export function apifyStartUrls(sources, arielPages) {
  const urls = [];
  if (sources.includes(SOURCE_ARIEL)) {
    for (let page = 1; page <= arielPages; page++) {
      urls.push({ url: page === 1 ? "https://arielsegal.co.il/topics/" : `https://arielsegal.co.il/topics/page/${page}/` });
    }
  }
  if (sources.includes(SOURCE_PRO)) {
    urls.push({ url: "https://www.pro.co.il/electricians" });
  }
  return urls;
}

export const APIFY_FINAL_STATUSES = ["SUCCEEDED", "FAILED", "TIMED-OUT", "ABORTED"];

// Every API call goes through here so an error always names the service and shows
// what came back, even when the body isn't JSON (e.g. an HTML error page).
export async function fetchJson(label, url, options) {
  const res = await fetch(url, options);
  const text = await res.text();
  if (!res.ok) throw new Error(`${label} ${res.status}: ${text.slice(0, 200)}`);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`${label} ${res.status} החזיר תשובה שאינה JSON: ${text.slice(0, 120)}`);
  }
}

export async function runApifyScraper(token, sources, arielPages, onProgress = () => {}) {
  const input = {
    startUrls: apifyStartUrls(sources, arielPages),
    pageFunction: APIFY_PAGE_FUNCTION,
    maxCrawlingDepth: 0,
    maxConcurrency: 3,
    proxyConfiguration: { useApifyProxy: true },
  };
  const auth = { Authorization: `Bearer ${token}` };

  // Start the run and poll it, instead of holding one HTTP request open for minutes
  // (fragile on mobile networks).
  const started = await fetchJson("Apify (הפעלת ריצה)", `https://api.apify.com/v2/acts/${APIFY_ACTOR}/runs`, {
    method: "POST",
    headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  let run = started.data;
  const consoleUrl = `https://console.apify.com/view/runs/${run.id}`;
  const deadline = Date.now() + 10 * 60 * 1000;
  while (!APIFY_FINAL_STATUSES.includes(run.status)) {
    if (Date.now() > deadline) throw new Error(`הריצה ב-Apify לא הסתיימה תוך 10 דקות: ${consoleUrl}`);
    onProgress(`סורק דרך Apify... סטטוס: ${run.status}`);
    const polled = await fetchJson("Apify (סטטוס ריצה)", `https://api.apify.com/v2/actor-runs/${run.id}?waitForFinish=30`, { headers: auth });
    run = polled.data;
  }
  if (run.status !== "SUCCEEDED") throw new Error(`הריצה ב-Apify הסתיימה בסטטוס ${run.status}: ${consoleUrl}`);

  const items = await fetchJson(
    "Apify (תוצאות)",
    `https://api.apify.com/v2/datasets/${run.defaultDatasetId}/items?clean=true&format=json`,
    { headers: auth }
  );
  return items.filter((item) => item && item.url && item.title);
}

export function toAirtableFields(item, scrapedAt) {
  const isQuestion = item.type === "question";
  const fields = {
    "כותרת": item.title,
    "מקור": item.source,
    "סוג": isQuestion ? TYPE_QUESTION : TYPE_COMPETITOR,
    "קישור": item.url,
    "נושא": isQuestion ? classifyTopic(item.title) : "",
    "מחבר": item.author || "",
    "תגובות": item.replies || 0,
    "תאריך": item.date || "",
    "פרטים": item.details || item.forum || "",
    "נסרק ב": scrapedAt,
  };
  if (item.rating != null) fields["דירוג"] = item.rating;
  return fields;
}

export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Upsert on "קישור" so re-running the scraper updates rows instead of duplicating them,
// and never touches "סטטוס" so manual review decisions survive a re-scrape.
export async function upsertToAirtable(token, items) {
  const scrapedAt = new Date().toISOString();
  for (let i = 0; i < items.length; i += 10) {
    const batch = items.slice(i, i + 10).map((item) => ({ fields: toAirtableFields(item, scrapedAt) }));
    await fetchJson("Airtable (שמירה)", `https://api.airtable.com/v0/${MR_AIRTABLE_BASE_ID}/${MR_FORUM_TABLE_ID}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ performUpsert: { fieldsToMergeOn: ["קישור"] }, records: batch, typecast: true }),
    });
    await sleep(250); // Airtable allows 5 requests/sec per base
  }
}
