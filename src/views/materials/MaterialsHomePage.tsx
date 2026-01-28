import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useSelection } from '../../providers/selection/SelectionContext';

export function MaterialsHomePage() {
  const nav = useNavigate();
  const { mode, setMode } = useSelection();

  const inPickerMode = mode.type === 'add-materials-to-assembly' || mode.type === 'add-materials-to-estimate';
  const returnLabel = mode.type === 'add-materials-to-assembly' ? 'Return to Assembly' : 'Return to Estimate';
  const returnPath =
    mode.type === 'add-materials-to-assembly'
      ? `/assemblies/user/${mode.assemblyId}`
      : mode.type === 'add-materials-to-estimate'
        ? `/estimates/${mode.estimateId}`
        : null;

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
                {returnLabel}
              </Button>
            </div>
          }
        >
          <div className="muted">
            Select a library to pick materials from. Your selection will be returned when you click the return button.
          </div>
        </Card>
      ) : null}

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

