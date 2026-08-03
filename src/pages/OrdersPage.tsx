import { useCallback, useEffect, useMemo, useState, type MouseEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Icon } from "../components/Icon";
import { HeldOrderEditor } from "../components/HeldOrderEditor";
import { OrderDetailModal } from "../components/OrderDetailModal";
import { OrderCartPreview } from "../components/OrderCartPreview";
import {
  cartToOrderItems,
  newCartLineId,
  validateCartBeforeSubmit,
  type CartLine,
} from "../cartTypes";
import type { Employee, Order, Service } from "../types";
import { labels } from "../labels";
import {
  formatMoney,
  formatTime,
  groupServicesByCategoryForOrders,
  initials,
  localDateString,
  minutesAgo,
  PAGE_TITLE_CLASS,
} from "../utils";

const O = labels.orders;

const WALK_IN_CUSTOMER = "Khách vãng lai";

export function OrdersPage() {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [active, setActive] = useState<Order[]>([]);
  const [held, setHeld] = useState<Order[]>([]);
  const [completed, setCompleted] = useState<Order[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const [cart, setCart] = useState<CartLine[]>([]);
  const [discountPercent, setDiscountPercent] = useState(0);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [editingHeld, setEditingHeld] = useState<Order | null>(null);
  const [completedDate, setCompletedDate] = useState(localDateString);
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);

  const loadCompleted = useCallback(async (date: string) => {
    const done = await api.orders.list({ status: "completed", date });
    setCompleted(done);
  }, []);

  const load = useCallback(async () => {
    const [svc, inProg, heldList, emps] = await Promise.all([
      api.services.list(),
      api.orders.list({ status: "in_progress" }),
      api.orders.list({ status: "held" }),
      api.employees.list(),
    ]);
    setServices(svc);
    setActive(inProg);
    setHeld(heldList);
    setEmployees(emps);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  useEffect(() => {
    loadCompleted(completedDate).catch(console.error);
  }, [completedDate, loadCompleted]);

  const reloadAll = async () => {
    await load();
    await loadCompleted(completedDate);
  };

  useEffect(() => {
    const q = searchParams.get("search");
    if (q) setSearch(q);
  }, [searchParams]);

  const filteredCompleted = completed.filter(
    (o) =>
      !search ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.service_name.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id).includes(search)
  );

  const heldRevenue = held.reduce((s, o) => s + o.amount, 0);

  const { categories, byCategory } = useMemo(
    () => groupServicesByCategoryForOrders(services),
    [services]
  );

  const cartQty = (serviceId: number) =>
    cart.filter((c) => c.serviceId === serviceId).reduce((s, c) => s + c.quantity, 0);

  const addService = (serviceId: number) => {
    setCart((prev) => [...prev, { lineId: newCartLineId(), serviceId, quantity: 1, assignments: [] }]);
  };

  const changeCartQty = (lineId: string, quantity: number) => {
    if (quantity < 1) {
      setCart((prev) => prev.filter((c) => c.lineId !== lineId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.lineId === lineId ? { ...c, quantity: Math.min(99, quantity) } : c))
    );
  };

  const removeFromCart = (lineId: string) => {
    setCart((prev) => prev.filter((c) => c.lineId !== lineId));
  };

  const setAssignments = (lineId: string, assignments: CartLine["assignments"]) => {
    setCart((prev) => prev.map((c) => (c.lineId === lineId ? { ...c, assignments } : c)));
  };

  const applyAssignmentsToAll = (sourceLineId: string, assignments: CartLine["assignments"]) => {
    setCart((prev) =>
      prev.map((c) => (c.lineId === sourceLineId ? c : { ...c, assignments }))
    );
  };

  const startOrder = async () => {
    if (cart.length === 0) {
      alert(O.needService);
      return;
    }
    const cartErr = validateCartBeforeSubmit(cart, services, employees);
    if (cartErr) {
      alert(cartErr);
      return;
    }
    await api.orders.create({
      customer_name: WALK_IN_CUSTOMER,
      status: "in_progress",
      items: cartToOrderItems(cart),
      discount_percent: discountPercent,
    });
    setCart([]);
    setDiscountPercent(0);
    await reloadAll();
  };

  const validateOrderHasStaff = (order: Order): string | null => {
    for (const item of order.items ?? []) {
      if (!item.assignments?.length) {
        return `«${item.name}»: chưa có thợ. Hủy đơn và tạo lại sau khi đã gán thợ cho từng dịch vụ.`;
      }
    }
    return null;
  };

  const checkout = async (id: number) => {
    const order = active.find((o) => o.id === id);
    if (order) {
      const err = validateOrderHasStaff(order);
      if (err) {
        alert(err);
        return;
      }
    }
    try {
      await api.orders.update(id, { status: "completed" });
      await reloadAll();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Không thể thu tiền");
    }
  };

  const holdOrder = async (id: number) => {
    await api.orders.update(id, { status: "held" });
    await reloadAll();
  };

  const resumeOrder = async (id: number) => {
    await api.orders.update(id, { status: "in_progress" });
    await reloadAll();
  };

  const cancelOrder = async (id: number) => {
    if (!confirm(O.cancelOrderConfirm)) return;
    await api.orders.cancel(id);
    await reloadAll();
  };

  const deleteCompletedOrder = async (order: Order, e: MouseEvent) => {
    e.stopPropagation();
    if (!confirm(O.deletePaidOrderConfirm(order.id, formatMoney(order.amount)))) return;
    try {
      await api.orders.cancel(order.id);
      await loadCompleted(completedDate);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Không thể xóa đơn");
    }
  };

  const clearHeld = async () => {
    if (!confirm(O.clearHeldConfirm)) return;
    await api.orders.clearHeld();
    await reloadAll();
  };

  const saveHeldEdit = async (
    id: number,
    data: { customer_name: string; items: ReturnType<typeof cartToOrderItems>; discount_percent?: number }
  ) => {
    const updated = await api.orders.update(id, {
      customer_name: data.customer_name,
      items: data.items,
      status: "held",
      discount_percent: data.discount_percent,
    });
    setHeld((prev) => prev.map((o) => (o.id === id ? updated : o)));
    await reloadAll();
  };

  const completedDayTotal = filteredCompleted.reduce((s, o) => s + o.amount, 0);

  return (
    <div className="flex flex-col h-[calc(100dvh-4rem)] md:h-screen overflow-hidden">
      <header className="flex justify-between items-center px-margin-mobile md:px-margin-desktop h-16 border-b border-outline-variant bg-surface shrink-0">
        <h2 className={PAGE_TITLE_CLASS}>{labels.pageTitle.orders}</h2>
        <label className="relative flex items-center">
          <Icon name="search" className="absolute left-3 text-outline" />
          <input
            className="bg-surface-container-low rounded-lg pl-10 pr-4 py-2 w-48 md:w-64 outline-none focus:ring-1 focus:ring-primary"
            placeholder={O.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </header>

      <section className="flex-1 flex overflow-hidden min-h-0">
        <section className="flex-1 flex flex-col p-margin-mobile md:p-margin-desktop gap-gutter overflow-y-auto pb-24 md:pb-8">
          {/* Quick create */}
          <section>
            <h3 className="font-headline-lg text-primary mb-4">{O.quickCreate}</h3>
            <article className="bg-surface-container-lowest border border-outline-variant p-6 rounded-lg">
              <p className="font-label-md text-outline mb-4">{O.pickService}</p>
              {categories.length === 0 ? (
                <p className="text-on-surface-variant">{O.noServices}</p>
              ) : (
                <section className="flex gap-3 overflow-x-auto pb-2 min-h-[280px]">
                  {categories.map((cat) => {
                    const list = byCategory.get(cat) ?? [];
                    return (
                      <div
                        key={cat}
                        className="flex flex-col min-w-[180px] flex-1 max-w-[240px] border border-outline-variant rounded-lg bg-surface overflow-hidden"
                      >
                        <h4 className="px-3 py-2.5 bg-surface-container-low border-b border-outline-variant font-label-md text-primary text-center shrink-0">
                          {cat}
                        </h4>
                        <div className="flex-1 overflow-y-auto p-2 space-y-2">
                          {list.map((s) => {
                              const qty = cartQty(s.id);
                              return (
                                <button
                                  key={s.id}
                                  type="button"
                                  onClick={() => addService(s.id)}
                                  className={`relative w-full flex flex-col items-start p-3 border rounded text-left transition-all ${
                                    qty > 0
                                      ? "border-primary ring-2 ring-primary bg-surface-container-low"
                                      : "border-outline-variant hover:border-primary hover:bg-surface-container-low"
                                  }`}
                                >
                                  {qty > 0 && (
                                    <span className="absolute top-2 right-2 min-w-[22px] h-5 px-1 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center">
                                      ×{qty}
                                    </span>
                                  )}
                                  <span className="font-label-md text-primary pr-7 leading-snug">{s.name}</span>
                                  <span className="font-label-sm text-on-surface-variant mt-1">
                                    {formatMoney(s.price)}
                                  </span>
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    );
                  })}
                </section>
              )}
              <section className="lg:hidden mt-6">
                <OrderCartPreview
                  cart={cart}
                  services={services}
                  employees={employees}
                  discountPercent={discountPercent}
                  onChangeQty={changeCartQty}
                  onRemove={removeFromCart}
                  onAssignmentsChange={setAssignments}
                  onApplyAssignmentsToAll={applyAssignmentsToAll}
                  onDiscountPercentChange={(n) =>
                    setDiscountPercent(Math.max(0, Math.min(100, Number(n) || 0)))
                  }
                  onStart={startOrder}
                  startDisabled={cart.length === 0}
                />
              </section>
            </article>
          </section>

          {/* Active */}
          <section>
            <header className="flex justify-between mb-4">
              <h3 className="font-headline-lg text-primary">{O.active}</h3>
              <span className="text-on-surface-variant">{O.activeCount(active.length)}</span>
            </header>
            <section className="space-y-3">
              {active.length === 0 && (
                <p className="text-on-surface-variant border border-dashed border-outline-variant p-8 text-center rounded">
                  {O.noActive}
                </p>
              )}
              {active.map((o) => (
                <article
                  key={o.id}
                  className="bg-surface-container-lowest border border-outline-variant p-5 flex flex-wrap items-center gap-4 hover:shadow-md"
                >
                  <span className="w-12 h-12 rounded-full bg-tertiary-fixed flex items-center justify-center font-bold text-primary">
                    {initials(o.customer_name)}
                  </span>
                  <span className="flex-1 min-w-[200px]">
                    <span className="flex items-center gap-3 flex-wrap">
                      <h4 className="font-headline-md text-[20px]">{o.customer_name}</h4>
                      <span className="px-2 py-0.5 bg-tertiary-fixed text-[11px] font-bold rounded uppercase">
                        {O.inProgress}
                      </span>
                    </span>
                    <p className="text-on-surface-variant">
                      {o.service_name} • <strong className="text-primary">{o.barber}</strong>
                    </p>
                  </span>
                  <span className="text-right">
                    <p className="font-headline-md text-[20px]">{formatMoney(o.amount)}</p>
                    <p className="text-label-sm text-outline">{minutesAgo(o.created_at)}</p>
                  </span>
                  <span className="flex gap-2">
                    <button
                      type="button"
                      title={O.hold}
                      onClick={() => holdOrder(o.id)}
                      className="p-2 border border-outline-variant rounded hover:bg-surface-container"
                    >
                      <Icon name="pause" />
                    </button>
                    <button
                      type="button"
                      onClick={() => checkout(o.id)}
                      className="px-4 py-2 bg-primary text-on-primary rounded font-label-md active:scale-95"
                    >
                      {O.checkout}
                    </button>
                  </span>
                </article>
              ))}
            </section>
          </section>

          {/* Completed */}
          <section>
            <header className="flex flex-wrap justify-between items-end gap-4 mb-4 border-b border-outline-variant pb-3">
              <span>
                <h3 className="font-headline-md text-primary">{O.completedOrders}</h3>
                <p className="text-label-sm text-on-surface-variant">{O.clickRowHint}</p>
              </span>
              <label className="font-label-md text-outline">
                {O.completedPickDay}
                <input
                  type="date"
                  className="block mt-1 border border-outline-variant rounded px-3 py-2"
                  value={completedDate}
                  onChange={(e) => setCompletedDate(e.target.value)}
                />
              </label>
              <span className="text-label-sm text-on-surface-variant">
                {O.completedDayCount(filteredCompleted.length)}
              </span>
            </header>
            <div className="border border-outline-variant rounded-lg overflow-x-auto">
              <table className="w-full text-left">
                <thead className="font-label-sm text-outline bg-surface-container-low">
                  <tr>
                    <th className="py-3 px-4">{O.colId}</th>
                    <th className="py-3 px-4">{O.colTime}</th>
                    <th className="py-3 px-4">{O.colCustomer}</th>
                    <th className="py-3 px-4">{O.colService}</th>
                    <th className="py-3 px-4 text-right">{O.colTotal}</th>
                    <th className="py-3 px-4 text-center">{O.colStatus}</th>
                    <th className="py-3 px-4 w-12" aria-label={O.colActions} />
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {filteredCompleted.map((o) => (
                    <tr
                      key={o.id}
                      className="hover:bg-surface-container-low cursor-pointer"
                      onClick={() => setDetailOrder(o)}
                    >
                      <td className="py-4 px-4 font-label-md">#{o.id}</td>
                      <td className="py-4 px-4 text-on-surface-variant text-label-sm">
                        {o.completed_at ? formatTime(o.completed_at) : "—"}
                      </td>
                      <td className="py-4 px-4">{o.customer_name}</td>
                      <td className="py-4 px-4 text-on-surface-variant">{o.service_name}</td>
                      <td className="py-4 px-4 text-right font-semibold">{formatMoney(o.amount)}</td>
                      <td className="py-4 px-4 text-center">
                        <span className="inline-block px-3 py-1 bg-primary-container text-on-primary-container text-[10px] font-bold rounded-full uppercase">
                          {O.paid}
                        </span>
                      </td>
                      <td className="py-4 px-4 text-center">
                        <button
                          type="button"
                          onClick={(e) => deleteCompletedOrder(o, e)}
                          className="p-2 text-error hover:bg-error-container rounded"
                          title={O.deletePaidOrder}
                        >
                          <Icon name="delete" className="text-[20px]" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {filteredCompleted.length > 0 && (
                  <tfoot className="bg-surface-container-highest border-t-2 border-primary/20">
                    <tr>
                      <td colSpan={5} className="py-3 px-4 font-label-md text-primary">
                        {O.completedDayTotal}
                      </td>
                      <td className="py-4 px-4 text-right font-headline-md text-primary">
                        {formatMoney(completedDayTotal)}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
              {filteredCompleted.length === 0 && (
                <p className="p-8 text-center text-on-surface-variant text-label-md">{O.noCompletedDay}</p>
              )}
            </div>
          </section>
        </section>

        {/* Held sidebar + cart preview */}
        <aside className="hidden lg:flex w-[min(400px,32vw)] border-l border-outline-variant bg-surface-container-low flex-col shrink-0 sticky top-0 self-start h-[calc(100vh-4rem)] max-h-[calc(100vh-4rem)]">
          <header className="p-6 border-b border-outline-variant bg-surface-container-high shrink-0">
            <span className="flex items-center gap-2 text-secondary mb-1">
              <Icon name="inventory_2" />
              <h3 className="font-headline-md font-bold uppercase">{O.heldTitle}</h3>
            </span>
            <p className="text-label-sm text-on-surface-variant">{O.heldPending(held.length)}</p>
          </header>
          <section className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
            {held.map((o) => (
              <article
                key={o.id}
                className="bg-surface-container-lowest border border-secondary p-4 rounded-lg border-l-4"
              >
                <header className="flex justify-between mb-2">
                  <h4 className="font-headline-md text-[18px]">{o.customer_name}</h4>
                  <span className="text-label-sm text-outline">{formatTime(o.created_at)}</span>
                </header>
                <ul className="text-label-sm text-on-surface-variant mb-3 space-y-1">
                  {(o.items?.length ? o.items : [{ name: o.service_name, quantity: 1 }]).map((item, idx) => (
                    <li key={idx}>
                      · {item.name}
                      {"quantity" in item && item.quantity > 1 ? ` ×${item.quantity}` : ""}
                      {"assignments" in item && item.assignments?.length
                        ? ` — ${item.assignments
                            .map(
                              (a) =>
                                a.employee_name ??
                                employees.find((e) => e.id === a.employee_id)?.name ??
                                ""
                            )
                            .filter(Boolean)
                            .join(", ")}`
                        : ""}
                    </li>
                  ))}
                </ul>
                <p className="text-label-sm text-outline mb-2">{O.staffOnOrder}: {o.barber}</p>
                <footer className="flex flex-col gap-2">
                  <span className="font-headline-md text-secondary">{formatMoney(o.amount)}</span>
                  <span className="flex gap-1 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setEditingHeld(o)}
                      className="flex items-center gap-1 border border-primary text-primary px-3 py-1.5 rounded font-label-md hover:bg-surface-container-low"
                      title={O.editHeld}
                    >
                      <Icon name="edit" className="text-[18px]" />
                      {O.editHeld}
                    </button>
                    <button
                      type="button"
                      onClick={() => resumeOrder(o.id)}
                      className="flex items-center gap-1 bg-secondary text-on-secondary px-3 py-1.5 rounded font-label-md"
                    >
                      <Icon name="play_arrow" className="text-[18px]" />
                      {O.resume}
                    </button>
                    <button
                      type="button"
                      onClick={() => cancelOrder(o.id)}
                      className="p-2 text-error hover:bg-error-container rounded ml-auto"
                      title={O.cancelOrder}
                    >
                      <Icon name="delete" className="text-[20px]" />
                    </button>
                  </span>
                </footer>
              </article>
            ))}
            {held.length === 0 && (
              <p className="border-2 border-dashed border-outline-variant rounded-lg p-8 text-center text-outline text-label-md">
                {O.heldEmpty}
              </p>
            )}
          </section>
          <footer className="shrink-0 border-t border-outline-variant bg-surface-container-highest">
            <div className="p-4 max-h-[min(50vh,420px)] overflow-y-auto">
              <OrderCartPreview
                variant="sidebar"
                cart={cart}
                services={services}
                employees={employees}
                discountPercent={discountPercent}
                onChangeQty={changeCartQty}
                onRemove={removeFromCart}
                onAssignmentsChange={setAssignments}
                onApplyAssignmentsToAll={applyAssignmentsToAll}
                onDiscountPercentChange={(n) =>
                  setDiscountPercent(Math.max(0, Math.min(100, Number(n) || 0)))
                }
                onStart={startOrder}
                startDisabled={cart.length === 0}
              />
            </div>
            <div className="p-4 border-t border-outline-variant">
              <p className="flex justify-between mb-4">
                <span className="text-outline">{O.heldRevenue}</span>
                <span className="font-headline-md text-secondary">{formatMoney(heldRevenue)}</span>
              </p>
              <button
                type="button"
                onClick={clearHeld}
                disabled={held.length === 0}
                className="w-full border border-primary text-primary py-3 rounded font-label-md uppercase disabled:opacity-40"
              >
                {O.clearAllHeld}
              </button>
            </div>
          </footer>
        </aside>
      </section>

      {editingHeld && (
        <HeldOrderEditor
          order={editingHeld}
          services={services}
          employees={employees}
          onClose={() => setEditingHeld(null)}
          onSave={(data) => saveHeldEdit(editingHeld.id, data)}
        />
      )}

      {detailOrder && (
        <OrderDetailModal
          order={detailOrder}
          employees={employees}
          onClose={() => setDetailOrder(null)}
        />
      )}
    </div>
  );
}
