import { useCallback, useEffect, useState } from "react";
import { api } from "../api";
import { Icon } from "../components/Icon";
import { labels } from "../labels";
import type { TrashCategory, TrashCategoryId } from "../types";
import { formatMoney, PAGE_TITLE_CLASS } from "../utils";

const T = labels.trash;

function formatMeta(category: TrashCategoryId, meta?: string) {
  if (!meta) return "—";
  if (category === "orders" || category === "depreciations" || category === "services") {
    const n = Number(meta);
    if (Number.isFinite(n)) return formatMoney(n);
  }
  return meta;
}

function TrashCategorySection({
  category,
  onReload,
}: {
  category: TrashCategory;
  onReload: () => Promise<void>;
}) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);

  const restore = async (id: number) => {
    setBusy(true);
    try {
      await api.trash.restore(category.id, id);
      alert(T.restoreDone);
      await onReload();
    } catch (err) {
      alert(err instanceof Error ? err.message : labels.errors.requestFailed);
    } finally {
      setBusy(false);
    }
  };

  const purgeAll = async () => {
    if (!window.confirm(T.purgeConfirm(category.title, category.count))) return;
    if (confirmText.trim().toUpperCase() !== "XOA") {
      alert(T.confirmLabel);
      return;
    }
    setBusy(true);
    try {
      const res = await api.trash.purge(category.id, confirmText.trim());
      alert(T.purgeDone(res.deleted, res.skipped ?? 0));
      setConfirmText("");
      await onReload();
    } catch (err) {
      alert(err instanceof Error ? err.message : labels.errors.requestFailed);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm">
      <header className="flex flex-wrap justify-between items-center gap-3 px-6 py-4 bg-surface-container-low border-b border-outline-variant">
        <span>
          <h3 className="font-headline-md text-primary">{category.title}</h3>
          <p className="text-label-sm text-on-surface-variant">{T.totalCount(category.count)}</p>
        </span>
      </header>

      {category.count === 0 ? (
        <p className="p-8 text-center text-on-surface-variant text-label-md">{T.emptyCategory}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-surface-container-lowest border-b border-outline-variant">
                  <th className="px-6 py-3 text-label-sm text-on-surface-variant uppercase">{T.colName}</th>
                  <th className="px-6 py-3 text-label-sm text-on-surface-variant uppercase">{T.colDetail}</th>
                  <th className="px-6 py-3 text-label-sm text-on-surface-variant uppercase">{T.colNote}</th>
                  <th className="px-6 py-3 text-label-sm text-on-surface-variant uppercase text-right">
                    {labels.services.colActions}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {category.items.map((item) => (
                  <tr key={item.id} className="hover:bg-surface-container-lowest">
                    <td className="px-6 py-4 font-label-md text-primary">{item.label}</td>
                    <td className="px-6 py-4 text-on-surface-variant">{item.sublabel ?? "—"}</td>
                    <td className="px-6 py-4 text-label-sm text-outline">
                      {formatMeta(category.id, item.meta)}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => restore(item.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-primary text-primary rounded font-label-md hover:bg-surface-container-low disabled:opacity-40"
                      >
                        <Icon name="restore_from_trash" className="text-[18px]" />
                        {T.restore}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <footer className="px-6 py-4 border-t border-outline-variant bg-surface-container-lowest space-y-3">
            {(category.id === "services" ||
              category.id === "employees" ||
              category.id === "staff_roles") && (
              <p className="text-label-sm text-on-surface-variant">{T.purgeHint}</p>
            )}
            <div className="flex flex-wrap items-end gap-3">
              <label className="block font-label-sm text-outline">
                {T.confirmLabel}
                <input
                  className="block mt-1 border border-outline-variant rounded px-3 py-2 w-32 uppercase"
                  placeholder={T.confirmPlaceholder}
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                />
              </label>
              <button
                type="button"
                disabled={busy || confirmText.trim().toUpperCase() !== "XOA"}
                onClick={purgeAll}
                className="bg-error text-on-error px-5 py-2.5 rounded font-label-md disabled:opacity-40"
              >
                {T.purgeAll}
              </button>
            </div>
          </footer>
        </>
      )}
    </section>
  );
}

export function TrashPage() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.trash.list>> | null>(null);

  const load = useCallback(async () => {
    const res = await api.trash.list();
    setData(res);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  return (
    <>
      <header className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 border-b border-outline-variant bg-surface">
        <h2 className={PAGE_TITLE_CLASS}>{labels.pageTitle.trash}</h2>
        {data && (
          <span className="text-label-sm text-on-surface-variant">{T.totalCount(data.total)}</span>
        )}
      </header>

      <section className="p-margin-mobile md:p-margin-desktop space-y-8 pb-8">
        <p className="text-body-md text-on-surface-variant max-w-3xl">{T.desc}</p>

        {data?.categories.map((cat) => (
          <TrashCategorySection key={cat.id} category={cat} onReload={load} />
        ))}
      </section>
    </>
  );
}
