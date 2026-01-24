import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Toggle } from '../../ui/components/Toggle';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { JobType } from '../../providers/data/types';

function makeNewJobType(): JobType {
  return {
    id: crypto.randomUUID?.() ?? `jt_${Date.now()}`,
    name: 'New Job Type',
    enabled: true,
    isDefault: false,
    mode: 'flat',
    grossMarginPct: 70,
    efficiencyPct: 50,
    allowDiscount: true,
  };
}

export function JobTypesPage() {
  const data = useData();
  const [rows, setRows] = useState<JobType[]>([]);
  const [editing, setEditing] = useState<Record<string, JobType>>({});
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.listJobTypes().then(setRows).catch((e) => {
      console.error(e);
      setStatus(String(e?.message ?? e));
    });
  }, [data]);

  const sorted = useMemo(() => {
    const draftOnly = Object.values(editing).filter((d) => !rows.some((r) => r.id === d.id));
    const combined = [...rows, ...draftOnly];
    // default first, then alpha
    return [...combined].sort((a, b) => {
      if (a.isDefault && !b.isDefault) return -1;
      if (!a.isDefault && b.isDefault) return 1;
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
      setRows((prev) => {
        const next = prev.some((x) => x.id === saved.id)
          ? prev.map((x) => (x.id === saved.id ? saved : x))
          : [...prev, saved];
        return next;
      });
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

  async function setDefault(id: string) {
    try {
      setStatus('Setting default...');
      await data.setDefaultJobType(id);
      setRows((prev) => prev.map((j) => ({ ...j, isDefault: j.id === id })));
      setStatus('Default updated.');
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
        <div className="muted">Job types drive margin, efficiency (flat rate), and hourly vs flat-rate mode.</div>
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
                  <div className="stack" style={{ flex: 1 }}>
                    <div className="row">
                      <strong>{jt.name}</strong>
                      {jt.isDefault ? <span className="pill gold">Default</span> : null}
                      {!jt.enabled ? <span className="pill">Disabled</span> : null}
                    </div>
                    <div className="row">
                      <span className="pill">{jt.mode === 'flat' ? 'Flat Rate' : 'Hourly'}</span>
                      <span className="pill">GM: {jt.grossMarginPct}%</span>
                      <span className="pill">Eff: {jt.efficiencyPct}%</span>
                      <span className="pill">{jt.allowDiscount ? 'Discounts allowed' : 'No discounts'}</span>
                    </div>
                  </div>
                  <div className="row">
                    <Button onClick={() => setDefault(jt.id)}>Set Default</Button>
                    {!isEditing ? (
                      <Button onClick={() => startEdit(jt)}>Edit</Button>
                    ) : (
                      <>
                        <Button variant="primary" onClick={() => save(row)}>Save</Button>
                        <Button onClick={() => setEditing((prev) => { const { [jt.id]: _, ...rest } = prev; return rest; })}>Cancel</Button>
                      </>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="grid2 mt">
                    <div className="stack">
                      <label className="label">Name</label>
                      <Input value={row.name} onChange={(e) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, name: e.target.value } }))} />
                    </div>

                    <div className="stack">
                      <label className="label">Mode</label>
                      <select className="textarea" value={row.mode} onChange={(e) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, mode: e.target.value as any } }))}>
                        <option value="flat">Flat Rate</option>
                        <option value="hourly">Hourly</option>
                      </select>
                    </div>

                    <div className="stack">
                      <label className="label">Gross Margin %</label>
                      <Input value={String(row.grossMarginPct)} onChange={(e) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, grossMarginPct: Number(e.target.value || 0) } }))} />
                    </div>

                    <div className="stack">
                      <label className="label">Efficiency % (flat rate)</label>
                      <Input value={String(row.efficiencyPct)} onChange={(e) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, efficiencyPct: Number(e.target.value || 0) } }))} />
                    </div>

                    <div className="stack">
                      <label className="label">Enabled</label>
                      <Toggle checked={row.enabled} onChange={(v) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, enabled: v } }))} label={row.enabled ? 'Yes' : 'No'} />
                    </div>

                    <div className="stack">
                      <label className="label">Allow Discounts</label>
                      <Toggle checked={row.allowDiscount} onChange={(v) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, allowDiscount: v } }))} label={row.allowDiscount ? 'Yes' : 'No'} />
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

