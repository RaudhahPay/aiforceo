"use client";

/**
 * CEO Business Dashboard — KPI Board tab (traffic lights).
 * Venture health, KPI traffic-light board, red-action log, and (kpiAdmin
 * only) KPI definition management.
 */

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  SectionCard,
  Table,
  Td,
  Field,
  TextInput,
  NumInput,
  Select,
  FormGrid,
  ActionForm,
  GhostButton,
  TrafficBadge,
  AttainBar,
  type Traffic,
} from "../../_components/ui";
import { C, Stat } from "@/app/_components/dashboard-primitives";
import {
  runKpiEvaluation,
  upsertKpiDefinition,
  deleteKpiDefinition,
  addRedAction,
  updateRedAction,
} from "@/server/actions/ceo";
import { periodLabel, type Granularity } from "@/lib/ceo-dashboard/periods";
import {
  fmtNum,
  fmtPct,
  type KpiDefinitionRow,
  type KpiSnapshotRow,
  type RedActionRow,
} from "@/lib/ceo-dashboard/types";

const SOURCE_KINDS = [
  "pnl",
  "bs",
  "cashflow",
  "funnel",
  "channel",
  "staff",
  "customer",
  "ops_metric",
  "strategy_count",
] as const;

const SOURCE_REF_HINT =
  "pnl: sales · gross_profit · ebitda · ebit_mgmt · pat · gp_pct · food_cost_pct | bs: cash_bank · total_assets · total_equity | funnel: sales · customers · prospects | channel: leads · revenue · cost | staff: enps · turnover_rate | customer: nps · csat · google_rating | ops_metric: use the metric code | strategy_count: leave blank";

type KpiDefForm = {
  name: string;
  source_kind: (typeof SOURCE_KINDS)[number];
  source_ref: string;
  target: string;
  direction: "higher_better" | "lower_better";
  green_threshold_pct: string;
  yellow_threshold_pct: string;
  weight: string;
  is_critical: boolean;
};

const EMPTY_DEF_FORM: KpiDefForm = {
  name: "",
  source_kind: "pnl",
  source_ref: "",
  target: "",
  direction: "higher_better",
  green_threshold_pct: "100",
  yellow_threshold_pct: "70",
  weight: "1",
  is_critical: false,
};

const RED_DOT_COLOR: Record<RedActionRow["status"], string> = {
  open: C.red,
  in_progress: C.amber,
  done: C.green,
  escalated: C.red,
};

