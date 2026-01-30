import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useSelection } from '../../providers/selection/SelectionContext';

export function AssembliesHomePage() {
  const nav = useNavigate();
  const { mode, setMode } = useSelection();

  const inPickerMode = mode.type === 'add-assemblies-to-estimate';
  const returnPath = inPickerMode ? `/estimates/${mode.estimateId}` : null;
  return (
    <div className="grid2">
      {inPickerMode ? (
        <Card
          title="Picker mode"
          right={
            <div className="row">
              <Button
                onClick={() => {
                  if (returnPath) nav(returnPath);
                  setMode({ type: 'none' });
                }}
              >
                Return to Estimate
              </Button>
            </div>
          }
        >
          <div className="muted">
            Select a library to pick assemblies from. Your selection will be returned when you click the return button.
          </div>
        </Card>
      ) : null}

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

