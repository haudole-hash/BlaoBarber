import { useState } from "react";
import { Icon } from "./Icon";
import { labels } from "../labels";
import type { Service } from "../types";
import { formatMoney } from "../utils";

const O = labels.orders;

export type CartLine = { serviceId: number; quantity: number };

type Props = {
  cart: CartLine[];
  services: Service[];
  onChangeQty: (serviceId: number, quantity: number) => void;
  onRemove: (serviceId: number) => void;
};

export function OrderCartPreview({ cart, services, onChangeQty, onRemove }: Props) {
  const [open, setOpen] = useState(true);

  const lines = cart
    .map((line) => {
      const svc = services.find((s) => s.id === line.serviceId);
      if (!svc) return null;
      return { ...line, svc, subtotal: svc.price * line.quantity };
    })
    .filter(Boolean) as { serviceId: number; quantity: number; svc: Service; subtotal: number }[];

  const total = lines.reduce((s, l) => s + l.subtotal, 0);
  const itemCount = lines.reduce((s, l) => s + l.quantity, 0);

  return (
    <section className="mb-4 border border-outline-variant rounded-lg overflow-hidden bg-surface">
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

      {open && (
        <div className="px-4 py-3 border-t border-outline-variant">
          {lines.length === 0 ? (
            <p className="text-body-md text-on-surface-variant py-2">{O.cartEmpty}</p>
          ) : (
            <ul className="space-y-2">
              {lines.map((line) => (
                <li
                  key={line.serviceId}
                  className="flex flex-wrap items-center gap-3 py-2 border-b border-outline-variant last:border-0"
                >
                  <span className="flex-1 min-w-[140px] font-body-md text-primary">{line.svc.name}</span>
                  <span className="text-label-sm text-on-surface-variant">{formatMoney(line.svc.price)}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-label-sm text-outline mr-1">{O.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onChangeQty(line.serviceId, line.quantity - 1)}
                      className="w-8 h-8 border border-outline-variant rounded hover:bg-surface-container-low"
                      aria-label={`Giảm ${line.svc.name}`}
                    >
                      −
                    </button>
                    <span className="w-8 text-center font-label-md">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => onChangeQty(line.serviceId, line.quantity + 1)}
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
                    onClick={() => onRemove(line.serviceId)}
                    className="p-1.5 text-error hover:bg-error-container rounded"
                    title={O.removeLine}
                  >
                    <Icon name="close" className="text-[18px]" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lines.length > 0 && (
            <p className="flex justify-between items-center pt-3 mt-2 border-t border-outline-variant font-label-md">
              <span className="text-on-surface-variant">{O.cartTotal}</span>
              <span className="text-headline-md text-primary">{formatMoney(total)}</span>
            </p>
          )}
        </div>
      )}
    </section>
  );
}
