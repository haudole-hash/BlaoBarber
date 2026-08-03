import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Icon } from "../components/Icon";
import type { Service, ServiceRolePointRow, ServiceStats } from "../types";
import { labels } from "../labels";
import { DURATION_PRESETS, CATEGORIES, formatDuration, formatMoney, PAGE_TITLE_CLASS } from "../utils";
const S = labels.services;
const C = labels.common;

type ServiceForm = {
  name: string;
  category: string;
  duration_minutes: number | null;
  price: number;
  icon: string;
  shop_percent: number;
};

const emptyForm: ServiceForm = {
  name: "",
  category: "Dịch vụ cắt tóc",
  duration_minutes: null,
  price: 0,
  icon: "content_cut",
  shop_percent: 0,
};

export function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [stats, setStats] = useState<ServiceStats | null>(null);
  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [rolePoints, setRolePoints] = useState<ServiceRolePointRow[]>([]);
  const [categoryMeta, setCategoryMeta] = useState<{ name: string; serviceCount: number }[]>([]);
  const [newCategory, setNewCategory] = useState("");

  const categoryOptions = useMemo(() => {
    const fromApi = categoryMeta.map((c) => c.name);
    if (fromApi.length > 0) return fromApi;
    return [...CATEGORIES];
  }, [categoryMeta]);

  const addCategory = async () => {
    const name = newCategory.trim();
    if (!name) return;
    if (categoryOptions.includes(name)) {
      alert(S.categoryExists);
      setForm((f) => ({ ...f, category: name }));
      setNewCategory("");
      return;
    }
    try {
      await api.serviceCategories.create(name);
      setForm((f) => ({ ...f, category: name }));
      setNewCategory("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thêm được loại");
    }
  };

  const removeCategory = async (name: string) => {
    const meta = categoryMeta.find((c) => c.name === name);
    if (meta && meta.serviceCount > 0) {
      alert(S.cannotDeleteCategoryInUse(meta.serviceCount));
      return;
    }
    if (!confirm(S.deleteCategoryConfirm(name))) return;
    try {
      await api.serviceCategories.remove(name);
      if (form.category === name) {
        const next = categoryOptions.find((c) => c !== name) ?? "Dịch vụ cắt tóc";
        setForm((f) => ({ ...f, category: next }));
      }
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không xóa được loại");
    }
  };

  const load = useCallback(async () => {
    const [list, st, catsResult] = await Promise.all([
      api.services.list(search || undefined),
      api.services.stats(),
      api.serviceCategories.list().catch(() => ({ categories: [] as { name: string; serviceCount: number }[] })),
    ]);
    setServices(list);
    setStats(st);
    setCategoryMeta(catsResult.categories);
  }, [search]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const openCreate = async () => {
    setEditing(null);
    setForm(emptyForm);
    setRolePoints([]);
    setModalOpen(true);
    const roles = await api.staffRoles.list();
    setRolePoints(
      roles
        .filter((r) => Number(r.is_proxy_owner) !== 1)
        .map((r) => ({ role_id: r.id, role_name: r.name, points: 0 }))
    );
  };

  const openEdit = async (s: Service) => {
    setEditing(s);
    setForm({
      name: s.name,
      category: s.category,
      duration_minutes: s.duration_minutes,
      price: s.price,
      icon: s.icon,
      shop_percent: Number(s.shop_percent) || 0,
    });
    const pts = await api.serviceRolePoints.get(s.id);
    setRolePoints(pts);
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name.trim() || !Number.isFinite(form.price) || form.price <= 0) {
      alert(S.invalidForm);
      return;
    }
    const payload = {
      name: form.name.trim(),
      category: form.category || "Dịch vụ cắt tóc",
      duration_minutes: form.duration_minutes,
      price: form.price,
      icon: form.icon,
      shop_percent: Math.max(0, Math.min(100, Number(form.shop_percent) || 0)),
    };
    try {
      let serviceId = editing?.id;
      if (editing) {
        await api.services.update(editing.id, payload);
      } else {
        const created = await api.services.create(payload);
        serviceId = created.id;
      }
      if (serviceId && rolePoints.length > 0) {
        await api.serviceRolePoints.save(
          serviceId,
          rolePoints.map((p) => ({ role_id: p.role_id, points: p.points }))
        );
      }
      setModalOpen(false);
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : labels.errors.requestFailed);
    }
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
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
                <span className="flex gap-2 pt-1">
                  <input
                    type="text"
                    placeholder={S.newCategoryPlaceholder}
                    className="flex-1 px-4 py-2 bg-surface-container-low border border-outline-variant rounded outline-none focus:ring-1 focus:ring-primary"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCategory();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void addCategory()}
                    className="shrink-0 px-4 py-2 border border-primary text-primary font-label-md rounded hover:bg-surface-container-low"
                  >
                    {S.addCategory}
                  </button>
                </span>
                {categoryMeta.length > 0 && (
                  <>
                    <p className="text-label-sm text-on-surface-variant pt-2">{S.categoryListHint}</p>
                    <ul className="flex flex-wrap gap-2 pt-1">
                      {categoryMeta.map(({ name, serviceCount }) => (
                        <li
                          key={name}
                          className="flex items-center gap-1 pl-3 pr-1 py-1 border border-outline-variant rounded-full bg-surface-container-low text-label-sm"
                        >
                          <span>{name}</span>
                          {serviceCount > 0 && (
                            <span className="text-on-surface-variant text-[11px]">({serviceCount})</span>
                          )}
                          <button
                            type="button"
                            onClick={() => void removeCategory(name)}
                            className="p-1 rounded hover:bg-error-container text-error"
                            title={S.deleteCategory}
                          >
                            <Icon name="close" className="text-[16px]" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </label>
              <section className="border border-outline-variant rounded-lg p-4 space-y-3">
                {rolePoints.length > 0 && (
                  <>
                    <p className="font-label-md text-primary">{S.rolePointsTitle}</p>
                    <p className="text-label-sm text-on-surface-variant">{S.rolePointsHint}</p>
                    <table className="w-full text-label-sm">
                      <thead>
                        <tr className="text-outline">
                          <th className="text-left py-1">{S.rolePointsColRole}</th>
                          <th className="text-right py-1 w-24">{S.rolePointsColPoints}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rolePoints.map((row, idx) => (
                          <tr key={row.role_id}>
                            <td className="py-2">{row.role_name}</td>
                            <td className="py-2 text-right">
                              <input
                                type="number"
                                min={0}
                                step={0.5}
                                className="w-20 border border-outline-variant rounded px-2 py-1 text-right"
                                value={row.points}
                                onChange={(e) => {
                                  const v = Number(e.target.value);
                                  setRolePoints((prev) =>
                                    prev.map((p, i) => (i === idx ? { ...p, points: v } : p))
                                  );
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </>
                )}
                <label
                  className={`block space-y-1 ${rolePoints.length > 0 ? "pt-1 border-t border-outline-variant" : ""}`}
                >
                  <span className="font-label-md text-primary">{S.shopPercent}</span>
                  <p className="text-label-sm text-on-surface-variant">{S.shopPercentHint}</p>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    className="w-28 border border-outline-variant rounded px-3 py-2 text-right"
                    value={form.shop_percent}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        shop_percent: Math.max(0, Math.min(100, Number(e.target.value) || 0)),
                      }))
                    }
                  />
                </label>
              </section>
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
