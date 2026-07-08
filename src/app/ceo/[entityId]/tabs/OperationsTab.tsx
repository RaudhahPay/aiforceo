"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { C, Stat } from "@/app/_components/dashboard-primitives";
import {
  SectionCard,
  Table,
  Td,
  Field,
  TextInput,
  NumInput,
  FormGrid,
  ActionForm,
} from "@/app/ceo/_components/ui";
import {
  addStaffHappiness,
  addCustomerHappiness,
  upsertOpsMetric,
} from "@/server/actions/ceo";
import { fmtNum, fmtPct } from "@/lib/ceo-dashboard/types";
import type {
  StaffHappinessRow,
  CustomerHappinessRow,
  MetricDefinitionRow,
  OpsMetricRow,
} from "@/lib/ceo-dashboard/types";

function fmtSigned(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return n > 0 ? `+${n}` : String(n);
}

function enpsColor(n: number | null | undefined): string | undefined {
  if (n === null || n === undefined) return undefined;
  if (n >= 30) return C.green;
  if (n >= 0) return C.amber;
  return C.red;
}

function turnoverColor(n: number | null | undefined): string | undefined {
  if (n === null || n === undefined) return undefined;
  return n > 15 ? C.red : undefined;
}

/** Numeric field → number|undefined for optional server-action inputs. */
function numOrUndefined(v: string): number | undefined {
  const t = v.trim();
  if (t === "") return undefined;
  const n = Number(t);
  return Number.isNaN(n) ? undefined : n;
}

