import { Card } from '../../ui/components/Card';

export function AdminRulesPage() {
  return (
    <div className="stack">
      <Card title="Admin Rules">
        <div className="muted">
          No default rules. Users create their own rules.
          Rules will be ordered by a priority number (winner takes all).
          Use Admin Rules = Yes locks job type; No allows manual job type selection.
          Apply Changes button will evaluate rules to prevent confusion while building.
        </div>
      </Card>
    </div>
  );
}
