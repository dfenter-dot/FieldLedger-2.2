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
    name: 'Service',
    description: null,
    is_default: false,
    enabled: true,
    profit_margin_percent: 70,
    efficiency_percent: 50,
    allow_discounts: true,
    billing_mode: 'flat',
    hourly_material_markup_mode: 'company',
    hourly_material_markup_fixed_percent: 0,
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
        const msg = String((e as any)?.message ?? e);
        if (msg.toLowerCase().includes('schema cache')) {
          setStatus(
            msg +
              "\n\nHint: This usually means your Supabase 'job_types' table is missing one of the columns the UI expects (e.g. allow_discounts, profit_margin_percent). Add the missing column(s) and run: select pg_notify('pgrst','reload schema');"
          );
        } else {
          setStatus(msg);
        }
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
      // Default is managed ONLY via setDefaultJobType().
      // Prevent accidental removal or reassignment of the default flag via the edit form.
      const existing = rows.find((x) => x.id === jt.id);
      const enforcedIsDefault = existing?.is_default ?? false;
      const payload = { ...jt, is_default: enforcedIsDefault };

      const saved = await data.upsertJobType(payload);

      // If this job type is the default, refresh from the server to ensure the default flag stays consistent.
      if (enforcedIsDefault) {
        const fresh = await data.listJobTypes();
        setRows(fresh);
      } else {
        setRows((prev) => (prev.some((x) => x.id === saved.id) ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved]));
      }
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

  async function remove(jt: JobType) {
    if (jt.is_default) {
      setStatus('Cannot delete the default job type. Set a different default first.');
      setTimeout(() => setStatus(''), 2500);
      return;
    }
    const ok = window.confirm(`Delete job type "${jt.name}"? This cannot be undone.`);
    if (!ok) return;
    try {
      setStatus('Deleting...');
      await data.deleteJobType(jt.id);
      const fresh = await data.listJobTypes();
      setRows(fresh);
      setStatus('Deleted.');
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
                        {!jt.is_default ? <Button variant="danger" onClick={() => remove(jt)}>Delete</Button> : null}
                      </>
                    ) : (
                      <>
                        <Button variant="primary" onClick={() => save(row)}>Save</Button>
                        <Button onClick={() => setEditing((prev) => { const { [jt.id]: _, ...rest } = prev; return rest; })}>Cancel</Button>
                        {!jt.is_default ? <Button onClick={() => setDefault(jt.id)}>Make Default</Button> : null}
                        {!jt.is_default ? <Button variant="danger" onClick={() => remove(jt)}>Delete</Button> : null}
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
                      <div className="row" style={{ alignItems: 'center', gap: 10 }}>
                        {jt.is_default ? <span className="pill">Default</span> : <span className="muted">No</span>}
                        <span className="muted small">Default is set using “Set Default / Make Default”.</span>
                      </div>
                    </div>

                    <div className="stack">
                      <label className="label">Enabled</label>
                      <Toggle
                        checked={row.enabled !== false}
                        onChange={(v) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, enabled: v } }))}
                        label={row.enabled === false ? 'No' : 'Yes'}
                      />
                    </div>

                    <div className="stack">
                      <label className="label">Billing Mode</label>
                      <select
                        className="input"
                        value={row.billing_mode ?? 'flat'}
                        onChange={(ev) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, billing_mode: (ev.target.value as any) } }))}
                      >
                        <option value="flat">Flat Rate</option>
                        <option value="hourly">Hourly</option>
                      </select>
                    </div>

                    {row.billing_mode === 'hourly' ? (
                      <>
                        <div className="stack">
                          <label className="label">Material Markup (Hourly)</label>
                          <select
                            className="input"
                            value={(row as any).hourly_material_markup_mode ?? 'company'}
                            onChange={(ev) =>
                              setEditing((prev) => ({
                                ...prev,
                                [jt.id]: { ...row, hourly_material_markup_mode: (ev.target.value as any) },
                              }))
                            }
                          >
                            <option value="company">Use Company Setting</option>
                            <option value="fixed">Use Fixed Markup</option>
                            <option value="tiered">Use Tiered Markup</option>
                          </select>
                        </div>

                        {(row as any).hourly_material_markup_mode === 'fixed' ? (
                          <div className="stack">
                            <label className="label">Hourly Fixed Markup (%)</label>
                            <Input
                              type="text"
                              inputMode="decimal"
                              value={(row as any).hourly_material_markup_fixed_percent == null ? '' : String((row as any).hourly_material_markup_fixed_percent)}
                              onChange={(e) => {
                                const v = e.target.value.trim() === '' ? null : Number(e.target.value);
                                setEditing((prev) => ({
                                  ...prev,
                                  [jt.id]: {
                                    ...row,
                                    hourly_material_markup_fixed_percent: Number.isFinite(v as any) ? (v as any) : null,
                                  },
                                }));
                              }}
                            />
                          </div>
                        ) : (
                          <div />
                        )}
                      </>
                    ) : null}

                    <div className="stack">
                      <label className="label">Gross Margin Target (%)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={row.profit_margin_percent == null ? '' : String(row.profit_margin_percent)}
                        onChange={(e) => {
                          const v = e.target.value.trim() === '' ? null : Number(e.target.value);
                          setEditing((prev) => ({ ...prev, [jt.id]: { ...row, profit_margin_percent: Number.isFinite(v as any) ? (v as any) : null } }));
                        }}
                      />
                    </div>

                    <div className="stack">
                      <label className="label">Efficiency (%)</label>
                      <Input
                        type="text"
                        inputMode="decimal"
                        value={row.efficiency_percent == null ? '' : String(row.efficiency_percent)}
                        onChange={(e) => {
                          const v = e.target.value.trim() === '' ? null : Number(e.target.value);
                          setEditing((prev) => ({ ...prev, [jt.id]: { ...row, efficiency_percent: Number.isFinite(v as any) ? (v as any) : null } }));
                        }}
                      />
                    </div>

                    <div className="stack">
                      <label className="label">Allow Discounts</label>
                      <Toggle
                        checked={row.allow_discounts !== false}
                        onChange={(v) => setEditing((prev) => ({ ...prev, [jt.id]: { ...row, allow_discounts: v } }))}
                        label={row.allow_discounts === false ? 'No' : 'Yes'}
                      />
                    </div>

                    
                    <div className="stack">
                      <label className="label">Task Code Suffix (optional)</label>
                      <Input
                        value={(row.assembly_task_code_suffix ?? row.task_code_suffix) ?? ''}
                        placeholder="e.g., SRV (3–6 chars)"
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [jt.id]: { ...row, assembly_task_code_suffix: e.target.value || null },
                          }))
                        }
                        onBlur={() => {
                          const raw = String((row.assembly_task_code_suffix ?? row.task_code_suffix) ?? '').trim();
                          if (!raw) {
                            setEditing((prev) => ({ ...prev, [jt.id]: { ...row, assembly_task_code_suffix: null, task_code_suffix: null } }));
                            return;
                          }
                          const cleaned = raw.replace(/\s+/g, '').toUpperCase();
                          const ok = /^[A-Z0-9]{3,6}$/.test(cleaned);
                          setEditing((prev) => ({
                            ...prev,
                            // Persist only the canonical column.
                            [jt.id]: { ...row, assembly_task_code_suffix: ok ? cleaned : null, task_code_suffix: null },
                          }));
                        }}
                      />
                      <div className="muted" style={{ marginTop: 6 }}>
                        Used to build Assembly task codes (master code + suffix). Leave blank to keep master code unchanged.
                      </div>
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





