import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, Folder, Material, LibraryType } from '../../providers/data/types';
import { computeAssemblyPricing } from '../../providers/data/pricing';
import { useSelection } from '../../providers/selection/SelectionContext';

type CsvRow = Record<string, string>;

function escapeCsv(val: string) {
  const s = String(val ?? '');
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replaceAll('"', '""')}"`;
  }
  return s;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadMaterialTemplate() {
  // Template columns match what the importer accepts.
  // - Provide job_type by NAME (recommended). job_type_id also supported.
  // - labor_decimal_hours is decimal hours (e.g., 1.5 = 1h 30m)
  const header = [
    'path',
    'name',
    'sku',
    'description',
    'base_cost',
    'custom_cost',
    'use_custom_cost',
    'taxable',
    'labor_decimal_hours',
    'job_type',
    'job_type_id',
    'labor_only',
    'order_index',
  ];

  const example = [
    'Electrical/Lighting',
    '4\" LED Recessed Retrofit',
    'LED-4R-RETRO',
    'Retrofit LED trim kit. Include any notes here.',
    '24.50',
    '',
    'false',
    'true',
    '0.5',
    'Install',
    '',
    'false',
    '0',
  ];

  downloadText('materials_import_template.csv', `${header.join(',')}\n${example.map(escapeCsv).join(',')}\n`);
}

function parseCsv(text: string): CsvRow[] {
  // Minimal CSV parser (handles quotes). Assumes first row is header.
  const rows: string[][] = [];
  let cur = '';
  let inQuotes = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (c === '"') {
        inQuotes = false;
      } else {
        cur += c;
      }
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ',') {
        row.push(cur);
        cur = '';
      } else if (c === '\n') {
        row.push(cur);
        cur = '';
        if (row.some((x) => x.trim() !== '')) rows.push(row);
        row = [];
      } else if (c === '\r') {
        // ignore
      } else {
        cur += c;
      }
    }
  }
  row.push(cur);
  if (row.some((x) => x.trim() !== '')) rows.push(row);

  if (rows.length === 0) return [];
  const header = rows[0].map((h) => h.trim());
  return rows.slice(1).map((r) => {
    const obj: CsvRow = {};
    for (let i = 0; i < header.length; i++) obj[header[i]] = r[i] ?? '';
    return obj;
  });
}

async function collectAllFolders(data: any, kind: 'materials' | 'assemblies', libraryType: LibraryType): Promise<Folder[]> {
  const out: Folder[] = [];
  async function walk(parentId: string | null) {
    const children = await data.listFolders({ kind, libraryType, parentId });
    out.push(...children);
    for (const c of children) await walk(c.id);
  }
  await walk(null);
  return out;
}

async function collectAllMaterials(data: any, libraryType: LibraryType, folders: Folder[]): Promise<Material[]> {
  const out: Material[] = [];
  const folderIds: Array<string | null> = [null, ...folders.map((f) => f.id)];
  for (const folderId of folderIds) {
    const mats = await data.listMaterials({ libraryType, folderId });
    out.push(...mats);
  }
  return out;
}

async function collectAllAssemblies(data: any, libraryType: LibraryType, folders: Folder[]): Promise<Assembly[]> {
  const out: Assembly[] = [];
  const folderIds: Array<string | null> = [null, ...folders.map((f) => f.id)];
  for (const folderId of folderIds) {
    const asms = await data.listAssemblies({ libraryType, folderId });
    out.push(...asms);
  }
  return out;
}


function buildPathMap(folders: Folder[]) {
  const byId = new Map<string, Folder>();
  folders.forEach((f) => byId.set(f.id, f));

  const rootIds = new Set<string>();
  folders.forEach((f) => {
    if (!f.parent_id) rootIds.add(f.id);
  });

  function pathForFolderId(folderId: string | null): string {
    if (!folderId) return '';
    const parts: string[] = [];
    let cur = byId.get(folderId) ?? null;
    while (cur) {
      parts.unshift(cur.name);
      if (!cur.parent_id) break;
      cur = byId.get(cur.parent_id) ?? null;
    }
    // Drop the first segment (the root folder name) if this folder is under a root.
    if (parts.length > 0) parts.shift();
    return parts.join('/');
  }

  return { pathForFolderId, byId, rootIds };
}

