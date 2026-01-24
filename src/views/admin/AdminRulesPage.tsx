import { useEffect, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { AdminRule } from '../../providers/data/types';

function makeNewRule(): AdminRule {
  return {
    id: crypto.randomUUID?.() ?? `rule_${Date.now()}`,
    company_id: '' as any,
    name: 'New Rule',
    priority: 1,
    enabled: true,
    created_at: new Date().toISOString(),
  };
}

export function AdminRulesPage() {
  const data = useData();
  const [rules, setRules] = useState<AdminRule[]>([]);
  const [editing, setEditing] = useState<Record<string, AdminRule>>({});
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    data.listAdminRules()
      .then(setRules)
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data]);

  function startEdit(r: AdminRule) {
    setEditing((prev) => ({ ...prev, [r.id]: { ...r } }));
  }

  async function save(r: AdminRule) {
    try {
      setStatus('Saving...');
      const saved = await data.upsertAdminRule(r);
      setRules((prev) => {
        const next = prev.some((x) => x.id === saved.id) ? prev.map((x) => (x.id === saved.id ? saved : x)) : [...prev, saved];
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
      // eslint-disable-next-line no-restricted-globals
      if (!confirm('Delete this rule?')) return;
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

  function create() {
    const r = makeNewRule();
    setEditing((prev) => ({ ...prev, [r.id]: r }));
  }

  return (
    <div className="stack">
      <Card title="Admin Rules" right={<Button variant="primary" onClick={create}>Create Rule</Button>}>
        <div className="muted small">Rules are ordered by priority (lowest wins). This page saves the existing admin_rules rows.</div>
      </Card>

      <Card title="Rules">
        <div className="stack">
          {rules.map((r) => {
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
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={String(row.priority)}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [r.id]: { ...row, priority: e.target.value === '' ? 0 : Number(e.target.value) } }))}
                      />
                    </div>

                    <div className="stack">
                      <label className="label">Enabled</label>
                      <Toggle checked={row.enabled} onChange={(v) => setEditing((prev) => ({ ...prev, [r.id]: { ...row, enabled: v } }))} label={row.enabled ? 'Yes' : 'No'} />
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

