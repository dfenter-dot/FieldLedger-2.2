import { useMemo, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import type { CompanySettings, JobType } from '../../providers/data/types';
import { computeTechCostBreakdown } from '../../providers/data/techCostBreakdown';

const _fmtMoney = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const _fmtInt = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const _fmt2 = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const money = (n: number) => _fmtMoney.format(Number.isFinite(n) ? n : 0);
const num0 = (n: number) => _fmtInt.format(Number.isFinite(n) ? n : 0);
const num2 = (n: number) => _fmt2.format(Number.isFinite(n) ? n : 0);

/**
 * TechCostBreakdownCard (Sheet 2)
 * Exact mirror of Admin → Company Setup "Cost Breakdown (Computed)",
 * except Job Type / Efficiency / Gross Margin come from the currently selected Job Type
 * (estimate or assembly), not the Admin default Job Type.
 */
export function TechCostBreakdownCard(props: {
  title?: string;
  company: CompanySettings;
  jobType: JobType | null;
}) {
  const { title = 'Tech View Cost Breakdown', company, jobType } = props;
  const [showAdvanced, setShowAdvanced] = useState(false);

  const tech = useMemo(() => computeTechCostBreakdown(company, jobType), [company, jobType]);

  // Mirror Company Setup derived helpers
  const workdaysPerWeek = Number(company.workdays_per_week ?? 5) || 5;
  const workhoursPerDay = Number(company.work_hours_per_day ?? 8) || 8;
  const techCount = Number(company.tech_count ?? 1) || 1;
  const vacationDays = Number(company.vacation_days_per_year ?? 10) || 10;
  const sickDays = Number(company.sick_days_per_year ?? 5) || 5;

  const workdaysPerYear = Math.max(0, (workdaysPerWeek * 52) - vacationDays - sickDays);
  const jobsPerTechPerDay = Number(company.jobs_per_tech_per_day ?? 1) || 1;

  // Company Setup uses a monthly workdays approximation.
  const workdaysPerMonth = workdaysPerYear / 12;
  const jobsPerMonth = techCount * jobsPerTechPerDay * workdaysPerMonth;

  return (
    <Card title={title}>
      <div className="grid2">
        <div className="stack">
          <label className="label">Job Type (Selected)</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
            {jobType ? jobType.name : 'Default / None'}
          </div>
        </div>

        <div className="stack">
          <label className="label">Efficiency (Selected Job Type)</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
            {tech.efficiencyPercent.toFixed(0)}%
          </div>
        </div>

        <div className="stack">
          <label className="label">Gross Margin Target (Selected Job Type)</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
            {tech.grossMarginTargetPercent.toFixed(0)}%
          </div>
        </div>

        <div className="stack">
          <label className="label">Overhead (Monthly)</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
            {money(tech.overheadMonthly)}
          </div>
        </div>

        <div className="stack">
          <label className="label">Overhead (Annual)</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
            {money(tech.overheadAnnual)}
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
            {tech.totalHoursYear.toFixed(0)}
          </div>
        </div>

        <div className="stack">
          <label className="label">Effective Hours / Year (Efficiency Applied)</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
            {tech.effectiveHoursYear.toFixed(0)}
          </div>
        </div>

        <div className="stack">
          <label className="label">Overhead / Labor Hour</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
            ${tech.overheadPerHour.toFixed(2)}
          </div>
        </div>

        <div className="stack">
          <label className="label">Avg Tech Wage</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
            {money(tech.avgTechWage)}/hr
          </div>
        </div>

        <div className="stack">
          <label className="label">Loaded Labor Rate (Wage + Overhead)</label>
          <div className="input" style={{ display: 'flex', alignItems: 'center' }}>
            {money(tech.loadedLaborRate)}/hr
          </div>
        </div>

        {/** UI-only: hide Average Job Goal (Derived) in Estimates tech breakdown view */}
        {null}

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
                  {money(tech.requiredRevenuePerBillableHour)}/hr
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="muted small">
        This mirrors Admin → Company Setup cost breakdown, but uses the currently selected Job Type’s efficiency and gross margin.
      </div>
    </Card>
  );
}




