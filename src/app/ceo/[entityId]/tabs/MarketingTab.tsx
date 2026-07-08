"use client";

/**
 * CEO Business Dashboard — Sales & Marketing tab.
 * Sales funnel (what-if calculator), 10x10 marketing strategies, channel analytics.
 */

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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
} from "@/app/ceo/_components/ui";
import { C } from "@/app/_components/dashboard-primitives";
import {
  computeFunnel,
  strategyCountStatus,
  MIN_ACTIVE_STRATEGIES,
} from "@/lib/ceo-dashboard/formulas";
import type { Granularity } from "@/lib/ceo-dashboard/periods";
import { periodLabel } from "@/lib/ceo-dashboard/periods";
import {
  fmtMoney,
  fmtNum,
  fmtPct,
  CHANNEL_LABELS,
  type FunnelRow,
  type StrategyRow,
  type ChannelMetricRow,
  type MarketingChannel,
} from "@/lib/ceo-dashboard/types";
import {
  upsertFunnel,
  upsertStrategy,
  deleteStrategy,
  upsertChannelMetric,
} from "@/server/actions/ceo";

const STATUS_COLOR: Record<StrategyRow["status"], string> = {
  active: C.green,
  planned: C.dim,
  paused: C.amber,
  completed: C.blue,
  killed: C.red,
};

const STRATEGY_STATUSES: StrategyRow["status"][] = [
  "planned",
  "active",
  "paused",
  "completed",
  "killed",
];

const CHANNEL_ORDER: MarketingChannel[] = [
  "facebook",
  "instagram",
  "linkedin",
  "tiktok",
  "threads",
  "website",
  "seo",
  "email",
  "whatsapp",
  "telegram",
  "referral",
  "alliances",
];

type FunnelForm = {
  total_reach: string;
  cr1: string;
  cr2: string;
  avg_sale: string;
  txn_per_customer: string;
  gp_pct: string;
  opex_ref: string;
};

function funnelFormFrom(funnel: FunnelRow | null): FunnelForm {
  return {
    total_reach: String(funnel?.total_reach ?? 0),
    cr1: String((funnel?.cr1 ?? 0) * 100),
    cr2: String((funnel?.cr2 ?? 0) * 100),
    avg_sale: String(funnel?.avg_sale ?? 0),
    txn_per_customer: String(funnel?.txn_per_customer ?? 1),
    gp_pct: String((funnel?.gp_pct ?? 0) * 100),
    opex_ref: String(funnel?.opex_ref ?? 0),
  };
}

type StrategyForm = {
  name: string;
  channel: string;
  status: StrategyRow["status"];
  budget: string;
  cost_spent: string;
  start_date: string;
  end_date: string;
  target_leads: string;
  target_sales: string;
  actual_leads: string;
  actual_sales: string;
};

const EMPTY_STRATEGY_FORM: StrategyForm = {
  name: "",
  channel: "",
  status: "planned",
  budget: "0",
  cost_spent: "0",
  start_date: "",
  end_date: "",
  target_leads: "0",
  target_sales: "0",
  actual_leads: "0",
  actual_sales: "0",
};

function strategyFormFrom(row: StrategyRow): StrategyForm {
  return {
    name: row.name,
    channel: row.channel ?? "",
    status: row.status,
    budget: String(row.budget),
    cost_spent: String(row.cost_spent),
    start_date: row.start_date ?? "",
    end_date: row.end_date ?? "",
    target_leads: String(row.target_leads),
    target_sales: String(row.target_sales),
    actual_leads: String(row.actual_leads),
    actual_sales: String(row.actual_sales),
  };
}

type ChannelForm = {
  reach: string;
  followers: string;
  engagement_rate: string;
  clicks: string;
  leads: string;
  cost: string;
  customers: string;
  revenue: string;
};

const EMPTY_CHANNEL_FORM: ChannelForm = {
  reach: "0",
  followers: "0",
  engagement_rate: "0",
  clicks: "0",
  leads: "0",
  cost: "0",
  customers: "0",
  revenue: "0",
};

