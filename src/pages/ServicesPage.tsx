import { FormEvent, useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../components/Icon";
import type { Service, ServiceStats } from "../types";
import { labels } from "../labels";
import { CATEGORIES, DURATION_PRESETS, formatDuration, formatMoney, PAGE_TITLE_CLASS } from "../utils";

const S = labels.services;
const C = labels.common;

type ServiceForm = {
  name: string;
  category: string;
  duration_minutes: number | null;
  price: number;
  icon: string;
};

const emptyForm: ServiceForm = {
  name: "",
  category: "Dịch vụ cắt tóc",
  duration_minutes: null,
  price: 0,
  icon: "content_cut",
};

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);

  const load = useCallback(async () => {
    const [list, st] = await Promise.all([
      api.services.list(search || undefined),
      api.services.stats(),
    ]);
    setServices(list);
    setStats(st);
  }, [search]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setModalOpen(true);
  };

  const openEdit = (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      category: s.category,
      duration_minutes: s.duration_minutes,
      price: s.price,
      icon: s.icon,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || form.price <= 0) {
      alert(S.invalidForm);
      return;
    }
    const payload = {
      ...form,
      duration_minutes: form.duration_minutes,
    };
    if (editing) {
      await api.services.update(editing.id, payload);
    } else {
      await api.services.create(payload);
    }
    setModalOpen(false);
    await load();
  };

  const handleDelete = async (s: Service) => {
    if (!confirm(S.deleteConfirm(s.name))) return;
    await api.services.remove(s.id);
    await load();
  };

  return (
    <>
      <header className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 border-b border-outline-variant bg-surface">
        <h2 className={PAGE_TITLE_CLASS}>{labels.pageTitle.services}</h2>
        <label className="relative hidden lg:block">
          <Icon name="search" className="absolute left-3 top-1/2 -translate-y-1/2 text-outline" />
          <input
            className="pl-10 pr-4 py-2 bg-surface-container-low border border-outline-variant rounded-full w-64 outline-none focus:ring-1 focus:ring-primary"
            placeholder={S.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </header>

      <section className="p-margin-mobile md:p-margin-desktop space-y-8 pb-8">
        <header className="flex justify-between items-end flex-wrap gap-4">
          <span>
            <h3 className="font-headline-lg text-headline-lg text-primary">{S.menuTitle}</h3>
            <p className="font-body-md text-on-surface-variant">{S.menuDesc}</p>
          </span>
          <button
            type="button"
            onClick={openCreate}
            className="bg-primary text-on-primary font-label-md py-3 px-6 rounded-lg flex items-center gap-2 hover:opacity-90 active:scale-95"
          >
            <Icon name="add_circle" />
            {S.addNew}
          </button>
        </header>

        {stats && (
          <section className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
            <article className="bg-surface p-6 border border-outline-variant rounded-xl">
              <p className="text-label-sm text-on-surface-variant uppercase">{S.total}</p>
              <span className="text-headline-xl font-headline-xl mt-2 block">{stats.totalServices}</span>
            </article>
            <article className="bg-surface p-6 border border-outline-variant rounded-xl">
              <p className="text-label-sm text-on-surface-variant uppercase">{S.avgPrice}</p>
              <span className="text-headline-xl font-headline-xl mt-2 block">
                {formatMoney(stats.averagePrice)}
              </span>
            </article>
            <article className="bg-surface p-6 border border-outline-variant rounded-xl">
              <p className="text-label-sm text-on-surface-variant uppercase">{S.bestSellerToday}</p>
              <span className="text-headline-md font-headline-md mt-2 block">
                {stats.mostPopular?.name ?? C.dash}
              </span>
              {stats.mostPopular && (
                <span className="text-on-surface-variant text-label-sm">
                  {formatDuration(stats.mostPopular.durationMinutes)}
                </span>
              )}
            </article>
            <article className="bg-primary p-6 rounded-xl text-on-primary">
              <p className="text-label-sm opacity-80 uppercase">{S.statusLabel}</p>
              <span className="text-headline-md mt-2 block">{S.statusReady}</span>
            </article>
          </section>
        )}

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">{S.colName}</th>
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">{S.colCategory}</th>
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">{S.colDuration}</th>
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">{S.colPrice}</th>
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">{S.colActions}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-surface-container-low">
                  <td className="px-6 py-5">
                    <span className="flex items-center gap-3">
                      <span className="w-10 h-10 rounded bg-surface-container-high flex items-center justify-center">
                        <Icon name={s.icon} className="text-primary" />
                      </span>
                      <span className="font-body-lg text-primary">{s.name}</span>
                    </span>
                  </td>
                  <td className="px-6 py-5">
                    <span className="bg-surface-container-high px-3 py-1 rounded-full text-label-sm">
                      {s.category}
                    </span>
                  </td>
                  <td className="px-6 py-5">{formatDuration(s.duration_minutes)}</td>
                  <td className="px-6 py-5 font-bold">{formatMoney(s.price)}</td>
                  <td className="px-6 py-5 text-right space-x-1">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="p-2 hover:bg-surface-container rounded"
                      title={S.edit}
                    >
                      <Icon name="edit" className="text-[20px]" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(s)}
                      className="p-2 hover:bg-secondary-fixed rounded text-secondary"
                      title={S.delete}
                    >
                      <Icon name="delete" className="text-[20px]" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <footer className="px-6 py-4 border-t border-outline-variant bg-surface-container-low text-label-sm text-on-surface-variant">
            {S.showing(services.length)}
          </footer>
        </section>
      </section>

      {modalOpen && (
        <section className="fixed inset-0 bg-primary/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <article className="bg-surface w-full max-w-lg rounded-xl shadow-xl p-8 space-y-6">
            <header className="flex justify-between items-start">
              <span>
                <h2 className="font-headline-lg text-primary">
                  {editing ? S.editTitle : S.newTitle}
                </h2>
                <p className="text-body-md text-on-surface-variant">{S.formDesc}</p>
              </span>
              <button type="button" onClick={() => setModalOpen(false)} className="p-2 hover:bg-surface-container-high rounded-full">
                <Icon name="close" />
              </button>
            </header>
            <form onSubmit={handleSubmit} className="space-y-4">
              <label className="block space-y-1">
                <span className="font-label-sm text-on-surface-variant uppercase">{S.name}</span>
                <input
                  required
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded outline-none focus:ring-1 focus:ring-primary"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <section className="grid grid-cols-2 gap-4">
                <label className="block space-y-1">
                  <span className="font-label-sm text-on-surface-variant uppercase">{S.price}</span>
                  <input
                    required
                    type="number"
                    min={1}
                    step={1}
                    placeholder="VD: 60000, 123456"
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded outline-none focus:ring-1 focus:ring-primary"
                    value={form.price || ""}
                    onChange={(e) => setForm({ ...form, price: Number(e.target.value) })}
                  />
                </label>
                <label className="block space-y-1">
                  <span className="font-label-sm text-on-surface-variant uppercase">
                    {S.durationOptional} <span className="normal-case font-normal text-outline">{S.optionalHint}</span>
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={480}
                    placeholder={S.durationPlaceholder}
                    className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded outline-none focus:ring-1 focus:ring-primary"
                    value={form.duration_minutes ?? ""}
                    onChange={(e) => {
                      const v = e.target.value.trim();
                      setForm({
                        ...form,
                        duration_minutes: v === "" ? null : Math.min(480, Math.max(1, Number(v))),
                      });
                    }}
                  />
                  <span className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, duration_minutes: null })}
                      className={`px-2 py-1 text-label-sm rounded border ${
                        form.duration_minutes === null
                          ? "border-primary bg-primary-container"
                          : "border-outline-variant hover:border-primary"
                      }`}
                    >
                      {S.noDuration}
                    </button>
                    {DURATION_PRESETS.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setForm({ ...form, duration_minutes: m })}
                        className={`px-2 py-1 text-label-sm rounded border ${
                          form.duration_minutes === m
                            ? "border-primary bg-primary-container"
                            : "border-outline-variant hover:border-primary"
                        }`}
                      >
                        {S.durationPreset(m)}
                      </button>
                    ))}
                  </span>
                </label>
              </section>
              <label className="block space-y-1">
                <span className="font-label-sm text-on-surface-variant uppercase">{S.category}</span>
                <select
                  className="w-full px-4 py-3 bg-surface-container-low border border-outline-variant rounded"
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                >
                  {CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <footer className="pt-4 flex gap-4">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 py-3 border border-outline text-primary font-label-md rounded"
                >
                  {S.cancel}
                </button>
                <button type="submit" className="flex-1 py-3 bg-primary text-on-primary font-label-md rounded">
                  {S.save}
                </button>
              </footer>
            </form>
          </article>
        </section>
      )}
    </>
  );
}
