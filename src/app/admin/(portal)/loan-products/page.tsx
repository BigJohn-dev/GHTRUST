"use client";

import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, GitBranch, Plus, Trash2 } from "lucide-react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { DescriptionList, PageHeader } from "@/components/admin/Page";
import { Empty, ErrorState, InlineError, Notice, PageSkeleton, Skeleton } from "@/components/admin/States";
import { P, useStaffAuth } from "@/lib/admin/auth";
import { productsApi, teamApi } from "@/lib/admin/endpoints";
import { useAction, useResource } from "@/lib/admin/hooks";
import { date, humanize } from "@/lib/admin/format";
import { cn } from "@/lib/utils";
import type { LoanProduct, Role, Workflow, WorkflowStageInput } from "@/lib/admin/types";

export default function LoanProductsPage() {
  const products = useResource(() => productsApi.list());
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selected && products.data?.length) setSelected(products.data[0].code);
  }, [products.data, selected]);

  if (products.loading && !products.data) return <PageSkeleton stats={false} />;
  if (products.error) return <ErrorState message={products.error} onRetry={products.reload} />;
  const list = products.data ?? [];
  const product = list.find((p) => p.code === selected);
  const live = list.filter((p) => p.is_active).length;

  return (
    <>
      <PageHeader
        title="Loan products"
        description="Pricing, availability and the approval workflow each application follows."
        meta={<Badge variant="muted">{live} of {list.length} live</Badge>}
      />

      <div className="grid items-start gap-6 lg:grid-cols-12">
        <Card flush className="lg:sticky lg:top-20 lg:col-span-4 xl:col-span-3">
          <p className="border-b border-line px-4 py-3 text-2xs font-semibold uppercase tracking-wider text-ink-3">Products</p>
          <ul role="listbox" aria-label="Loan products" className="p-1.5">
            {list.map((p) => {
              const active = selected === p.code;
              return (
                <li key={p.code}>
                  <button
                    role="option"
                    aria-selected={active}
                    onClick={() => setSelected(p.code)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                      active ? "bg-navy/[0.06]" : "hover:bg-gray-50",
                    )}
                  >
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", p.is_active ? "bg-success" : "bg-gray-300")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm font-medium", active ? "text-navy" : "text-ink")}>{p.name}</span>
                      <span className="num block text-xs text-ink-3">
                        {Number(p.interest_rate_pct_monthly)}% / mo · {Number(p.processing_fee_pct)}% fee · {p.is_active ? "Live" : "Off"}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <div className="min-w-0 space-y-6 lg:col-span-8 xl:col-span-9">
          {product ? <ProductPanel key={product.code} product={product} onChanged={products.reload} /> : <Empty title="Select a product" />}
        </div>
      </div>
    </>
  );
}

function ProductPanel({ product, onChanged }: { product: LoanProduct; onChanged: () => void }) {
  const { can } = useStaffAuth();
  const toggle = useAction();
  const canConfigure = can(P.LOAN_CONFIGURE_WORKFLOW);

  async function setActive(active: boolean) {
    if (await toggle.run(() => productsApi.setActive(product.code, active))) onChanged();
  }

  return (
    <>
      <Card>
        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2.5">
              <h2 className="text-lg font-semibold text-ink">{product.name}</h2>
              <Badge variant={product.is_active ? "success" : "muted"} dot>
                {product.is_active ? "Live" : "Off"}
              </Badge>
            </div>
            {product.description && <p className="mt-1 max-w-2xl text-sm text-ink-3">{product.description}</p>}
          </div>
          {canConfigure && (
            <Button variant={product.is_active ? "danger-outline" : "success"} loading={toggle.busy} onClick={() => setActive(!product.is_active)}>
              {product.is_active ? "Turn off" : "Make live"}
            </Button>
          )}
        </div>
        <InlineError message={toggle.error} />
        <DescriptionList
          columns={4}
          items={[
            { label: "Interest", value: `${Number(product.interest_rate_pct_monthly)}% / month` },
            { label: "Processing fee", value: `${Number(product.processing_fee_pct)}%` },
            { label: "Max tenure", value: product.max_tenure_days ? `${product.max_tenure_days} days` : "No limit" },
            {
              label: "Late penalty",
              value: product.default_penalty_pct_daily ? `${Number(product.default_penalty_pct_daily)}% / day (not yet charged)` : null,
            },
            { label: "Repayment options", value: product.repayment_cadence_options.map(humanize).join(", ") || null },
            { label: "Required documents", value: `${product.required_document_types.length}` },
            { label: "Wizard steps", value: `${product.workflow_steps.length}` },
          ]}
        />
      </Card>
      <WorkflowEditor product={product} canConfigure={canConfigure} />
    </>
  );
}

interface DraftStage extends WorkflowStageInput {
  key: string;
}

const toDraft = (wf: Workflow | null | undefined): DraftStage[] =>
  (wf?.stages ?? []).map((s) => ({ key: s.id, name: s.name, description: s.description ?? undefined, approver_role_id: s.approver_role_id }));

