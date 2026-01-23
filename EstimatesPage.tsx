import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useData } from '../../providers/data/DataContext';
import type { Estimate } from '../../providers/data/types';

export function EstimatesPage() {
  const data = useData();
  const nav = useNavigate();
  const [rows, setRows] = useState<Estimate[]>([]);

  useEffect(() => {
    data.listEstimates().then(setRows).catch(console.error);
  }, [data]);

  return (
    <div className="stack">
      <Card title="Estimates" right={<Button variant="primary" onClick={() => nav('/estimates/new')}>Create Estimate</Button>}>
        <div className="muted">Draft → Sent → Approved/Declined → Archived (auto-archive after validity).</div>
      </Card>

      <Card title="List">
        <div className="list">
          {rows.map((e) => (
            <div key={e.id} className="listRow clickable" onClick={() => nav(`/estimates/${e.id}`)}>
              <div className="listMain">
                <div className="listTitle">#{e.number} • {e.name}</div>
                <div className="listSub">{e.customerName || '—'} • {e.status}</div>
              </div>
              <div className="listRight">
                <div className="pill">{new Date(e.createdAt).toLocaleDateString()}</div>
              </div>
            </div>
          ))}
          {rows.length === 0 ? <div className="muted">No estimates yet.</div> : null}
        </div>
      </Card>
    </div>
  );
}
