import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../providers/auth/AuthContext';
import { useData } from '../../providers/data/DataContext';
import { AdminRule, JobType } from '../../providers/data/types';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Select } from '../../ui/components/Select';
import { Switch } from '../../ui/components/Switch';

const CONDITION_OPTIONS = [
  { value: 'expected_labor_hours', label: 'Expected Labor Hours ≥' },
  { value: 'material_cost', label: 'Material Cost ≥' },
  { value: 'line_item_count', label: 'Line Item Count ≥' },
  { value: 'any_line_item_qty', label: 'Any Line Item Qty ≥' },
];

export function AdminRulesPage() {
  const { user } = useAuth();
  const { dataProvider } = useData();

  const [companyId, setCompanyId] = useState<string | null>(null);

  const [rules, setRules] = useState<AdminRule[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [loading, setLoading] = useState(true);

  // Resolve companyId robustly (do NOT rely on AuthContext shape)
  useEffect(() => {
    let alive = true;

    (async () => {
      const fromUser =
        (user as any)?.company_id ??
        (user as any)?.companyId ??
        (user as any)?.companyID ??
        null;

      if (fromUser) {
        if (alive) setCompanyId(fromUser);
        return;
      }

      // Fallback: ask provider (Supabase provider can derive from profiles)
      const dp: any = dataProvider as any;
      if (typeof dp.getCurrentCompanyId === 'function') {
        try {
          const id = await dp.getCurrentCompanyId();
          if (alive) setCompanyId(id);
          return;
        } catch {
          // silent; we’ll stay null
        }
      }

      // If we can't resolve it, leave null (UI will show message below)
      if (alive) setCompanyId(null);
    })();

    return () => {
      alive = false;
    };
  }, [user, dataProvider]);

  // Load rules + job types once companyId is known
  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }

    let alive = true;

    (async () => {
      setLoading(true);
      try {
        const [rulesRes, jobTypesRes] = await Promise.all([
          (dataProvider as any).getAdminRules
            ? (dataProvider as any).getAdminRules(companyId)
            : (dataProvider as any).listAdminRules?.(),
          (dataProvider as any).getJobTypes
            ? (dataProvider as any).getJobTypes(companyId)
            : (dataProvider as any).listJobTypes?.(),
        ]);

        if (!alive) return;

        setRules((rulesRes ?? []) as AdminRule[]);
        setJobTypes(((jobTypesRes ?? []) as JobType[]).filter(j => j.enabled));
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [companyId, dataProvider]);

  const sortedRules = useMemo(
    () => [...rules].sort((a, b) => a.priority - b.priority),
    [rules]
  );

  const updateRule = async (rule: Partial<AdminRule>) => {
    if (!companyId) return;

    const saved: AdminRule = (dataProvider as any).upsertAdminRule
      ? await (dataProvider as any).upsertAdminRule(companyId, rule)
      : await (dataProvider as any).saveAdminRule(rule);

    setRules(prev =>
      prev.some(r => r.id === saved.id)
        ? prev.map(r => (r.id === saved.id ? saved : r))
        : [...prev, saved]
    );
  };

  const deleteRule = async (id: string) => {
    if (!companyId) return;
    if (!confirm('Delete this rule?')) return;

    if ((dataProvider as any).deleteAdminRule) {
      await (dataProvider as any).deleteAdminRule(companyId, id);
    } else if ((dataProvider as any).deleteAdminRuleById) {
      await (dataProvider as any).deleteAdminRuleById(id);
    } else {
      await (dataProvider as any).deleteAdminRule?.(id);
    }

    setRules(prev => prev.filter(r => r.id !== id));
  };

  if (loading) {
    return <div className="muted">Loading rules…</div>;
  }

  if (!companyId) {
    return (
      <Card title="Admin Rules">
        <div className="muted">
          Could not determine your company context. (This usually means the app
          user object doesn’t include company_id and the provider can’t resolve it.)
        </div>
      </Card>
    );
  }

  return (
    <div className="stack">
      <Card title="Admin Rules">
        <div className="muted small">
          Rules are evaluated only when “Apply Changes” is clicked on an Estimate or
          Assembly. Lower priority numbers run first; first match wins.
        </div>
      </Card>

      {sortedRules.map(rule => (
        <Card key={rule.id}>
          <div className="grid4">
            <Input
              value={rule.name}
              placeholder="Rule name"
              onChange={e => updateRule({ ...rule, name: e.target.value })}
            />

            <Select
              value={rule.condition_type}
              options={CONDITION_OPTIONS}
              onChange={v => updateRule({ ...rule, condition_type: v as any })}
            />

            <Input
              type="number"
              value={rule.threshold_value}
              onChange={e =>
                updateRule({
                  ...rule,
                  threshold_value: Number(e.target.value),
                })
              }
            />

            <Select
              value={rule.target_job_type_id ?? ''}
              options={[
                { value: '', label: 'Select Job Type' },
                ...jobTypes.map(j => ({ value: j.id, label: j.name })),
              ]}
              onChange={v =>
                updateRule({
                  ...rule,
                  target_job_type_id: v || null,
                })
              }
            />

            <Input
              type="number"
              value={rule.priority}
              onChange={e =>
                updateRule({
                  ...rule,
                  priority: Number(e.target.value),
                })
              }
            />

            <div className="inline gap">
              <Switch
                checked={rule.enabled}
                onChange={checked => updateRule({ ...rule, enabled: checked })}
              />
              <span className="muted small">Enabled</span>
            </div>

            <Button variant="danger" onClick={() => deleteRule(rule.id)}>
              Delete
            </Button>
          </div>
        </Card>
      ))}

      <Button
        onClick={() =>
          updateRule({
            name: 'New Rule',
            enabled: true,
            priority: sortedRules.length + 1,
            scope: 'both',
            condition_type: 'expected_labor_hours',
            operator: '>=',
            threshold_value: 0,
            target_job_type_id: null,
          })
        }
      >
        Add Rule
      </Button>
    </div>
  );
}