function WorkflowEditor({ product, canConfigure }: { product: LoanProduct; canConfigure: boolean }) {
  // Listing every version (incl. drafts) needs configure rights; viewers get the active one.
  const workflows = useResource<Workflow[]>(
    () =>
      canConfigure
        ? productsApi.workflows(product.code)
        : productsApi.activeWorkflow(product.code).then((wf) => (wf ? [wf] : [])),
    [product.code, canConfigure],
  );
  const roles = useResource<Role[]>(() => (canConfigure ? teamApi.listRoles() : Promise.resolve([])), [canConfigure]);
  const [editing, setEditing] = useState(false);
  const [draftId, setDraftId] = useState<string | null>(null);
  const [stages, setStages] = useState<DraftStage[]>([]);
  const [notice, setNotice] = useState<{ tone: "info" | "success"; text: string } | null>(null);
  const save = useAction();

  const all = workflows.data ?? [];
  const published = all.filter((w) => w.is_published).sort((a, b) => b.version - a.version)[0] ?? null;
  const pendingDraft = all.filter((w) => !w.is_published).sort((a, b) => b.version - a.version)[0] ?? null;

  function startEditing() {
    const base = pendingDraft ?? published;
    setDraftId(pendingDraft?.id ?? null);
    setStages(toDraft(base));
    setNotice(pendingDraft ? { tone: "info", text: `Resuming unpublished draft v${pendingDraft.version}.` } : null);
    setEditing(true);
  }

  const update = (i: number, patch: Partial<DraftStage>) => setStages((s) => s.map((st, idx) => (idx === i ? { ...st, ...patch } : st)));
  const move = (i: number, dir: -1 | 1) =>
    setStages((s) => {
      const next = [...s];
      const j = i + dir;
      if (j < 0 || j >= next.length) return s;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const valid = stages.length > 0 && stages.every((s) => s.name.trim() && s.approver_role_id);
  const payload = () => stages.map(({ name, description, approver_role_id }) => ({ name: name.trim(), description, approver_role_id }));

  async function persist(): Promise<string | undefined> {
    const wf = await save.run(() => (draftId ? productsApi.updateStages(draftId, payload()) : productsApi.createWorkflow(product.code, payload())));
    if (wf) setDraftId(wf.id);
    return wf?.id;
  }

  async function saveDraft() {
    if (await persist()) {
      setNotice({ tone: "info", text: "Draft saved. Publish it when ready — only new applications use a published workflow." });
      workflows.reload();
    }
  }

  async function publish() {
    const id = await persist();
    if (!id) return;
    const wf = await save.run(() => productsApi.publish(id));
    if (wf) {
      setEditing(false);
      setDraftId(null);
      setNotice({ tone: "success", text: `Published v${wf.version}. New applications will follow this workflow.` });
      workflows.reload();
    }
  }

  if (workflows.loading && !workflows.data) {
    return (
      <Card>
        <Skeleton className="h-4 w-40" />
        <div className="mt-5 space-y-2">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      </Card>
    );
  }
  if (workflows.error) return <ErrorState message={workflows.error} onRetry={workflows.reload} />;

  return (
    <Card>
      <CardHeader
        title="Approval workflow"
        description={
          <>
            {published ? `v${published.version} published ${date(published.published_at)}` : "No published workflow — submissions can't be routed"}
            {pendingDraft && !editing ? ` · draft v${pendingDraft.version} unpublished` : ""}
          </>
        }
        actions={
          canConfigure &&
          !editing && (
            <Button size="sm" variant="outline" onClick={startEditing}>
              <GitBranch className="h-3.5 w-3.5" /> {pendingDraft ? "Continue draft" : "Edit workflow"}
            </Button>
          )
        }
      />
      {notice && (
        <Notice tone={notice.tone} className="mb-4">
          {notice.text}
        </Notice>
      )}

      {!editing ? (
        published && published.stages.length ? (
          <ol className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-stretch">
            {published.stages.map((s, i) => (
              <li key={s.id} className="flex items-center gap-2 lg:flex-1">
                <div className="flex flex-1 items-center gap-3 rounded-lg border border-line bg-gray-50/60 px-3.5 py-3">
                  <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{i + 1}</span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{s.name}</p>
                    <p className="truncate text-xs text-ink-3">{s.approver_role_name ?? "—"}</p>
                  </div>
                </div>
                {i < published.stages.length - 1 && <span className="hidden text-gray-300 lg:block" aria-hidden>→</span>}
              </li>
            ))}
          </ol>
        ) : (
          <Empty title="No stages" compact />
        )
      ) : (
        <div className="space-y-2">
          {stages.map((s, i) => (
            <div key={s.key} className="flex flex-wrap items-center gap-2 rounded-lg border border-line bg-gray-50/60 p-2.5">
              <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy text-xs font-semibold text-white">{i + 1}</span>
              <input
                className="input h-9 min-w-[160px] flex-1"
                placeholder="Stage name"
                aria-label={`Stage ${i + 1} name`}
                value={s.name}
                onChange={(e) => update(i, { name: e.target.value })}
              />
              <select
                className="input h-9 w-52"
                aria-label={`Stage ${i + 1} approver role`}
                value={s.approver_role_id}
                onChange={(e) => update(i, { approver_role_id: e.target.value })}
              >
                <option value="">Approver role…</option>
                {(roles.data ?? []).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
              <div className="flex gap-0.5">
                <Button size="icon" variant="ghost" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="ghost" aria-label="Move down" disabled={i === stages.length - 1} onClick={() => move(i, 1)}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  className="hover:bg-error-soft hover:text-error"
                  aria-label="Remove stage"
                  onClick={() => setStages((st) => st.filter((_, idx) => idx !== i))}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
          <Button size="sm" variant="ghost" onClick={() => setStages((st) => [...st, { key: `new-${Date.now()}`, name: "", approver_role_id: "" }])}>
            <Plus className="h-4 w-4" /> Add stage
          </Button>
          <InlineError message={save.error} />
          <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <p className="mr-auto text-xs text-ink-3">Applications already in review keep the workflow they started with.</p>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button size="sm" variant="outline" disabled={!valid || save.busy} onClick={saveDraft}>
              Save draft
            </Button>
            <Button size="sm" loading={save.busy} disabled={!valid} onClick={publish}>
              Save & publish
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
