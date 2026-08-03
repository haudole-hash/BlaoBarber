import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { Icon } from "../components/Icon";
import { MonthPickerVi } from "../components/MonthPickerVi";
import type { DashboardMode, DashboardStats } from "../types";
import { labels } from "../labels";
import {
  formatMoney,
  localDateString,
  localMonthString,
  PAGE_TITLE_CLASS,
  rangeLastDays,
  startOfMonthString,
} from "../utils";

const L = labels.dashboard;
const C = labels.common;

export function DashboardPage() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<DashboardMode>("day");
  const [selectedDate, setSelectedDate] = useState(localDateString());
  const [selectedMonth, setSelectedMonth] = useState(localMonthString());
  const [rangeFrom, setRangeFrom] = useState(startOfMonthString());
  const [rangeTo, setRangeTo] = useState(localDateString());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let data: DashboardStats;
      if (mode === "month") {
        data = await api.dashboard({ mode: "month", month: selectedMonth });
      } else if (mode === "range") {
        data = await api.dashboard({ mode: "range", from: rangeFrom, to: rangeTo });
      } else {
        data = await api.dashboard({ mode: "day", date: selectedDate });
      }
      setStats(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [mode, selectedDate, selectedMonth, rangeFrom, rangeTo]);

  useEffect(() => {
    load();
  }, [load]);

  const setToday = () => {
    setMode("day");
    setSelectedDate(localDateString());
  };

  const setThisMonth = () => {
    setMode("month");
    setSelectedMonth(localMonthString());
  };

  const setRangeThisMonth = () => {
    setMode("range");
    setRangeFrom(startOfMonthString());
    setRangeTo(localDateString());
  };

  const setRangeLast7 = () => {
    setMode("range");
    const { from, to } = rangeLastDays(7);
    setRangeFrom(from);
    setRangeTo(to);
  };

  const tabClass = (active: boolean) =>
    `px-4 py-2 text-label-md transition-colors ${
      active ? "bg-primary text-on-primary" : "bg-surface hover:bg-surface-container-low"
    }`;

  return (
    <>
      <header className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 border-b border-outline-variant bg-surface sticky top-0 z-40 flex-wrap gap-2">
        <h2 className={PAGE_TITLE_CLASS}>{labels.pageTitle.dashboard}</h2>
        <label className="relative hidden sm:block">
          <Icon
            name="search"
            className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm"
          />
          <input
            className="bg-surface-container-low border border-outline-variant py-1.5 pl-10 pr-4 text-label-md outline-none w-64 focus:ring-1 focus:ring-tertiary-container"
            placeholder={L.searchOrders}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) =>
              e.key === "Enter" && navigate(`/orders?search=${encodeURIComponent(search)}`)
            }
          />
        </label>
      </header>

      <section className="p-margin-mobile md:p-margin-desktop space-y-gutter pb-8">
        <section className="bg-surface border border-outline-variant p-4 md:p-6 flex flex-col md:flex-row md:items-end gap-4 flex-wrap">
          <div className="flex rounded-lg border border-outline-variant overflow-hidden flex-wrap">
            <button type="button" onClick={() => setMode("day")} className={tabClass(mode === "day")}>
              {L.filterByDay}
            </button>
            <button type="button" onClick={() => setMode("month")} className={tabClass(mode === "month")}>
              {L.filterByMonth}
            </button>
            <button type="button" onClick={() => setMode("range")} className={tabClass(mode === "range")}>
              {L.filterByRange}
            </button>
          </div>

          {mode === "day" && (
            <label className="flex flex-col gap-1">
              <span className="text-label-sm text-on-surface-variant uppercase">{L.pickDay}</span>
              <input
                type="date"
                lang="vi"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-4 py-2 border border-outline-variant rounded bg-surface-container-low outline-none focus:ring-1 focus:ring-primary"
              />
            </label>
          )}

          {mode === "month" && (
            <div className="flex flex-col gap-1">
              <span className="text-label-sm text-on-surface-variant uppercase">{L.pickMonth}</span>
              <MonthPickerVi value={selectedMonth} onChange={setSelectedMonth} />
            </div>
          )}

          {mode === "range" && (
            <div className="flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-label-sm text-on-surface-variant uppercase">{L.fromDate}</span>
                <input
                  type="date"
                  lang="vi"
                  value={rangeFrom}
                  max={rangeTo}
                  onChange={(e) => setRangeFrom(e.target.value)}
                  className="px-4 py-2 border border-outline-variant rounded bg-surface-container-low outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
              <span className="text-on-surface-variant pb-2 hidden sm:inline">→</span>
              <label className="flex flex-col gap-1">
                <span className="text-label-sm text-on-surface-variant uppercase">{L.toDate}</span>
                <input
                  type="date"
                  lang="vi"
                  value={rangeTo}
                  min={rangeFrom}
                  onChange={(e) => setRangeTo(e.target.value)}
                  className="px-4 py-2 border border-outline-variant rounded bg-surface-container-low outline-none focus:ring-1 focus:ring-primary"
                />
              </label>
            </div>
          )}

          <div className="flex gap-2 flex-wrap">
            {mode === "day" && (
              <button
                type="button"
                onClick={setToday}
                className="px-4 py-2 border border-outline-variant text-label-md rounded hover:bg-surface-container-low"
              >
                {L.today}
              </button>
            )}
            {mode === "month" && (
              <button
                type="button"
                onClick={setThisMonth}
                className="px-4 py-2 border border-outline-variant text-label-md rounded hover:bg-surface-container-low"
              >
                {L.thisMonth}
              </button>
            )}
            {mode === "range" && (
              <>
                <button
                  type="button"
                  onClick={setRangeLast7}
                  className="px-4 py-2 border border-outline-variant text-label-md rounded hover:bg-surface-container-low"
                >
                  {L.last7Days}
                </button>
                <button
                  type="button"
                  onClick={setRangeThisMonth}
                  className="px-4 py-2 border border-outline-variant text-label-md rounded hover:bg-surface-container-low"
                >
                  {L.rangeThisMonth}
                </button>
              </>
            )}
            {mode !== "range" && (
              <button
                type="button"
                onClick={mode === "day" ? setThisMonth : setToday}
                className="px-4 py-2 border border-outline-variant text-label-md rounded hover:bg-surface-container-low"
              >
                {mode === "day" ? L.thisMonth : L.today}
              </button>
            )}
          </div>
        </section>

        {loading && <p className="text-on-surface-variant">{L.loading}</p>}

        {stats && !loading && (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
              <article className="bg-surface border border-outline-variant p-6 flex flex-col justify-between">
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                  {stats.customerLabel}
                </p>
                <h3 className="font-headline-xl text-headline-xl text-primary mt-4">{stats.customerCount}</h3>
                <p className="text-label-sm text-secondary flex items-center mt-2">
                  <Icon name="trending_up" className="text-xs mr-1" />
                  {stats.customerGrowthPct >= 0 ? "+" : ""}
                  {stats.customerGrowthPct}% {stats.growthCompareLabel}
                </p>
              </article>
              <article className="bg-surface border border-outline-variant p-6 flex flex-col justify-between">
                <p className="text-label-sm text-on-surface-variant uppercase tracking-wider">
                  {L.topService}
                </p>
                <h3 className="font-headline-lg text-headline-lg text-primary mt-4 leading-tight">
                  {stats.topService?.name ?? C.dash}
                </h3>
                <p className="text-label-sm text-on-surface-variant mt-2">
                  {stats.topService
                    ? `${stats.topService.sessions} ${stats.sessionsSuffix}`
                    : C.noOrders}
                </p>
              </article>
              <article className="bg-primary text-on-primary border border-primary p-6 flex flex-col justify-between">
                <p className="text-label-sm text-black/80 uppercase tracking-wider">{stats.revenueLabel}</p>
                <h3 className="font-headline-xl text-headline-xl mt-4 text-black">{formatMoney(stats.revenue)}</h3>
                <p className="text-label-sm text-black/70 mt-2">
                  {stats.revenueGrowthPct >= 0 ? "+" : ""}
                  {stats.revenueGrowthPct}% {stats.growthCompareLabel}
                </p>
              </article>
            </section>

            <section className="bg-surface border border-outline-variant overflow-hidden">
              <header className="px-8 py-6 border-b border-outline-variant flex justify-between items-center flex-wrap gap-4">
                <span>
                  <h3 className="font-headline-md text-headline-md text-primary">{L.statsByService}</h3>
                  <p className="font-body-md text-on-surface-variant">{stats.periodLabel}</p>
                </span>
                <button
                  type="button"
                  onClick={() => navigate("/orders")}
                  className="flex items-center px-4 py-2 border border-outline-variant text-label-sm hover:bg-surface-container-low"
                >
                  <Icon name="receipt_long" className="mr-2 text-sm" />
                  {L.viewOrders}
                </button>
              </header>
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-surface-container-low border-b border-outline-variant">
                    <th className="px-8 py-4 text-label-sm text-on-surface-variant uppercase">{L.colService}</th>
                    <th className="px-8 py-4 text-label-sm text-on-surface-variant uppercase">{L.colQuantity}</th>
                    <th className="px-8 py-4 text-label-sm text-on-surface-variant uppercase text-right">
                      {L.colRevenue}
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {stats.serviceStats.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-8 py-8 text-center text-on-surface-variant">
                        {stats.emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    <>
                      {stats.serviceStats.map((row) => (
                        <tr key={row.service_name} className="hover:bg-surface-container-low">
                          <td className="px-8 py-5 font-body-md text-primary">{row.service_name}</td>
                          <td className="px-8 py-5 font-bold">{row.quantity}</td>
                          <td className="px-8 py-5 text-right font-bold">{formatMoney(row.revenue)}</td>
                        </tr>
                      ))}
                      <tr className="bg-surface-container-low border-t-2 border-primary">
                        <td className="px-8 py-5 font-label-md text-primary uppercase">{L.totalRevenue}</td>
                        <td className="px-8 py-5 font-bold">
                          {stats.serviceStats.reduce((s, r) => s + r.quantity, 0)}
                        </td>
                        <td className="px-8 py-5 text-right font-headline-md text-primary">
                          {formatMoney(stats.serviceStats.reduce((s, r) => s + r.revenue, 0))}
                        </td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </section>

            {stats.heldRevenue > 0 && (
              <p className="text-label-sm text-secondary">
                {L.heldNote}: {formatMoney(stats.heldRevenue)} —{" "}
                <button type="button" className="underline" onClick={() => navigate("/orders")}>
                  {L.viewAtOrders}
                </button>
              </p>
            )}
          </>
        )}
      </section>
    </>
  );
}
