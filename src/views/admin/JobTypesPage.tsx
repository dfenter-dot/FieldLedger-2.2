import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { JobType } from '../../providers/data/types';

function makeNewJobType(): JobType {
  return {
    id: crypto.randomUUID?.() ?? `jt_${Date.now()}`,
    company_id: '' as any,
    name: 'New Job Type',
    description: null,
    is_default: false,
    created_at: new Date().toISOString(),
  };
}

export function JobTypesPage() {
  const data = useData();
  const [rows, setRows] = useState<JobType[]>([]);
  const [editing, setEditing] = useState<Record<string, JobType>>({});
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.listJobTypes()
      .then(setRows)
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data]);

  const sorted = useMemo(() => {
    const draftOnly = Object.values(editing).filter((d) => !rows.some((r) => r.id === d.id));
    const combined = [...rows, ...draftOnly];
    return [...combined].sort((a, b) => {
      if (a.is_default && !b.is_default) return -1;
      if (!a.is_default && b.is_default) return 1;
      return a.name.localeCompare(b.name);
    });
  }, [rows, editing]);

  function startEdit(jt: JobType) {
    setEditing((prev) => ({ ...prev, [jt.id]: { ...jt } }));
  }

  async function save(jt: JobType) {
    try {
      setStatus('Saving...');
      const saved = await data.upsertJobType(jt);
      setRows((prev) => (prev.some((x) => x.id === saved.id) ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]));
      setEditing((prev) => {
        const { [saved.id]: _, ...rest } = prev;
        return rest;
      });
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function setDefault(jobTypeId: string) {
    try {
      setStatus('Updating default...');
      await data.setDefaultJobType(jobTypeId);
      const fresh = await data.listJobTypes();
      setRows(fresh);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  function create() {
    const jt = makeNewJobType();
    setEditing((prev) => ({ ...prev, [jt.id]: jt }));
  }

  return (
    <div className="stack">
      <Card title="Job Types" right={<Button variant="primary" onClick={create}>Create Job Type</Button>}>
        <div className="muted small">Edit fields and save. Default job type is used by pricing rules later.</div>
      </Card>

      <Card title="List">
        <div className="stack">
          {sorted.map((jt) => {
            const draft = editing[jt.id];
            const row = draft ?? jt;
            const isEditing = Boolean(draft);

            return (
              <div key={jt.id} className="stack" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(31,41,55,0.4)' }}>
                <div className="rowBetween">
                  <div className="row" style={{ alignItems: 'center' }}>
                    <strong>{jt.name}</strong>
                    {jt.is_default ? <span className="pill">Default</span> : null}
                  </div>
                  <div className="row">
                    {!isEditing ? (
                      <>
                        <Button onClick={() => startEdit(jt)}>Edit</Button>
                        {!jt.is_default ? <Button onClick={() => setDefault(jt.id)}>Set Default</Button> : null}
                      </>
                    ) : (
                      <>
                        <Button variant="primary" onClick={() => save(row)}>Save</Button>
                        <Button onClick={() => setEditing((prev) => { const { [jt.id]: _, ...rest } = prev; return rest; })}>Cancel</Button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid2">
                    <div className="stack">
                      <label className="label">Name</label>
                      <Input value={row.name} onChange={(e) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, name: e.target.value } }))} />
                    </div>

                    <div className="stack">
                      <label className="label">Default</label>
                      <Toggle checked={row.is_default} onChange={(v) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, is_default: v } }))} label={row.is_default ? 'Yes' : 'No'} />
                    </div>

                    <div className="stack" style={{ gridColumn: '1 / -1' }}>
                      <label className="label">Description</label>
                      <Input value={row.description ?? ''} onChange={(e) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, description: e.target.value || null } }))} />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
          {sorted.length === 0 ? <div className="muted">No job types yet.</div> : null}
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>
    </div>
  );
}

