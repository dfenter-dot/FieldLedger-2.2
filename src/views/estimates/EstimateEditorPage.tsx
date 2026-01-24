import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { Estimate } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';

export function EstimateEditorPage() {
  const { estimateId } = useParams();
  const data = useData();
  const nav = useNavigate();
  const { setMode } = useSelection();

  const [estimate, setEstimate] = useState<Estimate | null>(null);

  useEffect(() => {
    if (!estimateId) return;
    if (estimateId === 'new') {
      const now = new Date().toISOString();
      setEstimate({
        id: `new_${Date.now()}`,
        companyId: 'mock-company',
        number: 0,
        name: 'New Estimate',
        useAdminRules: false,
        customerSuppliesMaterials: false,
        applyProcessingFees: true,
        applyMiscMaterial: true,
        status: 'draft',
        createdAt: now,
        validUntil: null,
        discountId: null,
        jobTypeId: null,
      });
      return;
    }
    data.getEstimate(estimateId).then(setEstimate).catch(console.error);
  }, [data, estimateId]);

  const showBreakdown = true; // Admin toggle will control this later.

  const grossMarginIndicator = useMemo(() => {
    // Placeholder: real calculation comes from pricing engine.
    const target = 70;
    const expected = 62;
    const delta = expected - target;
    return { target, expected, delta };
  }, []);

  if (!estimate) return <div className="muted">Loading…</div>;

  return (
    <div className="stack">
      <Card
        title={`Estimate • ${estimate.name}`}
        right={
          <div className="row">
            <Button onClick={() => nav('/estimates')}>Back</Button>
            <Button variant="danger">Delete</Button>
            <Button variant="primary">Save</Button>
          </div>
        }
      >
        <div className="grid2">
          <div className="stack">
            <label className="label">Estimate Name</label>
            <Input value={estimate.name} onChange={(e) => setEstimate({ ...estimate, name: e.target.value })} />
          </div>
          <div className="stack">
            <label className="label">Customer Name</label>
            <Input value={estimate.customerName ?? ''} onChange={(e) => setEstimate({ ...estimate, customerName: e.target.value })} />
          </div>
        </div>

        <div className="row mt">
          <Button onClick={() => { setMode({ type: 'add-materials-to-estimate', estimateId: estimate.id }); nav('/materials/user'); }}>
            Add Materials
          </Button>
          <Button onClick={() => { setMode({ type: 'add-assemblies-to-estimate', estimateId: estimate.id }); nav('/assemblies/user'); }}>
            Add Assemblies
          </Button>
          <Button>Apply Changes</Button>
          <Button variant="primary">View Estimate (PDF)</Button>
          <Button>Save as Assembly</Button>
        </div>
      </Card>

      {showBreakdown ? (
        <Card title="Cost Breakdown (Internal)" right={<div className="pill">Based on job type: Service</div>}>
          <div className="grid2">
            <div className="stack">
              <div className="metric"><span>Total Labor (Actual @100%)</span><strong>—</strong></div>
              <div className="metric"><span>Total Labor (Expected w/ Efficiency)</span><strong>—</strong></div>
              <div className="metric"><span>Expected Material Cost (Cost+Tax)</span><strong>—</strong></div>
              <div className="metric"><span>Actual Material (With Markup)</span><strong>—</strong></div>
              <div className="metric"><span>Misc Material Total</span><strong>—</strong></div>
            </div>

            <div className="stack">
              <div className="metric"><span>Gross Margin Target</span><strong>{grossMarginIndicator.target}%</strong></div>
              <div className="metric"><span>Expected Gross Margin</span><strong>{grossMarginIndicator.expected}%</strong></div>
              <div className="metric">
                <span>Status</span>
                <strong className={grossMarginIndicator.delta >= 0 ? 'good' : 'warn'}>
                  {grossMarginIndicator.delta >= 0 ? 'Above target' : 'Below target'}
                </strong>
              </div>
              <div className="muted small">
                (Color indicators + “Based on job type” label are enabled. Final math hooks into the pricing engine.)
              </div>
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
