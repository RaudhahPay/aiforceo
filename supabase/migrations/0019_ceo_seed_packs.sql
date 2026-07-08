-- =========================================================
-- 0019_ceo_seed_packs.sql — CEO Dashboard: industry seed packs
-- Fills the Stage 1 gap: per-industry ops metric catalogs and
-- industry-default KPI definitions (entity_id null) that the
-- evaluator applies to every entity of that industry unless the
-- entity overrides a definition with the same name.
-- Additive + idempotent (re-runnable).
-- =========================================================

-- =========================================================
-- Metric catalog — additions per industry
-- =========================================================
insert into public.ceo_metric_definitions (code, name, industry_type, unit, direction, default_target) values
  -- F&B
  ('fnb_wastage_pct',        'Wastage %',                 'fnb',        '%',      'lower_better',  5),
  ('fnb_avg_ticket',         'Average ticket (RM)',       'fnb',        'RM',     'higher_better', null),
  ('fnb_sales_per_labour_h', 'Sales per labour hour',     'fnb',        'RM',     'higher_better', null),
  -- Education
  ('edu_retention_pct',      'Student retention %',       'education',  '%',      'higher_better', 90),
  ('edu_teacher_turnover',   'Teacher turnover %',        'education',  '%',      'lower_better',  15),
  -- Healthcare
  ('hc_avg_wait_mins',       'Average wait time (mins)',  'healthcare', 'mins',   'lower_better',  30),
  ('hc_readmission_pct',     'Readmission rate %',        'healthcare', '%',      'lower_better',  10),
  -- Tech / SaaS
  ('saas_mrr_growth_pct',    'MRR growth %',              'tech_saas',  '%',      'higher_better', 10),
  ('saas_nrr_pct',           'Net revenue retention %',   'tech_saas',  '%',      'higher_better', 100),
  ('saas_cac_payback_m',     'CAC payback (months)',      'tech_saas',  'months', 'lower_better',  12),
  -- Retail / e-commerce
  ('retail_inventory_turns', 'Inventory turns (annual)',  'retail_ecommerce', 'x','higher_better', 6),
  ('retail_stockout_pct',    'Stockout rate %',           'retail_ecommerce', '%','lower_better',  5),
  ('retail_conversion_pct',  'Store/site conversion %',   'retail_ecommerce', '%','higher_better', 2),
  -- Generic / services
  ('any_utilization_pct',    'Team utilization %',        'other',      '%',      'higher_better', 70),
  ('any_on_time_pct',        'On-time delivery %',        'other',      '%',      'higher_better', 95),
  ('any_defect_pct',         'Quality defect/redo %',     'other',      '%',      'lower_better',  2)
on conflict (code) do nothing;

-- =========================================================
-- Industry-default KPI definitions.
-- Partial unique index makes the seed idempotent and prevents
-- duplicate industry defaults with the same name.
-- =========================================================
create unique index if not exists ceo_kpi_defs_industry_name_uidx
  on public.ceo_kpi_definitions (industry_type, name)
  where entity_id is null;

-- Universal defaults, one row per industry:
--   GP % (from P&L), active strategies >= 10 (critical),
--   staff eNPS, customer NPS
insert into public.ceo_kpi_definitions
  (industry_type, name, source_kind, source_ref, target, direction, weight, is_critical)
select i.industry_type, u.name, u.source_kind, u.source_ref,
       case when u.name = 'Gross profit %' then i.gp_target else u.target end,
       u.direction, u.weight, u.is_critical
from (values
  ('fnb', 65::numeric), ('education', 60::numeric), ('healthcare', 50::numeric),
  ('tech_saas', 75::numeric), ('retail_ecommerce', 35::numeric), ('other', 50::numeric)
) as i(industry_type, gp_target)
cross join (values
  ('Gross profit %',        'pnl',            'gp_pct', null::numeric, 'higher_better', 2::numeric, false),
  ('Active strategies (10x10)', 'strategy_count', null,  10::numeric,   'higher_better', 1::numeric, true),
  ('Staff eNPS',            'staff',          'enps',   30::numeric,   'higher_better', 1::numeric, false),
  ('Customer NPS',          'customer',       'nps',    50::numeric,   'higher_better', 1::numeric, false)
) as u(name, source_kind, source_ref, target, direction, weight, is_critical)
on conflict (industry_type, name) where entity_id is null do nothing;

-- Industry-specific defaults reading the ops metric catalog
insert into public.ceo_kpi_definitions
  (industry_type, name, source_kind, source_ref, target, direction, weight, is_critical)
values
  -- F&B
  ('fnb',        'Food cost %',            'ops_metric', 'fnb_food_cost_pct',   30,   'lower_better',  2, true),
  ('fnb',        'Labour cost %',          'ops_metric', 'fnb_labour_cost_pct', 25,   'lower_better',  2, false),
  ('fnb',        'Wastage %',              'ops_metric', 'fnb_wastage_pct',     5,    'lower_better',  1, false),
  -- Education
  ('education',  'Enrolment vs capacity',  'ops_metric', 'edu_enrolment_pct',   90,   'higher_better', 2, true),
  ('education',  'Fee collection %',       'ops_metric', 'edu_fee_collection',  90,   'higher_better', 2, true),
  ('education',  'Student retention %',    'ops_metric', 'edu_retention_pct',   90,   'higher_better', 1, false),
  -- Healthcare
  ('healthcare', 'Bed occupancy %',        'ops_metric', 'hc_occupancy_pct',    75,   'higher_better', 2, true),
  ('healthcare', 'Average wait (mins)',    'ops_metric', 'hc_avg_wait_mins',    30,   'lower_better',  1, false),
  ('healthcare', 'Readmission rate %',     'ops_metric', 'hc_readmission_pct',  10,   'lower_better',  1, false),
  -- Tech / SaaS
  ('tech_saas',  'Monthly churn %',        'ops_metric', 'saas_churn_pct',      3,    'lower_better',  2, true),
  ('tech_saas',  'Uptime %',               'ops_metric', 'saas_uptime_pct',     99.9, 'higher_better', 1, false),
  ('tech_saas',  'MRR growth %',           'ops_metric', 'saas_mrr_growth_pct', 10,   'higher_better', 2, false),
  -- Retail / e-commerce
  ('retail_ecommerce', 'Return rate %',    'ops_metric', 'retail_return_pct',   5,    'lower_better',  1, false),
  ('retail_ecommerce', 'Inventory turns',  'ops_metric', 'retail_inventory_turns', 6, 'higher_better', 1, false),
  ('retail_ecommerce', 'Stockout rate %',  'ops_metric', 'retail_stockout_pct', 5,    'lower_better',  1, false),
  -- Generic / services
  ('other',      'Cash runway (months)',   'ops_metric', 'any_cash_runway_m',   6,    'higher_better', 2, true),
  ('other',      'Team utilization %',     'ops_metric', 'any_utilization_pct', 70,   'higher_better', 1, false),
  ('other',      'On-time delivery %',     'ops_metric', 'any_on_time_pct',     95,   'higher_better', 1, false)
on conflict (industry_type, name) where entity_id is null do nothing;
