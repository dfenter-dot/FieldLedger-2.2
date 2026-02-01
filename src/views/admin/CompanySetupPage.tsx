import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { CompanySettings, JobType } from '../../providers/data/types';

const _fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const _fmt2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const _fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 });

type Tier = { min: number; max: number; markup_percent: number };
type Wage = { name: string; hourly_rate: number };

type ExpenseItem = {
  name: string;
  amount: number;
  frequency: 'monthly' | 'quarterly' | 'biannual' | 'annual';
};

function toNum(raw: string, fallback = 0) {
  const s = (raw ?? '').trim();
  if (s === '') return fallback;
  const n = Number(s);
  return Number.isFinite(n) ? n : fallback;
}

function toInt(raw: string, fallback = 0) {
  const s = (raw ?? '').trim();
  if (s === '') return fallback;
  const n = Math.floor(toNum(s, fallback));
  return Number.isFinite(n) ? n : fallback;
}

function avgWage(wages: Wage[]) {
  const w = wages.map((x) => Number(x.hourly_rate)).filter((x) => Number.isFinite(x) && x > 0);
  if (w.length === 0) return 0;
  return w.reduce((a, b) => a + b, 0) / w.length;
}

function freqToMonthlyMultiplier(freq: ExpenseItem['frequency']) {
  switch (freq) {
    case 'monthly':
      return 1;
    case 'quarterly':
      return 1 / 3;
    case 'biannual':
      return 1 / 6;
    case 'annual':
      return 1 / 12;
    default:
      return 1;
  }
}

function sumItemizedMonthly(items: ExpenseItem[]) {
  return (items ?? []).reduce((sum, it) => sum + (Number(it.amount) || 0) * freqToMonthlyMultiplier(it.frequency), 0);
}

