import { Card } from '../../ui/components/Card';

export function CompanySetupPage() {
  return (
    <div className="stack">
      <Card title="Company Setup">
        <div className="muted">
          Wiring coming next:
          hours/capacity, expenses (lump + itemized), profit goals, technician wage modal,
          markups (tier/fixed), purchase tax, misc %, discounts, processing fees, min labor minutes,
          estimate validity, starting estimate number, and computed company breakdown.
        </div>
      </Card>
    </div>
  );
}