export function OperationsTab({
  entityId,
  period,
  canWrite,
  staff,
  customer,
  metricDefs,
  opsMetrics,
}: {
  entityId: string;
  period: string;
  canWrite: boolean;
  staff: StaffHappinessRow[];
  customer: CustomerHappinessRow[];
  metricDefs: MetricDefinitionRow[];
  opsMetrics: OpsMetricRow[];
}) {
  const router = useRouter();

  // Staff happiness add form
  const [staffPeriod, setStaffPeriod] = useState(period);
  const [staffLocation, setStaffLocation] = useState("");
  const [staffEnps, setStaffEnps] = useState("");
  const [staffPulse, setStaffPulse] = useState("");
  const [staffTurnover, setStaffTurnover] = useState("");
  const [staffAbsenteeism, setStaffAbsenteeism] = useState("");
  const [staffTraining, setStaffTraining] = useState("");

  // Customer happiness add form
  const [custPeriod, setCustPeriod] = useState(period);
  const [custLocation, setCustLocation] = useState("");
  const [custNps, setCustNps] = useState("");
  const [custCsat, setCustCsat] = useState("");
  const [custGoogleRating, setCustGoogleRating] = useState("");
  const [custGoogleReviews, setCustGoogleReviews] = useState("");
  const [custComplaints, setCustComplaints] = useState("");
  const [custAvgResolution, setCustAvgResolution] = useState("");
  const [custUnresolved48h, setCustUnresolved48h] = useState("");
  const [custRepeatRate, setCustRepeatRate] = useState("");

  // Ops metrics — per-row pending input + error
  const [metricValues, setMetricValues] = useState<Record<string, string>>({});
  const [metricSaving, setMetricSaving] = useState<Record<string, boolean>>({});
  const [metricError, setMetricError] = useState<string | null>(null);

  const latestStaff = staff[0] ?? null;
  const latestCustomer = customer[0] ?? null;
  const opsByCode = new Map(opsMetrics.map((m) => [m.metric_code, m]));

  async function saveMetric(def: MetricDefinitionRow) {
    const raw = metricValues[def.code];
    if (raw === undefined || raw.trim() === "") return;
    const value = Number(raw);
    if (Number.isNaN(value)) {
      setMetricError(`${def.name}: enter a valid number`);
      return;
    }
    setMetricError(null);
    setMetricSaving((s) => ({ ...s, [def.code]: true }));
    const res = await upsertOpsMetric({
      entity_id: entityId,
      metric_code: def.code,
      period_start: period,
      value,
    });
    setMetricSaving((s) => ({ ...s, [def.code]: false }));
    if (!res.ok) {
      setMetricError(res.error);
      return;
    }
    setMetricValues((v) => ({ ...v, [def.code]: "" }));
    router.refresh();
  }

  function metricValueColor(
    current: number | null,
    def: MetricDefinitionRow,
  ): string | undefined {
    if (
      current === null ||
      def.default_target === null ||
      def.default_target === 0
    )
      return undefined;
    const ratio = current / def.default_target;
    const lowerBetter = def.direction === "lower_better";
    // "within 100% of target" = at/better than target; "within 70%" = amber band.
    if (lowerBetter) {
      if (ratio <= 1) return C.green;
      if (ratio <= 1 / 0.7) return C.amber;
      return C.red;
    }
    if (ratio >= 1) return C.green;
    if (ratio >= 0.7) return C.amber;
    return C.red;
  }

  return (
    <div>
      {/* ═══ STAFF HAPPINESS ═══ */}
      <SectionCard
        title="Staff Happiness Metrics"
        note="Aggregates only — individual survey answers never enter this system (PDPA)"
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <Stat
            label="eNPS"
            value={fmtSigned(latestStaff?.enps)}
            tone={
              latestStaff?.enps === null || latestStaff?.enps === undefined
                ? undefined
                : latestStaff.enps >= 30
                  ? "good"
                  : latestStaff.enps >= 0
                    ? "warn"
                    : "bad"
            }
          />
          <Stat
            label="Pulse Score"
            value={`${fmtNum(latestStaff?.pulse_score, 1)}/10`}
          />
          <Stat
            label="Turnover"
            value={fmtPct(latestStaff?.turnover_rate)}
            tone={
              latestStaff?.turnover_rate !== null &&
              latestStaff?.turnover_rate !== undefined &&
              latestStaff.turnover_rate > 15
                ? "bad"
                : undefined
            }
          />
          <Stat
            label="Absenteeism"
            value={fmtPct(latestStaff?.absenteeism_rate)}
          />
          <Stat
            label="Training Hours"
            value={fmtNum(latestStaff?.training_hours, 1)}
          />
        </div>

        {staff.length > 0 ? (
          <Table
            head={[
              "Period",
              "Location",
              "eNPS",
              "Pulse",
              "Turnover %",
              "Absenteeism %",
              "Training hrs",
            ]}
          >
            {staff.map((row) => (
              <tr key={row.id}>
                <Td>{row.period_start}</Td>
                <Td>{row.location ?? "All"}</Td>
                <Td right color={enpsColor(row.enps)}>
                  {fmtSigned(row.enps)}
                </Td>
                <Td right>{fmtNum(row.pulse_score, 1)}</Td>
                <Td right color={turnoverColor(row.turnover_rate)}>
                  {fmtPct(row.turnover_rate)}
                </Td>
                <Td right>{fmtPct(row.absenteeism_rate)}</Td>
                <Td right>{fmtNum(row.training_hours, 1)}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <div style={{ color: C.dim, fontSize: 13 }}>
            No staff happiness data yet.
          </div>
        )}

        {canWrite ? (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <ActionForm
              submitLabel="Add Entry"
              onSubmit={async () => {
                const res = await addStaffHappiness({
                  entity_id: entityId,
                  period_start: staffPeriod,
                  location: staffLocation.trim() || undefined,
                  enps: numOrUndefined(staffEnps),
                  pulse_score: numOrUndefined(staffPulse),
                  turnover_rate: numOrUndefined(staffTurnover),
                  absenteeism_rate: numOrUndefined(staffAbsenteeism),
                  training_hours: numOrUndefined(staffTraining),
                });
                return res;
              }}
              onDone={() => {
                setStaffLocation("");
                setStaffEnps("");
                setStaffPulse("");
                setStaffTurnover("");
                setStaffAbsenteeism("");
                setStaffTraining("");
                router.refresh();
              }}
            >
              <FormGrid>
                <Field label="Period start" width={150}>
                  <TextInput
                    type="date"
                    value={staffPeriod}
                    onChange={(e) => setStaffPeriod(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Location">
                  <TextInput
                    placeholder="All"
                    value={staffLocation}
                    onChange={(e) => setStaffLocation(e.target.value)}
                  />
                </Field>
                <Field label="eNPS" width={100}>
                  <NumInput
                    value={staffEnps}
                    onChange={(e) => setStaffEnps(e.target.value)}
                  />
                </Field>
                <Field label="Pulse /10" width={100}>
                  <NumInput
                    value={staffPulse}
                    onChange={(e) => setStaffPulse(e.target.value)}
                  />
                </Field>
                <Field label="Turnover %" width={110}>
                  <NumInput
                    value={staffTurnover}
                    onChange={(e) => setStaffTurnover(e.target.value)}
                  />
                </Field>
                <Field label="Absenteeism %" width={120}>
                  <NumInput
                    value={staffAbsenteeism}
                    onChange={(e) => setStaffAbsenteeism(e.target.value)}
                  />
                </Field>
                <Field label="Training hrs" width={110}>
                  <NumInput
                    value={staffTraining}
                    onChange={(e) => setStaffTraining(e.target.value)}
                  />
                </Field>
              </FormGrid>
            </ActionForm>
          </div>
        ) : (
          <div style={{ color: C.dim, fontSize: 12, marginTop: 12 }}>
            Ops role required to enter data.
          </div>
        )}
      </SectionCard>

      {/* ═══ CUSTOMER HAPPINESS ═══ */}
      <SectionCard title="Customer Happiness Metrics">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))",
            gap: 10,
            marginBottom: 18,
          }}
        >
          <Stat
            label="NPS"
            value={fmtSigned(latestCustomer?.nps)}
            tone={
              latestCustomer?.nps === null || latestCustomer?.nps === undefined
                ? undefined
                : latestCustomer.nps >= 30
                  ? "good"
                  : latestCustomer.nps >= 0
                    ? "warn"
                    : "bad"
            }
          />
          <Stat label="CSAT" value={fmtPct(latestCustomer?.csat)} />
          <Stat
            label="Google Rating"
            value={`${fmtNum(latestCustomer?.google_rating, 1)}/5`}
            sub={
              latestCustomer?.google_review_count !== null &&
              latestCustomer?.google_review_count !== undefined
                ? `${fmtNum(latestCustomer.google_review_count)} reviews`
                : undefined
            }
          />
          <Stat
            label="Complaints"
            value={fmtNum(latestCustomer?.complaints_count)}
            sub={
              latestCustomer?.unresolved_48h_count !== null &&
              latestCustomer?.unresolved_48h_count !== undefined &&
              latestCustomer.unresolved_48h_count > 0
                ? `${fmtNum(latestCustomer.unresolved_48h_count)} unresolved 48h`
                : undefined
            }
            tone={
              latestCustomer?.unresolved_48h_count !== null &&
              latestCustomer?.unresolved_48h_count !== undefined &&
              latestCustomer.unresolved_48h_count > 0
                ? "bad"
                : undefined
            }
          />
          <Stat
            label="Avg Resolution"
            value={`${fmtNum(latestCustomer?.avg_resolution_hours, 1)} hrs`}
          />
          <Stat
            label="Repeat Rate"
            value={fmtPct(latestCustomer?.repeat_rate)}
          />
        </div>

        {customer.length > 0 ? (
          <Table
            head={[
              "Period",
              "Location",
              "NPS",
              "CSAT",
              "Google",
              "Complaints",
              "Unresolved 48h",
              "Avg res hrs",
              "Repeat %",
            ]}
          >
            {customer.map((row) => (
              <tr key={row.id}>
                <Td>{row.period_start}</Td>
                <Td>{row.location ?? "All"}</Td>
                <Td right color={enpsColor(row.nps)}>
                  {fmtSigned(row.nps)}
                </Td>
                <Td right>{fmtPct(row.csat)}</Td>
                <Td right>
                  {fmtNum(row.google_rating, 1)}
                  {row.google_review_count !== null
                    ? ` (${fmtNum(row.google_review_count)})`
                    : ""}
                </Td>
                <Td right>{fmtNum(row.complaints_count)}</Td>
                <Td
                  right
                  color={
                    row.unresolved_48h_count && row.unresolved_48h_count > 0
                      ? C.red
                      : undefined
                  }
                >
                  {fmtNum(row.unresolved_48h_count)}
                </Td>
                <Td right>{fmtNum(row.avg_resolution_hours, 1)}</Td>
                <Td right>{fmtPct(row.repeat_rate)}</Td>
              </tr>
            ))}
          </Table>
        ) : (
          <div style={{ color: C.dim, fontSize: 13 }}>
            No customer happiness data yet.
          </div>
        )}

        {canWrite ? (
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: `1px solid ${C.line}`,
            }}
          >
            <ActionForm
              submitLabel="Add Entry"
              onSubmit={async () => {
                const res = await addCustomerHappiness({
                  entity_id: entityId,
                  period_start: custPeriod,
                  location: custLocation.trim() || undefined,
                  nps: numOrUndefined(custNps),
                  csat: numOrUndefined(custCsat),
                  google_rating: numOrUndefined(custGoogleRating),
                  google_review_count: numOrUndefined(custGoogleReviews),
                  complaints_count: numOrUndefined(custComplaints),
                  avg_resolution_hours: numOrUndefined(custAvgResolution),
                  unresolved_48h_count: numOrUndefined(custUnresolved48h),
                  repeat_rate: numOrUndefined(custRepeatRate),
                });
                return res;
              }}
              onDone={() => {
                setCustLocation("");
                setCustNps("");
                setCustCsat("");
                setCustGoogleRating("");
                setCustGoogleReviews("");
                setCustComplaints("");
                setCustAvgResolution("");
                setCustUnresolved48h("");
                setCustRepeatRate("");
                router.refresh();
              }}
            >
              <FormGrid>
                <Field label="Period start" width={150}>
                  <TextInput
                    type="date"
                    value={custPeriod}
                    onChange={(e) => setCustPeriod(e.target.value)}
                    required
                  />
                </Field>
                <Field label="Location">
                  <TextInput
                    placeholder="All"
                    value={custLocation}
                    onChange={(e) => setCustLocation(e.target.value)}
                  />
                </Field>
                <Field label="NPS" width={90}>
                  <NumInput
                    value={custNps}
                    onChange={(e) => setCustNps(e.target.value)}
                  />
                </Field>
                <Field label="CSAT %" width={100}>
                  <NumInput
                    value={custCsat}
                    onChange={(e) => setCustCsat(e.target.value)}
                  />
                </Field>
                <Field label="Google rating" width={120}>
                  <NumInput
                    value={custGoogleRating}
                    onChange={(e) => setCustGoogleRating(e.target.value)}
                  />
                </Field>
                <Field label="Google reviews" width={120}>
                  <NumInput
                    value={custGoogleReviews}
                    onChange={(e) => setCustGoogleReviews(e.target.value)}
                  />
                </Field>
                <Field label="Complaints" width={100}>
                  <NumInput
                    value={custComplaints}
                    onChange={(e) => setCustComplaints(e.target.value)}
                  />
                </Field>
                <Field label="Avg resolution hrs" width={140}>
                  <NumInput
                    value={custAvgResolution}
                    onChange={(e) => setCustAvgResolution(e.target.value)}
                  />
                </Field>
                <Field label="Unresolved 48h" width={130}>
                  <NumInput
                    value={custUnresolved48h}
                    onChange={(e) => setCustUnresolved48h(e.target.value)}
                  />
                </Field>
                <Field label="Repeat rate %" width={120}>
                  <NumInput
                    value={custRepeatRate}
                    onChange={(e) => setCustRepeatRate(e.target.value)}
                  />
                </Field>
              </FormGrid>
            </ActionForm>
          </div>
        ) : (
          <div style={{ color: C.dim, fontSize: 12, marginTop: 12 }}>
            Ops role required to enter data.
          </div>
        )}
      </SectionCard>

      {/* ═══ INDUSTRY OPS METRICS ═══ */}
      <SectionCard
        title="Industry Ops Metrics"
        note="Generic report set for this venture's industry — targets are defaults, tune per venture in the KPI board"
      >
        {metricDefs.length > 0 ? (
          <Table
            head={
              canWrite
                ? [
                    "Metric",
                    "Unit",
                    "Direction",
                    "Default Target",
                    "Current",
                    "Update",
                  ]
                : ["Metric", "Unit", "Direction", "Default Target", "Current"]
            }
          >
            {metricDefs.map((def) => {
              const current = opsByCode.get(def.code)?.value ?? null;
              return (
                <tr key={def.code}>
                  <Td>{def.name}</Td>
                  <Td>{def.unit}</Td>
                  <Td color={C.dim}>
                    {def.direction === "higher_better"
                      ? "higher is better"
                      : "lower is better"}
                  </Td>
                  <Td right>
                    {def.default_target === null
                      ? "—"
                      : fmtNum(def.default_target, 2)}
                  </Td>
                  <Td
                    right
                    color={
                      metricValueColor(current, def) ??
                      (current === null ? C.dim : undefined)
                    }
                  >
                    {current === null ? "—" : fmtNum(current, 2)}
                  </Td>
                  {canWrite ? (
                    <Td right>
                      <div
                        style={{
                          display: "flex",
                          gap: 6,
                          justifyContent: "flex-end",
                        }}
                      >
                        <NumInput
                          style={{ width: 100 }}
                          value={metricValues[def.code] ?? ""}
                          onChange={(e) =>
                            setMetricValues((v) => ({
                              ...v,
                              [def.code]: e.target.value,
                            }))
                          }
                          placeholder={current === null ? "—" : String(current)}
                        />
                        <button
                          type="button"
                          disabled={!!metricSaving[def.code]}
                          onClick={() => saveMetric(def)}
                          style={{
                            background: C.panel2,
                            border: `1px solid ${C.line}`,
                            color: C.text,
                            borderRadius: 7,
                            padding: "5px 10px",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: metricSaving[def.code] ? "wait" : "pointer",
                            opacity: metricSaving[def.code] ? 0.6 : 1,
                          }}
                        >
                          {metricSaving[def.code] ? "…" : "Save"}
                        </button>
                      </div>
                    </Td>
                  ) : null}
                </tr>
              );
            })}
          </Table>
        ) : (
          <div style={{ color: C.dim, fontSize: 13 }}>
            No industry metric definitions configured for this venture.
          </div>
        )}
        {metricError ? (
          <div style={{ color: C.red, fontSize: 12, marginTop: 10 }}>
            {metricError}
          </div>
        ) : null}
        {!canWrite ? (
          <div style={{ color: C.dim, fontSize: 12, marginTop: 12 }}>
            Ops role required to enter data.
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}
