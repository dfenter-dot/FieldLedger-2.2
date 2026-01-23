import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useData } from '../../providers/data/DataContext';
import type { Folder, LibraryType, Material } from '../../providers/data/types';
import { useAuth } from '../../providers/auth/AuthContext';
import { useSelection } from '../../providers/selection/SelectionContext';

export function LibraryFolderPage({ kind }: { kind: 'materials' | 'assemblies' }) {
  const { libraryType } = useParams();
  const lib = (libraryType === 'app' ? 'app' : 'user') as LibraryType;

  const data = useData();
  const { user } = useAuth();
  const { mode } = useSelection();

  const [parentId] = useState<string | null>(lib === 'app' ? 'f_app_root' : 'f_user_root');
  const [folders, setFolders] = useState<Folder[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);

  const title = useMemo(() => (kind === 'materials' ? (lib === 'app' ? 'App Materials' : 'User Materials') : (lib === 'app' ? 'App Assemblies' : 'User Assemblies')), [kind, lib]);

  useEffect(() => {
    (async () => {
      const f = await data.listFolders({ kind, libraryType: lib, parentId });
      setFolders(f);
      if (kind === 'materials') {
        // For v0.1 we show materials in a fixed folder if exists; folder navigation will be added next pass.
        if (f[0]?.id) {
          const m = await data.listMaterials({ libraryType: lib, folderId: f[0].id });
          setMaterials(m);
        } else {
          setMaterials([]);
        }
      }
    })().catch(console.error);
  }, [data, kind, lib, parentId]);

  const selectionBanner = (() => {
    if (mode.type === 'add-materials-to-assembly' && kind === 'materials') return 'Selection mode: Add materials to assembly';
    if (mode.type === 'add-materials-to-estimate' && kind === 'materials') return 'Selection mode: Add materials to estimate';
    if (mode.type === 'add-assemblies-to-estimate' && kind === 'assemblies') return 'Selection mode: Add assemblies to estimate';
    return null;
  })();

  return (
    <div className="stack">
      {selectionBanner ? <div className="banner">{selectionBanner}</div> : null}

      <Card title={title} right={<Button variant="primary">Create</Button>}>
        <div className="muted">
          Folder navigation, drag/drop ordering, move modal, and selection highlighting are planned next.
        </div>
      </Card>

      <Card title="Folders">
        <div className="folderList">
          {folders.map((f) => (
            <div key={f.id} className="folderRow">
              <div className="folderIcon">📁</div>
              <div className="folderName">{f.name}</div>
            </div>
          ))}
          {folders.length === 0 ? <div className="muted">No folders yet.</div> : null}
        </div>
      </Card>

      {kind === 'materials' ? (
        <Card title="Materials (List View)">
          <div className="list">
            {materials.map((m) => (
              <div key={m.id} className="listRow">
                <div className="listMain">
                  <div className="listTitle">{m.name}</div>
                  <div className="listSub">{m.sku || '—'} • {m.taxable ? 'Taxable' : 'Non-taxable'}</div>
                </div>
                <div className="listRight">
                  <div className="pill">{m.laborMinutes} min</div>
                  <div className="pill">${(m.useCustomCost ? (m.customCost ?? m.baseCost) : m.baseCost).toFixed(2)}</div>
                </div>
              </div>
            ))}
            {materials.length === 0 ? <div className="muted">Select a folder to view materials.</div> : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
