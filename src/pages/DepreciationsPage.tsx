import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Icon } from "../components/Icon";
import { labels } from "../labels";
import type { Depreciation } from "../types";
import { formatMoney, PAGE_TITLE_CLASS, rangeLastDays } from "../utils";

const D = labels.depreciations;
const C = labels.common;

type FormState = {
  name: string;
  amount: number;
  description: string;
  expense_date: string;
};

const emptyForm: FormState = {
  name: "",
  amount: 0,
  description: "",
  expense_date: rangeLastDays(0).to,
};

export function DepreciationsPage() {
  const defaultRange = rangeLastDays(30);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [rows, setRows] = useState<Depreciation[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Depreciation | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const total = useMemo(() => rows.reduce((s, r) => s + (Number(r.amount) || 0), 0), [rows]);

  const load = useCallback(async () => {
    const res = await api.depreciations.list({ from, to });
    setRows(res.rows);
  }, [from, to]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm({ ...emptyForm, expense_date: to });
    setModalOpen(true);
  };

  const openEdit = (d: Depreciation) => {
    setEditing(d);
    setForm({
      name: d.name,
      amount: d.amount,
      description: d.description ?? "",
      expense_date: d.expense_date,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !(form.amount > 0) || !form.expense_date) {
      alert(D.invalidForm);
      return;
    }
    const payload = {
      name: form.name.trim(),
      amount: Number(form.amount),
      description: form.description.trim() || undefined,
      expense_date: form.expense_date,
    };
    if (editing) {
      await api.depreciations.update(editing.id, payload);
    } else {
      await api.depreciations.create(payload);
    }
    setModalOpen(false);
    await load();
  };

  const handleDelete = async (d: Depreciation) => {
    if (!window.confirm(D.deleteConfirm(d.name))) return;
    await api.depreciations.remove(d.id);
    await load();
  };

  return (
    <>
      <header className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 border-b border-outline-variant bg-surface">
        <h2 className={PAGE_TITLE_CLASS}>{labels.pageTitle.depreciations}</h2>
        <button
          type="button"
          onClick={openCreate}
          className="bg-primary text-on-primary font-label-md py-2.5 px-4 rounded-lg flex items-center gap-2 hover:opacity-90 active:scale-95"
        >
          <Icon name="add_circle" />
          {D.addNew}
        </button>
      </header>

      <section className="p-margin-mobile md:p-margin-desktop space-y-6 pb-24">
        <header className="max-w-3xl">
          <h3 className="font-headline-lg text-headline-lg text-primary">{D.title}</h3>
          <p className="font-body-md text-on-surface-variant">{D.desc}</p>
        </header>

        <div className="flex flex-wrap gap-4 items-end">
          <label className="font-label-md text-outline">
            {D.fromDate}
            <input
              type="date"
              className="block mt-1 border border-outline-variant rounded p-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="font-label-md text-outline">
            {D.toDate}
            <input
              type="date"
              className="block mt-1 border border-outline-variant rounded p-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <button
            type="button"
            onClick={() => load()}
            className="border border-primary text-primary px-4 py-2 rounded font-label-md"
          >
            {D.view}
          </button>
          <div className="ml-auto text-label-md text-on-surface-variant">
            {D.totalInRange(rows.length, formatMoney(total))}
          </div>
        </div>

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm max-w-5xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">{D.colDate}</th>
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">{D.colName}</th>
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">{D.colDesc}</th>
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">{D.colAmount}</th>
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">{D.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {rows.length === 0 ? (
                <tr>
                  <td className="px-6 py-6 text-on-surface-variant" colSpan={5}>
                    {C.dash}
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-surface-container-low">
                    <td className="px-6 py-5 whitespace-nowrap">{r.expense_date}</td>
                    <td className="px-6 py-5 font-body-lg text-primary">{r.name}</td>
                    <td className="px-6 py-5 text-on-surface-variant">{r.description ?? C.dash}</td>
                    <td className="px-6 py-5 text-right font-bold">{formatMoney(r.amount)}</td>
                    <td className="px-6 py-5 text-right space-x-1">
                      <button
                        type="button"
                        onClick={() => openEdit(r)}
                        className="p-2 hover:bg-surface-container rounded"
                        title={D.edit}
                      >
                        <Icon name="edit" className="text-[20px]" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(r)}
                        className="p-2 hover:bg-secondary-fixed rounded text-secondary"
                        title={D.delete}
                      >
                        <Icon name="delete" className="text-[20px]" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </section>
      </section>

      {modalOpen && (
        <div className="fixed inset-0 bg-primary/30 flex items-end md:items-center justify-center p-4 z-[60]">
          <div className="bg-surface w-full max-w-lg rounded-2xl border border-outline-variant shadow-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-outline-variant flex items-center justify-between">
              <h3 className="font-headline-md text-primary">
                {editing ? D.editTitle : D.newTitle}
              </h3>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="p-2 hover:bg-surface-container rounded"
                aria-label={labels.monthPicker.close}
              >
                <Icon name="close" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <label className="block font-label-md text-outline">
                {D.name}
                <input
                  className="block mt-1 border border-outline-variant rounded p-2 w-full"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                />
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="block font-label-md text-outline">
                  {D.amount}
                  <input
                    type="number"
                    className="block mt-1 border border-outline-variant rounded p-2 w-full"
                    value={form.amount}
                    onChange={(e) => setForm((p) => ({ ...p, amount: Number(e.target.value) }))}
                  />
                </label>
                <label className="block font-label-md text-outline">
                  {D.date}
                  <input
                    type="date"
                    className="block mt-1 border border-outline-variant rounded p-2 w-full"
                    value={form.expense_date}
                    onChange={(e) => setForm((p) => ({ ...p, expense_date: e.target.value }))}
                  />
                </label>
              </div>
              <label className="block font-label-md text-outline">
                {D.description}
                <textarea
                  className="block mt-1 border border-outline-variant rounded p-2 w-full min-h-[80px]"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                />
              </label>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="border border-outline-variant px-4 py-2 rounded font-label-md"
                >
                  {D.cancel}
                </button>
                <button type="submit" className="bg-primary text-on-primary px-5 py-2 rounded font-label-md">
                  {D.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

