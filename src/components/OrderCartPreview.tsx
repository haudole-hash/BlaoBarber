import { useState } from "react";
import { Icon } from "./Icon";
import { LineStaffPicker } from "./LineStaffPicker";
import { labels } from "../labels";
import type { CartAssignment, CartLine } from "../cartTypes";
import type { Employee, Service } from "../types";
import { formatMoney } from "../utils";

const O = labels.orders;

type Props = {
  cart: CartLine[];
  services: Service[];
  employees: Employee[];
  discountPercent?: number;
  onChangeQty: (lineId: string, quantity: number) => void;
  onRemove: (lineId: string) => void;
  onAssignmentsChange: (lineId: string, assignments: CartAssignment[]) => void;
  onApplyAssignmentsToAll?: (sourceLineId: string, assignments: CartAssignment[]) => void;
  onDiscountPercentChange?: (next: number) => void;
  onStart?: () => void;
  startDisabled?: boolean;
  variant?: "default" | "sidebar";
};

export function OrderCartPreview({
  cart,
  services,
  employees,
  discountPercent = 0,
  onChangeQty,
  onRemove,
  onAssignmentsChange,
  onApplyAssignmentsToAll,
  onDiscountPercentChange,
  onStart,
  startDisabled = false,
  variant = "default",
}: Props) {
  const [open, setOpen] = useState(true);
  const isSidebar = variant === "sidebar";
  const expanded = isSidebar || open;

  const lines = cart
    .map((line) => {
      const svc = services.find((s) => s.id === line.serviceId);
      if (!svc) return null;
      return { ...line, svc, subtotal: svc.price * line.quantity };
    })
    .filter(Boolean) as (CartLine & { svc: Service; subtotal: number })[];

  const subtotal = lines.reduce((s, l) => s + l.subtotal, 0);
  const safeDiscount = Number.isFinite(discountPercent)
    ? Math.max(0, Math.min(100, discountPercent))
    : 0;
  const discountAmount = Math.round(subtotal * (safeDiscount / 100));
  const total = Math.max(0, subtotal - discountAmount);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <section
      className={`border border-outline-variant rounded-lg overflow-hidden bg-surface ${
        isSidebar ? "" : "mb-4"
      }`}
    >
      {isSidebar ? (
        <header className="px-4 py-3 bg-surface-container-low border-b border-outline-variant">
          <span className="flex items-center gap-2 font-label-md text-primary">
            <Icon name="shopping_cart" className="text-[20px]" />
            {O.cartPreview}
            {lines.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-label-sm">
                {O.cartCount(lines.length)} · {itemCount} món
              </span>
            )}
          </span>
        </header>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between px-4 py-3 bg-surface-container-low hover:bg-surface-container text-left"
        >
          <span className="flex items-center gap-2 font-label-md text-primary">
            <Icon name="shopping_cart" className="text-[20px]" />
            {O.cartPreview}
            {lines.length > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary text-on-primary text-label-sm">
                {O.cartCount(lines.length)} · {itemCount} món
              </span>
            )}
          </span>
          <span className="flex items-center gap-3">
            {lines.length > 0 && (
              <span className="font-label-md text-primary">{formatMoney(total)}</span>
            )}
            <Icon name={open ? "expand_less" : "expand_more"} />
          </span>
        </button>
      )}

      {expanded && (
        <div className="px-4 py-3 border-t border-outline-variant">
          {lines.length === 0 ? (
            <p className="text-body-md text-on-surface-variant py-2">{O.cartEmpty}</p>
          ) : (
            <ul className="space-y-4">
              {lines.map((line) => (
                <li
                  key={line.lineId}
                  className="py-3 border-b border-outline-variant last:border-0"
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex-1 min-w-[140px] font-body-md text-primary">{line.svc.name}</span>
                    <span className="text-label-sm text-on-surface-variant">{formatMoney(line.svc.price)}</span>
                    <span className="flex items-center gap-1">
                      <span className="text-label-sm text-outline mr-1">{O.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onChangeQty(line.lineId, line.quantity - 1)}
                        className="w-8 h-8 border border-outline-variant rounded hover:bg-surface-container-low"
                        aria-label={`Giảm ${line.svc.name}`}
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-label-md">{line.quantity}</span>
                      <button
                        type="button"
                        onClick={() => onChangeQty(line.lineId, line.quantity + 1)}
                        disabled={line.quantity >= 99}
                        className="w-8 h-8 border border-outline-variant rounded hover:bg-surface-container-low disabled:opacity-40"
                        aria-label={`Tăng ${line.svc.name}`}
                      >
                        +
                      </button>
                    </span>
                    <span className="font-label-md min-w-[90px] text-right">{formatMoney(line.subtotal)}</span>
                    <button
                      type="button"
                      onClick={() => onRemove(line.lineId)}
                      className="p-1.5 text-error hover:bg-error-container rounded"
                      title={O.removeLine}
                    >
                      <Icon name="close" className="text-[18px]" />
                    </button>
                  </div>
                  {line.assignments.length === 0 && (
                    <p className="text-label-sm text-error mt-2">{labels.orders.needStaffOnLine}</p>
                  )}
                  <LineStaffPicker
                    assignments={line.assignments}
                    employees={employees}
                    onChange={(a) => onAssignmentsChange(line.lineId, a)}
                  />
                  {onApplyAssignmentsToAll && line.assignments.length > 0 && lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onApplyAssignmentsToAll(line.lineId, line.assignments)}
                      className="mt-2 text-label-sm text-secondary font-label-md flex items-center gap-1 hover:underline"
                    >
                      <Icon name="content_copy" className="text-[18px]" />
                      {labels.orders.applyStaffToAll}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {lines.length > 0 && (
            <div className="pt-3 mt-2 border-t border-outline-variant space-y-2">
              <p className="flex justify-between items-center font-label-md">
                <span className="text-on-surface-variant">{O.cartSubtotal}</span>
                <span className="text-primary">{formatMoney(subtotal)}</span>
              </p>
              <div className="flex justify-between items-center gap-3">
                <span className="text-on-surface-variant font-label-md">{O.cartDiscountPct}</span>
                <label className="flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="border border-outline-variant rounded p-2 w-24 text-right"
                    value={safeDiscount}
                    onChange={(e) => onDiscountPercentChange?.(Number(e.target.value))}
                  />
                  <span className="text-on-surface-variant font-label-md">%</span>
                </label>
              </div>
              <p className="flex justify-between items-center font-label-md">
                <span className="text-on-surface-variant">{O.cartTotal}</span>
                <span className="text-headline-md text-primary">{formatMoney(total)}</span>
              </p>
            </div>
          )}
          {onStart && (
            <button
              type="button"
              onClick={onStart}
              disabled={startDisabled || lines.length === 0}
              className="mt-4 w-full bg-primary text-on-primary px-6 py-3 rounded font-label-md uppercase tracking-widest disabled:opacity-40 active:scale-95"
            >
              {O.start}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
