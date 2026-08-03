import { Icon } from "./Icon";
import { labels } from "../labels";
import type { Employee } from "../types";
import type { CartAssignment } from "../cartTypes";

const E = labels.employees;
const O = labels.orders;

type Props = {
  assignments: CartAssignment[];
  employees: Employee[];
  onChange: (assignments: CartAssignment[]) => void;
};

export function LineStaffPicker({ assignments, employees, onChange }: Props) {
  const addRow = () => {
    const next = employees.find((e) => !assignments.some((a) => a.employeeId === e.id));
    if (!next) {
      alert(assignments.length > 0 ? O.cannotAddMoreStaff : E.noEmployeesHint);
      return;
    }
    onChange([...assignments, { employeeId: next.id, roleId: next.role_id }]);
  };

  const updateEmployee = (index: number, employeeId: number) => {
    if (assignments.some((a, i) => i !== index && a.employeeId === employeeId)) {
      alert(O.duplicateStaffOnLine);
      return;
    }
    const emp = employees.find((e) => e.id === employeeId);
    if (!emp) return;
    onChange(
      assignments.map((a, i) =>
        i === index ? { employeeId: emp.id, roleId: emp.role_id } : a
      )
    );
  };

  const removeRow = (index: number) => {
    onChange(assignments.filter((_, i) => i !== index));
  };

  if (employees.length === 0) {
    return <p className="text-label-sm text-error">{E.noEmployeesHint}</p>;
  }

  return (
    <div className="w-full space-y-2 mt-2 pl-0 md:pl-2 border-l-2 border-secondary/40">
      <p className="text-label-sm text-outline font-label-md">{E.lineStaff}</p>
      <p className="text-[11px] text-on-surface-variant">{E.lineStaffHint}</p>
      {assignments.map((a, idx) => {
        const emp = employees.find((e) => e.id === a.employeeId);
        return (
          <div key={idx} className="flex flex-wrap items-center gap-2">
            <select
              className="flex-1 min-w-[140px] border border-outline-variant rounded px-2 py-1.5 text-label-sm"
              value={a.employeeId}
              onChange={(e) => updateEmployee(idx, Number(e.target.value))}
            >
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
            <span
              className="px-2 py-1 rounded-full bg-surface-container-high text-label-sm text-on-surface-variant whitespace-nowrap"
              title={E.roleFromProfile}
            >
              {emp?.role_name ?? "—"}
            </span>
            <button
              type="button"
              onClick={() => removeRow(idx)}
              className="p-1.5 text-error hover:bg-error-container rounded"
              title={E.removeStaff}
            >
              <Icon name="person_remove" className="text-[18px]" />
            </button>
          </div>
        );
      })}
      <button
        type="button"
        onClick={addRow}
        className="text-label-sm text-secondary font-label-md flex items-center gap-1 hover:underline"
      >
        <Icon name="person_add" className="text-[18px]" />
        {E.addStaff}
      </button>
    </div>
  );
}
