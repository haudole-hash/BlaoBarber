import { Icon } from "./Icon";
import { labels } from "../labels";
import type { Employee, Order } from "../types";
import { formatMoney, formatTime } from "../utils";

const O = labels.orders;

type Props = {
  order: Order;
  employees: Employee[];
  onClose: () => void;
};

export function OrderDetailModal({ order, employees, onClose }: Props) {
  const items = order.items?.length
    ? order.items
    : [
        {
          service_id: order.service_id ?? 0,
          name: order.service_name,
          quantity: 1,
          unit_price: order.amount,
          assignments: [],
        },
      ];

  const completedLabel = order.completed_at
    ? `${order.completed_at.slice(0, 10)} · ${formatTime(order.completed_at)}`
    : "—";

  const hasProxy =
    order.has_proxy ||
    items.some((i) => i.has_proxy || (i.assignments ?? []).some((a) => a.is_proxy));

  const shopCutTotal = items.reduce((s, i) => s + (Number(i.shop_cut) || 0), 0);

  const personTotals = (() => {
    const map = new Map<
      string,
      { name: string; role: string; earnings: number; is_proxy: boolean }
    >();
    for (const item of items) {
      for (const a of item.assignments ?? []) {
        const empName =
          a.employee_name ??
          employees.find((e) => e.id === a.employee_id)?.name ??
          `#${a.employee_id}`;
        const key = `${a.employee_id}`;
        const cur = map.get(key) ?? {
          name: empName,
          role: a.role_name ?? "",
          earnings: 0,
          is_proxy: Boolean(a.is_proxy),
        };
        cur.earnings += Number(a.earnings) || 0;
        cur.is_proxy = cur.is_proxy || Boolean(a.is_proxy);
        if (a.role_name) cur.role = a.role_name;
        map.set(key, cur);
      }
    }
    return [...map.values()].sort((a, b) => {
      if (a.is_proxy !== b.is_proxy) return a.is_proxy ? 1 : -1;
      return a.name.localeCompare(b.name, "vi");
    });
  })();

  return (
    <section className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/50 backdrop-blur-sm">
      <article className="bg-surface w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl shadow-xl">
        <header className="sticky top-0 bg-surface border-b border-outline-variant px-6 py-4 flex justify-between items-start z-10">
          <span>
            <h2 className="font-headline-lg text-primary">{O.orderDetailTitle(order.id)}</h2>
            <p className="text-label-sm text-on-surface-variant mt-1">
              {order.customer_name} · {completedLabel}
            </p>
            <p className="text-label-sm text-outline">
              {O.staffOnOrder}: {order.barber}
            </p>
          </span>
          <button type="button" onClick={onClose} className="p-2 hover:bg-surface-container-low rounded">
            <Icon name="close" />
          </button>
        </header>

        <div className="p-6 space-y-4">
          <table className="w-full text-left text-label-sm">
            <thead className="bg-surface-container-low text-outline">
              <tr>
                <th className="p-3">{O.detailService}</th>
                <th className="p-3 text-center">{O.quantity}</th>
                <th className="p-3 text-right">{O.colTotal}</th>
                <th className="p-3">{O.detailStaff}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant">
              {items.map((item, idx) => (
                <tr key={idx}>
                  <td className="p-3 font-label-md text-primary">{item.name}</td>
                  <td className="p-3 text-center">{item.quantity}</td>
                  <td className="p-3 text-right">{formatMoney(item.unit_price * item.quantity)}</td>
                  <td className="p-3">
                    {item.assignments?.length ? (
                      <ul className="space-y-2">
                        {item.assignments.map((a, aIdx) => {
                          const empName =
                            a.employee_name ??
                            employees.find((e) => e.id === a.employee_id)?.name ??
                            `#${a.employee_id}`;
                          return (
                            <li key={aIdx} className="text-on-surface-variant">
                              <span className="font-label-md text-primary">{empName}</span>
                              {a.role_name ? (
                                <span className="text-outline"> · {a.role_name}</span>
                              ) : null}
                              {a.is_proxy ? (
                                <span className="block text-[11px] text-outline">
                                  {O.detailEarnings}: {formatMoney(a.earnings ?? 0)}
                                </span>
                              ) : a.points != null && a.points > 0 ? (
                                <span className="block text-[11px] text-outline">
                                  {O.detailPoints}: {a.points}
                                  {a.earnings != null && a.earnings > 0
                                    ? ` · ${O.detailEarnings}: ${formatMoney(a.earnings)}`
                                    : ""}
                                </span>
                              ) : null}
                            </li>
                          );
                        })}
                      </ul>
                    ) : (
                      <span className="text-outline">{O.detailNoStaff}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="border-t-2 border-primary/20 bg-surface-container-low">
              <tr>
                <td colSpan={2} className="p-3 font-label-md text-primary">
                  {O.detailTotal}
                </td>
                <td className="p-3 text-right font-headline-md text-primary">
                  {formatMoney(order.amount)}
                </td>
                <td />
              </tr>
            </tfoot>
          </table>

          {hasProxy && (
            <section className="border border-outline-variant rounded-lg p-4 space-y-3 bg-surface-container-low">
              <p className="font-label-md text-primary">{O.proxyBreakdownTitle}</p>
              <ul className="space-y-2 text-label-sm">
                <li className="flex justify-between gap-4">
                  <span className="text-on-surface-variant">{O.proxyShopCut}</span>
                  <span className="font-label-md text-primary">{formatMoney(shopCutTotal)}</span>
                </li>
                {personTotals.map((p) => (
                  <li key={p.name + p.role} className="flex justify-between gap-4">
                    <span className="text-on-surface-variant">
                      {p.name}
                      {p.role ? ` · ${p.role}` : ""}
                    </span>
                    <span className="font-label-md text-primary">{formatMoney(p.earnings)}</span>
                  </li>
                ))}
              </ul>
              {order.shop_revenue != null && (
                <p className="text-label-sm text-outline border-t border-outline-variant pt-2 flex justify-between gap-4">
                  <span>{O.proxyShopRevenue}</span>
                  <span className="font-label-md text-primary">{formatMoney(order.shop_revenue)}</span>
                </p>
              )}
            </section>
          )}
        </div>

        <footer className="sticky bottom-0 bg-surface border-t border-outline-variant px-6 py-4 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-primary text-on-primary rounded font-label-md"
          >
            {O.close}
          </button>
        </footer>
      </article>
    </section>
  );
}
