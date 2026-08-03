import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import { Icon } from "../components/Icon";
import { labels } from "../labels";
import type { ProfitReportResponse } from "../types";
import { formatMoney, PAGE_TITLE_CLASS, rangeLastDays } from "../utils";

const P = labels.profit;

export function ProfitPage() {
  const defaultRange = rangeLastDays(30);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [busy, setBusy] = useState(false);
  const [report, setReport] = useState<ProfitReportResponse | null>(null);

  const load = useCallback(async () => {
    setBusy(true);
    try {
      const r = await api.profit.report(from, to);
      setReport(r);
    } finally {
      setBusy(false);
    }
  }, [from, to]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const totalProfit = useMemo(() => report?.totals.profit ?? 0, [report]);

  return (
    <>
      <header className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 border-b border-outline-variant bg-surface">
        <h2 className={PAGE_TITLE_CLASS}>{labels.pageTitle.profit}</h2>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="border border-primary text-primary px-4 py-2 rounded font-label-md disabled:opacity-50 flex items-center gap-2"
        >
          <Icon name="refresh" />
          {P.view}
        </button>
      </header>

      <section className="p-margin-mobile md:p-margin-desktop space-y-6 pb-24">
        <header className="max-w-3xl">
          <h3 className="font-headline-lg text-headline-lg text-primary">{P.title}</h3>
          <p className="font-body-md text-on-surface-variant">{P.desc}</p>
        </header>

        <div className="flex flex-wrap gap-4 items-end">
          <label className="font-label-md text-outline">
            {P.fromDate}
            <input
              type="date"
              className="block mt-1 border border-outline-variant rounded p-2"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="font-label-md text-outline">
            {P.toDate}
            <input
              type="date"
              className="block mt-1 border border-outline-variant rounded p-2"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <div className="ml-auto font-label-md">
            <span className={totalProfit >= 0 ? "text-primary" : "text-error"}>
              {P.totals(formatMoney(totalProfit))}
            </span>
          </div>
        </div>

        <section className="bg-surface border border-outline-variant rounded-xl overflow-hidden shadow-sm max-w-3xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low border-b border-outline-variant">
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase">{P.colDate}</th>
                <th className="px-6 py-4 text-label-sm text-on-surface-variant uppercase text-right">
                  {P.colProfit}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {(report?.days ?? []).map((d) => (
                <tr key={d.date} className="hover:bg-surface-container-low">
                  <td className="px-6 py-5">{d.date}</td>
                  <td className={"px-6 py-5 text-right font-bold " + (d.profit >= 0 ? "" : "text-error")}>
                    {formatMoney(d.profit)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {report && (
            <footer className="px-6 py-4 border-t border-outline-variant bg-surface-container-low text-label-sm text-on-surface-variant">
              {P.footerSummary(
                formatMoney(report.totals.revenue),
                formatMoney(report.totals.payroll),
                formatMoney(report.totals.depreciation)
              )}
            </footer>
          )}
        </section>
      </section>
    </>
  );
}

