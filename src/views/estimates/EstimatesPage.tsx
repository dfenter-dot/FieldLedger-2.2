import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useData } from '../../providers/data/DataContext';
import type { Estimate } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';

export function EstimatesPage() {
  const data = useData();
  const nav = useNavigate();
  const { mode, setMode } = useSelection();

  const [rows, setRows] = useState<Estimate[]>([]);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.listEstimates()
      .then(setRows)
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data]);

  return (
    <div className="stack">
      <Card
        title="Estimates"
        right={
          <Button variant="primary" onClick={() => nav('/estimates/new')}>
            Create Estimate
          </Button>
        }
      >
        <div className="muted small">
          This list is company-scoped under RLS. Click an estimate to edit.
        </div>
        {mode.type === 'job-costing-pick-estimate' ? (
          <div className="banner mt">Selection mode: Pick an estimate for Job Costing</div>
        ) : null}
        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>

      <Card title="List">
        <div className="list">
          {rows.map((e) => (
            <div
              key={e.id}
              className="listRow clickable"
              onClick={() => {
                if (mode.type === 'job-costing-pick-estimate') {
                  // For now we just exit selection mode and open the estimate.
                  setMode({ type: 'none' });
                }
                nav(`/estimates/${e.id}`);
              }}
            >
              <div className="listMain">
                <div className="listTitle">#{e.estimate_number} • {e.name}</div>
                <div className="listSub">Job Type: {e.job_type_id ?? '—'}</div>
              </div>
              <div className="listRight">
                <div className="pill">{new Date(e.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? <div className="muted">No estimates yet.</div> : null}
        </div>
      </Card>
    </div>
  );
}

