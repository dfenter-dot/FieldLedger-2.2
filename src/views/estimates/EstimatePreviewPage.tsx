import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';

/**
 * PDF / Customer View
 *
 * Per the current architecture, customer-facing PDF output is intentionally a placeholder
 * until the final PDF implementation is completed.
 */
export function EstimatePreviewPage() {
  const nav = useNavigate();

  return (
    <div className="stack">
      <Card
        title="PDF Preview (Coming Soon)"
        right={
          <div className="row">
            <Button onClick={() => nav(-1)}>Back</Button>
          </div>
        }
      >
        <div className="muted">
          Customer View / PDF output is not yet finalized in this build.
        </div>
      </Card>
    </div>
  );
}