export function CompanySetupPage() {
  const data = useData();
  const [s, setS] = useState<CompanySettings | null>(null);

  // Default job type (for efficiency + margin target)
  const [defaultJobType, setDefaultJobType] = useState<JobType | null>(null);

  // status line text (small text at bottom)
  const [status, setStatus] = useState<string>('');

  // Save button feedback
  const [saveUi, setSaveUi] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Numeric drafts (strings while typing) so decimals + backspace-to-empty work
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Tier drafts (aligned by index)
  const [tierDrafts, setTierDrafts] = useState<Array<{ min: string; max: string; markup_percent: string }>>([]);

  // Wage drafts (aligned by index)
  const [wageDrafts, setWageDrafts] = useState<string[]>([]);

  // Expense drafts (aligned by index)
  const [bizLumpDraft, setBizLumpDraft] = useState<string>('');
  const [perLumpDraft, setPerLumpDraft] = useState<string>('');
  const [bizItemDrafts, setBizItemDrafts] = useState<Array<{ name: string; amount: string; frequency: ExpenseItem['frequency'] }>>([]);
  const [perItemDrafts, setPerItemDrafts] = useState<Array<{ name: string; amount: string; frequency: ExpenseItem['frequency'] }>>([]);

  // Net profit drafts
  const [netProfitAmtDraft, setNetProfitAmtDraft] = useState<string>('');
  const [netProfitPctDraft, setNetProfitPctDraft] = useState<string>('');

  useEffect(() => {
    // Load settings + job types in parallel
    Promise.all([data.getCompanySettings(), data.listJobTypes()])
      .then(([cs, jts]) => {
        setS(cs);

        const def = (jts ?? []).find((x) => x.is_default) ?? null;
        setDefaultJobType(def);

        // core numeric drafts
        setDraft((prev) => ({
          ...prev,
          workdays_per_week: cs.workdays_per_week != null ? String(cs.workdays_per_week) : '',
          work_hours_per_day: cs.work_hours_per_day != null ? String(cs.work_hours_per_day) : '',
          technicians: cs.technicians != null ? String(cs.technicians) : '',
          avg_jobs_per_tech_per_day: cs.avg_jobs_per_tech_per_day != null ? String(cs.avg_jobs_per_tech_per_day) : '',
          vacation_days_per_year: cs.vacation_days_per_year != null ? String(cs.vacation_days_per_year) : '',
          sick_days_per_year: cs.sick_days_per_year != null ? String(cs.sick_days_per_year) : '',
          estimate_validity_days: cs.estimate_validity_days != null ? String(cs.estimate_validity_days) : '',
          starting_estimate_number: cs.starting_estimate_number != null ? String(cs.starting_estimate_number) : '',
          min_billable_labor_minutes_per_job:
            cs.min_billable_labor_minutes_per_job != null ? String(cs.min_billable_labor_minutes_per_job) : '',
          material_purchase_tax_percent:
            cs.material_purchase_tax_percent != null ? String(cs.material_purchase_tax_percent) : '',
          misc_material_percent: cs.misc_material_percent != null ? String(cs.misc_material_percent) : '',
          default_discount_percent: cs.default_discount_percent != null ? String(cs.default_discount_percent) : '',
          processing_fee_percent: cs.processing_fee_percent != null ? String(cs.processing_fee_percent) : '',
        }));

        const tiers = Array.isArray(cs.material_markup_tiers) ? (cs.material_markup_tiers as any as Tier[]) : [];
        setTierDrafts(
          tiers.map((t) => ({
            min: t.min != null ? String(t.min) : '',
            max: t.max != null ? String(t.max) : '',
            markup_percent: t.markup_percent != null ? String(t.markup_percent) : '',
          }))
        );

        const wages = Array.isArray(cs.technician_wages) ? (cs.technician_wages as any as Wage[]) : [];
        setWageDrafts(wages.map((w) => (w.hourly_rate != null ? String(w.hourly_rate) : '')));

        // expenses drafts
        setBizLumpDraft(cs.business_expenses_lump_sum_monthly != null ? String(cs.business_expenses_lump_sum_monthly) : '');
        setPerLumpDraft(cs.personal_expenses_lump_sum_monthly != null ? String(cs.personal_expenses_lump_sum_monthly) : '');

        const bizItems = Array.isArray(cs.business_expenses_itemized) ? (cs.business_expenses_itemized as any as ExpenseItem[]) : [];
        const perItems = Array.isArray(cs.personal_expenses_itemized) ? (cs.personal_expenses_itemized as any as ExpenseItem[]) : [];
        setBizItemDrafts(
          bizItems.map((it) => ({
            name: it.name ?? '',
            amount: it.amount != null ? String(it.amount) : '',
            frequency: it.frequency ?? 'monthly',
          }))
        );
        setPerItemDrafts(
          perItems.map((it) => ({
            name: it.name ?? '',
            amount: it.amount != null ? String(it.amount) : '',
            frequency: it.frequency ?? 'monthly',
          }))
        );

        // net profit drafts
        setNetProfitAmtDraft(cs.net_profit_goal_amount_monthly != null ? String(cs.net_profit_goal_amount_monthly) : '');
        setNetProfitPctDraft(cs.net_profit_goal_percent_of_revenue != null ? String(cs.net_profit_goal_percent_of_revenue) : '');
      })
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data]);

  const tiers = useMemo<Tier[]>(() => (Array.isArray(s?.material_markup_tiers) ? (s!.material_markup_tiers as any) : []), [s]);
  const wages = useMemo<Wage[]>(() => (Array.isArray(s?.technician_wages) ? (s!.technician_wages as any) : []), [s]);

  function onDraftChange(key: keyof CompanySettings, value: string) {
    setDraft((d) => ({ ...d, [key as string]: value }));
  }

  function commitNum<K extends keyof CompanySettings>(key: K, fallback = 0) {
    if (!s) return;
    const raw = (draft[key as string] ?? '').trim();
    const num = toNum(raw, fallback);
    setS({ ...s, [key]: num as any });
    setDraft((d) => ({ ...d, [key as string]: raw === '' ? '' : String(num) }));
  }

  function commitInt<K extends keyof CompanySettings>(key: K, fallback = 0) {
    if (!s) return;
    const raw = (draft[key as string] ?? '').trim();
    const num = raw === '' ? fallback : Math.max(0, toInt(raw, fallback));
    setS({ ...s, [key]: num as any });
    setDraft((d) => ({ ...d, [key as string]: raw === '' ? '' : String(num) }));
  }

  function ensureWagesRowCount(targetCount: number) {
    if (!s) return;

    // Always keep at least 1 row (even if Technicians is 0)
    const effectiveTargetCount = Math.max(1, targetCount);

    const cur = Array.isArray(s.technician_wages) ? (s.technician_wages as any as Wage[]) : [];
    const next = [...cur];

    while (next.length < effectiveTargetCount) next.push({ name: `Tech ${next.length + 1}`, hourly_rate: 0 });
    if (next.length > effectiveTargetCount) next.length = effectiveTargetCount;

    setS({ ...s, technician_wages: next as any });
    setWageDrafts((prev) => {
      const out = [...prev];
      while (out.length < effectiveTargetCount) out.push('');
      if (out.length > effectiveTargetCount) out.length = effectiveTargetCount;
      return out;
    });
  }

  // Keep wages array aligned any time technicians changes (use drafts so it reacts immediately)
  useEffect(() => {
    if (!s) return;
    const targetDraft = toInt(draft.technicians ?? '', Number(s.technicians) || 0);
    const target = Math.max(1, Math.max(0, targetDraft));
    const cur = Array.isArray(s.technician_wages) ? (s.technician_wages as any as Wage[]) : [];
    if (cur.length !== target) ensureWagesRowCount(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.technicians, s?.technicians]);

  // --------------------------
  // Derived totals (use DRAFTS while editing)
  // --------------------------

  const bizMonthly =
    s?.business_apply_itemized
      ? sumItemizedMonthly(
          bizItemDrafts.map((x) => ({
            name: x.name,
            amount: toNum(x.amount, 0),
            frequency: x.frequency,
          }))
        )
      : toNum(bizLumpDraft, 0);

  const perMonthly =
    s?.personal_apply_itemized
      ? sumItemizedMonthly(
          perItemDrafts.map((x) => ({
            name: x.name,
            amount: toNum(x.amount, 0),
            frequency: x.frequency,
          }))
        )
      : toNum(perLumpDraft, 0);

  const overheadMonthly = bizMonthly + perMonthly;
  const overheadAnnual = overheadMonthly * 12;

  // Default Job Type inputs (efficiency + margin)
  const efficiencyPercent = Number(defaultJobType?.efficiency_percent ?? 100);
  const grossMarginTargetPercent = Number(defaultJobType?.profit_margin_percent ?? 70); // displayed as “Gross Margin Target (%)”

  // Work capacity (use drafts so breakdown updates immediately while typing)
  const workdaysPerWeekDraft = toInt(draft.workdays_per_week ?? '', Number(s?.workdays_per_week) || 0);
  const hoursPerDayDraft = toNum(draft.work_hours_per_day ?? '', Number(s?.work_hours_per_day) || 0);
  const vacationDaysDraft = toInt(draft.vacation_days_per_year ?? '', Number(s?.vacation_days_per_year) || 0);
  const sickDaysDraft = toInt(draft.sick_days_per_year ?? '', Number(s?.sick_days_per_year) || 0);
  const techCountDraft = Math.max(0, toInt(draft.technicians ?? '', Number(s?.technicians) || 0));

  const workdaysPerYear = Math.max(0, workdaysPerWeekDraft * 52 - vacationDaysDraft - sickDaysDraft);
  const hoursPerTechYear = workdaysPerYear * hoursPerDayDraft;
  const techCount = techCountDraft;
  const totalHoursYear = hoursPerTechYear * techCount;

  // Apply efficiency the way YOU described:
  // If totalHours = 2000 and efficiency = 50%, effective = 1000
  const effectiveHoursYear = (totalHoursYear * Math.max(0, efficiencyPercent)) / 100;

  const overheadPerHour = effectiveHoursYear > 0 ? overheadAnnual / effectiveHoursYear : 0;

  const avgTechWage = avgWage(wages);
  const laborCostPerBillableHourPreview = effectiveHoursYear > 0 ? (avgTechWage * totalHoursYear) / effectiveHoursYear : 0;
  const loadedLaborRate = overheadPerHour + laborCostPerBillableHourPreview;

  // --------------------------
  // Revenue / pricing math derived from Default Job Type (margin + efficiency)
  // --------------------------
  // IMPORTANT: We are using TRUE gross margin math:
  //   Gross Margin = (Revenue - COGS) / Revenue
  //   => Revenue needed for GM target is based on COGS only (NOT overhead).
  // Overhead + Net Profit are handled separately.

  const grossMargin = Math.max(0, Math.min(100, grossMarginTargetPercent)) / 100;

  // Net profit rules you confirmed:
  // - percent mode: percent of FINAL revenue (company + personal)
  // - dollar mode: fixed monthly net profit target (converted to per-hour)
  const npPct = Math.max(0, toNum(netProfitPctDraft, Number(s?.net_profit_goal_percent_of_revenue || 0))) / 100;
  const npDollar = Math.max(0, toNum(netProfitAmtDraft, Number(s?.net_profit_goal_amount_monthly || 0)));

  // Hours (effective/billable) per month
  const billableHoursPerMonth = effectiveHoursYear / 12;

  // COGS per billable hour (materials not modeled yet in Company Setup; labor only for now)
  // Wage cost MUST be converted to cost per BILLABLE hour (efficiency applied).
  // You pay for total hours, but you only recover through effective/billable hours.
  const cogsLaborPerBillableHour = effectiveHoursYear > 0 ? (avgTechWage * totalHoursYear) / effectiveHoursYear : 0;
  const cogsPerBillableHour = cogsLaborPerBillableHour;

  // Revenue required to satisfy gross margin target (COGS capped to (1-GM) of revenue)
  const revenuePerBillableHourForGrossMargin = (() => {
    const denom = 1 - grossMargin;
    if (denom <= 0) return 0;
    return cogsPerBillableHour / denom;
  })();

  // Revenue required to satisfy net profit goal
  // Percent mode: (Revenue - COGS - Overhead) / Revenue = NP%
  // => Revenue = (COGS + Overhead) / (1 - NP%)
  // Dollar mode: Revenue = COGS + Overhead + Profit$/hour
  const revenuePerBillableHourForNetProfit = (() => {
    const costPlusOverhead = cogsPerBillableHour + overheadPerHour;
    if ((s?.net_profit_goal_mode ?? 'percent') === 'percent') {
      const denom = 1 - npPct;
      if (denom <= 0) return 0;
      return costPlusOverhead / denom;
    }

    const profitPerHour = billableHoursPerMonth > 0 ? npDollar / billableHoursPerMonth : 0;
    return costPlusOverhead + profitPerHour;
  })();

  // Final required revenue per billable hour must satisfy BOTH:
  // - gross margin target (COGS-based)
  // - net profit goal (after overhead)
  const requiredRevenuePerBillableHour = Math.max(revenuePerBillableHourForGrossMargin, revenuePerBillableHourForNetProfit);

  // Monthly revenue goal derived from capacity
  const revenueGoalMonthlyDerived = billableHoursPerMonth * requiredRevenuePerBillableHour;

  // Net profit monthly (derived)
  const netProfitMonthly =
    (s?.net_profit_goal_mode ?? 'percent') === 'percent' ? revenueGoalMonthlyDerived * npPct : npDollar;


  const grossProfitNeededMonthly = overheadMonthly + netProfitMonthly;
  const grossProfitPercentOfRevenue = revenueGoalMonthlyDerived > 0 ? (grossProfitNeededMonthly / revenueGoalMonthlyDerived) * 100 : 0;

  const jobsPerTechPerDay = toNum(
    (draft as any).avg_jobs_per_tech_per_day ?? '',
    Number((s as any)?.avg_jobs_per_tech_per_day) || 0
  );
  const workdaysPerMonth = workdaysPerYear / 12;
  const jobsPerMonth = techCountDraft * jobsPerTechPerDay * workdaysPerMonth;
  const avgJobGoal = jobsPerMonth > 0 ? revenueGoalMonthlyDerived / jobsPerMonth : 0;


  // commit payload
  function commitAllDraftsIntoSettings(): CompanySettings {
    if (!s) throw new Error('No company settings loaded');
    const next: CompanySettings = { ...s };

    // Integers
    (next as any).workdays_per_week = Math.max(0, toInt(draft.workdays_per_week ?? '', next.workdays_per_week ?? 0));
    (next as any).technicians = Math.max(0, toInt(draft.technicians ?? '', next.technicians ?? 0));
    // This field is used for Average Ticket calculations and MUST persist.
    (next as any).avg_jobs_per_tech_per_day = Math.max(
      0,
      toNum((draft as any).avg_jobs_per_tech_per_day ?? '', Number((next as any).avg_jobs_per_tech_per_day) || 0)
    );
    (next as any).vacation_days_per_year = Math.max(0, toInt(draft.vacation_days_per_year ?? '', next.vacation_days_per_year ?? 0));
    (next as any).sick_days_per_year = Math.max(0, toInt(draft.sick_days_per_year ?? '', next.sick_days_per_year ?? 0));
    (next as any).estimate_validity_days = Math.max(0, toInt(draft.estimate_validity_days ?? '', next.estimate_validity_days ?? 0));
    (next as any).starting_estimate_number = Math.max(0, toInt(draft.starting_estimate_number ?? '', next.starting_estimate_number ?? 0));
    (next as any).min_billable_labor_minutes_per_job = Math.max(0, toInt(draft.min_billable_labor_minutes_per_job ?? '', next.min_billable_labor_minutes_per_job ?? 0));

    // Decimals
    (next as any).work_hours_per_day = toNum(draft.work_hours_per_day ?? '', next.work_hours_per_day ?? 0);
    (next as any).material_purchase_tax_percent = toNum(draft.material_purchase_tax_percent ?? '', next.material_purchase_tax_percent ?? 0);
    (next as any).misc_material_percent = toNum(draft.misc_material_percent ?? '', next.misc_material_percent ?? 0);
    (next as any).default_discount_percent = toNum(draft.default_discount_percent ?? '', next.default_discount_percent ?? 0);
    (next as any).processing_fee_percent = toNum(draft.processing_fee_percent ?? '', next.processing_fee_percent ?? 0);

    // Tiers
    ;(next as any).material_markup_tiers = (tierDrafts.length ? tierDrafts : tiers.map((t) => ({ min: String(t.min ?? 0), max: String(t.max ?? 0), markup_percent: String(t.markup_percent ?? 0) }))).map(
      (d) => ({
        min: toNum(d.min, 0),
        max: toNum(d.max, 0),
        markup_percent: toNum(d.markup_percent, 0),
      })
    );

    // Wages
    (next as any).technician_wages = wages.map((w, idx) => ({
      ...w,
      hourly_rate: toNum(wageDrafts[idx] ?? String(w.hourly_rate ?? 0), 0),
    }));

    // Expenses
    (next as any).business_expenses_lump_sum_monthly = toNum(bizLumpDraft ?? '', next.business_expenses_lump_sum_monthly ?? 0);
    (next as any).personal_expenses_lump_sum_monthly = toNum(perLumpDraft ?? '', next.personal_expenses_lump_sum_monthly ?? 0);

    (next as any).business_expenses_itemized = (bizItemDrafts ?? []).map((it) => ({
      name: it.name ?? '',
      amount: toNum(it.amount ?? '', 0),
      frequency: it.frequency ?? 'monthly',
    }));
    (next as any).personal_expenses_itemized = (perItemDrafts ?? []).map((it) => ({
      name: it.name ?? '',
      amount: toNum(it.amount ?? '', 0),
      frequency: it.frequency ?? 'monthly',
    }));

    // Net profit goals
    (next as any).net_profit_goal_amount_monthly = toNum(netProfitAmtDraft ?? '', next.net_profit_goal_amount_monthly ?? 0);
    (next as any).net_profit_goal_percent_of_revenue = toNum(netProfitPctDraft ?? '', next.net_profit_goal_percent_of_revenue ?? 0);

    // Cached computed totals (raw dollars)
    ;(next as any).business_expenses_monthly = bizMonthly;
    ;(next as any).personal_expenses_monthly = perMonthly;
    ;(next as any).overhead_monthly = overheadMonthly;

    // Cached computed rates (system-derived)
    ;(next as any).overhead_per_billable_hour = overheadPerHour;
    ;(next as any).required_revenue_per_billable_hour = requiredRevenuePerBillableHour;

    // Revenue goal is derived from capacity + required revenue/hour, not user-input
    ;(next as any).revenue_goal_monthly = revenueGoalMonthlyDerived;

    // Misc material behavior
    ;(next as any).misc_applies_when_customer_supplies = Boolean((s as any).misc_applies_when_customer_supplies ?? false);

    return next;
  }

  async function save() {
    if (!s) return;

    try {
      setStatus('');
      setSaveUi('saving');

      const payload = commitAllDraftsIntoSettings();

      await data.saveCompanySettings(payload);

      // refresh both settings + job types (in case default changed elsewhere)
      const [fresh, jts] = await Promise.all([data.getCompanySettings(), data.listJobTypes()]);
      setS(fresh);
      setDefaultJobType((jts ?? []).find((x) => x.is_default) ?? null);

      // re-sync drafts quickly (so UI matches persisted values)
      setDraft((prev) => ({
        ...prev,
        workdays_per_week: fresh.workdays_per_week != null ? String(fresh.workdays_per_week) : '',
        work_hours_per_day: fresh.work_hours_per_day != null ? String(fresh.work_hours_per_day) : '',
        technicians: fresh.technicians != null ? String(fresh.technicians) : '',
        vacation_days_per_year: fresh.vacation_days_per_year != null ? String(fresh.vacation_days_per_year) : '',
        sick_days_per_year: fresh.sick_days_per_year != null ? String(fresh.sick_days_per_year) : '',
        estimate_validity_days: fresh.estimate_validity_days != null ? String(fresh.estimate_validity_days) : '',
        starting_estimate_number: fresh.starting_estimate_number != null ? String(fresh.starting_estimate_number) : '',
        min_billable_labor_minutes_per_job:
          fresh.min_billable_labor_minutes_per_job != null ? String(fresh.min_billable_labor_minutes_per_job) : '',
        material_purchase_tax_percent:
          fresh.material_purchase_tax_percent != null ? String(fresh.material_purchase_tax_percent) : '',
        misc_material_percent: fresh.misc_material_percent != null ? String(fresh.misc_material_percent) : '',
        default_discount_percent: fresh.default_discount_percent != null ? String(fresh.default_discount_percent) : '',
        processing_fee_percent: fresh.processing_fee_percent != null ? String(fresh.processing_fee_percent) : '',
      }));

      const ft = Array.isArray(fresh.material_markup_tiers) ? (fresh.material_markup_tiers as any as Tier[]) : [];
      setTierDrafts(
        ft.map((t) => ({
          min: t.min != null ? String(t.min) : '',
          max: t.max != null ? String(t.max) : '',
          markup_percent: t.markup_percent != null ? String(t.markup_percent) : '',
        }))
      );

      const fw = Array.isArray(fresh.technician_wages) ? (fresh.technician_wages as any as Wage[]) : [];
      setWageDrafts(fw.map((w) => (w.hourly_rate != null ? String(w.hourly_rate) : '')));

      setBizLumpDraft(fresh.business_expenses_lump_sum_monthly != null ? String(fresh.business_expenses_lump_sum_monthly) : '');
      setPerLumpDraft(fresh.personal_expenses_lump_sum_monthly != null ? String(fresh.personal_expenses_lump_sum_monthly) : '');

      const bizItems = Array.isArray(fresh.business_expenses_itemized) ? (fresh.business_expenses_itemized as any as ExpenseItem[]) : [];
      const perItems = Array.isArray(fresh.personal_expenses_itemized) ? (fresh.personal_expenses_itemized as any as ExpenseItem[]) : [];
      setBizItemDrafts(
        bizItems.map((it) => ({
          name: it.name ?? '',
          amount: it.amount != null ? String(it.amount) : '',
          frequency: it.frequency ?? 'monthly',
        }))
      );
      setPerItemDrafts(
        perItems.map((it) => ({
          name: it.name ?? '',
          amount: it.amount != null ? String(it.amount) : '',
          frequency: it.frequency ?? 'monthly',
        }))
      );

      setNetProfitAmtDraft(fresh.net_profit_goal_amount_monthly != null ? String(fresh.net_profit_goal_amount_monthly) : '');
      setNetProfitPctDraft(fresh.net_profit_goal_percent_of_revenue != null ? String(fresh.net_profit_goal_percent_of_revenue) : '');

      setSaveUi('saved');
      setTimeout(() => setSaveUi('idle'), 1200);
    } catch (e: any) {
      console.error(e);
      setSaveUi('error');
      setStatus(String(e?.message ?? e));
      setTimeout(() => setSaveUi('idle'), 1500);
    }
  }

  if (!s) return <div className="muted">Loading…</div>;

  const saveLabel = saveUi === 'saving' ? 'Saving…' : saveUi === 'saved' ? 'Saved ✓' : saveUi === 'error' ? 'Error' : 'Save';
  const money = (n: number) => _fmtMoney.format(Number.isFinite(n) ? n : 0);
  const num0 = (n: number) => _fmtInt.format(Number.isFinite(n) ? n : 0);
  const num2 = (n: number) => _fmt2.format(Number.isFinite(n) ? n : 0);

  // UI row count: NEVER below 1
  const techRowsUi = Math.max(1, techCountDraft);

  return (
    <div className="stack">
      <Card
        title="Company Setup"
        right={
          <Button variant="primary" onClick={save} disabled={saveUi === 'saving'} aria-busy={saveUi === 'saving'}>
            {saveLabel}
          </Button>
        }
      >
        <div className="muted small">Defaults and pricing knobs used across Materials / Assemblies / Estimates. Job Type Default drives efficiency + margin target.</div>
      </Card>

      <Card title="Defaults">
        <div className="grid2">
          <div className="stack">
            <label className="label">Workdays / Week</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.workdays_per_week ?? ''}
              onChange={(e) => onDraftChange('workdays_per_week', e.target.value)}
              onBlur={() => commitInt('workdays_per_week')}
            />
          </div>

          <div className="stack">
            <label className="label">Avg Jobs / Tech / Day</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.avg_jobs_per_tech_per_day ?? ''}
              onChange={(e) => onDraftChange('avg_jobs_per_tech_per_day', e.target.value)}
              onBlur={() => commitNum('avg_jobs_per_tech_per_day')}
            />
          </div>

          <div className="stack">
            <label className="label">Work Hours / Day</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.work_hours_per_day ?? ''}
              onChange={(e) => onDraftChange('work_hours_per_day', e.target.value)}
              onBlur={() => commitNum('work_hours_per_day')}
            />
          </div>

          <div className="stack">
            <label className="label">Technicians</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.technicians ?? ''}
              onChange={(e) => onDraftChange('technicians', e.target.value)}
              onBlur={() => {
                const target = Math.max(0, toInt(draft.technicians ?? '', 0));
                setS({ ...s, technicians: target as any });
                setDraft((d) => ({ ...d, technicians: (draft.technicians ?? '').trim() === '' ? '' : String(target) }));
                ensureWagesRowCount(target);
              }}
            />
          </div>

          <div className="stack">
            <label className="label">Vacation Days / Year</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.vacation_days_per_year ?? ''}
              onChange={(e) => onDraftChange('vacation_days_per_year', e.target.value)}
              onBlur={() => commitInt('vacation_days_per_year')}
            />
          </div>

          <div className="stack">
            <label className="label">Sick/Personal Days / Year</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.sick_days_per_year ?? ''}
              onChange={(e) => onDraftChange('sick_days_per_year', e.target.value)}
              onBlur={() => commitInt('sick_days_per_year')}
            />
          </div>

          <div className="stack">
            <label className="label">Estimate Validity Days</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.estimate_validity_days ?? ''}
              onChange={(e) => onDraftChange('estimate_validity_days', e.target.value)}
              onBlur={() => commitInt('estimate_validity_days')}
            />
          </div>

          <div className="stack">
            <label className="label">Starting Estimate Number</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.starting_estimate_number ?? ''}
              onChange={(e) => onDraftChange('starting_estimate_number', e.target.value)}
              onBlur={() => commitInt('starting_estimate_number')}
            />
          </div>

          <div className="stack">
            <label className="label">Min Billable Labor Minutes / Job</label>
            <Input
              type="text"
              inputMode="numeric"
              value={draft.min_billable_labor_minutes_per_job ?? ''}
              onChange={(e) => onDraftChange('min_billable_labor_minutes_per_job', e.target.value)}
              onBlur={() => commitInt('min_billable_labor_minutes_per_job')}
            />
          </div>
        </div>
      </Card>

      <Card title="Pricing Parameters">
        <div className="grid2">
          <div className="stack">
            <label className="label">Purchase Tax Percent</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.material_purchase_tax_percent ?? ''}
              onChange={(e) => onDraftChange('material_purchase_tax_percent', e.target.value)}
              onBlur={() => commitNum('material_purchase_tax_percent')}
            />
          </div>

          <div className="stack">
            <label className="label">Misc Material Percent</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.misc_material_percent ?? ''}
              onChange={(e) => onDraftChange('misc_material_percent', e.target.value)}
              onBlur={() => commitNum('misc_material_percent')}
            />
          </div>

          <div className="stack">
            <label className="label">Default Discount Percent</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.default_discount_percent ?? ''}
              onChange={(e) => onDraftChange('default_discount_percent', e.target.value)}
              onBlur={() => commitNum('default_discount_percent')}
            />
          </div>

          <div className="stack">
            <label className="label">Processing Fee Percent</label>
            <Input
              type="text"
              inputMode="decimal"
              value={draft.processing_fee_percent ?? ''}
              onChange={(e) => onDraftChange('processing_fee_percent', e.target.value)}
              onBlur={() => commitNum('processing_fee_percent')}
            />
          </div>
        </div>

        <div className="rowBetween" style={{ marginTop: 12, gap: 12, flexWrap: 'wrap' }}>
          <div className="stack" style={{ minWidth: 320 }}>
            <label className="label">Apply misc material when customer supplies materials</label>
            <div className="row" style={{ gap: 10, alignItems: 'center' }}>
              <Toggle
                checked={Boolean((s as any)?.misc_applies_when_customer_supplies ?? false)}
                onChange={(checked) => s && setS({ ...(s as any), misc_applies_when_customer_supplies: Boolean(checked) })}
              />
              <div className="muted">{(s as any)?.misc_applies_when_customer_supplies ? 'Yes' : 'No'}</div>
            </div>
          