async function ensureFolderPath(data: any, kind: 'materials' | 'assemblies', libraryType: LibraryType, path: string, existingFolders: Folder[]) {
  const { byId } = buildPathMap(existingFolders);
  // Always start at the true root (parent_id = null). Do NOT attach to an arbitrary existing folder.
  // This ensures CSV imports create the first path segment as a new top-level folder if needed.
  let parentId: string | null = null;
  const parts = (path ?? '').split('/').map((p) => p.trim()).filter(Boolean);
  for (const name of parts) {
    const match = existingFolders.find((f) => f.parent_id === parentId && f.name.toLowerCase() === name.toLowerCase());
    if (match) {
      parentId = match.id;
      continue;
    }
    const created = await data.createFolder({ kind, libraryType, parentId, name });
    existingFolders.push(created);
    byId.set(created.id, created);
    parentId = created.id;
  }
  return parentId;
}

export function CsvPage() {
  const data = useData();
  const nav = useNavigate();
  const { exportAssemblyIds, setExportAssemblyIds, setMode } = useSelection();
  const [allowMaterialImport, setAllowMaterialImport] = useState(true);
  const [allowAssemblyImport, setAllowAssemblyImport] = useState(true);
  const [status, setStatus] = useState('');
  const [isExportingAssemblies, setIsExportingAssemblies] = useState(false);

  // Assemblies export controls
  const [exportAllJobTypes, setExportAllJobTypes] = useState(true);
  const [exportJobTypeIds, setExportJobTypeIds] = useState<string[]>([]);
  const [exportAllAssemblies, setExportAllAssemblies] = useState(true);
  const [jobTypesUi, setJobTypesUi] = useState<any[]>([]);

  const matInputRef = useRef<HTMLInputElement | null>(null);
  const asmInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    data.getCsvSettings()
      .then((s: any) => {
        setAllowMaterialImport(Boolean(s.allow_material_import));
        setAllowAssemblyImport(Boolean(s.allow_assembly_import));
      })
      .catch((e) => setStatus(String((e as any)?.message ?? e)));
  }, [data]);

  useEffect(() => {
    let cancelled = false;
    data.listJobTypes()
      .then((rows: any) => {
        if (!cancelled) setJobTypesUi(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setJobTypesUi([]);
      });
    return () => {
      cancelled = true;
    };
  }, [data]);

  const settingsPayload = useMemo(() => ({
    allow_material_import: allowMaterialImport,
    allow_assembly_import: allowAssemblyImport,
  }), [allowMaterialImport, allowAssemblyImport]);

  async function saveSettings() {
    try {
      setStatus('Saving...');
      const current = await data.getCsvSettings();
      await data.saveCsvSettings({ ...current, ...settingsPayload } as any);
      setStatus('Saved.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function exportMaterials() {
    try {
      setStatus('Exporting materials...');
      const folders = await collectAllFolders(data, 'materials', 'company');
      const { pathForFolderId } = buildPathMap(folders);

      // collect materials by walking all folders (plus root null)
      const all: Material[] = [];
      const folderIds = [null, ...folders.map((f) => f.id)];
      for (const folderId of folderIds) {
        const mats = await data.listMaterials({ libraryType: 'company' as any, folderId });
        all.push(...mats);
      }

      const header = ['path', 'name', 'sku', 'description', 'base_cost', 'custom_cost', 'use_custom_cost', 'taxable', 'labor_decimal_hours', 'job_type_id'];
      const lines = [header.join(',')];
      for (const m of all) {
        const labor = (Number(m.labor_minutes ?? 0) / 60).toFixed(4);
        const row = [
          pathForFolderId(m.folder_id),
          m.name ?? '',
          (m.sku ?? '') as any,
          (m.description ?? '') as any,
          String(m.unit_cost ?? 0),
          m.custom_cost == null ? '' : String(m.custom_cost),
          String(Boolean(m.use_custom_cost)),
          String(Boolean(m.taxable)),
          labor,
          m.job_type_id ?? '',
        ].map(escapeCsv);
        lines.push(row.join(','));
      }
      downloadText('materials_export.csv', lines.join('\n'));
      setStatus('Materials exported.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  function csvEscapeAny(val: any) {
    const s = String(val ?? '');
    if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) return `"${s.replaceAll('"', '""')}"`;
    return s;
  }

  function fmt2(n: any) {
    const x = Number(n);
    return Number.isFinite(x) ? x.toFixed(2) : '0.00';
  }

  nc function collectAllAssembliesAcrossLibraries(): Promise<Assembly[]> {
    const libs: Array<LibraryType> = ['company' as any, 'personal' as any];
    const all: Assembly[] = [];
    for (const lib of libs) {
      const folders = await collectAllFolders(data, 'assemblies', lib);
      const folderIds = [null, ...folders.map((f) => f.id)];
      for (const folderId of folderIds) {
        const asms = await data.listAssemblies({ libraryType: lib, folderId });
        all.push(...asms);
      }
    }
    const byId = new Map<string, Assembly>();
    for (const a of all) byId.set(a.id, a);
    return [...byId.values()];
  }

  async function exportAssemblies() {
    try {
      setIsExportingAssemblies(true);
      setStatus('Exporting assemblies...');

      const companySettings = await data.getCompanySettings();
      const jobTypes = await data.listJobTypes().catch(() => [] as any[]);
      const jobTypesById: Record<string, any> = {};
      for (const jt of jobTypes as any[]) if (jt?.id) jobTypesById[String(jt.id)] = jt;

      const chosenJobTypes = exportAllJobTypes
        ? (jobTypes as any[])
        : (jobTypes as any[]).filter((jt) => jt?.id && exportJobTypeIds.includes(String(jt.id)));

      if (chosenJobTypes.length === 0) {
        setStatus('Select at least one Job Type to export.');
        return;
      }

      const baseAssemblies: any[] = exportAllAssemblies
        ? await collectAllAssembliesAcrossLibraries()
        : (await Promise.all(exportAssemblyIds.map((id) => data.getAssembly(id)))).filter(Boolean) as any[];

      if (baseAssemblies.length === 0) {
        setStatus('Select at least one Assembly to export.');
        return;
      }

      const fullAssemblies = await Promise.all(
        baseAssemblies.map(async (a) => {
          const full = await data.getAssembly(a.id).catch(() => null);
          return full ?? a;
        })
      );

      // Collect material IDs referenced by selected assemblies
      const matIds = new Set<string>();
      for (const asm of fullAssemblies) {
        for (const it of (asm?.items ?? []) as any[]) {
          if ((it?.type ?? it?.item_type) !== 'material') continue;
          const id = String(it?.material_id ?? it?.materialId ?? '').trim();
          if (id) matIds.add(id);
        }
      }

      const materialsById: Record<string, any> = {};
      await Promise.all(
        [...matIds].map(async (id) => {
          try {
            const m = await data.getMaterial(id);
            if (m) materialsById[id] = m;
          } catch {
            // ignore
          }
        })
      );

      const header = ['Name', 'Description', 'Price', 'Cost', 'Task Code', 'Job Type'];
      const lines = [header.join(',')];

      for (const asm of fullAssemblies) {
        for (const jt of chosenJobTypes) {
          const jobTypeId = String(jt.id);
          const pricing = computeAssemblyPricing({
            assembly: { ...(asm ?? {}), job_type_id: jobTypeId },
            items: (asm?.items ?? []) as any[],
            materialsById,
            jobTypesById,
            companySettings,
          });

          const base = String((asm as any)?.task_code_base ?? '').trim();
          const suffix = String((jt as any)?.assembly_task_code_suffix ?? (jt as any)?.task_code_suffix ?? '').trim();
          const taskCode = base ? (suffix ? `${base}${suffix}` : base) : '';

          const row = [
            String((asm as any)?.name ?? ''),
            String((asm as any)?.description ?? ''),
            fmt2(pricing?.total_price ?? 0),
            fmt2(Number(pricing?.material_cost_total ?? 0) + Number(pricing?.labor_price_total ?? 0)),
            taskCode,
            String((jt as any)?.name ?? ''),
          ].map(csvEscapeAny);
          lines.push(row.join(','));
        }
      }

      downloadText('assemblies_export.csv', lines.join('\n'));
      setStatus(`Assemblies exported: ${fullAssemblies.length} assemblies × ${chosenJobTypes.length} job types = ${fullAssemblies.length * chosenJobTypes.length} rows.`);
      setTimeout(() => setStatus(''), 2500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    } finally {
      setIsExportingAssemblies(false);
    }
  }

  async function importMaterials(file: File) {
    try {
      if (!allowMaterialImport) {
        setStatus('Material import is disabled in settings.');
        return;
      }
      setStatus('Importing materials...');
      const text = await file.text();
      const rows = parseCsv(text);

      // Support job_type by NAME (recommended) or job_type_id.
      // This prevents failed imports when users paste job type names instead of UUIDs.
      const jobTypes = await data.listJobTypes().catch(() => [] as any[]);
      const jobTypeIdByName = new Map<string, string>();
      for (const jt of jobTypes as any[]) {
        const name = String(jt?.name ?? '').trim().toLowerCase();
        if (name && jt?.id) jobTypeIdByName.set(name, jt.id);
      }

      const isOwner = await (data as any).isAppOwner?.().catch?.(() => false) ?? false;
      const libraryType: LibraryType = isOwner ? 'personal' : 'company';

      const folders = await collectAllFolders(data, 'materials', libraryType);
      const existingMaterials = await collectAllMaterials(data, libraryType, folders);
      const materialIdByFolderAndName = new Map<string, string>();
      for (const m of existingMaterials) {
        const key = `${m.folder_id ?? 'root'}::${(m.name ?? '').trim().toLowerCase()}`;
        if (!materialIdByFolderAndName.has(key)) materialIdByFolderAndName.set(key, m.id);
      }
      for (const r of rows) {
        const folderPath = r.path ?? '';
        const folderId = await ensureFolderPath(data, 'materials', libraryType, folderPath, folders);
        const laborDecimal = Number(r.labor_decimal_hours ?? 0);
        const laborMinutes = Number.isFinite(laborDecimal) ? Math.round(laborDecimal * 60) : 0;

        const jobTypeIdFromName = ((): string | null => {
          const raw = String((r as any).job_type ?? '').trim();
          if (!raw) return null;
          return jobTypeIdByName.get(raw.toLowerCase()) ?? null;
        })();

        const mat: Partial<Material> = {
          // Let the DB generate UUIDs when inserting new rows. If a matching material already exists
          // (same folder + name), we will set id below before upsert.
          name: (r.name ?? '').trim(),
          sku: (r.sku ?? '').trim() || null,
          description: (r.description ?? '').trim() || null,
          base_cost: Number(r.base_cost ?? r.unit_cost ?? r.cost ?? 0) || 0,
          custom_cost: r.custom_cost === '' ? null : Number(r.custom_cost ?? 0),
          use_custom_cost: String(r.use_custom_cost ?? '').toLowerCase() === 'true',
          taxable: String(r.taxable ?? '').toLowerCase() === 'true',
          labor_minutes: laborMinutes,
          job_type_id: r.job_type_id ? r.job_type_id : jobTypeIdFromName,
          folder_id: folderId,
          labor_only: String(r.labor_only ?? '').toLowerCase() === 'true',
          order_index: Number(r.order_index ?? r.sort_order ?? 0) || 0,
          library_type: libraryType,
        };
        await data.upsertMaterial(mat);
      }
      setStatus(`Imported ${rows.length} materials.`);
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function importAssemblies(file: File) {
    try {
      if (!allowAssemblyImport) {
        setStatus('Assembly import is disabled in settings.');
        return;
      }
      setStatus('Importing assemblies...');
      const text = await file.text();
      const rows = parseCsv(text);

      const isOwner = await (data as any).isAppOwner?.().catch?.(() => false) ?? false;
      const libraryType: LibraryType = isOwner ? 'personal' : 'company';

      // Allow CSV to specify job type by name (job_type) or id (job_type_id)
      const jobTypes = await data.listJobTypes().catch(() => [] as any[]);
      const jobTypeIdByName = new Map<string, string>();
      for (const jt of jobTypes as any[]) {
        const name = String(jt?.name ?? '').trim().toLowerCase();
        if (name && jt?.id) jobTypeIdByName.set(name, jt.id);
      }

      const folders = await collectAllFolders(data, 'assemblies', libraryType);
      const existing = await collectAllAssemblies(data, libraryType, folders);
      const assemblyIdByFolderAndName = new Map<string, string>();
      for (const a of existing) {
        const key = `${a.folder_id ?? 'root'}::${(a.name ?? '').trim().toLowerCase()}`;
        if (!assemblyIdByFolderAndName.has(key)) assemblyIdByFolderAndName.set(key, a.id);
      }

      for (const r of rows) {
        const folderId = await ensureFolderPath(data, 'assemblies', libraryType, r.path ?? '', folders);

        let items: any[] = [];
        try {
          items = r.items_json ? JSON.parse(r.items_json) : [];
        } catch {
          items = [];
        }

        const jobTypeIdFromName = ((): string | null => {
          const raw = String((r as any).job_type ?? '').trim();
          if (!raw) return null;
          return jobTypeIdByName.get(raw.toLowerCase()) ?? null;
        })();

        const asm: any = {
          name: (r.name ?? '').trim(),
          description: (r.description ?? '').trim() || null,
          use_admin_rules: String(r.use_admin_rules ?? '').toLowerCase() === 'true',
          job_type_id: r.job_type_id ? r.job_type_id : jobTypeIdFromName,
          customer_supplies_materials: String(r.customer_supplies_materials ?? '').toLowerCase() === 'true',
          labor_minutes: Number(r.labor_minutes ?? 0) || 0,
          folder_id: folderId,
          library_type: libraryType,
          items: Array.isArray(items) ? (items as any) : [],
        };

        const key = `${folderId ?? 'root'}::${(asm.name ?? '').trim().toLowerCase()}`;
        const existingId = assemblyIdByFolderAndName.get(key);
        if (existingId) asm.id = existingId;
        await data.upsertAssembly(asm);
      }

      setStatus(`Imported ${rows.length} assemblies.`);
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  return (
    <div className="stack">
      <Card title="CSV Import / Export" right={<Button variant="primary" onClick={saveSettings}>Save Settings</Button>}>
        <div className="stack">
          <Toggle checked={allowMaterialImport} onChange={setAllowMaterialImport} label="Allow material CSV import" />
          <Toggle checked={allowAssemblyImport} onChange={setAllowAssemblyImport} label="Allow assembly CSV import" />
        </div>
        {status ? <div className="muted small mt">{status}</div> : null}
      </Card>

      <Card title="Materials">
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={exportMaterials}>Export Materials</Button>
          <Button onClick={downloadMaterialTemplate}>Download Material CSV Template</Button>
          <Button onClick={() => matInputRef.current?.click()} disabled={!allowMaterialImport}>Import Materials CSV</Button>
          <input
            ref={matInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={(e) => {
              const f = e.target.files?.[0];
              e.currentTarget.value = '';
              if (f) void importMaterials(f);
            }}
          />
        </div>
        <div className="muted small mt">
          Labor time is exported/imported as decimal hours. Folder hierarchy uses a path like <span className="pill">Devices/Outlets/TR Duplex</span>.
        </div>
      </Card>

      <Card title="Assemblies">
        <div className="grid2" style={{ gap: 14 }}>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Job Types</div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Toggle
                checked={exportAllJobTypes}
                onChange={(v) => {
                  setExportAllJobTypes(Boolean(v));
                  if (v) setExportJobTypeIds([]);
                }}
                label="All job types"
              />
              {!exportAllJobTypes ? (
                <div className="muted small">Select one or more job types below.</div>
              ) : null}
            </div>
            {!exportAllJobTypes ? (
              <div className="row" style={{ gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
                {jobTypesUi.map((jt: any) => {
                  const id = String(jt?.id ?? '');
                  if (!id) return null;
                  const checked = exportJobTypeIds.includes(id);
                  return (
                    <label key={id} className="pill" style={{ display: 'inline-flex', gap: 8, alignItems: 'center' }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => {
                          setExportJobTypeIds((prev) =>
                            checked ? prev.filter((x) => x !== id) : [...prev, id]
                          );
                        }}
                      />
                      {String(jt?.name ?? 'Job Type')}
                    </label>
                  );
                })}
              </div>
            ) : null}
          </div>

          <div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Assemblies</div>
            <div className="row" style={{ gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <Toggle
                checked={exportAllAssemblies}
                onChange={(v) => {
                  setExportAllAssemblies(Boolean(v));
                  if (v) setExportAssemblyIds([]);
                }}
                label="All assemblies (User + App)"
              />
              {!exportAllAssemblies ? (
                <>
                  <Button
                    onClick={() => {
                      setMode({ type: 'pick-assemblies-for-export', returnTo: '/admin/csv' });
                      nav('/assemblies');
                    }}
                  >
                    Choose Assemblies
                  </Button>
                  <div className="muted small">Selected: {exportAssemblyIds.length}</div>
                  {exportAssemblyIds.length > 0 ? (
                    <Button variant="danger" onClick={() => setExportAssemblyIds([])}>
                      Clear
                    </Button>
                  ) : null}
                </>
              ) : null}
            </div>
          </div>

          <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <Button onClick={exportAssemblies} disabled={isExportingAssemblies}>
              {isExportingAssemblies ? 'Exporting…' : 'Export Assemblies CSV'}
            </Button>
            <Button onClick={() => asmInputRef.current?.click()} disabled={!allowAssemblyImport}>Import Assemblies CSV</Button>
            <input
              ref={asmInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.currentTarget.value = '';
                if (f) void importAssemblies(f);
              }}
            />
          </div>

          <div className="muted small">
            Export columns: Name, Description, Price, Cost, Task Code, Job Type. If you select 3 assemblies and 2 job types, you will export 6 rows.
          </div>
        </div>
      </Card>
    </div>
  );
}





