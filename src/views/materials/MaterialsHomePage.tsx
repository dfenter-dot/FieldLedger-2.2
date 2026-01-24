import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';

export function MaterialsHomePage() {
  const nav = useNavigate();
  return (
    <div className="grid2">
      <Card title="Materials Libraries">
        <div className="stack">
          <Button onClick={() => nav('/materials/user')}>User Materials</Button>
          <Button onClick={() => nav('/materials/app')}>App Materials</Button>
        </div>
      </Card>

      <Card title="Search">
        <div className="muted">Global search dropdown will be wired later.</div>
      </Card>
    </div>
  );
}
