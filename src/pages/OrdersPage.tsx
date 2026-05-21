import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api } from "../api";
import { Icon } from "../components/Icon";
import { HeldOrderEditor } from "../components/HeldOrderEditor";
import { OrderCartPreview, type CartLine } from "../components/OrderCartPreview";
import type { Order, Service } from "../types";
import { labels } from "../labels";
import { BARBERS, formatMoney, formatTime, initials, minutesAgo, PAGE_TITLE_CLASS } from "../utils";

const O = labels.orders;

export function OrdersPage() {
  const [searchParams] = useSearchParams();
  const [services, setServices] = useState<Service[]>([]);
  const [active, setActive] = useState<Order[]>([]);
  const [held, setHeld] = useState<Order[]>([]);
  const [completed, setCompleted] = useState<Order[]>([]);
  const [search, setSearch] = useState(searchParams.get("search") ?? "");

  const [customerName, setCustomerName] = useState("Khách vãng lai");
  const [barber, setBarber] = useState(BARBERS[0]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [editingHeld, setEditingHeld] = useState<Order | null>(null);

  const load = useCallback(async () => {
    const [svc, inProg, heldList, done] = await Promise.all([
      api.services.list(),
      api.orders.list({ status: "in_progress" }),
      api.orders.list({ status: "held" }),
      api.orders.list({ status: "completed", today: true }),
    ]);
    setServices(svc);
    setActive(inProg);
    setHeld(heldList);
    setCompleted(done);
  }, []);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

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

  const cartQty = (serviceId: number) => cart.find((c) => c.serviceId === serviceId)?.quantity ?? 0;

  const addService = (serviceId: number) => {
    setCart((prev) => {
      const idx = prev.findIndex((c) => c.serviceId === serviceId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: Math.min(99, next[idx].quantity + 1) };
        return next;
      }
      return [...prev, { serviceId, quantity: 1 }];
    });
  };

  const changeCartQty = (serviceId: number, quantity: number) => {
    if (quantity < 1) {
      setCart((prev) => prev.filter((c) => c.serviceId !== serviceId));
      return;
    }
    setCart((prev) =>
      prev.map((c) => (c.serviceId === serviceId ? { ...c, quantity: Math.min(99, quantity) } : c))
    );
  };

  const removeFromCart = (serviceId: number) => {
    setCart((prev) => prev.filter((c) => c.serviceId !== serviceId));
  };

  const startOrder = async () => {
    if (cart.length === 0) {
      alert(O.needService);
      return;
    }
    await api.orders.create({
      customer_name: customerName,
      barber,
      status: "in_progress",
      items: cart.map((c) => ({ service_id: c.serviceId, quantity: c.quantity })),
    });
    setCustomerName("Khách vãng lai");
    setCart([]);
    await load();
  };

  const checkout = async (id: number) => {
    await api.orders.update(id, { status: "completed" });
    await load();
  };

  const holdOrder = async (id: number) => {
    await api.orders.update(id, { status: "held" });
    await load();
  };

  const resumeOrder = async (id: number) => {
    await api.orders.update(id, { status: "in_progress" });
    await load();
  };

  const cancelOrder = async (id: number) => {
    if (!confirm(O.cancelOrderConfirm)) return;
    await api.orders.cancel(id);
    await load();
  };

  const clearHeld = async () => {
    if (!confirm(O.clearHeldConfirm)) return;
    await api.orders.clearHeld();
    await load();
  };

  const saveHeldEdit = async (
    id: number,
    data: { customer_name: string; barber: string; items: { service_id: number; quantity: number }[] }
  ) => {
    const updated = await api.orders.update(id, {
      customer_name: data.customer_name,
      barber: data.barber,
      items: data.items,
      status: "held",
    });
    setHeld((prev) => prev.map((o) => (o.id === id ? updated : o)));
    await load();
  };

  return (
    <>
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
            <article className="bg-surface-container-lowest border border-outline-variant p-6 rounded-lg grid grid-cols-12 gap-6">
              <section className="col-span-12 md:col-span-4 space-y-4">
                <label className="block font-label-md text-outline">
                  {O.customer}
                  <input
                    className="w-full mt-1 border border-outline-variant rounded p-3 focus:border-primary outline-none"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                  />
                </label>
                <label className="block font-label-md text-outline">
                  {O.barber}
                  <select
                    className="w-full mt-1 border border-outline-variant rounded p-3"
                    value={barber}
                    onChange={(e) => setBarber(e.target.value)}
                  >
                    {BARBERS.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </label>
              </section>
              <section className="col-span-12 md:col-span-8 flex flex-col">
                <OrderCartPreview
                  cart={cart}
                  services={services}
                  onChangeQty={changeCartQty}
                  onRemove={removeFromCart}
                />
                <p className="font-label-md text-outline mb-4">{O.pickService}</p>
                <section className="grid grid-cols-2 md:grid-cols-3 gap-3 flex-1">
                  {services.map((s) => {
                    const qty = cartQty(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addService(s.id)}
                        className={`relative flex flex-col items-start p-4 border rounded text-left transition-all ${
                          qty > 0
                            ? "border-primary ring-2 ring-primary bg-surface"
                            : "border-outline-variant hover:border-primary hover:bg-surface-container-low"
                        }`}
                      >
                        {qty > 0 && (
                          <span className="absolute top-2 right-2 min-w-[24px] h-6 px-1.5 rounded-full bg-primary text-on-primary text-label-sm flex items-center justify-center">
                            ×{qty}
                          </span>
                        )}
                        <span className="font-headline-md text-[18px] mb-1 pr-8 text-primary">{s.name}</span>
                        <span className="font-label-sm text-on-surface-variant">{formatMoney(s.price)}</span>
                      </button>
                    );
                  })}
                  {services.length === 0 && (
                    <p className="col-span-full text-on-surface-variant">{O.noServices}</p>
                  )}
                </section>
                <button
                  type="button"
                  onClick={startOrder}
                  disabled={cart.length === 0}
                  className="mt-6 self-end bg-primary text-on-primary px-8 py-3 rounded font-label-md uppercase tracking-widest disabled:opacity-40 active:scale-95"
                >
                  {O.start}
                </button>
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
            <header className="flex justify-between mb-4 border-b border-outline-variant pb-2">
              <h3 className="font-headline-md text-on-surface-variant">{O.completedToday}</h3>
            </header>
            <table className="w-full text-left">
              <thead className="font-label-sm text-outline bg-surface-container-low">
                <tr>
                  <th className="py-3 px-4">{O.colId}</th>
                  <th className="py-3 px-4">{O.colCustomer}</th>
                  <th className="py-3 px-4">{O.colService}</th>
                  <th className="py-3 px-4 text-right">{O.colTotal}</th>
                  <th className="py-3 px-4 text-center">{O.colStatus}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant">
                {filteredCompleted.map((o) => (
                  <tr key={o.id} className="hover:bg-surface-container-low">
                    <td className="py-4 px-4 font-label-md">#{o.id}</td>
                    <td className="py-4 px-4">{o.customer_name}</td>
                    <td className="py-4 px-4 text-on-surface-variant">{o.service_name}</td>
                    <td className="py-4 px-4 text-right font-semibold">{formatMoney(o.amount)}</td>
                    <td className="py-4 px-4 text-center">
                      <span className="inline-block px-3 py-1 bg-green-100 text-green-800 text-[10px] font-bold rounded-full uppercase">
                        {O.paid}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </section>

        {/* Held sidebar */}
        <aside className="hidden lg:flex w-80 border-l border-outline-variant bg-surface-container-low flex-col shrink-0">
          <header className="p-6 border-b border-outline-variant bg-surface-container-high">
            <span className="flex items-center gap-2 text-secondary mb-1">
              <Icon name="inventory_2" />
              <h3 className="font-headline-md font-bold uppercase">{O.heldTitle}</h3>
            </span>
            <p className="text-label-sm text-on-surface-variant">{O.heldPending(held.length)}</p>
          </header>
          <section className="flex-1 overflow-y-auto p-4 space-y-4">
            {held.map((o) => (
              <article
                key={o.id}
                className="bg-surface-container-lowest border border-secondary p-4 rounded-lg border-l-4"
              >
                <header className="flex justify-between mb-2">
                  <h4 className="font-headline-md text-[18px]">{o.customer_name}</h4>
                  <span className="text-label-sm text-outline">{formatTime(o.created_at)}</span>
                </header>
                <ul className="text-label-sm text-on-surface-variant mb-3 space-y-0.5">
                  {(o.items?.length ? o.items : [{ name: o.service_name, quantity: 1 }]).map((item, idx) => (
                    <li key={idx}>
                      · {item.name}
                      {"quantity" in item && item.quantity > 1 ? ` ×${item.quantity}` : ""}
                    </li>
                  ))}
                </ul>
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
          <footer className="p-4 bg-surface-container-highest border-t border-outline-variant">
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
          </footer>
        </aside>
      </section>

      {editingHeld && (
        <HeldOrderEditor
          order={editingHeld}
          services={services}
          onClose={() => setEditingHeld(null)}
          onSave={(data) => saveHeldEdit(editingHeld.id, data)}
        />
      )}
    </>
  );
}
