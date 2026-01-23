import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';

export function AssembliesHomePage() {
  const nav = useNavigate();
  return (
    <div className="grid2">
      <Card title="Assemblies Libraries">
        <div className="stack">
          <Button onClick={() => nav('/assemblies/user')}>User Assemblies</Button>
          <Button onClick={() => nav('/assemblies/app')}>App Assemblies</Button>
        </div>
      </Card>

      <Card title="Search">
        <div className="muted">Global search dropdown will be wired later.</div>
      </Card>
    </div>
  );
}
