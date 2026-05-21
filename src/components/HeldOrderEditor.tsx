import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { OrderCartPreview, type CartLine } from "./OrderCartPreview";
import { labels } from "../labels";
import type { Order, Service } from "../types";
import { BARBERS, formatMoney } from "../utils";

const O = labels.orders;

export function orderToCart(order: Order): CartLine[] {
  if (order.items?.length) {
    return order.items.map((i) => ({ serviceId: i.service_id, quantity: i.quantity }));
  }
  if (order.service_id) {
    return [{ serviceId: order.service_id, quantity: 1 }];
  }
  return [];
}

type Props = {
  order: Order;
  services: Service[];
  onClose: () => void;
  onSave: (data: {
    customer_name: string;
    barber: string;
    items: { service_id: number; quantity: number }[];
  }) => Promise<void>;
};

export function HeldOrderEditor({ order, services, onClose, onSave }: Props) {
  const [customerName, setCustomerName] = useState(order.customer_name);
  const [barber, setBarber] = useState(order.barber);
  const [cart, setCart] = useState<CartLine[]>(() => orderToCart(order));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCustomerName(order.customer_name);
    setBarber(order.barber);
    setCart(orderToCart(order));
  }, [order]);

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

  const cartTotal = cart.reduce((sum, line) => {
    const svc = services.find((s) => s.id === line.serviceId);
    return sum + (svc ? svc.price * line.quantity : 0);
  }, 0);

  const handleSave = async () => {
    if (cart.length === 0) {
      alert(O.needService);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        customer_name: customerName,
        barber,
        items: cart.map((c) => ({ service_id: c.serviceId, quantity: c.quantity })),
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      alert(msg || O.saveHeldFailed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/50 backdrop-blur-sm">
      <article className="bg-surface w-full max-w-3xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl flex flex-col">
        <header className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex justify-between items-start z-10">
          <span>
            <h2 className="font-headline-lg text-primary">{O.editHeldTitle}</h2>
            <p className="text-label-sm text-on-surface-variant">
              {O.editHeldHint} · #{order.id}
            </p>
          </span>
          <button type="button" onClick={onClose} className="p-2 hover:bg-surface-container-low rounded">
            <Icon name="close" />
          </button>
        </header>

        <div className="p-6 space-y-6 flex-1">
          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <OrderCartPreview
            cart={cart}
            services={services}
            onChangeQty={changeCartQty}
            onRemove={removeFromCart}
          />

          <section>
            <p className="font-label-md text-outline mb-3">{O.pickService}</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {services.map((s) => {
                const qty = cartQty(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => addService(s.id)}
                    className={`relative flex flex-col items-start p-3 border rounded text-left ${
                      qty > 0
                        ? "border-primary ring-2 ring-primary bg-surface"
                        : "border-outline-variant hover:border-primary"
                    }`}
                  >
                    {qty > 0 && (
                      <span className="absolute top-1 right-1 min-w-[22px] h-5 px-1 rounded-full bg-primary text-on-primary text-[11px] font-bold flex items-center justify-center">
                        ×{qty}
                      </span>
                    )}
                    <span className="font-label-md text-primary pr-6">{s.name}</span>
                    <span className="text-label-sm text-on-surface-variant">{formatMoney(s.price)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>

        <footer className="sticky bottom-0 bg-surface border-t border-outline-variant px-6 py-4 flex justify-between items-center gap-4">
          <span className="font-headline-md text-primary">{formatMoney(cartTotal)}</span>
          <span className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 border border-outline-variant rounded font-label-md"
            >
              {O.cancel}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || cart.length === 0}
              className="px-6 py-2.5 bg-primary text-on-primary rounded font-label-md disabled:opacity-40"
            >
              {saving ? O.saving : O.saveHeld}
            </button>
          </span>
        </footer>
      </article>
    </section>
  );
}