function channelFormFrom(row: ChannelMetricRow | undefined): ChannelForm {
  if (!row) return EMPTY_CHANNEL_FORM;
  return {
    reach: String(row.reach),
    followers: String(row.followers),
    engagement_rate: String(row.engagement_rate ?? 0),
    clicks: String(row.clicks),
    leads: String(row.leads),
    cost: String(row.cost),
    customers: String(row.customers),
    revenue: String(row.revenue),
  };
}

function FunnelBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      style={{
        background: C.panel2,
        border: `1px solid ${C.line}`,
        borderRadius: 10,
        padding: "12px 14px",
        minWidth: 130,
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: C.dim,
          textTransform: "uppercase",
          letterSpacing: "0.05em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 19,
          fontWeight: 700,
          marginTop: 5,
          fontVariantNumeric: "tabular-nums",
          color: color ?? C.text,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function FunnelOperator({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        color: C.dim,
        fontSize: 12,
        fontWeight: 600,
        padding: "0 4px",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </div>
  );
}

export function MarketingTab({
  entityId,
  currency,
  period,
  granularity,
  canWrite,
  canWriteChannels,
  funnel,
  strategies,
  channels,
}: {
  entityId: string;
  currency: string;
  period: string;
  granularity: Granularity;
  canWrite: boolean;
  canWriteChannels: boolean;
  funnel: FunnelRow | null;
  strategies: StrategyRow[];
  channels: ChannelMetricRow[];
}) {
  const router = useRouter();

  /* ─── Sales funnel / what-if ─── */
  const [funnelForm, setFunnelForm] = useState<FunnelForm>(() =>
    funnelFormFrom(funnel),
  );

  const funnelNums = useMemo(() => {
    const n = (s: string) => {
      const v = Number(s);
      return Number.isFinite(v) ? v : 0;
    };
    return {
      totalReach: n(funnelForm.total_reach),
      cr1: n(funnelForm.cr1) / 100,
      cr2: n(funnelForm.cr2) / 100,
      avgSale: n(funnelForm.avg_sale),
      txnPerCustomer: n(funnelForm.txn_per_customer),
      gpPct: n(funnelForm.gp_pct) / 100,
      opexRef: n(funnelForm.opex_ref),
    };
  }, [funnelForm]);

  const funnelResult = useMemo(() => computeFunnel(funnelNums), [funnelNums]);

  const isDirty = useMemo(() => {
    if (!funnel) return true;
    const saved = funnelFormFrom(funnel);
    return (Object.keys(saved) as (keyof FunnelForm)[]).some(
      (k) => saved[k] !== funnelForm[k],
    );
  }, [funnel, funnelForm]);

  function setFunnelField(key: keyof FunnelForm, value: string) {
    setFunnelForm((f) => ({ ...f, [key]: value }));
  }

  async function saveFunnel() {
    return upsertFunnel({
      entity_id: entityId,
      period_start: period,
      granularity,
      total_reach: funnelNums.totalReach,
      cr1: funnelNums.cr1,
      cr2: funnelNums.cr2,
      avg_sale: funnelNums.avgSale,
      txn_per_customer: funnelNums.txnPerCustomer,
      gp_pct: funnelNums.gpPct,
      opex_ref: funnelNums.opexRef,
    });
  }

  /* ─── Strategies ─── */
  const [strategyForm, setStrategyForm] =
    useState<StrategyForm>(EMPTY_STRATEGY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activeCount = strategies.filter((s) => s.status === "active").length;
  const statusCounts = STRATEGY_STATUSES.reduce<Record<string, number>>(
    (acc, s) => {
      acc[s] = strategies.filter((row) => row.status === s).length;
      return acc;
    },
    {},
  );

  function startEdit(row: StrategyRow) {
    setEditingId(row.id);
    setStrategyForm(strategyFormFrom(row));
  }

  function cancelEdit() {
    setEditingId(null);
    setStrategyForm(EMPTY_STRATEGY_FORM);
  }

  async function saveStrategy() {
    const res = await upsertStrategy({
      id: editingId ?? undefined,
      entity_id: entityId,
      name: strategyForm.name,
      channel: strategyForm.channel || null,
      status: strategyForm.status,
      budget: Number(strategyForm.budget),
      cost_spent: Number(strategyForm.cost_spent),
      start_date: strategyForm.start_date || null,
      end_date: strategyForm.end_date || null,
      target_leads: Number(strategyForm.target_leads),
      target_sales: Number(strategyForm.target_sales),
      actual_leads: Number(strategyForm.actual_leads),
      actual_sales: Number(strategyForm.actual_sales),
    });
    if (res.ok) cancelEdit();
    return res;
  }

  async function handleDeleteStrategy(id: string) {
    if (!window.confirm("Delete this strategy?")) return;
    await deleteStrategy(id);
    router.refresh();
  }

  /* ─── Channels ─── */
  const [editingChannel, setEditingChannel] = useState<MarketingChannel | null>(
    null,
  );
  const [channelForm, setChannelForm] =
    useState<ChannelForm>(EMPTY_CHANNEL_FORM);
  const channelByKey = new Map(channels.map((c) => [c.channel, c]));

  function startEditChannel(ch: MarketingChannel) {
    setEditingChannel(ch);
    setChannelForm(channelFormFrom(channelByKey.get(ch)));
  }

  async function saveChannel() {
    if (!editingChannel)
      return { ok: false as const, error: "No channel selected" };
    const res = await upsertChannelMetric({
      entity_id: entityId,
      channel: editingChannel,
      period_start: period,
      granularity,
      reach: Number(channelForm.reach),
      followers: Number(channelForm.followers),
      engagement_rate: Number(channelForm.engagement_rate),
      clicks: Number(channelForm.clicks),
      leads: Number(channelForm.leads),
      cost: Number(channelForm.cost),
      customers: Number(channelForm.customers),
      revenue: Number(channelForm.revenue),
      extras: {},
    });
    if (res.ok) setEditingChannel(null);
    return res;
  }

  return (
    <div>
      {/* ═══ 1. Sales Funnel ═══ */}
      <SectionCard
        title="Sales Funnel"
        note="Total Reach × CR1 = Prospects × CR2 = Customers × Avg Sale × Txn = Sales × GP% = Gross Profit − OPEX = EBITDA"
      >
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: 6,
            marginBottom: 16,
          }}
        >
          <FunnelBox
            label="Total Reach"
            value={fmtNum(
              funnelResult.prospects === 0
                ? funnelNums.totalReach
                : funnelNums.totalReach,
            )}
          />
          <FunnelOperator>{`×${fmtPct(funnelNums.cr1 * 100)} →`}</FunnelOperator>
          <FunnelBox label="Prospects" value={fmtNum(funnelResult.prospects)} />
          <FunnelOperator>{`×${fmtPct(funnelNums.cr2 * 100)} →`}</FunnelOperator>
          <FunnelBox label="Customers" value={fmtNum(funnelResult.customers)} />
          <FunnelOperator>{`×${fmtMoney(funnelNums.avgSale, currency)} × ${fmtNum(funnelNums.txnPerCustomer, 1)} →`}</FunnelOperator>
          <FunnelBox
            label="Sales"
            value={fmtMoney(funnelResult.sales, currency)}
          />
          <FunnelOperator>{`×${fmtPct(funnelNums.gpPct * 100)} →`}</FunnelOperator>
          <FunnelBox
            label="Gross Profit"
            value={fmtMoney(funnelResult.grossProfit, currency)}
          />
          <FunnelOperator>{`−${fmtMoney(funnelNums.opexRef, currency)} →`}</FunnelOperator>
          <FunnelBox
            label="EBITDA"
            value={fmtMoney(funnelResult.ebitda, currency)}
            color={funnelResult.ebitda >= 0 ? C.green : C.red}
          />
        </div>

        {funnel ? (
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>
            Saved for {periodLabel(period, granularity)}: Sales{" "}
            {fmtMoney(funnel.sales, currency)} · EBITDA{" "}
            {fmtMoney(funnel.ebitda, currency)}
            {isDirty ? (
              <span style={{ color: C.amber, marginLeft: 8 }}>
                what-if (unsaved)
              </span>
            ) : null}
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.dim, marginBottom: 12 }}>
            No saved funnel for {periodLabel(period, granularity)} — figures
            below are a live what-if
          </div>
        )}

        <FormGrid>
          <Field label="Total reach">
            <NumInput
              value={funnelForm.total_reach}
              onChange={(e) => setFunnelField("total_reach", e.target.value)}
              disabled={!canWrite}
            />
          </Field>
          <Field label="CR1 — reach→prospect %">
            <NumInput
              value={funnelForm.cr1}
              onChange={(e) => setFunnelField("cr1", e.target.value)}
              disabled={!canWrite}
            />
          </Field>
          <Field label="CR2 — prospect→customer %">
            <NumInput
              value={funnelForm.cr2}
              onChange={(e) => setFunnelField("cr2", e.target.value)}
              disabled={!canWrite}
            />
          </Field>
          <Field label={`Avg sale (${currency})`}>
            <NumInput
              value={funnelForm.avg_sale}
              onChange={(e) => setFunnelField("avg_sale", e.target.value)}
              disabled={!canWrite}
            />
          </Field>
          <Field label="Txn per customer">
            <NumInput
              value={funnelForm.txn_per_customer}
              onChange={(e) =>
                setFunnelField("txn_per_customer", e.target.value)
              }
              disabled={!canWrite}
            />
          </Field>
          <Field label="GP %">
            <NumInput
              value={funnelForm.gp_pct}
              onChange={(e) => setFunnelField("gp_pct", e.target.value)}
              disabled={!canWrite}
            />
          </Field>
          <Field label={`OPEX ref (${currency})`}>
            <NumInput
              value={funnelForm.opex_ref}
              onChange={(e) => setFunnelField("opex_ref", e.target.value)}
              disabled={!canWrite}
            />
          </Field>
        </FormGrid>

        {canWrite ? (
          <div style={{ marginTop: 12 }}>
            <ActionForm
              onSubmit={saveFunnel}
              submitLabel="Save funnel"
              onDone={() => router.refresh()}
            />
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.dim, marginTop: 12 }}>
            Marketing role required to enter data. The chain above still updates
            live as a what-if calculator.
          </div>
        )}
      </SectionCard>

      {/* ═══ 2. 10×10 Marketing Strategies ═══ */}
      <SectionCard
        title="10×10 Marketing Strategies"
        note={`${statusCounts.active ?? 0} active · ${statusCounts.planned ?? 0} planned · ${statusCounts.paused ?? 0} paused · ${statusCounts.completed ?? 0} completed · ${statusCounts.killed ?? 0} killed`}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 14,
          }}
        >
          <TrafficBadge
            status={strategyCountStatus(activeCount)}
            label={`${activeCount} of ${MIN_ACTIVE_STRATEGIES} minimum active`}
          />
        </div>

        <Table
          head={[
            "Name",
            "Channel",
            "Status",
            "Budget",
            "Spent",
            "Leads (act/tgt)",
            "Sales (act/tgt)",
            "CPA",
            "ROI",
            "",
          ]}
        >
          {strategies.length === 0 ? (
            <tr>
              <Td color={C.dim}>No strategies yet.</Td>
              <Td>{""}</Td>
              <Td>{""}</Td>
              <Td>{""}</Td>
              <Td>{""}</Td>
              <Td>{""}</Td>
              <Td>{""}</Td>
              <Td>{""}</Td>
              <Td>{""}</Td>
              <Td>{""}</Td>
            </tr>
          ) : (
            strategies.map((row) => (
              <tr key={row.id}>
                <Td>{row.name}</Td>
                <Td>{row.channel ?? "—"}</Td>
                <Td color={STATUS_COLOR[row.status]}>{row.status}</Td>
                <Td right>{fmtMoney(row.budget, currency)}</Td>
                <Td right>{fmtMoney(row.cost_spent, currency)}</Td>
                <Td
                  right
                >{`${fmtNum(row.actual_leads)} / ${fmtNum(row.target_leads)}`}</Td>
                <Td
                  right
                >{`${fmtMoney(row.actual_sales, currency)} / ${fmtMoney(row.target_sales, currency)}`}</Td>
                <Td right>
                  {row.cpa === null ? "—" : fmtMoney(row.cpa, currency)}
                </Td>
                <Td
                  right
                  color={
                    row.roi === null
                      ? undefined
                      : row.roi >= 0
                        ? C.green
                        : C.red
                  }
                >
                  {row.roi === null ? "—" : fmtPct(row.roi * 100)}
                </Td>
                <Td right>
                  {canWrite ? (
                    <div
                      style={{
                        display: "flex",
                        gap: 6,
                        justifyContent: "flex-end",
                      }}
                    >
                      <GhostButton onClick={() => startEdit(row)}>
                        Edit
                      </GhostButton>
                      <GhostButton
                        danger
                        onClick={() => handleDeleteStrategy(row.id)}
                      >
                        Delete
                      </GhostButton>
                    </div>
                  ) : null}
                </Td>
              </tr>
            ))
          )}
        </Table>

        {canWrite ? (
          <div style={{ marginTop: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              {editingId ? "Edit strategy" : "Add strategy"}
            </div>
            <FormGrid>
              <Field label="Name">
                <TextInput
                  value={strategyForm.name}
                  onChange={(e) =>
                    setStrategyForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </Field>
              <Field label="Channel">
                <TextInput
                  value={strategyForm.channel}
                  onChange={(e) =>
                    setStrategyForm((f) => ({ ...f, channel: e.target.value }))
                  }
                />
              </Field>
              <Field label="Status">
                <Select
                  value={strategyForm.status}
                  onChange={(e) =>
                    setStrategyForm((f) => ({
                      ...f,
                      status: e.target.value as StrategyRow["status"],
                    }))
                  }
                >
                  {STRATEGY_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={`Budget (${currency})`}>
                <NumInput
                  value={strategyForm.budget}
                  onChange={(e) =>
                    setStrategyForm((f) => ({ ...f, budget: e.target.value }))
                  }
                />
              </Field>
              <Field label={`Spent (${currency})`}>
                <NumInput
                  value={strategyForm.cost_spent}
                  onChange={(e) =>
                    setStrategyForm((f) => ({
                      ...f,
                      cost_spent: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Start date">
                <TextInput
                  type="date"
                  value={strategyForm.start_date}
                  onChange={(e) =>
                    setStrategyForm((f) => ({
                      ...f,
                      start_date: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="End date">
                <TextInput
                  type="date"
                  value={strategyForm.end_date}
                  onChange={(e) =>
                    setStrategyForm((f) => ({ ...f, end_date: e.target.value }))
                  }
                />
              </Field>
              <Field label="Target leads">
                <NumInput
                  value={strategyForm.target_leads}
                  onChange={(e) =>
                    setStrategyForm((f) => ({
                      ...f,
                      target_leads: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={`Target sales (${currency})`}>
                <NumInput
                  value={strategyForm.target_sales}
                  onChange={(e) =>
                    setStrategyForm((f) => ({
                      ...f,
                      target_sales: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Actual leads">
                <NumInput
                  value={strategyForm.actual_leads}
                  onChange={(e) =>
                    setStrategyForm((f) => ({
                      ...f,
                      actual_leads: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={`Actual sales (${currency})`}>
                <NumInput
                  value={strategyForm.actual_sales}
                  onChange={(e) =>
                    setStrategyForm((f) => ({
                      ...f,
                      actual_sales: e.target.value,
                    }))
                  }
                />
              </Field>
            </FormGrid>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <ActionForm
                onSubmit={saveStrategy}
                submitLabel={editingId ? "Save changes" : "Add strategy"}
                onDone={() => router.refresh()}
              />
              {editingId ? (
                <GhostButton onClick={cancelEdit}>Cancel edit</GhostButton>
              ) : null}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 12, color: C.dim, marginTop: 12 }}>
            Marketing role required to enter data.
          </div>
        )}
      </SectionCard>

      {/* ═══ 3. Channel Analytics ═══ */}
      <SectionCard
        title="Channel Analytics"
        note={`Key marketing metrics per channel for ${periodLabel(period, granularity)}`}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
          {CHANNEL_ORDER.map((ch) => {
            const row = channelByKey.get(ch);
            return (
              <div
                key={ch}
                style={{
                  width: 260,
                  background: C.panel,
                  border: `1px solid ${C.line}`,
                  borderRadius: 10,
                  padding: 14,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: 8,
                  }}
                >
                  <div style={{ fontWeight: 700, fontSize: 13 }}>
                    {CHANNEL_LABELS[ch]}
                  </div>
                  {canWriteChannels ? (
                    <GhostButton onClick={() => startEditChannel(ch)}>
                      {row ? "Edit" : "Enter data"}
                    </GhostButton>
                  ) : null}
                </div>
                {row ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    <ChannelStatRow k="Reach" v={fmtNum(row.reach)} />
                    <ChannelStatRow k="Followers" v={fmtNum(row.followers)} />
                    <ChannelStatRow
                      k="Engagement"
                      v={
                        row.engagement_rate === null
                          ? "—"
                          : fmtPct(row.engagement_rate)
                      }
                    />
                    <ChannelStatRow k="Clicks" v={fmtNum(row.clicks)} />
                    <ChannelStatRow k="Leads" v={fmtNum(row.leads)} />
                    <ChannelStatRow k="Cost" v={fmtMoney(row.cost, currency)} />
                    <ChannelStatRow k="Customers" v={fmtNum(row.customers)} />
                    <ChannelStatRow
                      k="Revenue"
                      v={fmtMoney(row.revenue, currency)}
                    />
                    <ChannelStatRow
                      k="CPL"
                      v={row.cpl === null ? "—" : fmtMoney(row.cpl, currency)}
                    />
                    <ChannelStatRow
                      k="ROI"
                      v={row.roi === null ? "—" : fmtPct(row.roi * 100)}
                      color={
                        row.roi === null
                          ? undefined
                          : row.roi >= 0
                            ? C.green
                            : C.red
                      }
                    />
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: C.dim }}>
                    No data this period
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {canWriteChannels && editingChannel ? (
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>
              Enter data — {CHANNEL_LABELS[editingChannel]} (
              {periodLabel(period, granularity)})
            </div>
            <FormGrid>
              <Field label="Reach">
                <NumInput
                  value={channelForm.reach}
                  onChange={(e) =>
                    setChannelForm((f) => ({ ...f, reach: e.target.value }))
                  }
                />
              </Field>
              <Field label="Followers">
                <NumInput
                  value={channelForm.followers}
                  onChange={(e) =>
                    setChannelForm((f) => ({
                      ...f,
                      followers: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Engagement rate %">
                <NumInput
                  value={channelForm.engagement_rate}
                  onChange={(e) =>
                    setChannelForm((f) => ({
                      ...f,
                      engagement_rate: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label="Clicks">
                <NumInput
                  value={channelForm.clicks}
                  onChange={(e) =>
                    setChannelForm((f) => ({ ...f, clicks: e.target.value }))
                  }
                />
              </Field>
              <Field label="Leads">
                <NumInput
                  value={channelForm.leads}
                  onChange={(e) =>
                    setChannelForm((f) => ({ ...f, leads: e.target.value }))
                  }
                />
              </Field>
              <Field label={`Cost (${currency})`}>
                <NumInput
                  value={channelForm.cost}
                  onChange={(e) =>
                    setChannelForm((f) => ({ ...f, cost: e.target.value }))
                  }
                />
              </Field>
              <Field label="Customers">
                <NumInput
                  value={channelForm.customers}
                  onChange={(e) =>
                    setChannelForm((f) => ({
                      ...f,
                      customers: e.target.value,
                    }))
                  }
                />
              </Field>
              <Field label={`Revenue (${currency})`}>
                <NumInput
                  value={channelForm.revenue}
                  onChange={(e) =>
                    setChannelForm((f) => ({ ...f, revenue: e.target.value }))
                  }
                />
              </Field>
            </FormGrid>
            <div
              style={{
                marginTop: 10,
                display: "flex",
                gap: 10,
                alignItems: "center",
              }}
            >
              <ActionForm
                onSubmit={saveChannel}
                submitLabel="Save channel data"
                onDone={() => router.refresh()}
              />
              <GhostButton onClick={() => setEditingChannel(null)}>
                Cancel
              </GhostButton>
            </div>
          </div>
        ) : null}

        {!canWriteChannels ? (
          <div style={{ fontSize: 12, color: C.dim, marginTop: 12 }}>
            Marketing role required to enter data.
          </div>
        ) : null}
      </SectionCard>
    </div>
  );
}

function ChannelStatRow({
  k,
  v,
  color,
}: {
  k: string;
  v: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        fontSize: 12,
      }}
    >
      <span style={{ color: C.dim }}>{k}</span>
      <span style={{ color: color ?? C.text, fontWeight: 600 }}>{v}</span>
    </div>
  );
}
