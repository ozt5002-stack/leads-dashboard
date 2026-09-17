import { useEffect, useMemo, useRef, useState } from "react";

const STATUSES = ["Lead", "Prospect", "Negotiation", "Won", "Lost"];
const STORAGE_KEY = "leads";

const STATUS_STYLES = {
  Lead: "bg-slate-100 text-slate-700 ring-slate-600/20",
  Prospect: "bg-blue-50 text-blue-700 ring-blue-600/20",
  Negotiation: "bg-amber-50 text-amber-700 ring-amber-600/20",
  Won: "bg-green-50 text-green-700 ring-green-600/20",
  Lost: "bg-red-50 text-red-700 ring-red-600/20",
};

const STATUS_FILTER_ACTIVE = {
  Lead: "bg-slate-600 text-white ring-slate-600",
  Prospect: "bg-blue-600 text-white ring-blue-600",
  Negotiation: "bg-amber-600 text-white ring-amber-600",
  Won: "bg-green-600 text-white ring-green-600",
  Lost: "bg-red-600 text-white ring-red-600",
};

const STATUS_FILTER_INACTIVE = "bg-white text-slate-500 ring-slate-300 hover:bg-slate-50";

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

const EMPTY_LEAD = { name: "", company: "", status: "Lead", value: "", source: "", notes: "" };

function AddLeadModal({ onSave, onClose }) {
  const [form, setForm] = useState(EMPTY_LEAD);

  function handleChange(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSave({ ...form, value: Number(form.value) || 0 });
  }

  return (
    <div className="fixed inset-0 z-10 flex items-center justify-center bg-slate-900/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
      >
        <h2 className="mb-4 text-lg font-bold text-slate-900">הוספת ליד חדש</h2>

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">שם</label>
            <input
              required
              type="text"
              value={form.name}
              onChange={(e) => handleChange("name", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">חברה</label>
            <input
              required
              type="text"
              value={form.company}
              onChange={(e) => handleChange("company", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">סטטוס</label>
              <select
                value={form.status}
                onChange={(e) => handleChange("status", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">ערך ($)</label>
              <input
                required
                type="number"
                min="0"
                value={form.value}
                onChange={(e) => handleChange("value", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">מקור</label>
            <input
              type="text"
              value={form.source}
              onChange={(e) => handleChange("source", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">הערות</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => handleChange("notes", e.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            ביטול
          </button>
          <button
            type="submit"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
          >
            שמירה
          </button>
        </div>
      </form>
    </div>
  );
}

export default function LeadsDashboard() {
  const [leads, setLeads] = useState(INITIAL_LEADS);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeStatuses, setActiveStatuses] = useState(new Set(STATUSES));
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setLeads(JSON.parse(stored));
      } catch {
        // ignore malformed data and keep INITIAL_LEADS
      }
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedRef.current) {
      hasLoadedRef.current = true;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(leads));
  }, [leads]);

  function handleExport() {
    const blob = new Blob([JSON.stringify(leads, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "leads.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function handleDelete(id) {
    setLeads((prev) => prev.filter((lead) => lead.id !== id));
  }

  function handleAddLead(leadData) {
    const nextId = leads.length > 0 ? Math.max(...leads.map((l) => l.id)) + 1 : 1;
    setLeads((prev) => [...prev, { ...leadData, id: nextId }]);
    setIsAdding(false);
  }

  function startEdit(lead) {
    setEditingId(lead.id);
    setEditDraft({ ...lead });
  }

  function updateEditDraft(field, value) {
    setEditDraft((prev) => ({ ...prev, [field]: value }));
  }

  function saveEdit() {
    setLeads((prev) =>
      prev.map((lead) => (lead.id === editingId ? { ...editDraft, id: editingId, value: Number(editDraft.value) || 0 } : lead))
    );
    setEditingId(null);
    setEditDraft(null);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditDraft(null);
  }

  function toggleStatus(status) {
    setActiveStatuses((prev) => {
      const next = new Set(prev);
      if (next.has(status)) {
        next.delete(status);
      } else {
        next.add(status);
      }
      return next;
    });
  }

  const filteredLeads = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return leads.filter((lead) => {
      const matchesStatus = activeStatuses.has(lead.status);
      const matchesQuery =
        query === "" ||
        lead.name.toLowerCase().includes(query) ||
        lead.company.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [leads, searchQuery, activeStatuses]);

  return (
    <div className="min-h-screen bg-slate-50 p-6" dir="rtl">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-slate-900">ניהול לידים</h1>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleExport}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Export JSON
            </button>
            <button
              type="button"
              onClick={() => setIsAdding(true)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
            >
              + הוסף ליד חדש
            </button>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-3">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש לפי שם או חברה..."
            className="w-full max-w-xs rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <div className="flex flex-wrap gap-2">
            {STATUSES.map((status) => {
              const isActive = activeStatuses.has(status);
              return (
                <button
                  key={status}
                  type="button"
                  onClick={() => toggleStatus(status)}
                  className={`rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset transition-colors ${
                    isActive ? STATUS_FILTER_ACTIVE[status] : STATUS_FILTER_INACTIVE
                  }`}
                >
                  {status}
                </button>
              );
            })}
          </div>
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
              {filteredLeads.map((lead) => {
                const isEditing = editingId === lead.id;

                if (isEditing) {
                  return (
                    <tr key={lead.id} className="bg-indigo-50/40">
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editDraft.name}
                          onChange={(e) => updateEditDraft("name", e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editDraft.company}
                          onChange={(e) => updateEditDraft("company", e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editDraft.status}
                          onChange={(e) => updateEditDraft("status", e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        >
                          {STATUSES.map((status) => (
                            <option key={status} value={status}>
                              {status}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min="0"
                          value={editDraft.value}
                          onChange={(e) => updateEditDraft("value", e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editDraft.source}
                          onChange={(e) => updateEditDraft("source", e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="text"
                          value={editDraft.notes}
                          onChange={(e) => updateEditDraft("notes", e.target.value)}
                          className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-2 text-sm">
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={saveEdit}
                            className="rounded-md px-2 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-500"
                          >
                            שמור
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100"
                          >
                            ביטול
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }

                return (
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
                          onClick={() => startEdit(lead)}
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
                );
              })}
              {filteredLeads.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-400">
                    {leads.length === 0 ? "אין לידים להצגה" : "לא נמצאו לידים התואמים לחיפוש/סינון"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdding && <AddLeadModal onSave={handleAddLead} onClose={() => setIsAdding(false)} />}
    </div>
  );
}
