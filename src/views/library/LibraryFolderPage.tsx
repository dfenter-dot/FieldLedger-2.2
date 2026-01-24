import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, Folder, LibraryType, Material } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';

export function LibraryFolderPage({ kind }: { kind: 'materials' | 'assemblies' }) {
  const { libraryType } = useParams();
  const nav = useNavigate();

  // URL uses app/user; data model uses personal/company.
  const lib = (libraryType === 'app' ? 'personal' : 'company') as LibraryType;

  const data = useData();
  const { mode } = useSelection();

  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);

  const [materials, setMaterials] = useState<Material[]>([]);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);

  const [status, setStatus] = useState<string>('');

  const title = useMemo(() => {
    if (kind === 'materials') return lib === 'personal' ? 'App Materials' : 'User Materials';
    return lib === 'personal' ? 'App Assemblies' : 'User Assemblies';
  }, [kind, lib]);

  async function refresh() {
    try {
      setStatus('');
      const f = await data.listFolders({ kind, libraryType: lib, parentId: null });
      setFolders(f);

      const nextActive = activeFolderId ?? f[0]?.id ?? null;
      setActiveFolderId(nextActive);

      if (kind === 'materials') {
        const m = await data.listMaterials({ libraryType: lib, folderId: nextActive });
        setMaterials(m);
      } else {
        const a = await data.listAssemblies({ libraryType: lib, folderId: nextActive });
        setAssemblies(a);
      }
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kind, lib]);

  async function handleCreate() {
    try {
      setStatus('');
      if (kind === 'materials') {
        const name = window.prompt('New folder name');
        if (!name) return;
        await data.createFolder({ kind, libraryType: lib, parentId: null, name });
        await refresh();
        return;
      }

      // Assemblies: create a new assembly and open editor.
      const name = window.prompt('New assembly name', 'New Assembly');
      if (!name) return;

      const folderId = activeFolderId ?? null;

      const created = await data.upsertAssembly({
        id: crypto.randomUUID?.() ?? `asm_${Date.now()}`,
        company_id: lib === 'personal' ? null : undefined,
        name,
        description: null,
        items: [],
        labor_minutes: 0,
        folder_id: folderId,
        created_at: new Date().toISOString(),
      } as any);

      nav(`/assemblies/${libraryType === 'app' ? 'app' : 'user'}/${created.id}`);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  const selectionBanner = (() => {
    if (mode.type === 'add-materials-to-assembly' && kind === 'materials') return 'Selection mode: Add materials to assembly';
    if (mode.type === 'add-materials-to-estimate' && kind === 'materials') return 'Selection mode: Add materials to estimate';
    if (mode.type === 'add-assemblies-to-estimate' && kind === 'assemblies') return 'Selection mode: Add assemblies to estimate';
    return null;
  })();

  return (
    <div className="stack">
      {selectionBanner ? <div className="banner">{selectionBanner}</div> : null}

      <Card
        title={title}
        right={
          <Button variant="primary" onClick={handleCreate}>
            {kind === 'materials' ? 'Create Folder' : 'Create Assembly'}
          </Button>
        }
      >
        <div className="muted small">
          Folder navigation is minimal in this build: pick a folder to view items.
        </div>
        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>

      <Card title="Folders">
        <div className="folderList">
          {folders.map((f) => (
            <div
              key={f.id}
              className={'folderRow clickable' + (f.id === activeFolderId ? ' selected' : '')}
              onClick={async () => {
                setActiveFolderId(f.id);
                try {
                  if (kind === 'materials') {
                    const m = await data.listMaterials({ libraryType: lib, folderId: f.id });
                    setMaterials(m);
                  } else {
                    const a = await data.listAssemblies({ libraryType: lib, folderId: f.id });
                    setAssemblies(a);
                  }
                } catch (e: any) {
                  console.error(e);
                  setStatus(String(e?.message ?? e));
                }
              }}
            >
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
                  <div className="listSub">{m.description || '—'} • {m.taxable ? 'Taxable' : 'Non-taxable'}</div>
                </div>
                <div className="listRight">
                  <div className="pill">{m.labor_minutes} min</div>
                  <div className="pill">${Number(m.unit_cost ?? 0).toFixed(2)}</div>
                </div>
              </div>
            ))}
            {materials.length === 0 ? <div className="muted">Select a folder to view materials.</div> : null}
          </div>
        </Card>
      ) : (
        <Card title="Assemblies (List View)">
          <div className="list">
            {assemblies.map((a) => (
              <div
                key={a.id}
                className="listRow clickable"
                onClick={() => nav(`/assemblies/${libraryType === 'app' ? 'app' : 'user'}/${a.id}`)}
              >
                <div className="listMain">
                  <div className="listTitle">{a.name}</div>
                  <div className="listSub">{a.description || '—'} • {a.items?.length ?? 0} items</div>
                </div>
                <div className="listRight">
                  <div className="pill">{a.labor_minutes} min</div>
                </div>
              </div>
            ))}
            {assemblies.length === 0 ? <div className="muted">Select a folder to view assemblies.</div> : null}
          </div>
        </Card>
      )}
    </div>
  );
}

