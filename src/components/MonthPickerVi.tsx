import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import { labels } from "../labels";
import { formatMonthLabel, localMonthString } from "../utils";

const M = labels.monthPicker;

type Props = {
  value: string;
  onChange: (month: string) => void;
};

export function MonthPickerVi({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const [year, month] = value.split("-").map(Number);
  const [viewYear, setViewYear] = useState(year);

  useEffect(() => {
    if (open) setViewYear(year);
  }, [open, year]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const pickMonth = (m: number) => {
    onChange(`${viewYear}-${String(m).padStart(2, "0")}`);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 min-w-[200px] px-4 py-2 border border-outline-variant rounded bg-surface-container-low hover:border-primary text-left"
      >
        <span className="flex-1 text-body-md">{formatMonthLabel(value)}</span>
        <Icon name="calendar_month" className="text-on-surface-variant" />
      </button>

      {open && (
        <article className="absolute left-0 top-full mt-1 z-50 w-[280px] bg-surface border border-outline-variant rounded-lg shadow-lg p-3">
          <header className="flex items-center justify-between mb-3 px-1">
            <button
              type="button"
              onClick={() => setViewYear((y) => y - 1)}
              className="p-1 rounded hover:bg-surface-container-low"
              aria-label={M.prevYear}
            >
              <Icon name="chevron_left" />
            </button>
            <span className="font-label-md text-primary">Năm {viewYear}</span>
            <button
              type="button"
              onClick={() => setViewYear((y) => y + 1)}
              className="p-1 rounded hover:bg-surface-container-low"
              aria-label={M.nextYear}
            >
              <Icon name="chevron_right" />
            </button>
          </header>

          <section className="grid grid-cols-3 gap-2">
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => {
              const selected = viewYear === year && m === month;
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => pickMonth(m)}
                  className={`py-2 px-1 rounded text-label-md transition-colors ${
                    selected
                      ? "bg-primary text-on-primary font-semibold"
                      : "hover:bg-surface-container-low text-on-surface"
                  }`}
                >
                  Tháng {m}
                </button>
              );
            })}
          </section>

          <footer className="flex justify-between mt-3 pt-3 border-t border-outline-variant">
            <button
              type="button"
              onClick={() => {
                onChange(localMonthString());
                setOpen(false);
              }}
              className="text-label-md text-on-tertiary-container hover:underline"
            >
              {M.thisMonth}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-label-md text-on-surface-variant hover:underline"
            >
              {M.close}
            </button>
          </footer>
        </article>
      )}
    </div>
  );
}
