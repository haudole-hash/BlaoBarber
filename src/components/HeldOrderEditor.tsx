import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import { OrderCartPreview } from "./OrderCartPreview";
import {
  cartToOrderItems,
  newCartLineId,
  validateCartBeforeSubmit,
  type CartLine,
} from "../cartTypes";
import { labels } from "../labels";
import type { Employee, Order, Service } from "../types";
import { formatMoney } from "../utils";

const O = labels.orders;

export function orderToCart(order: Order, employees: Employee[] = []): CartLine[] {
  if (order.items?.length) {
    return order.items.map((i, idx) => ({
      lineId: `item-${order.id}-${idx}`,
      serviceId: i.service_id,
      quantity: i.quantity,
      assignments: (i.assignments ?? []).map((a) => {
        const emp = employees.find((e) => e.id === a.employee_id);
        return {
          employeeId: a.employee_id,
          roleId: emp?.role_id ?? a.role_id,
        };
      }),
    }));
  }
  if (order.service_id) {
    return [{ lineId: newCartLineId(), serviceId: order.service_id, quantity: 1, assignments: [] }];
  }
  return [];
}

type Props = {
  order: Order;
  services: Service[];
  employees: Employee[];
  onClose: () => void;
  onSave: (data: {
    customer_name: string;
    items: ReturnType<typeof cartToOrderItems>;
    discount_percent?: number;
  }) => Promise<void>;
};

export function HeldOrderEditor({ order, services, employees, onClose, onSave }: Props) {
  const [customerName, setCustomerName] = useState(order.customer_name);
  const [cart, setCart] = useState<CartLine[]>(() => orderToCart(order, employees));
  const [discountPercent, setDiscountPercent] = useState<number>(order.discount_percent ?? 0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCustomerName(order.customer_name);
    setCart(orderToCart(order, employees));
    setDiscountPercent(order.discount_percent ?? 0);
  }, [order, employees]);

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

  const cartSubtotal = cart.reduce((sum, line) => {
    const svc = services.find((s) => s.id === line.serviceId);
    return sum + (svc ? svc.price * line.quantity : 0);
  }, 0);
  const safeDiscount = Number.isFinite(discountPercent)
    ? Math.max(0, Math.min(100, discountPercent))
    : 0;
  const cartTotal = Math.max(0, Math.round(cartSubtotal * (1 - safeDiscount / 100)));

  const applyAssignmentsToAll = (sourceLineId: string, assignments: CartLine["assignments"]) => {
    setCart((prev) => prev.map((c) => (c.lineId === sourceLineId ? c : { ...c, assignments })));
  };

  const handleSave = async () => {
    if (cart.length === 0) {
      alert(O.needService);
      return;
    }
    const cartErr = validateCartBeforeSubmit(cart, services, employees);
    if (cartErr) {
      alert(cartErr);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        customer_name: customerName,
        items: cartToOrderItems(cart),
        discount_percent: safeDiscount,
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
          <label className="block font-label-md text-outline">
            {O.customer}
            <input
              className="w-full mt-1 border border-outline-variant rounded p-3 focus:border-primary outline-none"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
          </label>

          <OrderCartPreview
            cart={cart}
            services={services}
            employees={employees}
            discountPercent={safeDiscount}
            onChangeQty={changeCartQty}
            onRemove={removeFromCart}
            onAssignmentsChange={setAssignments}
            onApplyAssignmentsToAll={applyAssignmentsToAll}
            onDiscountPercentChange={(n) => setDiscountPercent(Number(n) || 0)}
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