<div className="stack" style={{ minWidth: 320 }}>
  <label className="label">Show Tech View cost breakdown (Estimates + Assemblies)</label>
  <div className="row" style={{ gap: 10, alignItems: 'center' }}>
    <Toggle
      checked={Boolean((s as any)?.show_tech_view_breakdown ?? true)}
      onChange={(checked) => s && setS({ ...(s as any), show_tech_view_breakdown: Boolean(checked) })}
    />
    <div className="muted">{(s as any)?.show_tech_view_breakdown ?? true ? 'Visible' : 'Hidden'}</div>
  </div>
</div>

</div>

          <div className="muted small" style={{ maxWidth: 520 }}>
            Misc material is an estimate/assembly-level percentage applied after material totals are built. This toggle controls whether it can still apply when the customer supplies materials.
          </div>
        </div>
      </Card>

      <Card
        title="Material Markups"
        right={
          <Button
            onClick={() => {
              // Add a new tier row
              setTierDrafts((prev) => [...prev, { min: '0', max: '0', markup_percent: '0' }]);
            }}
          >
            Add Tier
          </Button>
        }
      >
        <div className="muted small">Define tiered material markups based on material cost. These are used by the pricing engine.</div>

        <div className="stack" style={{ marginTop: 10, gap: 10 }}>
          {(tierDrafts.length ? tierDrafts : [{ min: '0', max: '0', markup_percent: '0' }]).map((t, idx) => (
            <div key={idx} className="row" style={{ gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <div className="stack" style={{ width: 120 }}>
                <label className="label">Min</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={t.min}
                  onChange={(e) =>
                    setTierDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, min: e.target.value } : x)))
                  }
                />
              </div>

              <div className="stack" style={{ width: 120 }}>
                <label className="label">Max</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={t.max}
                  onChange={(e) =>
                    setTierDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, max: e.target.value } : x)))
                  }
                />
              </div>

              <div className="stack" style={{ width: 140 }}>
                <label className="label">Markup %</label>
                <Input
                  type="text"
                  inputMode="decimal"
                  value={t.markup_percent}
                  onChange={(e) =>
                    setTierDrafts((prev) => prev.map((x, i) => (i === idx ? { ...x, markup_percent: e.target.value } : x)))
                  }
                />
              </div>

              <div className="row" style={{ gap: 8, alignItems: 'end' }}>
                <Button
                  onClick={() => {
                    setTierDrafts((prev) => prev.filter((_, i) => i !== idx));
                  }}
                  disabled={(tierDrafts.length ? tierDrafts : []).length <= 1}
                >
                  Remove
                </Button>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* FIX: This card always renders, and row count never goes below 1 */}
      <Card title="Technician Wages (Defaults)">
        <div className="stack">
          <div className="muted small">
            This card always shows at least 1 technician entry, even if Technicians is set to 0.
          </div>

          <div className="rowBetween" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="muted">
              Wage rows follow the <strong>Technicians</strong> count.
            </div>
            <div className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                onClick={() => {
                  if (!s) return;
                  const curCount = Math.max(0, toInt(draft.technicians ?? '', Number(s.technicians) || 0));
                  const nextCount = Math.max(0, curCount - 1);
                  setS({ ...s, technicians: nextCount });
                  setDraft((d) => ({ ...d, technicians: String(nextCount) }));
                  ensureWagesRowCount(Math.max(1, nextCount));
                }}
              >
                Remove Technician
              </Button>
              <Button
                onClick={() => {
                  if (!s) return;
                  const curCount = Math.max(0, toInt(draft.technicians ?? '', Number(s.technicians) || 0));
                  const nextCount = curCount + 1;
                  setS({ ...s, technicians: nextCount });
                  setDraft((d) => ({ ...d, technicians: String(nextCount) }));
                  ensureWagesRowCount(nextCount);
                }}
              >
                Add Technician
              </Button>
            </div>
          </div>

          <div className="stack">
            {Array.from({ length: techRowsUi }).map((_, idx) => {
              const w = wages[idx] ?? { name: `Tech ${idx + 1}`, hourly_rate: 0 };
              const rateDraft = wageDrafts[idx] ?? (w.hourly_rate != null ? String(w.hourly_rate) : '');

              return (
                <div key={idx} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Input
                    style={{ minWidth: 220 }}
                    value={w.name ?? ''}
                    placeholder={`Technician ${idx + 1} Name`}
                    onChange={(e) => {
                      const v = e.target.value;
                      setS((prev) => {
                        if (!prev) return prev;
                        const cur = Array.isArray(prev.technician_wages) ? (prev.technician_wages as any as Wage[]) : [];
                        const next = [...cur];
                        while (next.length < techRowsUi) next.push({ name: `Tech ${next.length + 1}`, hourly_rate: 0 });
                        next[idx] = { ...next[idx], name: v };
                        return { ...prev, technician_wages: next as any };
                      });
                    }}
                  />

                  <Input
                    style={{ width: 160 }}
                    type="text"
                    inputMode="decimal"
                    value={rateDraft}
                    placeholder="Hourly $"
                    onChange={(e) => {
                      const v = e.target.value;
                      setWageDrafts((prev) => {
                        const out = [...prev];
                        while (out.length < techRowsUi) out.push('');
                        out[idx] = v;
                        return out;
                      });
                    }}
                    onBlur={() => {
                      const v = toNum((wageDrafts[idx] ?? '').trim(), Number(w.hourly_rate ?? 0));
                      setS((prev) => {
                        if (!prev) return prev;
                        const cur = Array.isArray(prev.technician_wages) ? (prev.technician_wages as any as Wage[]) : [];
                        const next = [...cur];
                        while (next.length < techRowsUi) next.push({ name: `Tech ${next.length + 1}`, hourly_rate: 0 });
                        next[idx] = { ...next[idx], hourly_rate: v };
                        return { ...prev, technician_wages: next as any };
                      });
                      setWageDrafts((prev) => {
                        const out = [...prev];
                        while (out.length < techRowsUi) out.push('');
                        out[idx] = (wageDrafts[idx] ?? '').trim() === '' ? '' : String(v);
                        return out;
                      });
                    }}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      <Card title="Business Expenses">
        <div className="grid2">
          <div className="stack">
            <label className="label">Use Itemized Expenses</label>
            <Toggle
              checked={Boolean(s.business_apply_itemized)}
              onChange={(v) => setS({ ...s, business_apply_itemized: v })}
              label={s.business_apply_itemized ? 'Itemized' : 'Lump Sum'}
            />
          </div>

          {!s.business_apply_itemized ? (
            <div className="stack">
              <label className="label">Business Expenses (Monthly Lump Sum)</label>
              <Input type="text" inputMode="decimal" value={bizLumpDraft} onChange={(e) => setBizLumpDraft(e.target.value)} />
            </div>
          ) : (
            <div className="stack" style={{ gridColumn: '1 / -1' }}>
              <div className="rowBetween">
                <strong>Itemized</strong>
                <Button onClick={() => setBizItemDrafts((prev) => [...prev, { name: '', amount: '', frequency: 'monthly' }])}>Add Expense</Button>
              </div>

              <div className="stack">
                {bizItemDrafts.length === 0 ? (
                  <div className="muted">No business expenses added.</div>
                ) : (
                  bizItemDrafts.map((it, idx) => (
                    <div key={idx} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Input
                        style={{ minWidth: 220 }}
                        value={it.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBizItemDrafts((prev) => {
                            const out = [...prev];
                            out[idx] = { ...out[idx], name: v };
                            return out;
                          });
                        }}
                        placeholder="Expense name"
                      />
                      <Input
                        style={{ width: 140 }}
                        type="text"
                        inputMode="decimal"
                        value={it.amount}
                        onChange={(e) => {
                          const v = e.target.value;
                          setBizItemDrafts((prev) => {
                            const out = [...prev];
                            out[idx] = { ...out[idx], amount: v };
                            return out;
                          });
                        }}
                        placeholder="$"
                      />
                      <select
                        className="input"
                        value={it.frequency}
                        onChange={(e) => {
                          const v = e.target.value as ExpenseItem['frequency'];
                          setBizItemDrafts((prev) => {
                            const out = [...prev];
                            out[idx] = { ...out[idx], frequency: v };
                            return out;
                          });
                        }}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="biannual">Biannual</option>
                        <option value="annual">Annual</option>
                      </select>
                      <Button
                        onClick={() => {
                          setBizItemDrafts((prev) => {
                            const out = [...prev];
                            out.splice(idx, 1);
                            return out;
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="muted small">
                Monthly equivalent: <strong>${bizMonthly.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="Personal Expenses">
        <div className="grid2">
          <div className="stack">
            <label className="label">Use Itemized Expenses</label>
            <Toggle
              checked={Boolean(s.personal_apply_itemized)}
              onChange={(v) => setS({ ...s, personal_apply_itemized: v })}
              label={s.personal_apply_itemized ? 'Itemized' : 'Lump Sum'}
            />
          </div>

          {!s.personal_apply_itemized ? (
            <div className="stack">
              <label className="label">Personal Expenses (Monthly Lump Sum)</label>
              <Input type="text" inputMode="decimal" value={perLumpDraft} onChange={(e) => setPerLumpDraft(e.target.value)} />
            </div>
          ) : (
            <div className="stack" style={{ gridColumn: '1 / -1' }}>
              <div className="rowBetween">
                <strong>Itemized</strong>
                <Button onClick={() => setPerItemDrafts((prev) => [...prev, { name: '', amount: '', frequency: 'monthly' }])}>Add Expense</Button>
              </div>

              <div className="stack">
                {perItemDrafts.length === 0 ? (
                  <div className="muted">No personal expenses added.</div>
                ) : (
                  perItemDrafts.map((it, idx) => (
                    <div key={idx} className="row" style={{ gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      <Input
                        style={{ minWidth: 220 }}
                        value={it.name}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPerItemDrafts((prev) => {
                            const out = [...prev];
                            out[idx] = { ...out[idx], name: v };
                            return out;
                          });
                        }}
                        placeholder="Expense name"
                      />
                      <Input
                        style={{ width: 140 }}
                        type="text"
                        inputMode="decimal"
                        value={it.amount}
                        onChange={(e) => {
                          const v = e.target.value;
                          setPerItemDrafts((prev) => {
                            const out = [...prev];
                            out[idx] = { ...out[idx], amount: v };
                            return out;
                          });
                        }}
                        placeholder="$"
                      />
                      <select
                        className="input"
                        value={it.frequency}
                        onChange={(e) => {
                          const v = e.target.value as ExpenseItem['frequency'];
                          setPerItemDrafts((prev) => {
                            const out = [...prev];
                            out[idx] = { ...out[idx], frequency: v };
                            return out;
                          });
                        }}
                      >
                        <option value="monthly">Monthly</option>
                        <option value="quarterly">Quarterly</option>
                        <option value="biannual">Biannual</option>
                        <option value="annual">Annual</option>
                      </select>
                      <Button
                        onClick={() => {
                          setPerItemDrafts((prev) => {
                            const out = [...prev];
                            out.splice(idx, 1);
                            return out;
                          });
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ))
                )}
              </div>

              <div className="muted small">
                Monthly equivalent: <strong>${perMonthly.toFixed(2)}</strong>
              </div>
            </div>
          )}
        </div>
      </Card>

      <Card title="Net Profit Goals">
        <div className="grid2">
          <div className="stack">
            <label className="label">Net Profit Goal Mode</label>
            <Toggle
              checked={s.net_profit_goal_mode === 'percent'}
              onChange={(v) => setS({ ...s, net_profit_goal_mode: v ? 'percent' : 'fixed' })}
              label={s.net_profit_goal_mode === 'percent' ? 'Percent of Revenue' : 'Fixed $ / Month'}
            />
          </div>

          {s.net_profit_goal_mode === 'percent' ? (
            <div className="stack">
              <label className="label">Net Profit % of Revenue</label>
              <Input type="text" inputMode="decimal" value={netProfitPctDraft} onChange={(e) => setNetProfitPctDraft(e.target.value)} placeholder="%" />
            </div>
          ) : (
            <div className="stack">
              <label className="label">Net Profit (Fixed $ / Month)</label>
              <Input type="text" inputMode="decimal" value={netProfitAmtDraft} onChange={(e) => setNetProfitAmtDraft(e.target.value)} placeholder="$" />
            </div>
          )}
        </div>

        <div className="muted small">Revenue goal is derived from the Default Job Type margin target. Net profit % mode uses that derived revenue.</div>
      </Card>

      <Card title="Cost Breakdown (Computed)">
        <div className="grid2">
          <div className="stack">
            <label className="label">Default Job Type</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {defaultJobType ? defaultJobType.name : 'None set'}
            </div>
          </div>

          <div className="stack">
            <label className="label">Efficiency (Default Job Type)</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {efficiencyPercent.toFixed(0)}%
            </div>
          </div>

          <div className="stack">
            <label className="label">Gross Margin Target (Default Job Type)</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {grossMarginTargetPercent.toFixed(0)}%
            </div>
          </div>

          <div className="stack">
            <label className="label">Overhead (Monthly)</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {money(overheadMonthly)}
            </div>
          </div>

          <div className="stack">
            <label className="label">Overhead (Annual)</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {money(overheadAnnual)}
            </div>
          </div>

          <div className="stack">
            <label className="label">Workdays / Year</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {num0(workdaysPerYear)}
            </div>
          </div>

          <div className="stack">
            <label className="label">Total Hours / Year</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {totalHoursYear.toFixed(0)}
            </div>
          </div>

          <div className="stack">
            <label className="label">Effective Hours / Year (Efficiency Applied)</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {effectiveHoursYear.toFixed(0)}
            </div>
          </div>

          <div className="stack">
            <label className="label">Overhead / Labor Hour</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              ${overheadPerHour.toFixed(2)}
            </div>
          </div>

          <div className="stack">
            <label className="label">Avg Tech Wage</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {money(avgTechWage)}/hr
            </div>
          </div>

          <div className="stack">
            <label className="label">Loaded Labor Rate (Wage + Overhead)</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {money(loadedLaborRate)}/hr
            </div>
          </div>

          <div className="stack">
            <label className="label">Average Job Goal (Derived)</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {money(avgJobGoal)}
            </div>
            <div className="muted small">
              Based on {num2(jobsPerMonth)} jobs/month (Techs × Jobs/Tech/Day × Workdays/Month)
            </div>
          </div>



          <div className="stack" style={{ gridColumn: '1 / -1' }}>
            <div className="rowBetween" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <div className="muted">Advanced</div>
              <Button variant="secondary" onClick={() => setShowAdvanced((v) => !v)}>
                {showAdvanced ? 'Hide advanced' : 'Show advanced'}
              </Button>
            </div>

            {showAdvanced ? (
              <div className="grid2" style={{ marginTop: 8 }}>
                <div className="stack">
                  <label className="label">Required Revenue / Billable Hour (Labor-only baseline)</label>
                  <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
                    {money(requiredRevenuePerBillableHour)}/hr
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="stack">
            <label className="label">Revenue Goal (Monthly, Derived)</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {money(revenueGoalMonthlyDerived)}
            </div>
          </div>

          <div className="stack">
            <label className="label">Gross Profit Needed (Monthly)</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {money(grossProfitNeededMonthly)}
            </div>
          </div>

          <div className="stack">
            <label className="label">Gross Profit % of Derived Revenue</label>
            <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
              {num2(grossProfitPercentOfRevenue)}%
            </div>
          </div>
        </div>

        <div className="muted small">Revenue goal is computed from overhead + net profit goal, using the Default Job Type gross margin target.</div>
      </Card>

      {status ? <div className="muted small mt">{status}</div> : null}
    </div>
  );
}


