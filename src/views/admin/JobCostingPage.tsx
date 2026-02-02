import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, Estimate, Material } from '../../providers/data/types';
import { computeEstimatePricing, computeEstimateTotalsNormalized, getAverageTechnicianWage } from '../../providers/data/pricing';
import { useSelection } from '../../providers/selection/SelectionContext';

function n(v: any, fallback = 0) {
  const num = Number(v);
  return Number.isFinite(num) ? num : fallback;
}

export function JobCostingPage() {
  const data = useData();
  const nav = useNavigate();
  const loc = useLocation();
  const { setMode } = useSelection();

  const params = new URLSearchParams(loc.search);
  const estimateId = params.get('estimateId');

  const [estimate, setEstimate] = useState<Estimate | null>(null);
  const [status, setStatus] = useState<string>('');
  const [companySettings, setCompanySettings] = useState<any | null>(null);
  const [jobTypes, setJobTypes] = useState<any[]>([]);
  const [materialCache, setMaterialCache] = useState<Record<string, Material | null>>({});
  const [assemblyCache, setAssemblyCache] = useState<Record<string, Assembly | null>>({});

  // Actuals entered by user
  const [actualRevenue, setActualRevenue] = useState<string>('');
  const [actualLaborHours, setActualLaborHours] = useState<string>('');
  const [actualLaborMinutes, setActualLaborMinutes] = useState<string>('');
  const [actualMaterialCost, setActualMaterialCost] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [adjustEstimate, setAdjustEstimate] = useState<boolean>(false);

  useEffect(() => {
    Promise.all([data.getCompanySettings(), data.listJobTypes()])
      .then(([s, jts]) => {
        setCompanySettings(s);
        setJobTypes(jts as any);
      })
      .catch(() => void 0);
  }, [data]);

  useEffect(() => {
    if (!estimateId) {
      setEstimate(null);
      return;
    }
    data.getEstimate(estimateId)
      .then((e) => {
        setEstimate(e);
        // preload actual revenue if blank
        if (!actualRevenue) setActualRevenue('');
      })
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, estimateId]);

  useEffect(() => {
    const items = estimate?.items ?? [];
    const matIds = Array.from(new Set(items.map((it: any) => it.material_id).filter(Boolean)));
    const asmIds = Array.from(new Set(items.map((it: any) => it.assembly_id).filter(Boolean)));
    let cancelled = false;
    (async () => {
      const nextM: Record<string, Material | null> = {};
      for (const id of matIds) {
        try {
          nextM[id] = await data.getMaterial(id);
        } catch {
          nextM[id] = null;
        }
      }
      const nextA: Record<string, Assembly | null> = {};
      for (const id of asmIds) {
        try {
          nextA[id] = await data.getAssembly(id);
        } catch {
          nextA[id] = null;
        }
      }
      if (!cancelled) {
        setMaterialCache(nextM);
        setAssemblyCache(nextA);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, estimate]);

  const expected = useMemo(() => {
    if (!estimate || !companySettings) return null;
    const jobTypesById = Object.fromEntries(jobTypes.map((j) => [j.id, j]));
    const totals = computeEstimateTotalsNormalized({
  estimate,
  materialsById: materialCache,
  assembliesById: assemblyCache,
  jobTypesById,
  companySettings,
});
const wage = getAverageTechnicianWage(companySettings);
const laborCost = wage * (totals.labor_minutes_expected / 60);
return {
  total: totals.total,
  labor_minutes_expected: totals.labor_minutes_expected,
  material_cost: totals.material_cost,
  labor_cost: laborCost,
  gross_margin_expected_percent: totals.gross_margin_expected_percent,
};
  }, [assemblyCache, companySettings, estimate, jobTypes, materialCache]);

  const actual = useMemo(() => {
    const revenue = n(actualRevenue, NaN);
    const matCost = n(actualMaterialCost, NaN);
    const mins = n(actualLaborHours, 0) * 60 + n(actualLaborMinutes, 0);
    const wage = companySettings ? getAverageTechnicianWage(companySettings) : 0;
    const laborCost = wage * (mins / 60);
    if (!Number.isFinite(revenue) || !Number.isFinite(matCost)) {
      return { revenue: NaN, matCost: NaN, laborMins: mins, laborCost, grossProfit: NaN, grossMargin: NaN };
    }
    const grossProfit = revenue - matCost - laborCost;
    const grossMargin = revenue > 0 ? (grossProfit / revenue) * 100 : NaN;
    return { revenue, matCost, laborMins: mins, laborCost, grossProfit, grossMargin };
  }, [actualLaborHours, actualLaborMinutes, actualMaterialCost, actualRevenue, companySettings]);

  return (
    <div className="stack">
      <Card
        title="Job Costing"
        right={
          <div className="row noPrint">
            <Button
              variant="primary"
              onClick={() => {
                setMode({ type: 'job-costing-pick-estimate' });
                nav('/estimates');
              }}
            >
              Select Estimate
            </Button>
            <Button onClick={() => window.print()} disabled={!estimate}>Print / Save PDF</Button>
          </div>
        }
      >
        <div className="muted">Choose an estimate to load expected numbers. Enter actuals to compare performance.</div>
        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>

      <Card title="Options">
        <Toggle checked={adjustEstimate} onChange={setAdjustEstimate} label="Adjust estimate baseline (change orders)" />
        <div className="muted small mt">Optional toggle for future change-order baselines. (No automatic recalculation in Phase 3.)</div>
      </Card>

      <div className="grid2">
        <Card title="Expected (from estimate)">
          {!estimate ? <div className="muted">No estimate selected.</div> : null}
          {estimate ? (
            <div className="printPage">
              <div className="printHeader">
                <div>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>Job Costing Report</div>
                  <div className="muted small">Estimate #{estimate.estimate_number} • {estimate.name}</div>
                </div>
                <div className="printMeta">
                  <div className="muted small">Generated</div>
                  <div style={{ fontWeight: 650 }}>{new Date().toLocaleDateString()}</div>
                </div>
              </div>

              <div className="printSection">
                <div className="printSectionTitle">Expected</div>
                {expected ? (
                  <div className="stack">
                    <div className="metric"><span>Expected Revenue (incl. processing)</span><strong>${expected.total.toFixed(2)}</strong></div>
                    <div className="metric"><span>Expected Labor (efficiency applied)</span><strong>{(expected.labor_minutes_expected / 60).toFixed(2)} hrs</strong></div>
                    <div className="metric"><span>Expected Materials (cost + tax)</span><strong>${expected.material_cost.toFixed(2)}</strong></div>
                    <div className="metric"><span>Misc Material (embedded in price)</span><strong>Admin Controlled</strong></div>
                    <div className="metric"><span>Expected Gross Profit</span><strong>${(expected.total - expected.material_cost - expected.labor_cost).toFixed(2)}</strong></div>
                    <div className="metric"><span>Expected Gross Margin</span><strong>{expected.gross_margin_expected_percent === null ? '—' : `${expected.gross_margin_expected_percent.toFixed(1)}%`}</strong></div>
                  </div>
                ) : (
                  <div className="muted">Loading pricing…</div>
                )}
              </div>
            </div>
          ) : null}
        </Card>

        <Card title="Actuals (enter what happened)">
          <div className="grid2">
            <div className="stack">
              <label className="label">Actual Revenue Received</label>
              <Input prefix="$" value={actualRevenue} onChange={(e) => setActualRevenue(e.target.value)} placeholder="e.g. 1250" />
            </div>

            <div className="stack">
              <label className="label">Actual Material Cost (cost + purchase tax)</label>
              <Input prefix="$" value={actualMaterialCost} onChange={(e) => setActualMaterialCost(e.target.value)} placeholder="e.g. 225" />
            </div>

            <div className="stack">
              <label className="label">Actual Labor Hours</label>
              <Input value={actualLaborHours} onChange={(e) => setActualLaborHours(e.target.value)} placeholder="e.g. 2" />
            </div>

            <div className="stack">
              <label className="label">Actual Labor Minutes</label>
              <Input value={actualLaborMinutes} onChange={(e) => setActualLaborMinutes(e.target.value)} placeholder="e.g. 30" />
            </div>
          </div>

          <div className="mt">
            <label className="label">Notes</label>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
          </div>

          <div className="mt">
            <div className="muted small">Calculated actual gross profit</div>
            <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <div className="pill">Labor COGS: ${actual.laborCost.toFixed(2)}</div>
              <div className="pill">Gross Profit: {Number.isFinite(actual.grossProfit) ? `$${actual.grossProfit.toFixed(2)}` : '—'}</div>
              <div className="pill">Gross Margin: {Number.isFinite(actual.grossMargin) ? `${actual.grossMargin.toFixed(1)}%` : '—'}</div>
            </div>
          </div>

          <div className="muted small mt">
            "Print / Save PDF" uses your browser print-to-PDF. Email wiring is intentionally not implemented in Phase 3.
          </div>
        </Card>
      </div>
    </div>
  );
}



