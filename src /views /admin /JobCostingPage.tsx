import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { Estimate } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';
import { Toggle } from '../../ui/components/Toggle';

export function JobCostingPage() {
  const data = useData();
  const nav = useNavigate();
  const { setMode } = useSelection();

  const [estimate, setEstimate] = useState<Estimate | null>(null);

  // Actuals entered by user
  const [actualRevenue, setActualRevenue] = useState<string>('');
  const [actualLaborHours, setActualLaborHours] = useState<string>('');
  const [actualLaborMinutes, setActualLaborMinutes] = useState<string>('');
  const [actualMaterialCost, setActualMaterialCost] = useState<string>('');
  const [notes, setNotes] = useState<string>('');

  const [adjustEstimate, setAdjustEstimate] = useState<boolean>(false);

  const expected = useMemo(() => {
    // Placeholder: hooks into estimate math engine later
    return {
      expectedRevenue: '—',
      expectedLabor: '—',
      expectedMaterialCost: '—',
      expectedMiscMaterial: '—',
      expectedGrossProfit: '—',
      expectedGrossMargin: '—',
    };
  }, [estimate]);

  return (
    <div className="stack">
      <Card title="Job Costing" right={
        <Button variant="primary" onClick={() => {
          setMode({ type: 'job-costing-pick-estimate' });
          nav('/estimates');
        }}>
          Select Estimate
        </Button>
      }>
        <div className="muted">
          Pick an estimate to load expected numbers. Enter actuals to learn what to adjust.
        </div>
      </Card>

      <Card title="Options">
        <Toggle checked={adjustEstimate} onChange={setAdjustEstimate} label="Allow adjustments / change orders for this costing record" />
        <div className="muted small mt">
          If enabled, you can add adjustments that affect the expected side (useful for revised estimates/change orders).
        </div>
      </Card>

      <div className="grid2">
        <Card title="Expected (from estimate)">
          <div className="stack">
            <div className="metric"><span>Expected Revenue (incl. processing fees)</span><strong>{expected.expectedRevenue}</strong></div>
            <div className="metric"><span>Expected Labor (w/ efficiency)</span><strong>{expected.expectedLabor}</strong></div>
            <div className="metric"><span>Expected Material Cost (cost + purchase tax)</span><strong>{expected.expectedMaterialCost}</strong></div>
            <div className="metric"><span>Misc Material Total</span><strong>{expected.expectedMiscMaterial}</strong></div>
            <div className="metric"><span>Expected Gross Profit</span><strong>{expected.expectedGrossProfit}</strong></div>
            <div className="metric"><span>Expected Gross Margin</span><strong>{expected.expectedGrossMargin}</strong></div>
          </div>
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
            <label className="label">Notes (what went wrong / what to adjust)</label>
            <textarea className="textarea" value={notes} onChange={(e) => setNotes(e.target.value)} rows={5} />
          </div>

          <div className="row mt">
            <Button>Generate PDF</Button>
            <Button>Email PDF</Button>
          </div>

          <div className="muted small mt">
            Actual gross profit/margin (and optional net profit) will be calculated after the pricing engine is wired.
          </div>
        </Card>
      </div>
    </div>
  );
}
