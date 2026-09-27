import { useState } from "react";
import LeadsDashboard from "./LeadsDashboard.jsx";
import MarketResearch from "./MarketResearch.jsx";
import Solar from "./Solar.jsx";

// === APP START ===
const TABS = [
  ["leads", "לידים"],
  ["market", "Market Research"],
  ["solar", "סולארי"],
];
const TAB_STORAGE_KEY = "active_tab";

function App() {
  const [tab, setTab] = useState(() => {
    try {
      return localStorage.getItem(TAB_STORAGE_KEY) || "leads";
    } catch {
      return "leads";
    }
  });

  function selectTab(next) {
    setTab(next);
    try {
      localStorage.setItem(TAB_STORAGE_KEY, next);
    } catch {}
  }

  return (
    <div dir="rtl">
      <div className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
        <div className="tab-bar flex gap-1 border-b">
          {TABS.map(([id, label]) => (
            <button key={id} type="button" onClick={() => selectTab(id)} className={`tab px-4 py-2.5 text-sm font-medium ${tab === id ? "tab-active" : ""}`} style={{ minHeight: 44 }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {/* Both tabs stay mounted so switching doesn't refetch from Airtable. */}
      <div style={{ display: tab === "leads" ? "block" : "none" }}>
        <LeadsDashboard />
      </div>
      <div style={{ display: tab === "market" ? "block" : "none" }} className="min-h-screen p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-p mb-1 text-2xl font-bold">Market Research</h1>
          <p className="text-m mb-6 text-xs">שאלות מהפורום של arielsegal.co.il וחשמלאים מ-pro.co.il, נסרקים דרך Apify ונשמרים בטבלה Forum Leads</p>
          <MarketResearch />
        </div>
      </div>
      <div style={{ display: tab === "solar" ? "block" : "none" }} className="min-h-screen p-4 sm:p-6">
        <div className="mx-auto max-w-6xl">
          <h1 className="text-p mb-1 text-2xl font-bold">מחשבון סולארי</h1>
          <p className="text-m mb-6 text-xs">כמה תייצר מערכת סולארית בכל עיר, לפי נתוני PVGIS של הנציבות האירופית</p>
          <Solar />
        </div>
      </div>
    </div>
  );
}
// === APP END ===

export default App;
