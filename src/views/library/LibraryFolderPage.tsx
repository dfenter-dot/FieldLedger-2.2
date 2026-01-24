import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, Folder, LibraryType, Material } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';
import { useDialogs } from '../../providers/dialogs/DialogContext';

export function LibraryFolderPage({ kind }: { kind: 'materials' | 'assemblies' }) {
  const { libraryType, '*': splat } = useParams();
  const nav = useNavigate();

  // URL uses app/user; data model uses personal/company.
  const lib = (libraryType === 'app' ? 'personal' : 'company') as LibraryType;

  const data = useData();
  const { mode, setMode } = useSelection();
  const { prompt } = useDialogs();
  const dialogs = useDialogs();

  const [folders, setFolders] = useState<Folder[]>([]);

  // Folder navigation is encoded in the splat segment so deep links work:
  // /materials/:libraryType/f/:folderId
  const activeFolderId = useMemo(() => {
    const s = (splat ?? '').trim();
    if (!s) return null;
    const parts = s.split('/').filter(Boolean);
    if (parts[0] === 'f' && parts[1]) return parts[1];
    return null;
  }, [splat]);

  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ id: string | null; name: string }>>([
    { id: null, name: 'Root' },
  ]);

  const parentFolderId = useMemo(() => {
    if (breadcrumbs.length < 2) return null;
    return breadcrumbs[breadcrumbs.length - 2]?.id ?? null;
  }, [breadcrumbs]);

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
      const f = await data.listFolders({ kind, libraryType: lib, parentId: activeFolderId });
      setFolders(f);

      if (kind === 'materials') {
        const m = await data.listMaterials({ libraryType: lib, folderId: activeFolderId });
        setMaterials(m);
      } else {
        const a = await data.listAssemblies({ libraryType: lib, folderId: activeFolderId });
        setAssemblies(a);
      }

      // Breadcrumbs (best-effort, cached in memory)
      setBreadcrumbs((prev) => {
        const root = [{ id: null, name: 'Root' }];
        if (!activeFolderId) return root;
        // If we already have the path, keep it.
        const existingIdx = prev.findIndex((b) => b.id === activeFolderId);
        if (existingIdx >= 0) return prev.slice(0, existingIdx + 1);
        // Otherwise keep the same (we set readable names on folder click).
        return prev;
      });
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  useEffect(() => {
    refresh().catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, kind, lib, activeFolderId]);

  async function handleCreate() {
    try {
      setStatus('');
      const name = await prompt({
        title: 'Create Folder',
        label: 'New folder name',
        placeholder: 'e.g., Lighting',
        confirmText: 'Create',
      });
      if (!name) return;
      await data.createFolder({ kind, libraryType: lib, parentId: activeFolderId, name });
      await refresh();
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function handleCreateAssembly() {
    try {
      setStatus('');
      const name = await prompt({
        title: 'Create Assembly',
        label: 'New assembly name',
        defaultValue: 'New Assembly',
        confirmText: 'Create',
      });
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

  async function handleCreateMaterial() {
    try {
      setStatus('');
      const name = await prompt({
        title: 'Create Material',
        label: 'New material name',
        defaultValue: 'New Material',
        confirmText: 'Create',
      });
      if (!name) return;

      const created = await data.upsertMaterial({
        id: crypto.randomUUID?.() ?? `mat_${Date.now()}`,
        company_id: lib === 'personal' ? null : undefined,
        name,
        description: null,
        unit_cost: 0,
        taxable: true,
        labor_minutes: 0,
        folder_id: activeFolderId ?? null,
        created_at: new Date().toISOString(),
      } as any);

      nav(`/materials/${libraryType === 'app' ? 'app' : 'user'}/${created.id}`);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  function goToFolder(folderId: string | null, name?: string) {
    const base = kind === 'materials' ? '/materials' : '/assemblies';
    const lt = libraryType === 'app' ? 'app' : 'user';
    if (!folderId) {
      setBreadcrumbs([{ id: null, name: 'Root' }]);
      nav(`${base}/${lt}`);
      return;
    }

    if (name) {
      setBreadcrumbs((prev) => {
        const existingIdx = prev.findIndex((b) => b.id === folderId);
        if (existingIdx >= 0) return prev.slice(0, existingIdx + 1);
        return [...prev, { id: folderId, name }];
      });
    }

    nav(`${base}/${lt}/f/${folderId}`);
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
          kind === 'assemblies' ? (
            <div className="row">
              <Button variant="secondary" onClick={handleCreate}>Create Folder</Button>
              <Button variant="primary" onClick={handleCreateAssembly}>Create Assembly</Button>
            </div>
          ) : (
            <Button variant="primary" onClick={handleCreate}>Create Folder</Button>
          )
        }
      >
        <div className="row" style={{ flexWrap: 'wrap', gap: 8 }}>
          <div className="muted small">Folder:</div>
          <div className="row" style={{ flexWrap: 'wrap', gap: 6 }}>
            {breadcrumbs.map((b, idx) => (
              <Button
                key={`${b.id ?? 'root'}_${idx}`}
                variant="secondary"
                onClick={() => goToFolder(b.id)}
              >
                {b.name}
              </Button>
            ))}
          </div>
          {activeFolderId ? (
            <Button variant="secondary" onClick={() => goToFolder(parentFolderId)}>
              Up One Level
            </Button>
          ) : null}
        </div>
        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>

      <Card title="Folders">
        <div className="folderList">
          {folders.map((f) => (
            <div
              key={f.id}
              className={'folderRow clickable'}
              onClick={() => goToFolder(f.id, f.name)}
            >
              <div className="folderIcon">📁</div>
              <div className="folderName">{f.name}</div>
            </div>
          ))}
          {folders.length === 0 ? <div className="muted">No folders yet.</div> : null}
        </div>
      </Card>

      {kind === 'materials' ? (
        <Card title="Materials (List View)" right={<Button variant="primary" onClick={handleCreateMaterial}>Create Material</Button>}>
          <div className="list">
            {materials.map((m) => (
              <div
              key={m.id}
              className={"listRow clickable"}
              onClick={async () => {
                try {
                  if (mode.type === 'add-materials-to-assembly') {
                    const asm = await data.getAssembly(mode.assemblyId);
                    if (!asm) throw new Error('Assembly not found');
                    const qtyText = await dialogs.prompt({
                      title: 'Quantity',
                      label: `Quantity for “${m.name}”`,
                      defaultValue: '1',
                      confirmText: 'Add',
                    });
                    if (!qtyText) return;
                    const qty = Math.max(1, Number(qtyText));
                    const next = {
                      ...asm,
                      items: [...(asm.items ?? []), { id: crypto.randomUUID?.() ?? `it_${Date.now()}`, material_id: m.id, quantity: Number.isFinite(qty) ? qty : 1 }],
                    };
                    await data.upsertAssembly(next as any);
                    setMode({ type: 'none' });
                    nav(-1);
                    return;
                  }
                  if (mode.type === 'add-materials-to-estimate') {
                    const est = await data.getEstimate(mode.estimateId);
                    if (!est) throw new Error('Estimate not found');
                    const qtyText = await dialogs.prompt({
                      title: 'Quantity',
                      label: `Quantity for “${m.name}”`,
                      defaultValue: '1',
                      confirmText: 'Add',
                    });
                    if (!qtyText) return;
                    const qty = Math.max(1, Number(qtyText));
                    const next = {
                      ...est,
                      items: [...(est.items ?? []), { id: crypto.randomUUID?.() ?? `it_${Date.now()}`, material_id: m.id, quantity: Number.isFinite(qty) ? qty : 1 }],
                    };
                    await data.upsertEstimate(next as any);
                    setMode({ type: 'none' });
                    nav(-1);
                    return;
                  }
                  // normal edit
                  nav(`/materials/${libraryType === 'app' ? 'app' : 'user'}/${m.id}`);
                } catch (e: any) {
                  console.error(e);
                  setStatus(String(e?.message ?? e));
                }
              }}
            >
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
                onClick={async () => {
                  try {
                    if (mode.type === 'add-assemblies-to-estimate') {
                      const est = await data.getEstimate(mode.estimateId);
                      if (!est) throw new Error('Estimate not found');
                      const qtyText = await dialogs.prompt({
                        title: 'Quantity',
                        label: `Quantity for “${a.name}”`,
                        defaultValue: '1',
                        confirmText: 'Add',
                      });
                      if (!qtyText) return;
                      const qty = Math.max(1, Number(qtyText));
                      const next = {
                        ...est,
                        items: [...(est.items ?? []), { id: crypto.randomUUID?.() ?? `it_${Date.now()}`, assembly_id: a.id, quantity: Number.isFinite(qty) ? qty : 1 }],
                      };
                      await data.upsertEstimate(next as any);
                      setMode({ type: 'none' });
                      nav(-1);
                      return;
                    }
                    nav(`/assemblies/${libraryType === 'app' ? 'app' : 'user'}/${a.id}`);
                  } catch (e: any) {
                    console.error(e);
                    setStatus(String(e?.message ?? e));
                  }
                }}
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

