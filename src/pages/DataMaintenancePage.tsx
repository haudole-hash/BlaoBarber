import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Icon } from "../components/Icon";
import { labels } from "../labels";
import { formatMoney, PAGE_TITLE_CLASS, rangeLastDays } from "../utils";

const M = labels.maintenance;

type Preview = Awaited<ReturnType<typeof api.maintenance.previewOrders>>;
type DeletableEmp = Awaited<ReturnType<typeof api.maintenance.deletableEmployees>>[number];
type DepPreview = Awaited<ReturnType<typeof api.maintenance.previewDepreciations>>;

export function DataMaintenancePage() {
  const defaultRange = rangeLastDays(30);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [orderConfirmText, setOrderConfirmText] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [depConfirmText, setDepConfirmText] = useState("");
  const [depPreview, setDepPreview] = useState<DepPreview | null>(null);
  const [deletable, setDeletable] = useState<DeletableEmp[]>([]);
  const [selectedEmpIds, setSelectedEmpIds] = useState<number[]>([]);
  const [empConfirm, setEmpConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const loadDeletable = useCallback(async () => {
    const list = await api.maintenance.deletableEmployees();
    setDeletable(list);
    setSelectedEmpIds([]);
  }, []);

  useEffect(() => {
    loadDeletable().catch(console.error);
  }, [loadDeletable]);

  const runPreview = async () => {
    setBusy(true);
    try {
      const p = await api.maintenance.previewOrders(from, to);
      setPreview(p);
    } finally {
      setBusy(false);
    }
  };

  const runDepPreview = async () => {
    setBusy(true);
    try {
      const p = await api.maintenance.previewDepreciations(from, to);
      setDepPreview(p);
    } finally {
      setBusy(false);
    }
  };

  const purgeOrders = async () => {
    if (!preview || preview.completed === 0) {
      alert("Bấm «Xem trước» — không có đơn đã thu nào trong khoảng để chuyển vào Thùng rác.");
      return;
    }
    if (
      !window.confirm(
        `Chuyển ${preview.completed} đơn đã thu vào Thùng rác (${from} → ${to})?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await api.maintenance.purgeOrders({
        from,
        to,
        confirm: orderConfirmText,
      });
      alert(M.purgeOrdersDone(res.deleted));
      setPreview(null);
      setOrderConfirmText("");
      await loadDeletable();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Không xóa được");
    } finally {
      setBusy(false);
    }
  };

  const purgeDepreciations = async () => {
    if (!depPreview || depPreview.total === 0) {
      alert("Bấm «Xem trước» và kiểm tra số khấu hao trước khi xóa.");
      return;
    }
    if (
      !window.confirm(
        `Chuyển ${depPreview.total} khoản khấu hao vào Thùng rác (${from} → ${to})?`
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      const res = await api.maintenance.purgeDepreciations({
        from,
        to,
        confirm: depConfirmText,
      });
      alert(M.purgeDepreciationsDone(res.deleted));
      setDepPreview(null);
      setDepConfirmText("");
    } catch (e) {
      alert(e instanceof Error ? e.message : "Không xóa được");
    } finally {
      setBusy(false);
    }
  };

  const toggleEmp = (id: number) => {
    setSelectedEmpIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const purgeEmployees = async () => {
    if (selectedEmpIds.length === 0) {
      alert(M.noDeletableEmployees);
      return;
    }
    if (!window.confirm(`Chuyển ${selectedEmpIds.length} nhân viên vào Thùng rác?`)) return;
    setBusy(true);
    try {
      const res = await api.maintenance.purgeEmployees({
        ids: selectedEmpIds,
        confirm: empConfirm,
      });
      alert(M.purgeEmployeesDone(res.deleted));
      setEmpConfirm("");
      await loadDeletable();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Không xóa được");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <header className="px-margin-mobile md:px-margin-desktop py-4 border-b border-outline-variant bg-surface">
        <h2 className={PAGE_TITLE_CLASS}>{labels.pageTitle.maintenance}</h2>
        <p className="text-label-sm text-on-surface-variant mt-2 max-w-2xl">{M.warning}</p>
        <p className="text-label-sm mt-1">
          {M.trashLinkHint}{" "}
          <Link to="/trash" className="text-secondary font-label-md hover:underline">
            {labels.trash.goToTrash}
          </Link>
        </p>
      </header>

      <div className="p-margin-mobile md:p-margin-desktop space-y-10 pb-24 max-w-3xl">
        <section className="border border-outline-variant rounded-xl p-6 bg-surface space-y-4">
          <div>
            <h3 className="font-headline-md text-primary">{M.ordersSection}</h3>
            <p className="text-label-sm text-on-surface-variant mt-1">{M.ordersHint}</p>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <label className="font-label-md text-outline">
              {M.fromDate}
              <input
                type="date"
                className="block mt-1 border border-outline-variant rounded p-2"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setPreview(null);
                  setDepPreview(null);
                }}
              />
            </label>
            <label className="font-label-md text-outline">
              {M.toDate}
              <input
                type="date"
                className="block mt-1 border border-outline-variant rounded p-2"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setPreview(null);
                  setDepPreview(null);
                }}
              />
            </label>
            <button
              type="button"
              onClick={runPreview}
              disabled={busy}
              className="border border-primary text-primary px-4 py-2 rounded font-label-md"
            >
              {M.preview}
            </button>
          </div>
          {preview && (
            <p className="text-label-md bg-surface-container-low rounded-lg p-4 border border-outline-variant">
              {M.previewResult({
                ...preview,
                revenueFormatted: formatMoney(preview.revenue),
              })}
            </p>
          )}
          <label className="block font-label-md text-outline">
            {M.confirmLabel}
            <input
              className="block mt-1 border border-outline-variant rounded p-2 w-32 uppercase"
              value={orderConfirmText}
              onChange={(e) => setOrderConfirmText(e.target.value)}
              placeholder={M.confirmPlaceholder}
            />
          </label>
          <button
            type="button"
            onClick={purgeOrders}
            disabled={busy || orderConfirmText.toUpperCase() !== "XOA"}
            className="bg-error text-on-error px-5 py-2.5 rounded font-label-md disabled:opacity-40"
          >
            <Icon name="delete" className="align-middle mr-1 text-[18px]" />
            {M.purgeOrders}
          </button>
        </section>

        <section className="border border-outline-variant rounded-xl p-6 bg-surface space-y-4">
          <div>
            <h3 className="font-headline-md text-primary">{M.depreciationsSection}</h3>
            <p className="text-label-sm text-on-surface-variant mt-1">{M.depreciationsHint}</p>
          </div>
          <div className="flex flex-wrap gap-4 items-end">
            <label className="font-label-md text-outline">
              {M.fromDate}
              <input
                type="date"
                className="block mt-1 border border-outline-variant rounded p-2"
                value={from}
                onChange={(e) => {
                  setFrom(e.target.value);
                  setDepPreview(null);
                }}
              />
            </label>
            <label className="font-label-md text-outline">
              {M.toDate}
              <input
                type="date"
                className="block mt-1 border border-outline-variant rounded p-2"
                value={to}
                onChange={(e) => {
                  setTo(e.target.value);
                  setDepPreview(null);
                }}
              />
            </label>
            <button
              type="button"
              onClick={runDepPreview}
              disabled={busy}
              className="border border-primary text-primary px-4 py-2 rounded font-label-md"
            >
              {M.preview}
            </button>
          </div>
          {depPreview && (
            <p className="text-label-md bg-surface-container-low rounded-lg p-4 border border-outline-variant">
              {M.previewDepreciationsResult({
                total: depPreview.total,
                totalAmountFormatted: formatMoney(depPreview.totalAmount),
              })}
            </p>
          )}
          <label className="block font-label-md text-outline">
            {M.confirmLabel}
            <input
              className="block mt-1 border border-outline-variant rounded p-2 w-32 uppercase"
              value={depConfirmText}
              onChange={(e) => setDepConfirmText(e.target.value)}
              placeholder={M.confirmPlaceholder}
            />
          </label>
          <button
            type="button"
            onClick={purgeDepreciations}
            disabled={busy || depConfirmText.toUpperCase() !== "XOA"}
            className="bg-error text-on-error px-5 py-2.5 rounded font-label-md disabled:opacity-40"
          >
            <Icon name="delete" className="align-middle mr-1 text-[18px]" />
            {M.purgeDepreciations}
          </button>
        </section>

        <section className="border border-outline-variant rounded-xl p-6 bg-surface space-y-4">
          <div>
            <h3 className="font-headline-md text-primary">{M.employeesSection}</h3>
            <p className="text-label-sm text-on-surface-variant mt-1">{M.employeesHint}</p>
          </div>
          <button
            type="button"
            onClick={() => loadDeletable()}
            className="border border-outline-variant px-3 py-2 rounded text-label-md"
          >
            {M.refreshEmployees}
          </button>
          {deletable.length === 0 ? (
            <p className="text-on-surface-variant text-label-md">{M.noDeletableEmployees}</p>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setSelectedEmpIds(deletable.map((e) => e.id))}
                className="text-label-sm text-secondary hover:underline"
              >
                {M.selectAll}
              </button>
              <ul className="border border-outline-variant rounded-lg divide-y divide-outline-variant max-h-64 overflow-y-auto">
                {deletable.map((emp) => (
                  <li key={emp.id} className="flex items-center gap-3 p-3 hover:bg-surface-container-low">
                    <input
                      type="checkbox"
                      checked={selectedEmpIds.includes(emp.id)}
                      onChange={() => toggleEmp(emp.id)}
                    />
                    <span className="flex-1">
                      <span className="font-label-md">{emp.name}</span>
                      <span className="text-label-sm text-outline block">
                        {emp.role_name} ·{" "}
                        {emp.is_active ? M.statusActive : M.statusHidden}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <label className="block font-label-md text-outline">
                {M.confirmLabel}
                <input
                  className="block mt-1 border border-outline-variant rounded p-2 w-32 uppercase"
                  value={empConfirm}
                  onChange={(e) => setEmpConfirm(e.target.value)}
                  placeholder={M.confirmPlaceholder}
                />
              </label>
              <button
                type="button"
                onClick={purgeEmployees}
                disabled={busy || empConfirm.toUpperCase() !== "XOA" || selectedEmpIds.length === 0}
                className="bg-secondary text-on-secondary px-5 py-2.5 rounded font-label-md disabled:opacity-40"
              >
                <Icon name="delete" className="align-middle mr-1 text-[18px]" />
                {M.purgeEmployees}
              </button>
            </>
          )}
        </section>
      </div>
    </>
  );
}
