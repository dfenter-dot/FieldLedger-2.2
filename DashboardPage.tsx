import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';

export function DashboardPage() {
  return (
    <div className="grid2">
      <Card title="Quick Actions" right={<Button variant="primary">New Estimate</Button>}>
        <div className="stack">
          <Button>Import Materials</Button>
          <Button>Import Assemblies</Button>
          <Button>Go to Job Costing</Button>
        </div>
      </Card>

      <Card title="At a Glance">
        <div className="kpiRow">
          <div className="kpi">
            <div className="kpiLabel">Active Estimates</div>
            <div className="kpiValue">—</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Approved</div>
            <div className="kpiValue">—</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Archived</div>
            <div className="kpiValue">—</div>
          </div>
        </div>
      </Card>

      <Card title="Recent Estimates">
        <div className="muted">Connect to your data provider to show recent estimates.</div>
      </Card>

      <Card title="Tips & Resources">
        <div className="muted">Short tips will live here later (optional).</div>
      </Card>
    </div>
  );
}
