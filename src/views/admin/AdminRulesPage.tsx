import { useEffect, useMemo, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { AdminRule, JobType } from '../../providers/data/types';
import { useDialogs } from '../../providers/dialogs/DialogContext';

type Operator = AdminRule['operator'];
type ConditionType = AdminRule['condition_type'];

const CONDITION_LABELS: Record<ConditionType, string> = {
  expected_labor_hours: 'Expected labor hours (after efficiency)',
  material_cost: 'Material cost (cost + tax, no markup)',
  line_item_count: 'Line item count',
  any_line_item_qty: 'Any line item quantity (max qty)',
};

const OPERATORS: Operator[] = ['>=', '>', '<=', '<', '==', '!='];

function newRule(nextPriority: number): AdminRule {
  const id = crypto.randomUUID?.() ?? `rule_${Date.now()}`;
  return {
    id,
    // company_id is enforced server-side by the data provider (currentCompanyId)
    company_id: null as any,
    name: 'New Rule',
    description: '',
    enabled: true,
    priority: nextPriority,
    scope: 'both',
    condition_type: 'expected_labor_hours',
    operator: '>=',
    threshold_value: 0,
    target_job_type_id: null,
  };
}

function toNumberOr(value: string, fallback: number) {
  if (value.trim() === '') return fallback;
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function AdminRulesPage() {
  const data = useData();
  const { confirm } = useDialogs();
  const [rules, setRules] = useState<AdminRule[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [editing, setEditing] = useState<Record<string, AdminRule>>({});
  const [status, setStatus] = useState<string>('');

  const enabledJobTypes = useMemo(() => jobTypes.filter(j => j.enabled), [jobTypes]);

  useEffect(() => {
    Promise.all([data.listAdminRules(), data.listJobTypes()])
      .then(([r, jt]) => {
        setRules((r ?? []).slice().sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0)));
        setJobTypes(jt ?? []);
      })
      .catch((e) => {
        console.error(e);
        setStatus(String((e as any)?.message ?? e));
      });
  }, [data]);

  function startEdit(rule: AdminRule) {
    setEditing((prev) => ({ ...prev, [rule.id]: { ...rule } }));
  }

  function cancelEdit(id: string) {
    setEditing((prev) => {
      const { [id]: _, ...rest } = prev;
      return rest;
    });
  }

  async function save(rule: AdminRule) {
    try {
      setStatus('Saving...');
      const saved = await data.upsertAdminRule({
        ...rule,
        // normalize
        description: rule.description?.trim() ? rule.description : null,
        threshold_value: Number(rule.threshold_value ?? 0),
      });

      setRules((prev) => {
        const exists = prev.some((x) => x.id === saved.id);
        const next = exists ? prev.map((x) => (x.id === saved.id ? (saved as any) : x)) : [...prev, (saved as any)];
        return [...next].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
      });
      cancelEdit(rule.id);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1200);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: 'Delete Rule',
      message: 'Delete this rule?',
      confirmText: 'Delete',
      danger: true,
    });
    if (!ok) return;

    try {
      setStatus('Deleting...');
      await data.deleteAdminRule(id);
      setRules((prev) => prev.filter((x) => x.id !== id));
      cancelEdit(id);
      setStatus('Deleted.');
      setTimeout(() => setStatus(''), 1200);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  function create() {
    const nextPriority = (rules.reduce((m, r) => Math.max(m, r.priority ?? 0), 0) || 0) + 1;
    const r = newRule(nextPriority);

    // Add a local draft row so it renders immediately (even before saving)
    setRules((prev) => {
      const next = [...prev, r];
      return next.sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
    });

    setEditing((prev) => ({ ...prev, [r.id]: r }));
  }

  function explain(rule: AdminRule): string {
    const cond = CONDITION_LABELS[rule.condition_type];
    const op = rule.operator;
    const thr = rule.threshold_value;
    const jt = enabledJobTypes.find(j => j.id === rule.target_job_type_id) ?? jobTypes.find(j => j.id === rule.target_job_type_id);
    const jtName = jt?.name ?? '(no job type selected)';
    return `IF ${cond} ${op} ${thr} → set Job Type = ${jtName}`;
  }

  return (
    <div className="stack">
      <Card
        title="Admin Rules"
        right={<Button variant="primary" onClick={create}>Create Rule</Button>}
      >
        <div className="muted small">
          Rules run only when a user clicks <strong>Apply Changes</strong> in an Estimate or Assembly. Rules are evaluated by priority (lowest number wins). First match wins.
        </div>
        <div className="muted small">
          Note: Scope is stored for future use, but Phase 1 treats rules as <strong>both</strong>.
        </div>
      </Card>

      <Card title="Rules">
        <div className="stack">
          {rules.length === 0 ? <div className="muted">No rules yet.</div> : null}

          {rules.map((r) => {
            const draft = editing[r.id];
            const row = draft ?? r;
            const isEditing = Boolean(draft);
            const targetDisabled = row.target_job_type_id
              ? Boolean(jobTypes.find(j => j.id === row.target_job_type_id && !j.enabled))
              : false;

            return (
              <div
                key={r.id}
                className="stack"
                style={{
                  border: '1px solid var(--border)',
                  borderRadius: 12,
                  padding: 12,
                  background: 'rgba(31,41,55,0.4)',
                }}
              >
                <div className="rowBetween">
                  <div className="row" style={{ alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <strong>{r.name}</strong>
                    {!r.enabled ? <span className="pill">Disabled</span> : null}
                    <span className="pill">Priority: {r.priority}</span>
                    {targetDisabled ? <span className="pill">Target job type disabled</span> : null}
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
                        <Button onClick={() => cancelEdit(r.id)}>Cancel</Button>
                      </>
                    )}
                  </div>
                </div>

                <div className="muted small">{explain(row)}</div>

                {isEditing ? (
                  <div className="grid2" style={{ marginTop: 8 }}>
                    <div className="stack">
                      <label className="label">Name</label>
                      <Input
                        value={row.name}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [r.id]: { ...row, name: e.target.value },
                          }))
                        }
                      />
                    </div>

                    <div className="stack">
                      <label className="label">Priority (lowest wins)</label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={String(row.priority)}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [r.id]: {
                              ...row,
                              priority: toNumberOr(e.target.value, row.priority ?? 0),
                            },
                          }))
                        }
                      />
                    </div>

                    <div className="stack">
                      <label className="label">Enabled</label>
                      <Toggle
                        checked={row.enabled}
                        onChange={(v) =>
                          setEditing((prev) => ({ ...prev, [r.id]: { ...row, enabled: v } }))
                        }
                        label={row.enabled ? 'Yes' : 'No'}
                      />
                    </div>

                    <div className="stack">
                      <label className="label">Condition</label>
                      <select
                        className="input"
                        value={row.condition_type}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [r.id]: { ...row, condition_type: e.target.value as ConditionType },
                          }))
                        }
                      >
                        {Object.entries(CONDITION_LABELS).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="stack">
                      <label className="label">Operator</label>
                      <select
                        className="input"
                        value={row.operator}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [r.id]: { ...row, operator: e.target.value as Operator },
                          }))
                        }
                      >
                        {OPERATORS.map((op) => (
                          <option key={op} value={op}>
                            {op}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="stack">
                      <label className="label">Threshold</label>
                      <Input
                        type="number"
                        inputMode="decimal"
                        value={String(row.threshold_value ?? 0)}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [r.id]: { ...row, threshold_value: toNumberOr(e.target.value, row.threshold_value ?? 0) },
                          }))
                        }
                      />
                      <div className="muted small">
                        Use hours for labor rules (e.g., 8). Use dollars for material cost rules (e.g., 2500).
                      </div>
                    </div>

                    <div className="stack" style={{ gridColumn: '1 / -1' }}>
                      <label className="label">Target Job Type</label>
                      <select
                        className="input"
                        value={row.target_job_type_id ?? ''}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [r.id]: { ...row, target_job_type_id: e.target.value || null },
                          }))
                        }
                      >
                        <option value="">(select job type)</option>
                        {enabledJobTypes.map((jt) => (
                          <option key={jt.id} value={jt.id}>
                            {jt.name}
                          </option>
                        ))}
                      </select>
                      <div className="muted small">Only enabled job types are available as targets.</div>
                    </div>

                    <div className="stack" style={{ gridColumn: '1 / -1' }}>
                      <label className="label">Description (optional)</label>
                      <Input
                        value={row.description ?? ''}
                        onChange={(e) =>
                          setEditing((prev) => ({
                            ...prev,
                            [r.id]: { ...row, description: e.target.value },
                          }))
                        }
                        placeholder="Example: Long jobs should use Install pricing."
                      />
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>

        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>
    </div>
  );
}


