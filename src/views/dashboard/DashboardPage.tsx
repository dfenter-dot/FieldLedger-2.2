import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useData } from '../../providers/data/DataContext';
import type { Estimate } from '../../providers/data/types';

export function DashboardPage() {
  const data = useData();
  const nav = useNavigate();
  const [estimates, setEstimates] = useState<Estimate[]>([]);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.listEstimates()
      .then(setEstimates)
      .catch((e) => {
        console.error(e);
        setStatus('Connect to your data provider to show dashboard stats.');
      });
  }, [data]);

  const kpis = useMemo(() => {
    const active = estimates.filter((e) => e.status !== 'archived').length;
    const approved = estimates.filter((e) => e.status === 'approved').length;
    const archived = estimates.filter((e) => e.status === 'archived').length;
    return { active, approved, archived };
  }, [estimates]);

  const recent = useMemo(() => {
    return [...estimates]
      .sort((a, b) => (b.number ?? 0) - (a.number ?? 0))
      .slice(0, 5);
  }, [estimates]);

  return (
    <div className="grid2">
      <Card
        title="Quick Actions"
        right={<Button variant="primary" onClick={() => nav('/estimates')}>New Estimate</Button>}
      >
        <div className="stack">
          <Button onClick={() => nav('/admin/csv')}>Import Materials</Button>
          <Button onClick={() => nav('/admin/csv')}>Import Assemblies</Button>
          <Button onClick={() => nav('/admin/job-costing')}>Go to Job Costing</Button>
        </div>
      </Card>

      <Card title="At a Glance">
        <div className="kpiRow">
          <div className="kpi">
            <div className="kpiLabel">Active Estimates</div>
            <div className="kpiValue">{estimates.length ? kpis.active : '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Approved</div>
            <div className="kpiValue">{estimates.length ? kpis.approved : '—'}</div>
          </div>
          <div className="kpi">
            <div className="kpiLabel">Archived</div>
            <div className="kpiValue">{estimates.length ? kpis.archived : '—'}</div>
          </div>
        </div>
        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>

      <Card title="Recent Estimates" right={<Button onClick={() => nav('/estimates')}>View All</Button>}>
        {recent.length ? (
          <div className="list">
            {recent.map((e) => (
              <div
                key={e.id}
                className="listRow clickable"
                onClick={() => nav(`/estimates/${e.id}`)}
                role="button"
                tabIndex={0}
              >
                <div className="listMain">
                  <div className="listTitle">#{e.number} — {e.name}</div>
                  <div className="listSub">{e.customerName ?? 'No customer'} • {e.status}</div>
                </div>
                <div className="listRight">
                  <span className="pill">{new Date(e.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted">No recent estimates yet.</div>
        )}
        <div className="muted small mt">
          Dashboard is an overview only. Full estimate editing lives on the Estimates page.
        </div>
      </Card>

      <Card title="Tips & Resources">
        <div className="muted">Short tips will live here later (optional).</div>
      </Card>
    </div>
  );
}