export function KpiTab({
  entityId,
  period,
  granularity,
  canManage,
  canAct,
  health,
  kpiDefs,
  snapshots,
  redActions,
}: {
  entityId: string;
  period: string;
  granularity: Granularity;
  canManage: boolean;
  canAct: boolean;
  health: {
    score: number;
    badge: "green" | "yellow" | "red";
    redCount: number;
  };
  kpiDefs: KpiDefinitionRow[];
  snapshots: KpiSnapshotRow[];
  redActions: RedActionRow[];
}) {
  const router = useRouter();
  const [evaluating, setEvaluating] = useState(false);
  const [evalError, setEvalError] = useState<string | null>(null);

  const [selectedSnapshot, setSelectedSnapshot] = useState<{
    id: string;
    kpiName: string;
  } | null>(null);
  const [actionNote, setActionNote] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [deadline, setDeadline] = useState("");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [defForm, setDefForm] = useState<KpiDefForm>(EMPTY_DEF_FORM);

  async function handleEvaluate() {
    setEvaluating(true);
    setEvalError(null);
    const res = await runKpiEvaluation({
      entity_id: entityId,
      period_start: period,
      granularity,
    });
    setEvaluating(false);
    if (res.ok) {
      router.refresh();
    } else {
      setEvalError(res.error);
    }
  }

  const snapshotByKpiId = new Map(snapshots.map((s) => [s.kpi_id, s]));

  const statusOrder: Record<Traffic | "none", number> = {
    red: 0,
    yellow: 1,
    green: 2,
    none: 3,
  };

  const boardRows = kpiDefs
    .map((def) => ({ def, snap: snapshotByKpiId.get(def.id) ?? null }))
    .sort((a, b) => {
      const rankA = a.snap ? statusOrder[a.snap.status] : statusOrder.none;
      const rankB = b.snap ? statusOrder[b.snap.status] : statusOrder.none;
      return rankA - rankB;
    });

  function startRedAction(snapshotId: string, kpiName: string) {
    setSelectedSnapshot({ id: snapshotId, kpiName });
    setActionNote("");
    setOwnerEmail("");
    setDeadline("");
  }

  function startEditDef(def: KpiDefinitionRow) {
    if (def.entity_id === null) return;
    setEditingId(def.id);
    setDefForm({
      name: def.name,
      source_kind: def.source_kind,
      source_ref: def.source_ref ?? "",
      target: def.target === null ? "" : String(def.target),
      direction: def.direction,
      green_threshold_pct: String(def.green_threshold_pct),
      yellow_threshold_pct: String(def.yellow_threshold_pct),
      weight: String(def.weight),
      is_critical: def.is_critical,
    });
  }

  function cancelEditDef() {
    setEditingId(null);
    setDefForm(EMPTY_DEF_FORM);
  }

  const redActionsForStatus = (status: RedActionRow["status"]) => {
    switch (status) {
      case "open":
      case "escalated":
        return ["Start", "Done"] as const;
      case "in_progress":
        return ["Done"] as const;
      case "done":
        return [] as const;
    }
  };

  return (
    <div>
      <SectionCard
        title="Venture health"
        note="Traffic lights recompute from the data entered in the other tabs — run after entering numbers. Nightly auto-run comes with the cron phase."
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 12,
            marginBottom: 14,
          }}
        >
          <Stat
            label="Health score"
            value={health.score.toFixed(0)}
            sub="0–120 scale"
            tone={
              health.badge === "green"
                ? "good"
                : health.badge === "red"
                  ? "bad"
                  : "warn"
            }
          />
          <div
            style={{
              background: C.panel2,
              border: `1px solid ${C.line}`,
              borderRadius: 12,
              padding: "14px 16px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                color: C.dim,
                fontSize: 11,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                fontWeight: 600,
                marginBottom: 8,
              }}
            >
              Badge
            </div>
            <div>
              <TrafficBadge status={health.badge} />
            </div>
          </div>
          <Stat
            label="Red KPIs"
            value={String(health.redCount)}
            tone={health.redCount > 0 ? "bad" : "good"}
          />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button
            type="button"
            disabled={evaluating}
            onClick={handleEvaluate}
            style={{
              background: C.gold,
              color: "#101318",
              fontWeight: 700,
              fontSize: 13,
              border: 0,
              borderRadius: 8,
              padding: "9px 16px",
              cursor: evaluating ? "wait" : "pointer",
              opacity: evaluating ? 0.6 : 1,
            }}
          >
            {evaluating ? "Evaluating…" : "Evaluate now"}
          </button>
          {evalError ? (
            <span style={{ color: C.red, fontSize: 12 }}>{evalError}</span>
          ) : null}
        </div>
      </SectionCard>

      <SectionCard
        title={`KPI traffic light board for ${periodLabel(period, granularity)}`}
      >
        <Table
          head={[
            "KPI",
            "Source",
            "Target",
            "Actual",
            "Attainment",
            "Status",
            "",
          ]}
        >
          {boardRows.map(({ def, snap }) => {
            const noData = !snap;
            const status: Traffic = snap?.status ?? "green";
            return (
              <tr key={def.id}>
                <Td color={noData ? C.dim : undefined}>
                  {def.name}
                  {def.entity_id === null ? (
                    <span style={{ color: C.dim }}> (industry default)</span>
                  ) : null}
                  {def.is_critical ? (
                    <span style={{ color: C.red }}> ★</span>
                  ) : null}
                </Td>
                <Td color={C.dim}>
                  {def.source_kind}
                  {def.source_ref ? ` · ${def.source_ref}` : ""}
                </Td>
                <Td right>{fmtNum(def.target, 1)}</Td>
                <Td right>{noData ? "—" : fmtNum(snap!.actual, 1)}</Td>
                <Td right>
                  {noData ? (
                    "—"
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        justifyContent: "flex-end",
                      }}
                    >
                      <div style={{ width: 60 }}>
                        <AttainBar
                          pct={snap!.attainment_pct ?? 0}
                          status={status}
                        />
                      </div>
                      <span>{fmtPct(snap!.attainment_pct, 0)}</span>
                    </div>
                  )}
                </Td>
                <Td>
                  {noData ? (
                    <span style={{ color: C.dim, fontSize: 12 }}>no data</span>
                  ) : (
                    <TrafficBadge
                      status={status}
                      label={status.toUpperCase()}
                    />
                  )}
                </Td>
                <Td>
                  {!noData && status === "red" && canAct ? (
                    <GhostButton
                      onClick={() => startRedAction(snap!.id, def.name)}
                    >
                      Log action
                    </GhostButton>
                  ) : null}
                </Td>
              </tr>
            );
          })}
        </Table>

        {selectedSnapshot && canAct ? (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              Action for: {selectedSnapshot.kpiName}
            </div>
            <ActionForm
              submitLabel="Log action"
              onSubmit={() =>
                addRedAction({
                  kpi_snapshot_id: selectedSnapshot.id,
                  entity_id: entityId,
                  action_note: actionNote,
                  owner_email: ownerEmail || undefined,
                  deadline: deadline || undefined,
                })
              }
              onDone={() => {
                setSelectedSnapshot(null);
                router.refresh();
              }}
            >
              <FormGrid>
                <Field label="Action note" width="100%">
                  <TextInput
                    value={actionNote}
                    onChange={(e) => setActionNote(e.target.value)}
                    required
                  />
                </Field>
              </FormGrid>
              <FormGrid>
                <Field label="Owner email">
                  <TextInput
                    value={ownerEmail}
                    onChange={(e) => setOwnerEmail(e.target.value)}
                    placeholder="owner@email — blank = me"
                  />
                </Field>
                <Field label="Deadline">
                  <TextInput
                    type="date"
                    value={deadline}
                    onChange={(e) => setDeadline(e.target.value)}
                  />
                </Field>
              </FormGrid>
            </ActionForm>
            <div style={{ marginTop: 10 }}>
              <GhostButton onClick={() => setSelectedSnapshot(null)}>
                Cancel
              </GhostButton>
            </div>
            <div style={{ color: C.dim, fontSize: 11, marginTop: 10 }}>
              Every red gets an owner and a 48-hour clock — untouched reds
              escalate to the group view.
            </div>
          </div>
        ) : null}
      </SectionCard>

      <SectionCard title="Red KPI action log">
        {redActions.length === 0 ? (
          <div style={{ color: C.dim, fontSize: 13 }}>
            No red actions logged — that is either very good or very unmeasured.
          </div>
        ) : (
          <div style={{ display: "grid", gap: 10 }}>
            {redActions.map((a) => (
              <div
                key={a.id}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "10px 12px",
                  background: C.panel2,
                  border: `1px solid ${C.line}`,
                  borderRadius: 10,
                }}
              >
                <div
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    marginTop: 4,
                    flexShrink: 0,
                    background: RED_DOT_COLOR[a.status],
                    boxShadow:
                      a.status === "escalated"
                        ? `0 0 0 4px color-mix(in srgb, ${C.red} 14%, transparent)`
                        : undefined,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {a.action_note}
                  </div>
                  <div style={{ color: C.dim, fontSize: 12, marginTop: 3 }}>
                    Status: {a.status}
                    {a.deadline ? ` · Deadline: ${a.deadline}` : ""}
                    {a.status === "escalated" ? (
                      <span style={{ color: C.red }}> · ESCALATED</span>
                    ) : null}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                  {redActionsForStatus(a.status).map((label) => (
                    <GhostButton
                      key={label}
                      onClick={async () => {
                        await updateRedAction({
                          id: a.id,
                          status: label === "Start" ? "in_progress" : "done",
                        });
                        router.refresh();
                      }}
                    >
                      {label}
                    </GhostButton>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </SectionCard>

      {canManage ? (
        <SectionCard title="KPI definitions">
          <Table
            head={[
              "Name",
              "Scope",
              "Source",
              "Target",
              "Direction",
              "Green ≥",
              "Yellow ≥",
              "Weight",
              "Critical",
              "",
            ]}
          >
            {kpiDefs.map((def) => {
              const entityScoped = def.entity_id !== null;
              return (
                <tr key={def.id}>
                  <Td>{def.name}</Td>
                  <Td color={C.dim}>
                    {entityScoped ? "This venture" : "Industry default"}
                  </Td>
                  <Td color={C.dim}>
                    {def.source_kind}
                    {def.source_ref ? ` / ${def.source_ref}` : ""}
                  </Td>
                  <Td right>{fmtNum(def.target, 1)}</Td>
                  <Td color={C.dim}>
                    {def.direction === "higher_better"
                      ? "higher better"
                      : "lower better"}
                  </Td>
                  <Td right>{fmtPct(def.green_threshold_pct, 0)}</Td>
                  <Td right>{fmtPct(def.yellow_threshold_pct, 0)}</Td>
                  <Td right>{fmtNum(def.weight, 1)}</Td>
                  <Td>{def.is_critical ? "★" : "—"}</Td>
                  <Td>
                    {entityScoped ? (
                      <div style={{ display: "flex", gap: 6 }}>
                        <GhostButton onClick={() => startEditDef(def)}>
                          Edit
                        </GhostButton>
                        <GhostButton
                          danger
                          onClick={async () => {
                            if (
                              !window.confirm(
                                `Delete KPI "${def.name}"? This cannot be undone.`,
                              )
                            )
                              return;
                            await deleteKpiDefinition(def.id);
                            router.refresh();
                          }}
                        >
                          Delete
                        </GhostButton>
                      </div>
                    ) : null}
                  </Td>
                </tr>
              );
            })}
          </Table>

          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10 }}>
              {editingId ? "Edit KPI" : "Add KPI"}
            </div>
            <ActionForm
              submitLabel={editingId ? "Save changes" : "Add KPI"}
              onSubmit={() =>
                upsertKpiDefinition({
                  id: editingId ?? undefined,
                  entity_id: entityId,
                  name: defForm.name,
                  source_kind: defForm.source_kind,
                  source_ref: defForm.source_ref || null,
                  target: defForm.target === "" ? null : Number(defForm.target),
                  direction: defForm.direction,
                  green_threshold_pct: Number(defForm.green_threshold_pct),
                  yellow_threshold_pct: Number(defForm.yellow_threshold_pct),
                  weight: Number(defForm.weight),
                  is_critical: defForm.is_critical,
                })
              }
              onDone={() => {
                cancelEditDef();
                router.refresh();
              }}
            >
              <FormGrid>
                <Field label="Name" width="100%">
                  <TextInput
                    value={defForm.name}
                    onChange={(e) =>
                      setDefForm((f) => ({ ...f, name: e.target.value }))
                    }
                    required
                  />
                </Field>
              </FormGrid>
              <FormGrid>
                <Field label="Source kind">
                  <Select
                    value={defForm.source_kind}
                    onChange={(e) =>
                      setDefForm((f) => ({
                        ...f,
                        source_kind: e.target
                          .value as KpiDefForm["source_kind"],
                      }))
                    }
                  >
                    {SOURCE_KINDS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Source ref" width="100%">
                  <TextInput
                    value={defForm.source_ref}
                    onChange={(e) =>
                      setDefForm((f) => ({
                        ...f,
                        source_ref: e.target.value,
                      }))
                    }
                  />
                </Field>
              </FormGrid>
              <div style={{ color: C.dim, fontSize: 11, marginTop: -4 }}>
                {SOURCE_REF_HINT}
              </div>
              <FormGrid>
                <Field label="Target">
                  <NumInput
                    value={defForm.target}
                    onChange={(e) =>
                      setDefForm((f) => ({ ...f, target: e.target.value }))
                    }
                  />
                </Field>
                <Field label="Direction">
                  <Select
                    value={defForm.direction}
                    onChange={(e) =>
                      setDefForm((f) => ({
                        ...f,
                        direction: e.target.value as KpiDefForm["direction"],
                      }))
                    }
                  >
                    <option value="higher_better">Higher better</option>
                    <option value="lower_better">Lower better</option>
                  </Select>
                </Field>
                <Field label="Green ≥ (%)">
                  <NumInput
                    value={defForm.green_threshold_pct}
                    onChange={(e) =>
                      setDefForm((f) => ({
                        ...f,
                        green_threshold_pct: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Yellow ≥ (%)">
                  <NumInput
                    value={defForm.yellow_threshold_pct}
                    onChange={(e) =>
                      setDefForm((f) => ({
                        ...f,
                        yellow_threshold_pct: e.target.value,
                      }))
                    }
                  />
                </Field>
                <Field label="Weight">
                  <NumInput
                    value={defForm.weight}
                    onChange={(e) =>
                      setDefForm((f) => ({ ...f, weight: e.target.value }))
                    }
                  />
                </Field>
              </FormGrid>
              <FormGrid>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    fontSize: 13,
                    color: C.text,
                  }}
                >
                  <input
                    type="checkbox"
                    checked={defForm.is_critical}
                    onChange={(e) =>
                      setDefForm((f) => ({
                        ...f,
                        is_critical: e.target.checked,
                      }))
                    }
                  />
                  Critical KPI (a red critical KPI forces the venture badge to
                  red)
                </label>
              </FormGrid>
              {editingId ? (
                <div>
                  <GhostButton onClick={cancelEditDef}>Cancel edit</GhostButton>
                </div>
              ) : null}
            </ActionForm>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
