import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { Material } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';

export function MaterialsHomePage() {
  const nav = useNavigate();
  const { mode, setMode } = useSelection();
  const data = useData();

  const [searchUser, setSearchUser] = useState('');
  const [searchApp, setSearchApp] = useState('');
  const [userResults, setUserResults] = useState<Material[]>([]);
  const [appResults, setAppResults] = useState<Material[]>([]);
  const userBoxRef = useRef<HTMLDivElement | null>(null);
  const appBoxRef = useRef<HTMLDivElement | null>(null);

  const inPickerMode = mode.type === 'add-materials-to-assembly' || mode.type === 'add-materials-to-estimate';
  const returnLabel = mode.type === 'add-materials-to-assembly' ? 'Return to Assembly' : 'Return to Estimate';
  // When picker mode is entered from a specific editor, that editor should pass a returnTo
  // via navigation state. If missing, fall back to legacy routes.
  const state = (history.state?.usr ?? null) as any;
  const returnPath =
    mode.type === 'add-materials-to-assembly'
      ? state?.returnTo ?? `/assemblies/user/${mode.assemblyId}`
      : mode.type === 'add-materials-to-estimate'
        ? state?.returnTo ?? `/estimates/${mode.estimateId}`
        : null;

  async function findMaterials(lib: 'company' | 'personal', q: string): Promise<Material[]> {
    const trimmed = q.trim();
    if (!trimmed) return [];
    const lower = trimmed.toLowerCase();

    const folderIds: Array<string | null> = [null];
    const seen = new Set<string>();

    async function walk(parentId: string | null) {
      const kids = await data.listFolders({ kind: 'materials', libraryType: lib, parentId });
      for (const f of kids) {
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        folderIds.push(f.id);
        await walk(f.id);
      }
    }

    await walk(null);
    const lists = await Promise.all(folderIds.map((fid) => data.listMaterials({ libraryType: lib, folderId: fid })));
    const all = lists.flat();

    return all
      .filter(
        (m) =>
          (m.name ?? '').toLowerCase().includes(lower) ||
          (m.sku ?? '').toLowerCase().includes(lower) ||
          (m.description ?? '').toLowerCase().includes(lower)
      )
      .slice(0, 8);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hits = await findMaterials('company', searchUser);
        if (!cancelled) setUserResults(hits);
      } catch {
        if (!cancelled) setUserResults([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchUser]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hits = await findMaterials('personal', searchApp);
        if (!cancelled) setAppResults(hits);
      } catch {
        if (!cancelled) setAppResults([]);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchApp]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const t = e.target as any;
      if (userBoxRef.current && !userBoxRef.current.contains(t)) setUserResults([]);
      if (appBoxRef.current && !appBoxRef.current.contains(t)) setAppResults([]);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

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
        <div className="stack">
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>
              Search User Materials
            </div>
            <div ref={userBoxRef} style={{ position: 'relative' }}>
              <Input
                placeholder="Search user materialsâ€¦"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
              />
              {userResults.length ? (
                <div className="dropdown" style={{ position: 'absolute', left: 0, right: 0, top: '42px', zIndex: 10 }}>
                  {userResults.map((m) => (
                    <div
                      key={m.id}
                      className="dropdownRow clickable"
                      onClick={() => {
                        setUserResults([]);
                        const fid = (m as any).folder_id ?? (m as any).folderId ?? null;
                        nav(fid ? `/materials/user/f/${fid}` : '/materials/user', { state: { highlightId: m.id } });
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <div className="muted small">{m.sku ?? ''}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>
              Search App Materials
            </div>
            <div ref={appBoxRef} style={{ position: 'relative' }}>
              <Input
                placeholder="Search app materialsâ€¦"
                value={searchApp}
                onChange={(e) => setSearchApp(e.target.value)}
              />
              {appResults.length ? (
                <div className="dropdown" style={{ position: 'absolute', left: 0, right: 0, top: '42px', zIndex: 10 }}>
                  {appResults.map((m) => (
                    <div
                      key={m.id}
                      className="dropdownRow clickable"
                      onClick={() => {
                        setAppResults([]);
                        const fid = (m as any).folder_id ?? (m as any).folderId ?? null;
                        nav(fid ? `/materials/app/f/${fid}` : '/materials/app', { state: { highlightId: m.id } });
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <div className="muted small">{m.sku ?? ''}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}



