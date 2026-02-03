import { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Toggle } from '../../ui/components/Toggle';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, Folder, Material } from '../../providers/data/types';

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

async function collectAllFolders(data: any, kind: 'materials' | 'assemblies', libraryType: 'company' | 'personal'): Promise<Folder[]> {
  const out: Folder[] = [];
  async function walk(parentId: string | null) {
    const children = await data.listFolders({ kind, libraryType, parentId });
    out.push(...children);
    for (const c of children) await walk(c.id);
  }
  await walk(null);
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
    // IMPORTANT: CSV paths are absolute from the library root.
    // Do not drop the first segment; otherwise imports will anchor under an existing root folder.
    return parts.join('/');
  }

  return { pathForFolderId, byId, rootIds };
}

async function ensureFolderPath(
  data: any,
  kind: 'materials' | 'assemblies',
  libraryType: 'company' | 'personal',
  path: string,
  existingFolders: Folder[],
) {
  const { byId } = buildPathMap(existingFolders);
  // Always treat CSV folder paths as absolute from the library root.
  // Start at null parent so the first segment becomes (or matches) a true root folder.
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

function getCell(row: Record<string, any>, key: string): string {
  // Be tolerant of header casing/spaces (e.g. "Name", "name", "Base Cost", "base_cost").
  const target = key.trim().toLowerCase();
  for (const k of Object.keys(row)) {
    if (k.trim().toLowerCase() === target) return String(row[k] ?? '');
  }
  return '';
}

export function CsvPage() {
  const data = useData();
  const [allowMaterialImport, setAllowMaterialImport] = useState(true);
  const [allowAssemblyImport, setAllowAssemblyImport] = useState(true);
  const [status, setStatus] = useState('');

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
        const mats = await data.listMaterials({ libraryType: 'company', folderId });
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

  async function exportAssemblies() {
    try {
      setStatus('Exporting assemblies...');
      const folders = await collectAllFolders(data, 'assemblies', 'company');
      const { pathForFolderId } = buildPathMap(folders);
      const all: Assembly[] = [];
      const folderIds = [null, ...folders.map((f) => f.id)];
      for (const folderId of folderIds) {
        const asms = await data.listAssemblies({ libraryType: 'company', folderId });
        all.push(...asms);
      }
      const header = ['path', 'name', 'description', 'use_admin_rules', 'job_type_id', 'customer_supplies_materials', 'labor_minutes', 'items_json'];
      const lines = [header.join(',')];
      for (const a of all) {
        const row = [
          pathForFolderId(a.folder_id),
          a.name ?? '',
          a.description ?? '',
          String(Boolean(a.use_admin_rules)),
          a.job_type_id ?? '',
          String(Boolean(a.customer_supplies_materials)),
          String(a.labor_minutes ?? 0),
          JSON.stringify(a.items ?? []),
        ].map(escapeCsv);
        lines.push(row.join(','));
      }
      downloadText('assemblies_export.csv', lines.join('\n'));
      setStatus('Assemblies exported.');
      setTimeout(() => setStatus(''), 1500);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
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

      const isOwner = await (data as any).isAppOwner?.().catch?.(() => false) ?? false;
      const libraryType: 'company' | 'personal' = isOwner ? 'personal' : 'company';

      const folders = await collectAllFolders(data, 'materials', libraryType);
      let imported = 0;
      let skipped = 0;
      for (const r of rows) {
        const folderPath = getCell(r as any, 'path');
        const folderId = await ensureFolderPath(data, 'materials', libraryType, folderPath, folders);
        const laborDecimal = Number(getCell(r as any, 'labor_decimal_hours') || 0);
        const laborMinutes = Number.isFinite(laborDecimal) ? Math.round(laborDecimal * 60) : 0;

        const name = getCell(r as any, 'name').trim();
        if (!name) {
          skipped++;
          continue;
        }

        const mat: Material = {
          id: crypto.randomUUID?.() ?? `mat_${Date.now()}`,
          company_id: libraryType === 'personal' ? null : (undefined as any), // provider fills
          name,
          sku: (getCell(r as any, 'sku') || '').trim() || null,
          description: (getCell(r as any, 'description') || '').trim() || null,
          unit_cost: Number(getCell(r as any, 'base_cost') || 0) || 0,
          custom_cost: (getCell(r as any, 'custom_cost') || '').trim() === '' ? null : Number(getCell(r as any, 'custom_cost') || 0),
          use_custom_cost: String(getCell(r as any, 'use_custom_cost')).toLowerCase() === 'true',
          taxable: String(getCell(r as any, 'taxable')).toLowerCase() !== 'false',
          labor_minutes: laborMinutes,
          job_type_id: (getCell(r as any, 'job_type_id') || '').trim() || null,
          folder_id: folderId,
          created_at: new Date().toISOString(),
        };
        await data.upsertMaterial(mat);
        imported++;
      }
      setStatus(`Imported ${imported} materials${skipped ? ` (skipped ${skipped} blank name rows)` : ''}.`);
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
      const libraryType: 'company' | 'personal' = isOwner ? 'personal' : 'company';

      const folders = await collectAllFolders(data, 'assemblies', libraryType);

      let imported = 0;
      let skipped = 0;

      for (const r of rows) {
        const folderId = await ensureFolderPath(data, 'assemblies', libraryType, getCell(r as any, 'path'), folders);
        let items: any[] = [];
        try {
          const raw = getCell(r as any, 'items_json');
          items = raw ? JSON.parse(raw) : [];
        } catch {
          items = [];
        }

        const name = getCell(r as any, 'name').trim();
        if (!name) {
          skipped++;
          continue;
        }
        const asm: Assembly = {
          id: crypto.randomUUID?.() ?? `asm_${Date.now()}`,
          company_id: libraryType === 'personal' ? null : (undefined as any), // provider fills
          name,
          description: (getCell(r as any, 'description') || '').trim() || null,
          use_admin_rules: String(getCell(r as any, 'use_admin_rules')).toLowerCase() === 'true',
          job_type_id: (getCell(r as any, 'job_type_id') || '').trim() || null,
          customer_supplies_materials: String(getCell(r as any, 'customer_supplies_materials')).toLowerCase() === 'true',
          labor_minutes: Number(getCell(r as any, 'labor_minutes') || 0) || 0,
          items: Array.isArray(items) ? (items as any) : [],
          folder_id: folderId,
          created_at: new Date().toISOString(),
        };
        await data.upsertAssembly(asm);
        imported++;
      }

      setStatus(`Imported ${imported} assemblies${skipped ? ` (skipped ${skipped} blank name rows)` : ''}.`);
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
        <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
          <Button onClick={exportAssemblies}>Export Assemblies</Button>
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
        <div className="muted small mt">
          App-owned libraries are not exported item-by-item. This exports only your company-owned assemblies.
        </div>
      </Card>
    </div>
  );
}



