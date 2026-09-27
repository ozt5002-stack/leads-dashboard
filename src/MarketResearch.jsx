import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  MR_AIRTABLE_BASE_ID,
  MR_FORUM_TABLE_ID,
  SOURCE_ARIEL,
  SOURCE_PRO,
  TYPE_COMPETITOR,
  TYPE_QUESTION,
  fetchJson,
  runApifyScraper,
  upsertToAirtable,
} from "./scraperCore.js";

// === MARKET RESEARCH START ===
const MR_AIRTABLE_TOKEN_KEY = "airtable_pat";
const MR_APIFY_TOKEN_KEY = "apify_token";

const REVIEW_STATUSES = ["חדש", "רלוונטי", "לא רלוונטי"];
const SCRAPE_WORKFLOW_URL = "https://github.com/ozt5002-stack/leads-dashboard/actions/workflows/scrape.yml";

// A question with no replies only counts as "stuck" after this many days;
// newer ones may simply not have been answered yet.
const STUCK_AFTER_DAYS = 7;

const AGE_UNITS = [
  ["שעתיים", 2 / 24], ["יומיים", 2], ["שבועיים", 14], ["חודשיים", 60], ["שנתיים", 730],
  ["דק", 1 / 1440], ["שעה", 1 / 24], ["שעות", 1 / 24], ["יום", 1], ["ימים", 1],
  ["שבוע", 7], ["חודש", 30], ["שנה", 365], ["שנים", 365],
];

// bbPress shows relative times like "לפני 3 ימים, 4 שעות" or "לפני שבועיים";
// the first (largest) unit is enough. Returns null when the text can't be read.
function parseAgeDays(text) {
  const match = (text || "").match(/(\d+)?\s*(שעתיים|יומיים|שבועיים|חודשיים|שנתיים|דק|שעה|שעות|יום|ימים|שבוע|חודש|שנה|שנים)/);
  if (!match) return null;
  const perUnit = AGE_UNITS.find(([word]) => word === match[2])[1];
  return (match[1] ? parseInt(match[1], 10) : 1) * perUnit;
}

// Age measured from now: the age shown at scrape time plus the time since that scrape.
function questionAgeDays(item) {
  const ageAtScrape = parseAgeDays(item.date);
  if (ageAtScrape == null || !item.scrapedAt) return null;
  return ageAtScrape + (Date.now() - new Date(item.scrapedAt).getTime()) / 86400000;
}

// Unknown age counts as stuck, so an unreadable date never hides a question.
function isStuck(item) {
  if (item.type !== TYPE_QUESTION || item.replies !== 0) return false;
  const age = questionAgeDays(item);
  return age == null || age >= STUCK_AFTER_DAYS;
}

async function fetchForumLeads(token) {
  const records = [];
  let offset;
  do {
    const params = new URLSearchParams({ pageSize: "100" });
    if (offset) params.set("offset", offset);
    const data = await fetchJson("Airtable (קריאה)", `https://api.airtable.com/v0/${MR_AIRTABLE_BASE_ID}/${MR_FORUM_TABLE_ID}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    records.push(...data.records);
    offset = data.offset;
  } while (offset);
  return records.map((record) => ({
    id: record.id,
    title: record.fields["כותרת"] || "",
    source: record.fields["מקור"] || "",
    type: record.fields["סוג"] || "",
    url: record.fields["קישור"] || "",
    topic: record.fields["נושא"] || "",
    author: record.fields["מחבר"] || "",
    replies: Number(record.fields["תגובות"]) || 0,
    rating: record.fields["דירוג"],
    date: record.fields["תאריך"] || "",
    scrapedAt: record.fields["נסרק ב"] || "",
    status: record.fields["סטטוס"] || "חדש",
  }));
}

async function updateForumLeadStatus(token, recordId, status) {
  await fetchJson("Airtable (עדכון סטטוס)", `https://api.airtable.com/v0/${MR_AIRTABLE_BASE_ID}/${MR_FORUM_TABLE_ID}/${recordId}`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ fields: { "סטטוס": status } }),
  });
}

