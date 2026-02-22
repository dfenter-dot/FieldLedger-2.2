import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { useData } from '../../providers/data/DataContext';
import type { Assembly } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';

export function AssembliesHomePage() {
  const nav = useNavigate();
  const { mode, setMode } = useSelection();
  const data = useData();

  const [searchUser, setSearchUser] = useState('');
  const [searchApp, setSearchApp] = useState('');
  const [userResults, setUserResults] = useState<Assembly[]>([]);
  const [appResults, setAppResults] = useState<Assembly[]>([]);
  const userBoxRef = useRef<HTMLDivElement | null>(null);
  const appBoxRef = useRef<HTMLDivElement | null>(null);

  const inPickerMode = mode.type === 'add-assemblies-to-estimate' || mode.type === 'pick-assemblies-for-export';
  const returnPath =
    mode.type === 'add-assemblies-to-estimate'
      ? `/estimates/${mode.estimateId}`
      : mode.type === 'pick-assemblies-for-export'
        ? mode.returnTo
        : null;
  const returnLabel =
    mode.type === 'add-assemblies-to-estimate'
      ? 'Return to Estimate'
      : mode.type === 'pick-assemblies-for-export'
        ? 'Return to CSV'
        : 'Return';

  async function findAssemblies(lib: 'company' | 'personal', q: string): Promise<Assembly[]> {
    const trimmed = q.trim();
    if (!trimmed) return [];
    const lower = trimmed.toLowerCase();

    const folderIds: Array<string | null> = [null];
    const seen = new Set<string>();

    async function walk(parentId: string | null) {
      const kids = await data.listFolders({ kind: 'assemblies', libraryType: lib, parentId });
      for (const f of kids) {
        if (seen.has(f.id)) continue;
        seen.add(f.id);
        folderIds.push(f.id);
        await walk(f.id);
      }
    }

    await walk(null);
    const lists = await Promise.all(folderIds.map((fid) => data.listAssemblies({ libraryType: lib, folderId: fid })));
    const all = lists.flat();

    return all
      .filter(
        (a) =>
          (a.name ?? '').toLowerCase().includes(lower) ||
          (a.assembly_number ?? '').toLowerCase().includes(lower) ||
          (a.description ?? '').toLowerCase().includes(lower)
      )
      .slice(0, 8);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const hits = await findAssemblies('company', searchUser);
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
        const hits = await findAssemblies('personal', searchApp);
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
        <div className="stack">
          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>
              Search User Assemblies
            </div>
            <div ref={userBoxRef} style={{ position: 'relative' }}>
              <Input
                placeholder="Search user assembliesÃ¢â‚¬Â¦"
                value={searchUser}
                onChange={(e) => setSearchUser(e.target.value)}
              />
              {userResults.length ? (
                <div className="dropdown" style={{ position: 'absolute', left: 0, right: 0, top: '42px', zIndex: 10 }}>
                  {userResults.map((a) => (
                    <div
                      key={a.id}
                      className="dropdownRow clickable"
                      onClick={() => {
                        setUserResults([]);
                        const fid = (a as any).folder_id ?? (a as any).folderId ?? null;
                        nav(fid ? `/assemblies/user/f/${fid}` : '/assemblies/user', { state: { highlightId: a.id } });
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{a.name}</div>
                      <div className="muted small">{(a as any).assembly_number ?? ''}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          <div>
            <div className="muted small" style={{ marginBottom: 6 }}>
              Search App Assemblies
            </div>
            <div ref={appBoxRef} style={{ position: 'relative' }}>
              <Input
                placeholder="Search app assembliesÃ¢â‚¬Â¦"
                value={searchApp}
                onChange={(e) => setSearchApp(e.target.value)}
              />
              {appResults.length ? (
                <div className="dropdown" style={{ position: 'absolute', left: 0, right: 0, top: '42px', zIndex: 10 }}>
                  {appResults.map((a) => (
                    <div
                      key={a.id}
                      className="dropdownRow clickable"
                      onClick={() => {
                        setAppResults([]);
                        const fid = (a as any).folder_id ?? (a as any).folderId ?? null;
                        nav(fid ? `/assemblies/app/f/${fid}` : '/assemblies/app', { state: { highlightId: a.id } });
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{a.name}</div>
                      <div className="muted small">{(a as any).assembly_number ?? ''}</div>
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



