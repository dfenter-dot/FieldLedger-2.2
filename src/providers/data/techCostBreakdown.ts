import type { CompanySettings, JobType } from './types';

function toNum(v: any, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

function monthlyFromItemized(items: any[]): number {
  const mult = (freq: string) => {
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
  };
  return (Array.isArray(items) ? items : []).reduce((sum, it) => {
    const amt = toNum(it?.amount, 0);
    const f = String(it?.frequency ?? 'monthly');
    return sum + amt * mult(f);
  }, 0);
}

function avgWage(wages: any[]): number {
  const list = (Array.isArray(wages) ? wages : []).map((w) => toNum(w?.hourly_rate, 0)).filter((n) => n > 0);
  if (list.length === 0) return 0;
  return list.reduce((a, b) => a + b, 0) / list.length;
}

/**
 * Tech Cost Breakdown (Sheet 2)
 *
 * This is a pure-math clone of the Admin Company Setup "Cost Breakdown" logic,
 * but it uses the job type passed in (estimate/assembly selected job type)
 * instead of the default job type.
 *
 * Company Setup (Sheet 1) remains unchanged.
 */
export function computeTechCostBreakdown(company: CompanySettings, jobType: JobType | null) {
  const efficiencyPercent = clampPct(toNum(jobType?.efficiency_percent ?? 100, 100));
  const grossMarginTargetPercent = clampPct(toNum(jobType?.profit_margin_percent ?? 70, 70));

  const overheadMonthly = (() => {
    const bizMonthly = company?.business_apply_itemized
      ? monthlyFromItemized(company?.business_expenses_itemized as any)
      : toNum((company as any)?.business_expenses_lump_sum_monthly, 0);

    const perMonthly = company?.personal_apply_itemized
      ? monthlyFromItemized(company?.personal_expenses_itemized as any)
      : toNum((company as any)?.personal_expenses_lump_sum_monthly, 0);

    return bizMonthly + perMonthly;
  })();

  const overheadAnnual = overheadMonthly * 12;

  const workdaysPerWeek = toNum(company?.workdays_per_week, 0);
  const hoursPerDay = toNum(company?.work_hours_per_day, 0);
  const vacationDays = toNum(company?.vacation_days_per_year, 0);
  const sickDays = toNum(company?.sick_days_per_year, 0);
  const technicians = Math.max(0, toNum(company?.technicians, 0));

  const workdaysPerYear = Math.max(0, workdaysPerWeek * 52 - vacationDays - sickDays);
  const hoursPerTechYear = workdaysPerYear * hoursPerDay;
  const totalHoursYear = hoursPerTechYear * technicians;

  // Apply efficiency (same as Admin card)
  const effectiveHoursYear = (totalHoursYear * Math.max(0, efficiencyPercent)) / 100;

  const overheadPerHour = effectiveHoursYear > 0 ? overheadAnnual / effectiveHoursYear : 0;

  const wages = (company as any)?.technician_wages ?? [];
  const avgTechWage = avgWage(wages);

  const wageCostPerBillableHour = effectiveHoursYear > 0 ? (avgTechWage * totalHoursYear) / effectiveHoursYear : 0;

  const loadedLaborRate = overheadPerHour + wageCostPerBillableHour;

  // Net profit rules (Admin card behavior)
  const npMode = (company as any)?.net_profit_goal_mode ?? 'percent';
  const npPct = Math.max(0, toNum((company as any)?.net_profit_goal_percent_of_revenue, 0)) / 100;
  const npDollar = Math.max(0, toNum((company as any)?.net_profit_goal_amount_monthly, 0));

  const billableHoursPerMonth = effectiveHoursYear / 12;

  const cogsLaborPerBillableHour = wageCostPerBillableHour;
  const cogsPerBillableHour = cogsLaborPerBillableHour;

  const grossMargin = clampPct(grossMarginTargetPercent) / 100;

  const revenuePerBillableHourForGrossMargin = (() => {
    const denom = 1 - grossMargin;
    if (denom <= 0) return 0;
    return cogsPerBillableHour / denom;
  })();

  const revenuePerBillableHourForNetProfit = (() => {
    const costPlusOverhead = cogsPerBillableHour + overheadPerHour;
    if (npMode === 'percent') {
      const denom = 1 - npPct;
      if (denom <= 0) return 0;
      return costPlusOverhead / denom;
    }
    const profitPerHour = billableHoursPerMonth > 0 ? npDollar / billableHoursPerMonth : 0;
    return costPlusOverhead + profitPerHour;
  })();

  const requiredRevenuePerBillableHour = Math.max(revenuePerBillableHourForGrossMargin, revenuePerBillableHourForNetProfit);

  return {
    efficiencyPercent,
    grossMarginTargetPercent,

    overheadMonthly,
    overheadAnnual,

    totalHoursYear,
    effectiveHoursYear,
    billableHoursPerMonth,

    avgTechWage,
    overheadPerHour,
    wageCostPerBillableHour,
    loadedLaborRate,

    cogsPerBillableHour,
    revenuePerBillableHourForGrossMargin,
    revenuePerBillableHourForNetProfit,
    requiredRevenuePerBillableHour,
  };
}