function readStoredToken(key) {
  try {
    return localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function MarketResearch() {
  const [apifyToken, setApifyToken] = useState(() => readStoredToken(MR_APIFY_TOKEN_KEY));
  const [airtableToken, setAirtableToken] = useState(() => readStoredToken(MR_AIRTABLE_TOKEN_KEY));
  const [items, setItems] = useState([]);
  const [sources, setSources] = useState([SOURCE_ARIEL, SOURCE_PRO]);
  const [arielPages, setArielPages] = useState(3);
  const [typeFilter, setTypeFilter] = useState("all");
  const [onlyUnanswered, setOnlyUnanswered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function reload(token = airtableToken) {
    if (!token) return;
    try {
      setItems(await fetchForumLeads(token));
    } catch (err) {
      setMessage(`⚠ לא הצלחתי לקרוא את "Forum Leads" (${err.message}). ודא שלטוקן יש גישה לטבלה.`);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  function promptToken(key, label, setter) {
    const token = window.prompt(label);
    if (!token) return null;
    try {
      localStorage.setItem(key, token.trim());
    } catch {}
    setter(token.trim());
    return token.trim();
  }

  function handleConnectApify() {
    promptToken(MR_APIFY_TOKEN_KEY, "הדבק כאן את ה-Apify API Token (Settings → API & Integrations):", setApifyToken);
  }

  function handleConnectAirtable() {
    const token = promptToken(
      MR_AIRTABLE_TOKEN_KEY,
      "הדבק Airtable Personal Access Token עם הרשאות data.records:read + data.records:write:",
      setAirtableToken
    );
    if (token) reload(token);
  }

  function toggleSource(source) {
    setSources((prev) => (prev.includes(source) ? prev.filter((s) => s !== source) : [...prev, source]));
  }

  async function handleRun() {
    if (!apifyToken || !airtableToken || sources.length === 0) return;
    setBusy(true);
    try {
      setMessage("מפעיל ריצה ב-Apify... (יכול לקחת 1–4 דקות, השאר את הדף פתוח)");
      const scraped = await runApifyScraper(apifyToken, sources, arielPages, setMessage);
      const counts = sources.map((s) => `${s}: ${scraped.filter((i) => i.source === s).length}`).join(" · ");
      if (scraped.length === 0) {
        setMessage(`Apify החזיר 0 פריטים (${counts}). כנראה מבנה האתר השתנה — בדוק את הלוג של הריצה ב-Apify Console.`);
        return;
      }
      setMessage(`נמצאו ${scraped.length} פריטים (${counts}). שולח ל-Airtable...`);
      await upsertToAirtable(airtableToken, scraped);
      await reload();
      setMessage(`✓ ${scraped.length} פריטים נשמרו ב-Forum Leads (${counts})`);
    } catch (err) {
      console.error(err);
      setMessage(`⚠ ${err.message}`);
    } finally {
      setBusy(false);
    }
  }

  async function handleStatusChange(item, status) {
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status } : i)));
    try {
      await updateForumLeadStatus(airtableToken, item.id, status);
    } catch (err) {
      setMessage(`⚠ עדכון סטטוס נכשל: ${err.message}`);
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, status: item.status } : i)));
    }
  }

  const questions = useMemo(() => items.filter((i) => i.type === TYPE_QUESTION), [items]);
  const competitors = useMemo(() => items.filter((i) => i.type === TYPE_COMPETITOR), [items]);

  const topicData = useMemo(() => {
    const counts = {};
    questions.forEach((q) => {
      const topic = q.topic || "אחר";
      counts[topic] = counts[topic] || { topic, answered: 0, waiting: 0, unanswered: 0 };
      const bucket = q.replies > 0 ? "answered" : isStuck(q) ? "unanswered" : "waiting";
      counts[topic][bucket] += 1;
    });
    // Topics where electricians get stuck without an answer come first.
    return Object.values(counts).sort(
      (a, b) => b.unanswered - a.unanswered || b.answered + b.waiting + b.unanswered - (a.answered + a.waiting + a.unanswered)
    );
  }, [questions]);

  const unansweredCount = questions.filter(isStuck).length;
  const ratedCompetitors = competitors.filter((c) => typeof c.rating === "number");
  const avgRating = ratedCompetitors.length
    ? ratedCompetitors.reduce((sum, c) => sum + c.rating, 0) / ratedCompetitors.length
    : null;

  const visibleItems = useMemo(() => {
    return items.filter((i) => {
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (onlyUnanswered && !isStuck(i)) return false;
      return true;
    });
  }, [items, typeFilter, onlyUnanswered]);

  const canRun = apifyToken && airtableToken && sources.length > 0 && !busy;

  return (
    <div>
      <div className="surface mb-6 rounded-xl border p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-s text-xs">
            <p>Apify: {apifyToken ? "✓ מחובר" : "לא מחובר"} · Airtable: {airtableToken ? "✓ מחובר" : "לא מחובר"}</p>
            <p className="mt-1">
              סריקה אוטומטית רצה כל בוקר ב-GitHub Actions ·{" "}
              <a href={SCRAPE_WORKFLOW_URL} target="_blank" rel="noopener noreferrer" className="btn-edit underline">הפעל עכשיו</a>
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={!airtableToken || busy} onClick={() => reload()} className="btn-ghost rounded-lg border px-4 py-2.5 text-sm font-medium disabled:opacity-50" style={{ borderColor: "var(--border)", minHeight: 44 }}>
              רענן נתונים
            </button>
            <button type="button" onClick={handleConnectApify} className="btn-ghost rounded-lg border px-4 py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)", minHeight: 44 }}>
              חבר Apify
            </button>
            <button type="button" onClick={handleConnectAirtable} className="btn-ghost rounded-lg border px-4 py-2.5 text-sm font-medium" style={{ borderColor: "var(--border)", minHeight: 44 }}>
              חבר Airtable
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          {[SOURCE_ARIEL, SOURCE_PRO].map((source) => (
            <label key={source} className="text-s flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sources.includes(source)} onChange={() => toggleSource(source)} />
              {source}
            </label>
          ))}
          <label className="text-s flex items-center gap-2 text-sm">
            עמודי פורום:
            <input type="number" min="1" max="20" value={arielPages} onChange={(e) => setArielPages(Math.min(20, Math.max(1, Number(e.target.value) || 1)))} className="field-input w-16 rounded-md px-2 py-1 text-sm" />
          </label>
          <button type="button" disabled={!canRun} onClick={handleRun} className="btn-primary rounded-lg px-4 py-2.5 text-sm font-medium shadow-sm disabled:opacity-50" style={{ minHeight: 44 }}>
            {busy ? "סורק..." : "הרץ סריקה"}
          </button>
        </div>
        {message && <p className="text-s mt-3 text-sm">{message}</p>}
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="surface rounded-xl border p-4 shadow-sm">
          <p className="text-s text-sm">שאלות בפורום</p>
          <p className="text-p mt-1 text-3xl font-bold">{questions.length}</p>
        </div>
        <div className="surface rounded-xl border p-4 shadow-sm">
          <p className="text-s text-sm">בלי תשובה מעל שבוע</p>
          <p className="text-p mt-1 text-3xl font-bold">{unansweredCount}</p>
        </div>
        <div className="surface rounded-xl border p-4 shadow-sm">
          <p className="text-s text-sm">מתחרים (pro.co.il)</p>
          <p className="text-p mt-1 text-3xl font-bold">{competitors.length}</p>
        </div>
        <div className="surface rounded-xl border p-4 shadow-sm">
          <p className="text-s text-sm">דירוג ממוצע למתחרים</p>
          <p className="text-p mt-1 text-3xl font-bold">{avgRating ? avgRating.toFixed(1) : "—"}</p>
        </div>
      </div>

      <div className="surface mb-6 rounded-xl border p-4 shadow-sm">
        <h2 className="text-p mb-2 text-sm font-semibold">איפה חשמלאים נתקעים (שאלות לפי נושא)</h2>
        {topicData.length > 0 ? (
          <div style={{ height: Math.max(200, topicData.length * 32) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topicData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <XAxis type="number" reversed allowDecimals={false} tick={{ fontSize: 12, fill: "#64748b" }} />
                <YAxis type="category" dataKey="topic" width={110} orientation="right" tick={{ fontSize: 12, fill: "#64748b", textAnchor: "end" }} />
                <Tooltip formatter={(value, name) => [`${value} שאלות`, name]} />
                <Legend />
                <Bar dataKey="unanswered" name="בלי תשובה מעל שבוע" stackId="q" fill="var(--accent)" />
                <Bar dataKey="waiting" name="חדשה, עוד מחכה" stackId="q" fill="var(--status-negotiation-fg)" />
                <Bar dataKey="answered" name="נענו" stackId="q" fill="var(--text-muted)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="text-m flex items-center justify-center text-sm" style={{ height: 200 }}>
            אין עדיין נתונים — חבר Apify ו-Airtable והרץ סריקה
          </div>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {[["all", "הכל"], [TYPE_QUESTION, "שאלות"], [TYPE_COMPETITOR, "מתחרים"]].map(([value, label]) => (
          <button key={value} type="button" onClick={() => setTypeFilter(value)} className={`filter-pill rounded-full px-3.5 py-1.5 text-sm font-medium ${typeFilter === value ? "btn-primary" : "filter-inactive"}`} style={{ minHeight: 36 }}>
            {label}
          </button>
        ))}
        <label className="text-s flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyUnanswered} onChange={(e) => setOnlyUnanswered(e.target.checked)} />
          רק שאלות בלי תשובה מעל שבוע
        </label>
      </div>

      <div className="surface overflow-hidden rounded-xl border shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="thead-bg">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-m">כותרת</th>
                <th className="px-4 py-3 text-xs font-semibold text-m">מקור</th>
                <th className="px-4 py-3 text-xs font-semibold text-m">נושא</th>
                <th className="px-4 py-3 text-xs font-semibold text-m">תגובות / ביקורות</th>
                <th className="px-4 py-3 text-xs font-semibold text-m">דירוג</th>
                <th className="px-4 py-3 text-xs font-semibold text-m">פעילות אחרונה</th>
                <th className="px-4 py-3 text-xs font-semibold text-m">סטטוס</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id} className="row-hover border-t border-t-soft">
                  <td className="max-w-xs truncate px-4 py-3 text-sm font-medium" title={item.title}>
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="btn-edit">{item.title}</a>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-s">{item.source}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-s">{item.topic || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-s" style={{ fontVariantNumeric: "tabular-nums" }}>{item.replies}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-s">{typeof item.rating === "number" ? item.rating.toFixed(1) : "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-m">{item.date || "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <select value={item.status} onChange={(e) => handleStatusChange(item, e.target.value)} className="cell-input rounded-md px-2 py-1 text-sm">
                      {REVIEW_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                </tr>
              ))}
              {visibleItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-m">אין פריטים להצגה</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
// === MARKET RESEARCH END ===

export default MarketResearch;
