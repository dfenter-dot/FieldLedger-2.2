import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useData } from '../../providers/data/DataContext';
import type { Estimate, JobType } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';

export function EstimatesPage() {
  const data = useData();
  const nav = useNavigate();
  const { mode, setMode } = useSelection();

  const [rows, setRows] = useState<Estimate[]>([]);
  const [optionCounts, setOptionCounts] = useState<Record<string, number>>({});
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [filter, setFilter] = useState<'active' | 'approved' | 'declined' | 'archived'>('active');
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.listEstimates()
      .then(setRows)
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data]);

  // Load option counts so the list can show "X options" per estimate.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (!rows || rows.length === 0) {
          if (!cancelled) setOptionCounts({});
          return;
        }
        if (!(data as any).listEstimateOptions) return;
        const pairs = await Promise.all(
          rows.map(async (r: any) => {
            try {
              const opts = await (data as any).listEstimateOptions(String(r.id));
              const count = Math.max(0, (Array.isArray(opts) ? opts.length : 0) - 1);
              return [String(r.id), count] as const;
            } catch {
              return [String(r.id), 0] as const;
            }
          })
        );
        if (!cancelled) setOptionCounts(Object.fromEntries(pairs));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, rows]);


  const jobTypeName = (id?: string | null) => {
    if (!id) return '—';
    const jt = jobTypes.find((j) => j.id === id);
    return jt?.name ?? '—';
  };
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

      <Card title="Filters">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button variant={filter === 'active' ? 'primary' : 'secondary'} onClick={() => setFilter('active')}>
            Active
          </Button>
          <Button variant={filter === 'approved' ? 'primary' : 'secondary'} onClick={() => setFilter('approved')}>
            Approved
          </Button>
          <Button variant={filter === 'declined' ? 'primary' : 'secondary'} onClick={() => setFilter('declined')}>
            Declined
          </Button>
          <Button variant={filter === 'archived' ? 'primary' : 'secondary'} onClick={() => setFilter('archived')}>
            Archived
          </Button>
        </div>
      </Card>

      <Card title="List">
        <div className="list">
          {rows
            .filter((r) => {
              const s = (r.status ?? 'draft') as string;
              if (filter === 'active') return s === 'draft' || s === 'sent';
              if (filter === 'approved') return s === 'approved';
              if (filter === 'declined') return s === 'declined';
              return s === 'archived';
            })
            .map((e) => (
            <div
              key={e.id}
              className="listRow clickable"
              onClick={() => {
                if (mode.type === 'job-costing-pick-estimate') {
                  setMode({ type: 'none' });
                  nav(`/admin/job-costing?estimateId=${encodeURIComponent(e.id)}`);
                  return;
                }
                nav(`/estimates/${e.id}`);
              }}
            >
              <div className="listMain">
                <div className="listTitle">#{e.estimate_number} • {e.name}</div>
                <div className="listSub">
                  Job Type: {jobTypeName(e.job_type_id)} • {(optionCounts[String(e.id)] ?? 0)} options
                </div>
              </div>
              <div className="listRight">
                <div className="pill">{new Date(e.created_at).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
          {rows.filter((r) => {
            const s = (r.status ?? 'draft') as string;
            if (filter === 'active') return s === 'draft' || s === 'sent';
            if (filter === 'approved') return s === 'approved';
            if (filter === 'declined') return s === 'declined';
            return s === 'archived';
          }).length === 0 ? <div className="muted">No estimates in this view.</div> : null}
        </div>
      </Card>
    </div>
  );
}




