"use client";

import { useState } from "react";
import { Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { ConfirmModal, Modal } from "@/components/ui/Modal";
import { Field, FilterTabs, Initials, PageHeader, SearchInput, TableShell } from "@/components/admin/Page";
import { Empty, ErrorState, InlineError, Notice, TableSkeleton } from "@/components/admin/States";
import { P, PERMISSION_LABELS, useStaffAuth } from "@/lib/admin/auth";
import { teamApi } from "@/lib/admin/endpoints";
import { useAction, useResource } from "@/lib/admin/hooks";
import type { PermissionGroup, Role, StaffProfile } from "@/lib/admin/types";

export default function StaffAndRolesPage() {
  const { can } = useStaffAuth();
  const tabs = [
    ...(can(P.STAFF_READ) ? [{ value: "staff", label: "Staff" }] : []),
    ...(can(P.ROLE_READ) ? [{ value: "roles", label: "Roles & permissions" }] : []),
  ];
  const [tab, setTab] = useState(tabs[0]?.value ?? "staff");

  return (
    <>
      <PageHeader title="Staff & roles" description="Who can sign in, and what each role is allowed to do." />
      {tabs.length > 1 && (
        <div className="mb-6 border-b border-line">
          <FilterTabs label="Section" value={tab} onChange={setTab} options={tabs} />
        </div>
      )}
      {tab === "staff" && can(P.STAFF_READ) && <StaffSection />}
      {tab === "roles" && can(P.ROLE_READ) && <RolesSection />}
    </>
  );
}

// ── Staff ─────────────────────────────────────────────────────────────────

function StaffSection() {
  const { staff: me, can } = useStaffAuth();
  const staff = useResource(() => teamApi.listStaff());
  const roles = useResource<Role[]>(() => (can(P.ROLE_READ) ? teamApi.listRoles() : Promise.resolve([])));
  const [editing, setEditing] = useState<StaffProfile | "new" | null>(null);
  const [deactivating, setDeactivating] = useState<StaffProfile | null>(null);
  const [filter, setFilter] = useState("");
  const toggle = useAction();

  async function setActive(member: StaffProfile, active: boolean) {
    const ok = await toggle.run(() => (active ? teamApi.activate(member.id) : teamApi.deactivate(member.id)));
    if (ok) {
      setDeactivating(null);
      staff.reload();
    }
  }

  const q = filter.trim().toLowerCase();
  const rows = (staff.data ?? []).filter((s) => !q || [s.full_name, s.email, s.phone, s.role?.name].some((v) => (v ?? "").toLowerCase().includes(q)));

  return (
    <Card flush>
      <div className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row sm:items-center">
        <SearchInput value={filter} onChange={setFilter} placeholder="Search staff by name, email, phone or role" aria-label="Search staff" containerClassName="sm:max-w-sm sm:flex-1" />
        {can(P.STAFF_CREATE) && (
          <Button className="sm:ml-auto" onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> Add staff
          </Button>
        )}
      </div>
      {toggle.error && (
        <div className="px-4 pt-4">
          <InlineError message={toggle.error} />
        </div>
      )}
      {staff.loading && !staff.data ? (
        <TableSkeleton cols={5} rows={4} />
      ) : staff.error ? (
        <div className="p-5">
          <ErrorState message={staff.error} onRetry={staff.reload} />
        </div>
      ) : rows.length === 0 ? (
        <Empty title={q ? "No staff match that search" : "No staff yet"} />
      ) : (
        <TableShell>
          <table className="tbl">
            <thead>
              <tr>
                <th>Name</th>
                <th>Phone</th>
                <th>Role</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="stagger-rows">
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <div className="flex items-center gap-3">
                      <Initials name={s.full_name} />
                      <div className="min-w-0">
                        <p className="font-medium text-ink">
                          {s.full_name} {s.id === me?.id && <span className="text-xs font-normal text-ink-3">(you)</span>}
                        </p>
                        <p className="truncate text-xs text-ink-3">{s.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="whitespace-nowrap tabular-nums">{s.phone}</td>
                  <td>
                    {s.is_super_admin ? (
                      <Badge variant="navy">Super admin</Badge>
                    ) : s.role ? (
                      <Badge variant="info">{s.role.name}</Badge>
                    ) : (
                      <Badge variant="warning">No role</Badge>
                    )}
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>
                    <div className="flex justify-end gap-1.5">
                      {can(P.STAFF_UPDATE) && !s.is_super_admin && (
                        <Button size="xs" variant="outline" onClick={() => setEditing(s)} aria-label={`Edit ${s.full_name}`}>
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                      )}
                      {can(P.STAFF_ACTIVATE) && !s.is_super_admin && s.id !== me?.id && (
                        s.status === "active" ? (
                          <Button size="xs" variant="danger-outline" disabled={toggle.busy} onClick={() => setDeactivating(s)}>
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            size="xs"
                            variant="success"
                            disabled={toggle.busy || !s.role}
                            title={s.role ? undefined : "Assign a role first"}
                            onClick={() => setActive(s, true)}
                          >
                            Activate
                          </Button>
                        )
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableShell>
      )}
      <p className="border-t border-line px-4 py-3 text-xs text-ink-3">
        New staff are created inactive. Assign a role, then activate to let them sign in. Deactivating ends their sessions immediately.
      </p>

      {editing && (
        <StaffDialog
          member={editing === "new" ? null : editing}
          roles={roles.data ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            staff.reload();
          }}
        />
      )}
      <ConfirmModal
        isOpen={!!deactivating}
        onClose={() => setDeactivating(null)}
        onConfirm={() => deactivating && setActive(deactivating, false)}
        busy={toggle.busy}
        variant="danger"
        title={`Deactivate ${deactivating?.full_name ?? ""}?`}
        message="They are signed out everywhere immediately and can't sign in until reactivated."
        confirmLabel="Deactivate"
      />
    </Card>
  );
}

function StaffDialog({
  member,
  roles,
  onClose,
  onSaved,
}: {
  member: StaffProfile | null;
  roles: Role[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [fullName, setFullName] = useState(member?.full_name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [roleId, setRoleId] = useState(member?.role?.id ?? "");
  const action = useAction();
  const valid = !!fullName.trim() && !!email.trim() && phone.trim().length >= 10;

  async function save() {
    const body = { full_name: fullName.trim(), email: email.trim(), phone: phone.trim(), role_id: roleId || null };
    const ok = await action.run(() => (member ? teamApi.updateStaff(member.id, body) : teamApi.createStaff(body)));
    if (ok) onSaved();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={member ? `Edit ${member.full_name}` : "Add staff member"}
      description={member ? undefined : "They'll be created inactive. Activate them once their role is set."}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={action.busy} disabled={!valid} onClick={save}>
            {member ? "Save changes" : "Add staff member"}
          </Button>
        </>
      }
    >
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid) save();
        }}
      >
        <Field label="Full name" required>
          {(id) => <input id={id} className="input" autoComplete="off" value={fullName} onChange={(e) => setFullName(e.target.value)} />}
        </Field>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Email" required>
            {(id) => <input id={id} className="input" type="email" autoComplete="off" value={email} onChange={(e) => setEmail(e.target.value)} />}
          </Field>
          <Field label="Phone" required hint="Sign-in codes are sent here">
            {(id, d) => <input id={id} aria-describedby={d} className="input" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />}
          </Field>
        </div>
        <Field label="Role">
          {(id) => (
            <select id={id} className="input" value={roleId} onChange={(e) => setRoleId(e.target.value)}>
              <option value="">No role</option>
              {roles
                .filter((r) => !r.is_system)
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </select>
          )}
        </Field>
        <InlineError message={action.error} />
        <button type="submit" hidden />
      </form>
    </Modal>
  );
}

// ── Roles ─────────────────────────────────────────────────────────────────

function RolesSection() {
  const { can } = useStaffAuth();
  const roles = useResource(() => teamApi.listRoles());
  const catalog = useResource(() => teamApi.permissionCatalog());
  const [editing, setEditing] = useState<Role | "new" | null>(null);
  const [deleting, setDeleting] = useState<Role | null>(null);
  const del = useAction();

  async function remove(role: Role) {
    // DELETE returns 204 (no body), so signal success explicitly.
    const ok = await del.run(async () => {
      await teamApi.deleteRole(role.id);
      return true;
    });
    if (ok) {
      setDeleting(null);
      roles.reload();
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-3">System roles are locked. Custom roles can be edited or deleted.</p>
        {can(P.ROLE_CREATE) && (
          <Button onClick={() => setEditing("new")}>
            <Plus className="h-4 w-4" /> New role
          </Button>
        )}
      </div>
      {del.error && (
        <div className="mb-4">
          <InlineError message={del.error} />
        </div>
      )}
      {roles.loading && !roles.data ? (
        <Card flush>
          <TableSkeleton cols={3} rows={4} />
        </Card>
      ) : roles.error ? (
        <ErrorState message={roles.error} onRetry={roles.reload} />
      ) : (roles.data ?? []).length === 0 ? (
        <Card>
          <Empty title="No roles yet" />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2 3xl:grid-cols-3">
          {(roles.data ?? []).map((r) => (
            <Card key={r.id} className="flex flex-col">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 font-semibold text-ink">
                    {r.name}
                    {r.is_system && (
                      <Badge variant="muted">
                        <Lock className="h-3 w-3" /> System
                      </Badge>
                    )}
                  </p>
                  {r.description && <p className="mt-0.5 text-xs text-ink-3">{r.description}</p>}
                </div>
                {!r.is_system && (
                  <div className="flex shrink-0 gap-1">
                    {can(P.ROLE_UPDATE) && (
                      <Button size="icon" variant="ghost" aria-label={`Edit ${r.name}`} title="Edit" onClick={() => setEditing(r)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    {can(P.ROLE_DELETE) && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="hover:bg-error-soft hover:text-error"
                        aria-label={`Delete ${r.name}`}
                        title="Delete"
                        disabled={del.busy}
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5 border-t border-line pt-4">
                {r.permissions.length === 0 ? (
                  <span className="text-xs text-ink-3">No permissions</span>
                ) : (
                  r.permissions.map((p) => (
                    <span key={p} className="rounded-md bg-gray-100 px-2 py-0.5 text-xs text-ink-2">
                      {PERMISSION_LABELS[p] ?? p}
                    </span>
                  ))
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <RoleDialog
          role={editing === "new" ? null : editing}
          groups={catalog.data?.groups ?? []}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            roles.reload();
          }}
        />
      )}
      <ConfirmModal
        isOpen={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => deleting && remove(deleting)}
        busy={del.busy}
        variant="danger"
        title={`Delete the role “${deleting?.name ?? ""}”?`}
        message="Staff with this role lose its permissions. This can't be undone."
        confirmLabel="Delete role"
      />
    </>
  );
}

function RoleDialog({
  role,
  groups,
  onClose,
  onSaved,
}: {
  role: Role | null;
  groups: PermissionGroup[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(role?.name ?? "");
  const [description, setDescription] = useState(role?.description ?? "");
  const [perms, setPerms] = useState<Set<string>>(new Set(role?.permissions ?? []));
  const action = useAction();

  const toggle = (p: string) =>
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });
  const toggleGroup = (g: PermissionGroup, on: boolean) =>
    setPerms((prev) => {
      const next = new Set(prev);
      g.permissions.forEach((p) => (on ? next.add(p) : next.delete(p)));
      return next;
    });

  async function save() {
    const body = { name: name.trim(), description: description.trim() || undefined, permissions: Array.from(perms) };
    const ok = await action.run(() => (role ? teamApi.updateRole(role.id, body) : teamApi.createRole(body)));
    if (ok) onSaved();
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="lg"
      title={role ? `Edit role: ${role.name}` : "New role"}
      footer={
        <>
          <span className="mr-auto self-center text-xs text-ink-3">
            <span className="num font-semibold text-ink-2">{perms.size}</span> permission{perms.size === 1 ? "" : "s"} selected
          </span>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button loading={action.busy} disabled={!name.trim()} onClick={save}>
            Save role
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Name" required>
            {(id) => <input id={id} className="input" value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>
          <Field label="Description">
            {(id) => <input id={id} className="input" value={description} onChange={(e) => setDescription(e.target.value)} />}
          </Field>
        </div>
        {groups.length === 0 ? (
          <Notice tone="warning">The permission list couldn&apos;t be loaded.</Notice>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => {
              const on = g.permissions.filter((p) => perms.has(p)).length;
              const all = on === g.permissions.length;
              return (
                <fieldset key={g.label} className="rounded-lg border border-line p-3">
                  <legend className="sr-only">{g.label}</legend>
                  <label className="mb-2 flex cursor-pointer items-center justify-between gap-2 border-b border-line pb-2">
                    <span className="text-[13px] font-semibold text-ink">{g.label}</span>
                    <span className="flex items-center gap-2 text-xs text-ink-3">
                      {on}/{g.permissions.length}
                      <input
                        type="checkbox"
                        className="h-4 w-4 cursor-pointer accent-navy"
                        checked={all}
                        ref={(el) => {
                          if (el) el.indeterminate = on > 0 && !all;
                        }}
                        onChange={() => toggleGroup(g, !all)}
                        aria-label={`All ${g.label} permissions`}
                      />
                    </span>
                  </label>
                  <div className="space-y-1.5">
                    {g.permissions.map((p) => (
                      <label key={p} className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-0.5 text-[13px] text-ink-2 hover:bg-gray-50">
                        <input type="checkbox" checked={perms.has(p)} onChange={() => toggle(p)} className="h-4 w-4 cursor-pointer accent-navy" />
                        {PERMISSION_LABELS[p] ?? p}
                      </label>
                    ))}
                  </div>
                </fieldset>
              );
            })}
          </div>
        )}
        <InlineError message={action.error} />
      </div>
    </Modal>
  );
}
