import { useEffect, useMemo, useState } from "react";
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { MR_AIRTABLE_BASE_ID, fetchJson } from "./scraperCore.js";
import { MONTHS, SOLAR_TABLE_ID } from "./solarCore.js";

// === SOLAR START ===
const SOLAR_SETTINGS_KEY = "solar_settings";
const SOLAR_AIRTABLE_TOKEN_KEY = "airtable_pat";
const MONTHS_SHORT = ["ינו", "פבר", "מרץ", "אפר", "מאי", "יונ", "יול", "אוג", "ספט", "אוק", "נוב", "דצמ"];
const PVGIS_INFO_URL = "https://joint-research-centre.ec.europa.eu/photovoltaic-geographical-information-system-pvgis_en";
const TICK_STYLE = { fontSize: 12, fill: "#64748b" };

function readSolarSettings() {
  try {
    return JSON.parse(localStorage.getItem(SOLAR_SETTINGS_KEY)) || {};
  } catch {
    return {};
  }
}

function readSolarToken() {
  try {
    return localStorage.getItem(SOLAR_AIRTABLE_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

// Rows hold PVGIS output for a 1 kWp system; the tab scales them by the chosen size.
async function fetchSolarEstimates(token) {
  const data = await fetchJson("Airtable (סולארי)", `https://api.airtable.com/v0/${MR_AIRTABLE_BASE_ID}/${SOLAR_TABLE_ID}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.records
    .map((record) => ({
      name: record.fields["עיר"] || "",
      lat: Number(record.fields["קו רוחב"]) || 0,
      yearly: Number(record.fields['קוט"ש לשנה ל-1kWp']) || 0,
      monthly: MONTHS.map((month) => Number(record.fields[month]) || 0),
      slope: record.fields["זווית"],
      azimuth: record.fields["אזימוט"],
      updatedAt: record.fields["עודכן ב"] || "",
    }))
    .filter((city) => city.name && city.yearly > 0)
    .sort((a, b) => b.lat - a.lat); // north to south
}

const formatNumber = (value, digits = 0) =>
  new Intl.NumberFormat("he-IL", { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(value);

// PVGIS azimuth: 0 = south, negative = east, positive = west.
function describeAzimuth(azimuth) {
  if (azimuth == null) return "";
  if (azimuth === 0) return "דרום";
  return `${Math.abs(azimuth)}° ${azimuth > 0 ? "מערבה" : "מזרחה"} מדרום`;
}

function Solar() {
  const saved = readSolarSettings();
  const [token] = useState(readSolarToken);
  const [cities, setCities] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [cityName, setCityName] = useState(saved.city || "");
  const [sizeKwp, setSizeKwp] = useState(saved.size ?? 10);
  const [tariff, setTariff] = useState(saved.tariff ?? "");
  const [cost, setCost] = useState(saved.cost ?? "");

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    fetchSolarEstimates(token)
      .then(setCities)
      .catch((err) => setError(`⚠ לא הצלחתי לקרוא את "Solar Estimates" (${err.message})`))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => {
    try {
      localStorage.setItem(SOLAR_SETTINGS_KEY, JSON.stringify({ city: cityName, size: sizeKwp, tariff, cost }));
    } catch {}
  }, [cityName, sizeKwp, tariff, cost]);

  const selected = cities.find((c) => c.name === cityName) || cities[0];
  const size = Math.max(0, Number(sizeKwp) || 0);
  const tariffValue = Number(tariff) || 0;
  const costValue = Number(cost) || 0;

  const yearlyKwh = selected ? selected.yearly * size : 0;
  const yearlyIls = tariffValue > 0 ? yearlyKwh * tariffValue : null;
  const paybackYears = yearlyIls && costValue > 0 ? costValue / yearlyIls : null;

  const monthlyData = useMemo(
    () => (selected ? MONTHS.map((month, i) => ({ month, short: MONTHS_SHORT[i], kwh: selected.monthly[i] * size })) : []),
    [selected, size]
  );
  const compareData = useMemo(() => cities.map((c) => ({ name: c.name, kwh: c.yearly * size })), [cities, size]);

  if (!token) {
    return (
      <div className="surface rounded-xl border p-6 text-center shadow-sm">
        <p className="text-s text-sm">כדי לראות את הנתונים צריך לחבר Airtable. לוחצים "חבר Airtable" בטאב לידים או Market Research.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="surface mb-6 rounded-xl border p-4 shadow-sm">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="text-s block text-sm">
            עיר
            <select value={selected?.name || ""} onChange={(e) => setCityName(e.target.value)} className="field-input mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ minHeight: 44 }}>
              {cities.map((c) => (
                <option key={c.name} value={c.name}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="text-s block text-sm">
            גודל מערכת (kWp)
            <input type="number" min="0" step="0.5" value={sizeKwp} onChange={(e) => setSizeKwp(e.target.value)} className="field-input mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ minHeight: 44 }} />
          </label>
          <label className="text-s block text-sm">
            תעריף (₪ לקוט"ש)
            <input type="number" min="0" step="0.01" value={tariff} placeholder="התעריף שלך" onChange={(e) => setTariff(e.target.value)} className="field-input mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ minHeight: 44 }} />
          </label>
          <label className="text-s block text-sm">
            עלות מערכת (₪, אופציונלי)
            <input type="number" min="0" step="1000" value={cost} placeholder="להחזר השקעה" onChange={(e) => setCost(e.target.value)} className="field-input mt-1 w-full rounded-lg px-3 py-2 text-sm" style={{ minHeight: 44 }} />
          </label>
        </div>
        {loading && <p className="text-m mt-3 text-sm">טוען...</p>}
        {error && <p className="text-s mt-3 text-sm">{error}</p>}
      </div>

      {selected && (
        <>
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="surface rounded-xl border p-4 shadow-sm">
              <p className="text-s text-sm">ייצור שנתי צפוי</p>
              <p className="text-p mt-1 text-3xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{formatNumber(yearlyKwh)}</p>
              <p className="text-m text-xs">קוט"ש לשנה</p>
            </div>
            <div className="surface rounded-xl border p-4 shadow-sm">
              <p className="text-s text-sm">שווי שנתי</p>
              <p className="text-p mt-1 text-3xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{yearlyIls != null ? `₪${formatNumber(yearlyIls)}` : "—"}</p>
              <p className="text-m text-xs">{yearlyIls != null ? `לפי ${tariffValue} ₪ לקוט"ש` : "הזן תעריף"}</p>
            </div>
            <div className="surface rounded-xl border p-4 shadow-sm">
              <p className="text-s text-sm">החזר השקעה</p>
              <p className="text-p mt-1 text-3xl font-bold" style={{ fontVariantNumeric: "tabular-nums" }}>{paybackYears != null ? formatNumber(paybackYears, 1) : "—"}</p>
              <p className="text-m text-xs">{paybackYears != null ? "שנים" : "הזן תעריף ועלות"}</p>
            </div>
            <div className="surface rounded-xl border p-4 shadow-sm">
              <p className="text-s text-sm">התקנה אופטימלית</p>
              <p className="text-p mt-1 text-3xl font-bold">{selected.slope != null ? `${selected.slope}°` : "—"}</p>
              <p className="text-m text-xs">שיפוע · {describeAzimuth(selected.azimuth)}</p>
            </div>
          </div>

          <div className="mb-6 flex flex-col gap-4 md:flex-row">
            <div className="surface flex-1 rounded-xl border p-4 shadow-sm">
              <h2 className="text-p mb-2 text-sm font-semibold">ייצור חודשי צפוי ב{selected.name} (קוט"ש)</h2>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData} margin={{ top: 8, right: 8, left: 8, bottom: 4 }}>
                    <XAxis dataKey="short" reversed interval={0} tick={{ ...TICK_STYLE, fontSize: 11 }} />
                    <YAxis orientation="right" tick={{ ...TICK_STYLE, textAnchor: "end" }} tickFormatter={(v) => formatNumber(v)} width={48} />
                    <Tooltip cursor={{ fill: "var(--row-hover)" }} labelFormatter={(_, payload) => payload?.[0]?.payload.month || ""} formatter={(value) => [`${formatNumber(value)} קוט"ש`, "ייצור"]} />
                    <Bar dataKey="kwh" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="surface flex-1 rounded-xl border p-4 shadow-sm">
              <h2 className="text-p mb-2 text-sm font-semibold">אותה מערכת בערים אחרות (קוט"ש לשנה)</h2>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={compareData} layout="vertical" margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                    <XAxis type="number" reversed tick={TICK_STYLE} tickFormatter={(v) => formatNumber(v)} />
                    <YAxis type="category" dataKey="name" width={84} orientation="right" tick={{ ...TICK_STYLE, textAnchor: "end" }} />
                    <Tooltip cursor={{ fill: "var(--row-hover)" }} formatter={(value) => [`${formatNumber(value)} קוט"ש`, "ייצור שנתי"]} />
                    <Bar dataKey="kwh" radius={[4, 4, 4, 4]}>
                      {compareData.map((entry) => (
                        <Cell key={entry.name} fill={entry.name === selected.name ? "var(--accent)" : "var(--text-muted)"} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="surface rounded-xl border p-4 text-sm shadow-sm">
            <p className="text-p font-semibold">⚠ הערכה בלבד</p>
            <ul className="text-s mt-2 list-disc space-y-1 pr-5">
              <li>המספרים הם ממוצע רב-שנתי לפי <a href={PVGIS_INFO_URL} target="_blank" rel="noopener noreferrer" className="btn-edit underline">PVGIS</a> (הנציבות האירופית), בזווית ובכיוון האופטימליים, עם 14% הפסדי מערכת.</li>
              <li><strong>לא כולל הצללה מקומית:</strong> בניינים, עצים, דודי שמש ומעקות לא מופיעים במודל. ייצור בפועל נקבע רק אחרי בדיקה בשטח.</li>
              <li>התעריף והעלות מוזנים ידנית ומשתנים עם הזמן. החישוב אינו ייעוץ פיננסי.</li>
            </ul>
            {selected.updatedAt && (
              <p className="text-m mt-2 text-xs">הנתונים עודכנו: {new Date(selected.updatedAt).toLocaleDateString("he-IL")}</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
// === SOLAR END ===

export default Solar;
