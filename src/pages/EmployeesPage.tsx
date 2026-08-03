import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Icon } from "../components/Icon";
import { labels } from "../labels";
import type { Employee, StaffRole } from "../types";
import { formatMoney, PAGE_TITLE_CLASS, rangeLastDays } from "../utils";

const E = labels.employees;

function isProxyRole(role: StaffRole | undefined) {
  return Boolean(role && Number(role.is_proxy_owner) === 1);
}

export function EmployeesPage() {
  const defaultRange = rangeLastDays(7);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [employeesAll, setEmployeesAll] = useState<Employee[]>([]);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [rolesAll, setRolesAll] = useState<(StaffRole & { employee_count?: number })[]>([]);
  const [roleModal, setRoleModal] = useState(false);
  const [editingRole, setEditingRole] = useState<StaffRole | null>(null);
  const [roleForm, setRoleForm] = useState({ name: "", sort_order: 0 });
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [employeeFilter, setEmployeeFilter] = useState<number | "">("");
  const [pointRate, setPointRate] = useState(1000);
  const [report, setReport] = useState<Awaited<ReturnType<typeof api.payroll.workLog>> | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState({ name: "", role_id: 0, salary_coefficient: 1 });

  const selectedRole = useMemo(
    () => roles.find((r) => r.id === form.role_id),
    [roles, form.role_id]
  );
  const formIsProxy = isProxyRole(selectedRole);

  const loadMeta = useCallback(async () => {
    const [emps, empsAll, roleList, allRoles, settings] = await Promise.all([
      api.employees.list(),
      api.employees.listAll(),
      api.staffRoles.list(),
      api.staffRoles.listAll(),
      api.payroll.settings(),
    ]);
    setEmployees(emps);
    setEmployeesAll(empsAll);
    setRoles(roleList);
    setRolesAll(allRoles);
    setPointRate(settings.point_rate_vnd);
  }, []);

  useEffect(() => {
    loadMeta().catch(console.error);
  }, [loadMeta]);

  const loadReport = useCallback(async () => {
    const data = await api.payroll.workLog({
      from,
      to,
      employee_id: employeeFilter === "" ? undefined : employeeFilter,
    });
    setReport(data);
  }, [from, to, employeeFilter]);

  useEffect(() => {
    loadReport().catch(console.error);
  }, [loadReport]);

  const openCreate = () => {
    setEditing(null);
    setForm({
      name: "",
      role_id: roles[0]?.id ?? 0,
      salary_coefficient: 1,
    });
    setModalOpen(true);
  };

  const openEdit = (emp: Employee) => {
    setEditing(emp);
    setForm({
      name: emp.name,
      role_id: emp.role_id,
      salary_coefficient: emp.salary_coefficient,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const role = roles.find((r) => r.id === form.role_id);
    const proxy = isProxyRole(role);
    if (!form.name.trim() || (!proxy && form.salary_coefficient <= 0)) {
      alert(E.invalidEmployee);
      return;
    }
    const payload = {
      ...form,
      salary_coefficient: proxy ? 1 : form.salary_coefficient,
    };
    if (editing) {
      await api.employees.update(editing.id, payload);
    } else {
      await api.employees.create(payload);
    }
    setModalOpen(false);
    await loadMeta();
    await loadReport();
  };

  const hideEmployee = async (emp: Employee) => {
    if (!confirm(E.hideEmployeeConfirm(emp.name))) return;
    await api.employees.update(emp.id, { is_active: 0 });
    await loadMeta();
    await loadReport();
  };

  const reportFilterOptions = employeesAll;

  const deleteEmployee = async (emp: Employee) => {
    if (!confirm(E.deleteEmployeeConfirm(emp.name))) return;
    try {
      await api.employees.remove(emp.id);
      await loadMeta();
      await loadReport();
    } catch (err) {
      alert(err instanceof Error ? err.message : labels.errors.requestFailed);
    }
  };

  const openCreateRole = () => {
    setEditingRole(null);
    setRoleForm({ name: "", sort_order: rolesAll.length + 1 });
    setRoleModal(true);
  };

  const openEditRole = (role: StaffRole) => {
    setEditingRole(role);
    setRoleForm({ name: role.name, sort_order: role.sort_order });
    setRoleModal(true);
  };

  const submitRole = async (e: FormEvent) => {
    e.preventDefault();
    if (!roleForm.name.trim()) {
      alert(E.invalidRole);
      return;
    }
    if (editingRole) {
      await api.staffRoles.update(editingRole.id, roleForm);
    } else {
      await api.staffRoles.create(roleForm);
    }
    setRoleModal(false);
    await loadMeta();
  };

  const removeRole = async (role: StaffRole & { employee_count?: number }) => {
    if ((role.employee_count ?? 0) > 0) {
      alert(E.cannotDeleteRoleInUse(role.employee_count ?? 0));
      return;
    }
    if (!confirm(E.deleteRoleConfirm(role.name))) return;
    try {
      await api.staffRoles.remove(role.id);
      await loadMeta();
    } catch (err) {
      alert(err instanceof Error ? err.message : E.cannotDeleteRoleInUse(1));
    }
  };

  const savePointRate = async () => {
    await api.payroll.updateSettings(pointRate);
    await loadReport();
  };

  const selectedSummary =
    employeeFilter === ""
      ? report?.summaries
      : report?.summaries.filter((s) => s.employee_id === employeeFilter);

  const reportEntries = report?.entries ?? [];
  const reportTotals = reportEntries.reduce(
    (acc, row) => {
      acc.points += row.points;
      acc.earnings += row.earnings;
      return acc;
    },
    { points: 0, earnings: 0 }
  );

  return (
    <>
      <header className="flex flex-wrap justify-between items-center gap-4 px-margin-mobile md:px-margin-desktop h-auto min-h-16 py-3 border-b border-outline-variant bg-surface shrink-0">
        <div>
          <h2 className={PAGE_TITLE_CLASS}>{labels.pageTitle.employees}</h2>
          <p className="text-label-sm text-on-surface-variant">{E.desc}</p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          className="bg-primary text-on-primary px-4 py-2 rounded font-label-md flex items-center gap-2"
        >
          <Icon name="person_add" />
          {E.addEmployee}
        </button>
      </header>

      <div className="p-margin-mobile md:p-margin-desktop space-y-8 pb-24">
        <section className="bg-surface-container-lowest border border-outline-variant rounded-lg p-4 flex flex-wrap gap-4 items-end">
          <label className="font-label-md text-outline">
            {E.pointRate}
            <input
              type="number"
              min={1}
              step={1000}
              className="block mt-1 border border-outline-variant rounded p-2 w-36"
              value={pointRate}
              onChange={(e) => setPointRate(Number(e.target.value))}
            />
          </label>
          <button
            type="button"
            onClick={savePointRate}
            className="border border-primary text-primary px-4 py-2 rounded font-label-md"
          >
            {E.saveSettings}
          </button>
        </section>

        <section className="bg-surface border border-outline-variant rounded-lg p-4">
          <header className="flex flex-wrap justify-between items-start gap-3 mb-4">
            <span>
              <h3 className="font-headline-md text-primary">{E.staffRolesTitle}</h3>
              <p className="text-label-sm text-on-surface-variant">{E.staffRolesDesc}</p>
            </span>
            <button
              type="button"
              onClick={openCreateRole}
              className="border border-primary text-primary px-3 py-2 rounded font-label-md flex items-center gap-1"
            >
              <Icon name="add" className="text-[18px]" />
              {E.addStaffRole}
            </button>
          </header>
          <ul className="flex flex-wrap gap-2">
            {rolesAll
              .filter((r) => r.is_active)
              .map((role) => (
                <li
                  key={role.id}
                  className="flex items-center gap-2 px-3 py-2 border border-outline-variant rounded-full bg-surface-container-low"
                >
                  <span className="font-label-md">{role.name}</span>
                  <span className="text-[11px] text-outline">
                    {E.roleInUse(role.employee_count ?? 0)}
                  </span>
                  <button type="button" onClick={() => openEditRole(role)} className="p-1 hover:bg-surface-container rounded">
                    <Icon name="edit" className="text-[16px]" />
                  </button>
                  <button
                    type="button"
                    onClick={() => removeRole(role)}
                    disabled={(role.employee_count ?? 0) > 0}
                    title={
                      (role.employee_count ?? 0) > 0
                        ? E.cannotDeleteRoleInUse(role.employee_count ?? 0)
                        : E.deleteRole
                    }
                    className="p-1 text-error hover:bg-error-container rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Icon name="close" className="text-[16px]" />
                  </button>
                </li>
              ))}
          </ul>
          <p className="mt-4 text-label-sm text-on-surface-variant">
            {E.trashHint}{" "}
            <Link to="/trash" className="text-secondary font-label-md hover:underline">
              {labels.trash.goToTrash}
            </Link>
          </p>
        </section>

        <section className="grid lg:grid-cols-3 gap-6">
          <article className="lg:col-span-1 bg-surface border border-outline-variant rounded-lg p-4">
            <h3 className="font-headline-md text-primary mb-4">{E.staffList}</h3>
            <ul className="space-y-2">
              {employees.map((emp) => (
                <li
                  key={emp.id}
                  className="flex items-center justify-between gap-2 p-3 border border-outline-variant rounded hover:bg-surface-container-low"
                >
                  <span>
                    <span className="font-label-md block">{emp.name}</span>
                    <span className="text-label-sm text-on-surface-variant">
                      {emp.role_name}
                      {isProxyRole(roles.find((r) => r.id === emp.role_id) ?? rolesAll.find((r) => r.id === emp.role_id))
                        ? ""
                        : ` · hệ số ×${emp.salary_coefficient}`}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-1 justify-end">
                    <button
                      type="button"
                      onClick={() => openEdit(emp)}
                      className="px-2 py-1 text-label-sm border border-outline-variant rounded hover:bg-surface-container"
                    >
                      {labels.services.edit}
                    </button>
                    <button
                      type="button"
                      onClick={() => hideEmployee(emp)}
                      className="px-2 py-1 text-label-sm border border-outline-variant rounded hover:bg-surface-container"
                      title={E.hideEmployeeConfirm(emp.name)}
                    >
                      {E.hideEmployee}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEmployee(emp)}
                      title={E.deleteEmployeeConfirm(emp.name)}
                      className="px-2 py-1 text-label-sm text-error border border-error/40 rounded hover:bg-error-container"
                    >
                      {E.deleteEmployee}
                    </button>
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-4 text-label-sm text-on-surface-variant">
              {E.trashHint}{" "}
              <Link to="/trash" className="text-secondary font-label-md hover:underline">
                {labels.trash.goToTrash}
              </Link>
            </p>
          </article>

          <article className="lg:col-span-2 space-y-4">
            <div className="flex flex-wrap gap-3 items-end bg-surface-container-lowest border border-outline-variant rounded-lg p-4">
              <label className="font-label-md text-outline">
                {E.fromDate}
                <input
                  type="date"
                  className="block mt-1 border border-outline-variant rounded p-2"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                />
              </label>
              <label className="font-label-md text-outline">
                {E.toDate}
                <input
                  type="date"
                  className="block mt-1 border border-outline-variant rounded p-2"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                />
              </label>
              <label className="font-label-md text-outline">
                {E.reportStaffFilter}
                <select
                  className="block mt-1 border border-outline-variant rounded p-2 min-w-[180px]"
                  value={employeeFilter}
                  onChange={(e) =>
                    setEmployeeFilter(e.target.value === "" ? "" : Number(e.target.value))
                  }
                >
                  <option value="">{E.allStaff}</option>
                  {reportFilterOptions.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name}
                      {!emp.is_active ? ` (${E.employeeHiddenTag})` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() => loadReport()}
                className="bg-secondary text-on-secondary px-4 py-2 rounded font-label-md"
              >
                {E.filter}
              </button>
            </div>

            {selectedSummary && selectedSummary.length > 0 && (
              <div className="grid sm:grid-cols-2 gap-3">
                {selectedSummary.map((s) => (
                  <div
                    key={s.employee_id}
                    className="border border-outline-variant rounded-lg p-4 bg-surface"
                  >
                    <h4 className="font-headline-md text-primary">{s.employee_name}</h4>
                    <p className="text-label-sm text-on-surface-variant mt-1">
                      {E.totalPoints}: <strong>{s.total_points}</strong>
                    </p>
                    <p className="text-label-md text-secondary mt-1">
                      {E.totalEarnings}: {formatMoney(s.total_earnings)}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="border border-outline-variant rounded-lg overflow-x-auto">
              <table className="w-full text-left text-label-sm">
                <thead className="bg-surface-container-low text-outline">
                  <tr>
                    <th className="p-3">{E.colDate}</th>
                    <th className="p-3">{E.colOrder}</th>
                    <th className="p-3">{E.colService}</th>
                    <th className="p-3">{E.colRole}</th>
                    <th className="p-3 text-right">{E.colPoints}</th>
                    <th className="p-3 text-right">{E.colEarnings}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-outline-variant">
                  {reportEntries.map((row, i) => (
                    <tr key={`${row.order_id}-${row.service_id}-${row.employee_id}-${i}`}>
                      <td className="p-3">{row.completed_at.slice(0, 10)}</td>
                      <td className="p-3">#{row.order_id}</td>
                      <td className="p-3">
                        {row.service_name}
                        {row.quantity > 1 ? ` ×${row.quantity}` : ""}
                      </td>
                      <td className="p-3">{row.role_name}</td>
                      <td className="p-3 text-right">{row.points}</td>
                      <td className="p-3 text-right font-label-md">{formatMoney(row.earnings)}</td>
                    </tr>
                  ))}
                </tbody>
                {reportEntries.length > 0 && (
                  <tfoot className="bg-surface-container-highest border-t-2 border-primary/30">
                    <tr>
                      <td colSpan={4} className="p-3 font-label-md text-primary">
                        {E.reportTableTotal}
                      </td>
                      <td className="p-3 text-right font-label-md text-primary">
                        {reportTotals.points}
                      </td>
                      <td className="p-3 text-right font-headline-md text-secondary">
                        {formatMoney(reportTotals.earnings)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
              {reportEntries.length === 0 && (
                <p className="p-8 text-center text-on-surface-variant">{E.noEntries}</p>
              )}
            </div>
          </article>
        </section>
      </div>

      {roleModal && (
        <section className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40">
          <form
            onSubmit={submitRole}
            className="bg-surface w-full max-w-md rounded-xl p-6 shadow-xl space-y-4"
          >
            <h3 className="font-headline-lg text-primary">
              {editingRole ? E.editStaffRole : E.addStaffRole}
            </h3>
            <label className="block font-label-md text-outline">
              {E.roleName}
              <input
                className="w-full mt-1 border border-outline-variant rounded p-3"
                value={roleForm.name}
                onChange={(e) => setRoleForm({ ...roleForm, name: e.target.value })}
              />
            </label>
            <label className="block font-label-md text-outline">
              {E.sortOrder}
              <input
                type="number"
                min={0}
                className="w-full mt-1 border border-outline-variant rounded p-3"
                value={roleForm.sort_order}
                onChange={(e) => setRoleForm({ ...roleForm, sort_order: Number(e.target.value) })}
              />
            </label>
            <footer className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setRoleModal(false)}
                className="px-4 py-2 border border-outline-variant rounded"
              >
                {E.cancel}
              </button>
              <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded">
                {E.save}
              </button>
            </footer>
          </form>
        </section>
      )}

      {modalOpen && (
        <section className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-primary/40">
          <form
            onSubmit={handleSubmit}
            className="bg-surface w-full max-w-md rounded-xl p-6 shadow-xl space-y-4"
          >
            <h3 className="font-headline-lg text-primary">
              {editing ? E.editEmployee : E.addEmployee}
            </h3>
            <label className="block font-label-md text-outline">
              {E.name}
              <input
                className="w-full mt-1 border border-outline-variant rounded p-3"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="block font-label-md text-outline">
              {E.role}
              <select
                className="w-full mt-1 border border-outline-variant rounded p-3"
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </label>
            {formIsProxy ? (
              <p className="text-label-sm text-on-surface-variant">{E.proxyNoCoefficientHint}</p>
            ) : (
              <label className="block font-label-md text-outline">
                {E.coefficient}
                <input
                  type="number"
                  min={0.1}
                  step={0.1}
                  className="w-full mt-1 border border-outline-variant rounded p-3"
                  value={form.salary_coefficient}
                  onChange={(e) =>
                    setForm({ ...form, salary_coefficient: Number(e.target.value) })
                  }
                />
              </label>
            )}
            <footer className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 border border-outline-variant rounded"
              >
                {E.cancel}
              </button>
              <button type="submit" className="px-4 py-2 bg-primary text-on-primary rounded">
                {E.save}
              </button>
            </footer>
          </form>
        </section>
      )}
    </>
  );
}
