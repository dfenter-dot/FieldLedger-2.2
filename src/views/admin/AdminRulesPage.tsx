import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { AdminRule, JobType } from '../../providers/data/types';

function newRule(companyId: string): AdminRule {
  return {
    id: crypto.randomUUID?.() ?? `rule_${Date.now()}`,
    companyId,
    priority: 1,
    name: 'New Rule',
    enabled: true,
    jobTypeId: null,
    definitionJson: {},
  };
}

export function AdminRulesPage() {
  const data = useData();
  const [rules, setRules] = useState<AdminRule[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [editing, setEditing] = useState<Record<string, AdminRule>>({});
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    Promise.all([
      data.listAdminRules(),
      data.listJobTypes(),
    ])
      .then(([r, jts]) => {
        setRules(r);
        setJobTypes(jts);
      })
      .catch((e) => {
        console.error(e);
        setStatus(String(e?.message ?? e));
      });
  }, [data]);

  const jobTypeOptions = useMemo(() => {
    return jobTypes.map((jt) => ({ id: jt.id, name: jt.name }));
  }, [jobTypes]);

  function startEdit(r: AdminRule) {
    setEditing((prev) => ({ ...prev, [r.id]: { ...r } }));
  }

  async function save(r: AdminRule) {
    try {
      setStatus('Saving...');
      const saved = await data.upsertAdminRule(r);
      setRules((prev) => {
        const next = prev.some((x) => x.id === saved.id)
          ? prev.map((x) => (x.id === saved.id ? saved : x))
          : [...prev, saved];
        return [...next].sort((a, b) => a.priority - b.priority);
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

  async function remove(id: string) {
    try {
      setStatus('Deleting...');
      await data.deleteAdminRule(id);
      setRules((prev) => prev.filter((x) => x.id !== id));
      setStatus('Deleted.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function create() {
    try {
      // companyId is server-scoped under RLS; we keep a placeholder for local mode
      const r = newRule('mock-company');
      setEditing((prev) => ({ ...prev, [r.id]: r }));
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  return (
    <div className="stack">
      <Card title="Admin Rules" right={<Button variant="primary" onClick={create}>Create Rule</Button>}>
        <div className="muted">
          Rules are ordered by priority (lowest wins). This is minimal wiring scaffolding: edit fields and save.
        </div>
      </Card>

      <Card title="Rules">
        <div className="stack">
          {[...rules]
            .map((r) => {
              const draft = editing[r.id];
              const row = draft ?? r;
              const isEditing = Boolean(draft);

              return (
                <div key={r.id} className="stack" style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'rgba(31,41,55,0.4)' }}>
                  <div className="rowBetween">
                    <div className="row" style={{ alignItems: 'center' }}>
                      <strong>{r.name}</strong>
                      {!r.enabled ? <span className="pill">Disabled</span> : null}
                      <span className="pill">Priority: {r.priority}</span>
                    </div>
                    <div className="row">
                      {!isEditing ? (
                        <>
                          <Button onClick={() => startEdit(r)}>Edit</Button>
                          <Button onClick={() => remove(r.id)}>Delete</Button>
                        </>
                      ) : (
                        <>
                          <Button variant="primary" onClick={() => save(row)}>Save</Button>
                          <Button onClick={() => setEditing((prev) => { const { [r.id]: _, ...rest } = prev; return rest; })}>Cancel</Button>
                        </>
                      )}
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="grid2">
                      <div className="stack">
                        <label className="label">Name</label>
                        <Input value={row.name} onChange={(e) => setEditing((prev) => ({ ...prev, [r.id]: { ...row, name: e.target.value } }))} />
                      </div>

                      <div className="stack">
                        <label className="label">Priority (lowest wins)</label>
                        <Input value={String(row.priority)} onChange={(e) => setEditing((prev) => ({ ...prev, [r.id]: { ...row, priority: Number(e.target.value || 0) } }))} />
                      </div>

                      <div className="stack">
                        <label className="label">Job Type (if rule selects one)</label>
                        <select
                          className="textarea"
                          value={row.jobTypeId ?? ''}
                          onChange={(e) => setEditing((prev) => ({ ...prev, [r.id]: { ...row, jobTypeId: e.target.value || null } }))}
                        >
                          <option value="">(none)</option>
                          {jobTypeOptions.map((jt) => (
                            <option key={jt.id} value={jt.id}>{jt.name}</option>
                          ))}
                        </select>
                      </div>

                      <div className="stack">
                        <label className="label">Enabled</label>
                        <Toggle checked={row.enabled} onChange={(v) => setEditing((prev) => ({ ...prev, [r.id]: { ...row, enabled: v } }))} label={row.enabled ? 'Yes' : 'No'} />
                      </div>

                      <div className="stack" style={{ gridColumn: '1 / -1' }}>
                        <label className="label">Definition (JSON)</label>
                        <textarea
                          className="textarea"
                          rows={6}
                          value={JSON.stringify(row.definitionJson ?? {}, null, 2)}
                          onChange={(e) => {
                            const v = e.target.value;
                            let parsed: any = row.definitionJson ?? {};
                            try { parsed = JSON.parse(v); } catch { /* keep last valid */ }
                            setEditing((prev) => ({ ...prev, [r.id]: { ...row, definitionJson: parsed } }));
                          }}
                        />
                        <div className="muted small">
                          This field stores rule criteria without changing pricing logic. The evaluation engine can be wired later.
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}

          {rules.length === 0 ? <div className="muted">No rules yet.</div> : null}
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>
    </div>
  );
}

