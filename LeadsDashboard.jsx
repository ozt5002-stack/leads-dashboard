import { useState } from "react";

const STATUS_STYLES = {
  Lead: "bg-slate-100 text-slate-700 ring-slate-600/20",
  Prospect: "bg-blue-50 text-blue-700 ring-blue-600/20",
  Negotiation: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Won: "bg-green-50 text-green-700 ring-green-600/20",
  Lost: "bg-red-50 text-red-700 ring-red-600/20",
};

const INITIAL_LEADS = [
  { id: 1, name: "דנה כהן", company: "Nexora Ltd", status: "Won", value: 24000, source: "Referral", notes: "חתמו חוזה שנתי" },
  { id: 2, name: "יוסי לוי", company: "BluePeak Tech", status: "Negotiation", value: 15500, source: "Website", notes: "מחכים לאישור תקציב" },
  { id: 3, name: "מאיה שגיא", company: "Greenfield Foods", status: "Prospect", value: 8200, source: "LinkedIn", notes: "פגישה נקבעה לשבוע הבא" },
  { id: 4, name: "אורי בן דוד", company: "Skyline Media", status: "Lead", value: 5000, source: "Cold Call", notes: "עדיין לא נוצר קשר ראשוני" },
  { id: 5, name: "נועה פרץ", company: "Orbit Systems", status: "Won", value: 32000, source: "Referral", notes: "לקוח מרוצה, אפשרות להרחבה" },
  { id: 6, name: "עידן שמעוני", company: "Fusion Labs", status: "Lost", value: 12000, source: "Website", notes: "בחרו במתחרה" },
  { id: 7, name: "טל אברהם", company: "Cedar & Co", status: "Prospect", value: 9800, source: "Trade Show", notes: "מעוניינים בהדגמה" },
  { id: 8, name: "ליאור גל", company: "Northgate Retail", status: "Negotiation", value: 21000, source: "LinkedIn", notes: "מו״מ על מחיר" },
  { id: 9, name: "שירה מזרחי", company: "Vantage Group", status: "Lead", value: 3000, source: "Email Campaign", notes: "הורידו חוברת מוצר" },
  { id: 10, name: "רועי אלון", company: "Harbor Solutions", status: "Won", value: 18500, source: "Referral", notes: "חתימה חודשית" },
];

function formatCurrency(value) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(value);
}

export default function LeadsDashboard() {
  const [leads, setLeads] = useState(INITIAL_LEADS);

  function handleDelete(id) {
    setLeads((prev) => prev.filter((lead) => lead.id !== id));
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">ניהול לידים</h1>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
          >
            + הוסף ליד חדש
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-slate-200 text-right">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">שם</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">חברה</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">סטטוס</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">ערך</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">מקור</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">הערות</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((lead) => (
                <tr key={lead.id} className="hover:bg-slate-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">{lead.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{lead.company}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${STATUS_STYLES[lead.status]}`}
                    >
                      {lead.status}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{formatCurrency(lead.value)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{lead.source}</td>
                  <td className="max-w-xs truncate px-4 py-3 text-sm text-slate-500" title={lead.notes}>
                    {lead.notes}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        className="rounded-md px-2 py-1 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
                      >
                        ערוך
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(lead.id)}
                        className="rounded-md px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        מחק
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                    אין לידים להצגה
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
