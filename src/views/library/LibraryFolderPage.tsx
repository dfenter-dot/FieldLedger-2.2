import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Modal } from '../../ui/components/Modal';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, Folder, LibraryType, Material } from '../../providers/data/types';
import { useSelection } from '../../providers/selection/SelectionContext';
import { useDialogs } from '../../providers/dialogs/DialogContext';

type MoveTarget =
  | null
  | { type: 'material'; id: string; currentFolderId: string | null }
  | { type: 'assembly'; id: string; currentFolderId: string | null }
  | { type: 'folder'; id: string; currentParentId: string | null }
  | { type: 'bulk'; folderIds: string[]; itemIds: string[] };

function clampQty(n: number) {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.floor(n));
}

export function LibraryFolderPage({ kind }: { kind: 'materials' | 'assemblies' }) {
  const { libraryType, '*': splat } = useParams();
  const nav = useNavigate();
  const location = useLocation();

  // URL uses app/user; data model uses personal/company.
  const lib = (libraryType === 'app' ? 'personal' : 'company') as LibraryType;

  const data = useData();
  const { mode, setMode } = useSelection();
  const dialogs = useDialogs();

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

  const [folders, setFolders] = useState<Folder[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [assemblies, setAssemblies] = useState<Assembly[]>([]);

  const [selectedEstimateItems, setSelectedEstimateItems] = useState<any[] | null>(null);
  const [status, setStatus] = useState<string>('');

  // Picker mode selection tracking (materials only)
  const [selectedQtyByMaterialId, setSelectedQtyByMaterialId] = useState<Record<string, string>>({});
  // Draft quantities for picker mode before a material is actually added
  const [draftQtyByMaterialId, setDraftQtyByMaterialId] = useState<Record<string, string>>({});
  const [draftQtyByAssemblyId, setDraftQtyByAssemblyId] = useState<Record<string, string>>({});

  // Global search (materials only)
  const [searchText, setSearchText] = useState('');
  const [searchResults, setSearchResults] = useState<Material[]>([]);
  const searchBoxRef = useRef<HTMLDivElement | null>(null);

  // Bulk select/delete (folders + items)
  const [selectMode, setSelectMode] = useState(false);
  const [selectedFolderIds, setSelectedFolderIds] = useState<Record<string, boolean>>({});
  const [selectedItemIds, setSelectedItemIds] = useState<Record<string, boolean>>({});

  // Move modal
  const [moveTarget, setMoveTarget] = useState<MoveTarget>(null);
  const [moveFolders, setMoveFolders] = useState<Array<{ id: string | null; name: string; depth: number }>>([]);
  const [moveFolderId, setMoveFolderId] = useState<string>('');

  const title = useMemo(() => {
    if (kind === 'materials') return lib === 'personal' ? 'App Materials' : 'User Materials';
    return lib === 'personal' ? 'App Assemblies' : 'User Assemblies';
  }, [kind, lib]);

  const selectionBanner = useMemo(() => {
    if (mode.type === 'add-materials-to-assembly' && kind === 'materials') return 'Picker mode: Add materials to assembly';
    if (mode.type === 'add-materials-to-estimate' && kind === 'materials') return 'Picker mode: Add materials to estimate';
    if (mode.type === 'add-assemblies-to-estimate' && kind === 'assemblies') return 'Picker mode: Add assemblies to estimate';
    return null;
  }, [kind, mode.type]);

  const returnToPath = useMemo(() => {
    if (mode.type === 'add-materials-to-assembly') return `/assemblies/user/${mode.assemblyId}`;
    if (mode.type === 'add-materials-to-estimate') return `/estimates/${mode.estimateId}`;
    if (mode.type === 'add-assemblies-to-estimate') return `/estimates/${mode.estimateId}`;
    return null;
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        if (mode.type === 'add-assemblies-to-estimate' && kind === 'assemblies') {
          const est = await data.getEstimate(mode.estimateId);
          if (!cancelled) setSelectedEstimateItems((est?.items ?? []) as any[]);
        } else {
          if (!cancelled) setSelectedEstimateItems(null);
        }
      } catch (e) {
        console.error(e);
        if (!cancelled) setSelectedEstimateItems(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, kind, mode]);

  const inMaterialPickerMode =
    kind === 'materials' && (mode.type === 'add-materials-to-assembly' || mode.type === 'add-materials-to-estimate');

  async function refresh() {
    try {
      setStatus('');

      // Load selection map in picker mode
      if (inMaterialPickerMode) {
        if (mode.type === 'add-materials-to-assembly') {
          const asm = await data.getAssembly(mode.assemblyId);
          const map: Record<string, string> = {};
          for (const it of (asm?.items ?? []) as any[]) {
            if (!it?.material_id) continue;
            map[it.material_id] = String(it.quantity ?? 1);
          }
          setSelectedQtyByMaterialId(map);
        } else if (mode.type === 'add-materials-to-estimate') {
          const est = await data.getEstimate(mode.estimateId);
          const map: Record<string, string> = {};
          for (const it of (est?.items ?? []) as any[]) {
            if (!it?.material_id) continue;
            map[it.material_id] = String(it.quantity ?? 1);
          }
          setSelectedQtyByMaterialId(map);
        }
      } else {
        setSelectedQtyByMaterialId({});
      }

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
        const existingIdx = prev.findIndex((b) => b.id === activeFolderId);
        if (existingIdx >= 0) return prev.slice(0, existingIdx + 1);
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
  }, [data, kind, lib, activeFolderId, mode.type]);

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

  async function buildFolderOptions() {
    const out: Array<{ id: string | null; name: string; depth: number }> = [{ id: null, name: 'Root', depth: 0 }];

    async function walk(parentId: string | null, depth: number) {
      const kids = await data.listFolders({ kind, libraryType: lib, parentId });
      for (const f of kids) {
        out.push({ id: f.id, name: f.name, depth });
        await walk(f.id, depth + 1);
      }
    }

    await walk(null, 1);
    setMoveFolders(out);
  }

  async function openMoveModal(target: NonNullable<MoveTarget>) {
    try {
      setStatus('');
      await buildFolderOptions();
      setMoveTarget(target);
      setMoveFolderId('');
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function confirmMove() {
    if (!moveTarget) return;
    try {
      setStatus('');
      const targetFolderId = moveFolderId === '' ? null : moveFolderId;

      if (moveTarget.type === 'material') {
        const m = await data.getMaterial(moveTarget.id);
        if (!m) throw new Error('Material not found');
        await data.upsertMaterial({ ...m, folder_id: targetFolderId } as any);
      } else if (moveTarget.type === 'assembly') {
        const a = await data.getAssembly(moveTarget.id);
        if (!a) throw new Error('Assembly not found');
        await data.upsertAssembly({ ...a, folder_id: targetFolderId } as any);
      } else if (moveTarget.type === 'folder') {
        const all = await collectFolderTreeIds(moveTarget.id);
        if (targetFolderId && all.has(targetFolderId)) {
          throw new Error('Cannot move a folder into itself (or its subtree).');
        }
        const folder = folders.find((f) => f.id === moveTarget.id) ?? (await findFolderById(moveTarget.id));
        if (!folder) throw new Error('Folder not found');
        await data.saveFolder({ ...folder, parent_id: targetFolderId } as any);
      } else if (moveTarget.type === 'bulk') {
        const folderIds = moveTarget.folderIds ?? [];
        const itemIds = moveTarget.itemIds ?? [];

        if (targetFolderId) {
          for (const fid of folderIds) {
            const tree = await collectFolderTreeIds(fid);
            if (tree.has(targetFolderId)) {
              throw new Error('Cannot move a folder into itself (or its subtree).');
            }
          }
        }

        // Move folders
        for (const fid of folderIds) {
          const folder = folders.find((f) => f.id === fid) ?? (await findFolderById(fid));
          if (!folder) continue;
          await data.saveFolder({ ...folder, parent_id: targetFolderId } as any);
        }

        // Move items
        for (const id of itemIds) {
          if (kind === 'materials') {
            const m = await data.getMaterial(id);
            if (!m) continue;
            await data.upsertMaterial({ ...m, folder_id: targetFolderId } as any);
          } else {
            const a = await data.getAssembly(id);
            if (!a) continue;
            await data.upsertAssembly({ ...a, folder_id: targetFolderId } as any);
          }
        }

        clearBulkSelection();
        setSelectMode(false);
      }

      setMoveTarget(null);
      await refresh();
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function collectFolderTreeIds(rootId: string): Promise<Set<string>> {
    const out = new Set<string>();
    async function walk(id: string) {
      out.add(id);
      const kids = await data.listFolders({ kind, libraryType: lib, parentId: id });
      for (const k of kids) await walk(k.id);
    }
    await walk(rootId);
    return out;
  }

  async function findFolderById(id: string): Promise<Folder | null> {
    // Best-effort: scan tree until found.
    async function walk(parentId: string | null): Promise<Folder | null> {
      const kids = await data.listFolders({ kind, libraryType: lib, parentId });
      for (const k of kids) {
        if (k.id === id) return k;
        const found = await walk(k.id);
        if (found) return found;
      }
      return null;
    }
    return await walk(null);
  }

  async function handleCreateFolder() {
    try {
      setStatus('');
      const name = await dialogs.prompt({
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

  async function handleRenameFolder(folder: Folder) {
    try {
      setStatus('');
      const name = await dialogs.prompt({
        title: 'Rename Folder',
        label: 'Folder name',
        defaultValue: folder.name,
        confirmText: 'Save',
      });
      if (!name) return;
      await data.saveFolder({ ...folder, name } as any);
      await refresh();
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function handleDeleteFolder(folder: Folder) {
    try {
      setStatus('');

      const ok = await dialogs.confirm({
        title: 'Delete Folder',
        message: `Delete “${folder.name}”?`,
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;

      await data.deleteFolder(folder.id);
      await refresh();
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  const selectedFolderCount = useMemo(() => Object.values(selectedFolderIds).filter(Boolean).length, [selectedFolderIds]);
  const selectedItemCount = useMemo(() => Object.values(selectedItemIds).filter(Boolean).length, [selectedItemIds]);

  function clearBulkSelection() {
    setSelectedFolderIds({});
    setSelectedItemIds({});
  }

  async function bulkMoveSelected() {
    try {
      setStatus('');
      if (!selectMode) return;

      const folderIds = Object.entries(selectedFolderIds)
        .filter(([, v]) => v)
        .map(([id]) => id);

      const itemIds = Object.entries(selectedItemIds)
        .filter(([, v]) => v)
        .map(([id]) => id);

      if (folderIds.length === 0 && itemIds.length === 0) return;

      await openMoveModal({ type: 'bulk', folderIds, itemIds });
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function bulkDeleteSelected() {
    try {
      setStatus('');
      const total = selectedFolderCount + selectedItemCount;
      if (total === 0) return;

      const ok = await dialogs.confirm({
        title: 'Delete Selected',
        message: `Delete ${selectedItemCount} item(s) and ${selectedFolderCount} folder(s)? This cannot be undone.`,
        confirmText: 'Delete',
        danger: true,
      });
      if (!ok) return;

      const itemIds = Object.entries(selectedItemIds)
        .filter(([, v]) => v)
        .map(([id]) => id);
      const folderIds = Object.entries(selectedFolderIds)
        .filter(([, v]) => v)
        .map(([id]) => id);

      // Delete items first (safer if any FK relationships exist)
      for (const id of itemIds) {
        try {
          if (kind === 'materials') await data.deleteMaterial(id);
          else await data.deleteAssembly(id);
        } catch (e) {
          // ignore individual failures so the rest continue
          console.warn('Bulk delete item failed', id, e);
        }
      }

      for (const id of folderIds) {
        try {
          await data.deleteFolder(id);
        } catch (e) {
          console.warn('Bulk delete folder failed', id, e);
        }
      }

      clearBulkSelection();
      setSelectMode(false);
      await refresh();
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function handleCreateMaterial() {
    try {
      setStatus('');
      if (!activeFolderId) {
        setStatus('Create or enter a folder first. Materials must live inside a folder.');
        return;
      }

      // App materials represent the global catalog and should only be created by the app owner.
      // Company users create materials in the User Materials library.
      if (lib === 'personal') {
        try {
          const owner = await (data as any).isAppOwner?.();
          if (!owner) {
            setStatus('App materials can only be created by the app owner.');
            return;
          }
        } catch {
          setStatus('App materials can only be created by the app owner.');
          return;
        }
      }
      const name = await dialogs.prompt({
        title: 'Create Material',
        label: 'New material name',
        defaultValue: 'New Material',
        confirmText: 'Create',
      });
      if (!name) return;

      const created = await data.upsertMaterial({
        // Let the DB generate the id (avoids insert failures under certain RLS/DB setups)
        // and always provide library_type so the provider maps owner correctly.
        library_type: lib,
        company_id: lib === 'personal' ? null : undefined,
        name,
        description: null,
        unit_cost: 0,
        taxable: true,
        labor_minutes: 0,
        folder_id: activeFolderId,
      } as any);

      nav(`/materials/${libraryType === 'app' ? 'app' : 'user'}/${created.id}`);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  async function handleCreateAssembly() {
    try {
      setStatus('');
      if (!activeFolderId) {
        setStatus('Create or enter a folder first. Assemblies must live inside a folder.');
        return;
      }
      const name = await dialogs.prompt({
        title: 'Create Assembly',
        label: 'New assembly name',
        defaultValue: 'New Assembly',
        confirmText: 'Create',
      });
      if (!name) return;

      const created = await data.upsertAssembly({
        id: crypto.randomUUID?.() ?? `asm_${Date.now()}`,
        company_id: lib === 'personal' ? null : undefined,
        // IMPORTANT: tell the provider which library this record belongs to.
        // App libraries use LibraryType 'personal' (DB owner='app'); User libraries use 'company' (DB owner='company').
        library_type: lib,
        name,
        description: null,
        items: [],
        labor_minutes: 0,
        folder_id: activeFolderId,
        created_at: new Date().toISOString(),
      } as any);

      nav(`/assemblies/${libraryType === 'app' ? 'app' : 'user'}/${created.id}`, {
        // Preserve current folder path so Back returns here (prevents "vanishing" folder drift).
        state: { returnTo: location.pathname },
      });
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  // Drag-sort (materials only, within a folder)
  const [draggingId, setDraggingId] = useState<string | null>(null);

  async function persistMaterialOrder(next: Material[]) {
    try {
      // Update order_index sequentially (best-effort)
      await Promise.all(next.map((m, idx) => data.upsertMaterial({ ...m, order_index: idx } as any)));
    } catch (e) {
      console.error(e);
      setStatus('Could not persist ordering.');
    }
  }

  // Picker: add/update/remove items
  async function updatePickerQuantity(materialId: string, qtyText: string) {
    if (!inMaterialPickerMode) return;

    const trimmed = qtyText.trim();
    const qty = trimmed === '' ? null : clampQty(Number(trimmed));

    // Keep UI selection map in sync (blank means removed)
    setSelectedQtyByMaterialId((prev) => {
      const next = { ...prev };
      if (qty == null) delete next[materialId];
      else next[materialId] = String(qty);
      return next;
    });

    try {
      if (mode.type === 'add-materials-to-assembly') {
        const asm = await data.getAssembly(mode.assemblyId);
        if (!asm) throw new Error('Assembly not found');

        const items = [...((asm.items ?? []) as any[])];
        const idx = items.findIndex((it) => it.material_id === materialId);

        if (qty == null) {
          // remove
          if (idx >= 0) items.splice(idx, 1);
        } else if (idx >= 0) {
          items[idx] = {
            ...items[idx],
            type: items[idx]?.type ?? 'material',
            material_id: items[idx]?.material_id ?? materialId,
            quantity: qty,
          };
        } else {
          items.push({
            id: crypto.randomUUID?.() ?? `it_${Date.now()}`,
            type: 'material',
            material_id: materialId,
            quantity: qty,
          });
        }

        await data.upsertAssembly({ ...asm, items } as any);
        return;
      }

      if (mode.type === 'add-materials-to-estimate') {
        const est = await data.getEstimate(mode.estimateId);
        if (!est) throw new Error('Estimate not found');

        const items = [...((est.items ?? []) as any[])];
        const idx = items.findIndex((it) => it.material_id === materialId);

        if (qty == null) {
          if (idx >= 0) items.splice(idx, 1);
        } else if (idx >= 0) {
          items[idx] = {
            ...items[idx],
            type: items[idx]?.type ?? 'material',
            material_id: items[idx]?.material_id ?? materialId,
            quantity: qty,
          };
        } else {
          items.push({
            id: crypto.randomUUID?.() ?? `it_${Date.now()}`,
            type: 'material',
            material_id: materialId,
            quantity: qty,
          });
        }

        await data.upsertEstimate({ ...est, items } as any);
      }
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  function clampAssemblyQty(n: number) {
    const x = Math.floor(Number(n));
    if (!Number.isFinite(x) || x <= 0) return 1;
    return Math.max(1, x);
  }

  async function handlePickAssembly(assemblyId: string, qtyText: string) {
    if (!(mode.type === 'add-assemblies-to-estimate' && kind === 'assemblies')) return;

    const trimmed = (qtyText ?? '').trim();
    const qty = trimmed === '' ? null : clampAssemblyQty(Number(trimmed));

    try {
      const est = await data.getEstimate(mode.estimateId);
      if (!est) throw new Error('Estimate not found');

      // NEW BEHAVIOR (authoritative): Assemblies act as placeholders that expand into
      // real estimate line items. The estimate stores the expanded items so pricing and
      // breakdown behave exactly like direct material/labor lines.
      //
      // We store a group header row (type: 'assembly_group') that holds the assembly
      // description/name and a group quantity. Child rows carry a `group_id` and
      // per-assembly baselines (`base_quantity`, `base_labor_minutes`). When group
      // quantity changes in the estimate editor, children are recalculated.

      const items = [...((est.items ?? []) as any[])];

      // Find existing group for this assembly source (if any)
      const existingGroupIdx = items.findIndex((it) => it.type === 'assembly_group' && it.source_assembly_id === assemblyId);
      const existingGroupId = existingGroupIdx >= 0 ? items[existingGroupIdx]?.id : null;

      // Remove: delete group + its children
      if (qty == null) {
        if (existingGroupIdx >= 0) {
          const gid = existingGroupId;
          const next = items.filter((it) => it.id !== gid && it.group_id !== gid);
          const saved = await data.upsertEstimate({ ...est, items: next } as any);
          setSelectedEstimateItems((saved?.items ?? next) as any[]);
        }
        return;
      }

      // Add/update: build expanded lines from the assembly definition
      const asm = await data.getAssembly(assemblyId);
      if (!asm) throw new Error('Assembly not found');
      const asmItems: any[] = (asm as any).items ?? [];

      const groupId = existingGroupId || (crypto.randomUUID?.() ?? `grp_${Date.now()}`);

      // Rebuild group header
      const groupHeader: any = {
        id: groupId,
        type: 'assembly_group',
        source_assembly_id: assemblyId,
        name: (asm as any).name ?? 'Assembly',
        description: (asm as any).description ?? null,
        quantity: qty,
      };

      // Remove old group + children (if any)
      const stripped = items.filter((it) => it.id !== groupId && it.group_id !== groupId);

      // Expand children
      const children: any[] = [];
      for (const it of asmItems) {
        const baseQty = Math.max(1, Math.floor(Number(it?.quantity ?? 1) || 1));
        const childId = crypto.randomUUID?.() ?? `it_${Date.now()}_${Math.random().toString(16).slice(2)}`;

        if (it?.type === 'material' && it?.material_id) {
          children.push({
            id: childId,
            type: 'material',
            material_id: it.material_id,
            quantity: qty * baseQty,
            group_id: groupId,
            base_quantity: baseQty,
          });
        } else if (it?.type === 'labor') {
          const baseMins = Math.max(0, Math.floor(Number(it?.labor_minutes ?? 0) || 0));
          children.push({
            id: childId,
            type: 'labor',
            name: String(it?.name ?? 'Labor'),
            labor_minutes: baseMins * qty,
            quantity: 1,
            group_id: groupId,
            base_labor_minutes: baseMins,
          });
        } else if (it?.type === 'blank_material') {
          // Best-effort support: a local, non-catalog material line.
          // Pricing engine treats this as a material cost override.
          const cost = it?.material_cost_override != null ? Number(it.material_cost_override) : 0;
          children.push({
            id: childId,
            type: 'blank_material',
            name: String(it?.name ?? 'Material'),
            material_cost_override: Number.isFinite(cost) ? cost : 0,
            quantity: qty * baseQty,
            group_id: groupId,
            base_quantity: baseQty,
          });
        }
      }

      const nextItems = [...stripped, groupHeader, ...children];
      const saved = await data.upsertEstimate({ ...est, items: nextItems } as any);
      setSelectedEstimateItems((saved?.items ?? nextItems) as any[]);
    } catch (e: any) {
      console.error(e);
      setStatus(String(e?.message ?? e));
    }
  }

  // Global search dropdown (materials only)
  useEffect(() => {
    if (kind !== 'materials') return;

    const q = searchText.trim();
    if (!q) {
      setSearchResults([]);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
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
        const lower = q.toLowerCase();

        const hits = all
          .filter(
            (m) =>
              (m.name ?? '').toLowerCase().includes(lower) ||
              (m.sku ?? '').toLowerCase().includes(lower) ||
              (m.description ?? '').toLowerCase().includes(lower)
          )
          .slice(0, 8);

        if (!cancelled) setSearchResults(hits);
      } catch {
        if (!cancelled) setSearchResults([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [data, kind, lib, searchText]);

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const el = searchBoxRef.current;
      if (!el) return;
      if (!el.contains(e.target as any)) {
        setSearchResults([]);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  return (
    <div className="stack">
      <Card
        title={title}
        right={
          <div className="row">
            {selectionBanner ? (
              <>
                <div className="pill">{selectionBanner}</div>
                {returnToPath ? (
                  <Button
                    variant="primary"
                    onClick={() => {
                      setMode({ type: 'none' });
                      nav(returnToPath);
                    }}
                  >
                    {mode.type === 'add-materials-to-assembly' ? 'Return to Assembly' : 'Return to Estimate'}
                  </Button>
                ) : null}
              </>
            ) : null}
            {selectionBanner ? null : (
              <>
                <Button
                  variant={selectMode ? 'secondary' : 'primary'}
                  onClick={() => {
                    if (selectMode) {
                      clearBulkSelection();
                      setSelectMode(false);
                    } else {
                      setSelectMode(true);
                    }
                  }}
                >
                  {selectMode ? 'Cancel Select' : 'Select'}
                </Button>

                <Button
                  variant="secondary"
                  disabled={!selectMode || selectedFolderCount + selectedItemCount === 0}
                  onClick={bulkMoveSelected}
                >
                  Move Selected
                </Button>

                <Button
                  variant="danger"
                  disabled={!selectMode || selectedFolderCount + selectedItemCount === 0}
                  onClick={bulkDeleteSelected}
                >
                  Delete Selected
                </Button>
              </>
            )}
            <Button onClick={handleCreateFolder}>Create Folder</Button>
            {kind === 'materials' ? (
              <Button variant="primary" onClick={handleCreateMaterial}>
                Create Material
              </Button>
            ) : (
              <Button variant="primary" onClick={handleCreateAssembly}>
                Create Assembly
              </Button>
            )}
          </div>
        }
      >
        <div className="stack">
          {/* Breadcrumbs */}
          <div className="row wrap">
            {breadcrumbs.map((b, idx) => (
              <Button key={String(b.id ?? 'root')} onClick={() => goToFolder(b.id, b.name)}>
                {idx === 0 ? 'Root' : b.name}
              </Button>
            ))}
          </div>

          {/* Global search */}
          {kind === 'materials' ? (
            <div ref={searchBoxRef} style={{ position: 'relative' }}>
              <Input
                placeholder="Search materials (name, SKU, description)…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
              {searchResults.length ? (
                <div className="dropdown" style={{ position: 'absolute', left: 0, right: 0, top: '42px', zIndex: 10 }}>
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      className="dropdownRow clickable"
                      onClick={() => {
                        setSearchResults([]);
                        nav(`/materials/${libraryType === 'app' ? 'app' : 'user'}/${m.id}`);
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <div className="muted small">{m.sku ?? ''}</div>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Folder list */}
          <div className="list">
            {folders.map((f) => (
              <div key={f.id} className="listRow">
                <div
                  className={selectMode ? '' : 'clickable'}
                  style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}
                  onClick={() => {
                    if (selectMode) {
                      setSelectedFolderIds((p) => ({ ...p, [f.id]: !p[f.id] }));
                      return;
                    }
                    goToFolder(f.id, f.name);
                  }}
                >
                  {selectMode ? (
                    <input
                      type="checkbox"
                      checked={!!selectedFolderIds[f.id]}
                      onChange={() => setSelectedFolderIds((p) => ({ ...p, [f.id]: !p[f.id] }))}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : null}
                  <span className="folderIcon">📁</span> {f.name}
                </div>
                <div className="row">
                  <Button onClick={() => handleRenameFolder(f)}>Rename</Button>
                  <Button onClick={() => openMoveModal({ type: 'folder', id: f.id, currentParentId: f.parent_id })}>Move</Button>
                  <Button variant="danger" onClick={() => handleDeleteFolder(f)}>
                    Delete
                  </Button>
                </div>
              </div>
            ))}
            {folders.length === 0 ? <div className="muted">No folders yet.</div> : null}
          </div>

          {/* Items list */}
          {kind === 'materials' ? (
            <div className="list">
              {materials.map((m) => {
                const selectedText = selectedQtyByMaterialId[m.id];
                const isSelected = selectedText != null;
                const draftText = draftQtyByMaterialId[m.id] ?? '1';
                return (
                  <div
                    key={m.id}
                    className={'listRow' + (isSelected ? ' selected' : '')}
                    draggable={!inMaterialPickerMode}
                    onDragStart={() => setDraggingId(m.id)}
                    onDragOver={(e) => {
                      if (!draggingId || draggingId === m.id) return;
                      e.preventDefault();
                    }}
                    onDrop={async (e) => {
                      e.preventDefault();
                      if (!draggingId || draggingId === m.id) return;
                      const cur = [...materials];
                      const from = cur.findIndex((x) => x.id === draggingId);
                      const to = cur.findIndex((x) => x.id === m.id);
                      if (from < 0 || to < 0) return;
                      const [moved] = cur.splice(from, 1);
                      cur.splice(to, 0, moved);
                      setMaterials(cur);
                      setDraggingId(null);
                      await persistMaterialOrder(cur);
                    }}
                  >
                    <div
                      className={selectMode && !inMaterialPickerMode ? '' : 'clickable'}
                      style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10 }}
                      onClick={() => {
                        if (inMaterialPickerMode) return;
                        if (selectMode) {
                          setSelectedItemIds((p) => ({ ...p, [m.id]: !p[m.id] }));
                          return;
                        }
                        nav(`/materials/${libraryType === 'app' ? 'app' : 'user'}/${m.id}`);
                      }}
                    >
                      {selectMode && !inMaterialPickerMode ? (
                        <input
                          type="checkbox"
                          checked={!!selectedItemIds[m.id]}
                          onChange={() => setSelectedItemIds((p) => ({ ...p, [m.id]: !p[m.id] }))}
                          onClick={(e) => e.stopPropagation()}
                        />
                      ) : null}
                      <div style={{ fontWeight: 600 }}>{m.name}</div>
                      <div className="muted small">{m.sku ?? ''}</div>
                    </div>

                    <div className="row">
                      <Button onClick={() => openMoveModal({ type: 'material', id: m.id, currentFolderId: m.folder_id ?? null })}>
                        Move
                      </Button>

                      {inMaterialPickerMode ? (
                        isSelected ? (
                          <div className="row">
                            <Button
                              onClick={() => updatePickerQuantity(m.id, String(clampQty(Number(selectedText)) - 1))}
                              disabled={clampQty(Number(selectedText)) <= 1}
                            >
                              -
                            </Button>
                            <Input
                              style={{ width: 80 }}
                              inputMode="numeric"
                              value={selectedText}
                              onChange={(e) => setSelectedQtyByMaterialId((prev) => ({ ...prev, [m.id]: e.target.value }))}
                              onBlur={() => updatePickerQuantity(m.id, selectedQtyByMaterialId[m.id] ?? '')}
                            />
                            <Button onClick={() => updatePickerQuantity(m.id, String(clampQty(Number(selectedText)) + 1))}>+</Button>
                            <Button variant="danger" onClick={() => updatePickerQuantity(m.id, '')}>
                              Remove
                            </Button>
                          </div>
                        ) : (
                          <div className="row">
                            <Button
                              onClick={() =>
                                setDraftQtyByMaterialId((prev) => ({
                                  ...prev,
                                  [m.id]: String(Math.max(1, clampQty(Number(draftText)) - 1)),
                                }))
                              }
                              disabled={clampQty(Number(draftText)) <= 1}
                            >
                              -
                            </Button>
                            <Input
                              style={{ width: 80 }}
                              inputMode="numeric"
                              value={draftText}
                              onChange={(e) => setDraftQtyByMaterialId((prev) => ({ ...prev, [m.id]: e.target.value }))}
                            />
                            <Button
                              onClick={() =>
                                setDraftQtyByMaterialId((prev) => ({
                                  ...prev,
                                  [m.id]: String(clampQty(Number(draftText)) + 1),
                                }))
                              }
                            >
                              +
                            </Button>
                            <Button variant="primary" onClick={() => updatePickerQuantity(m.id, draftText)}>
                              Add
                            </Button>
                          </div>
                        )
                      ) : null}
                    </div>
                  </div>
                );
              })}
              {materials.length === 0 ? <div className="muted">No materials in this folder.</div> : null}
            </div>
          ) : (
            <div className="list">
              {assemblies.map((a) => {
                const inAssemblyPicker = mode.type === 'add-assemblies-to-estimate';
                // current qty if already selected in estimate
                const selectedQty = (() => {
                  if (!inAssemblyPicker) return '';
                  const estItem = (selectedEstimateItems ?? []).find((it: any) => it.type === 'assembly' && it.assembly_id === a.id);
                  return estItem ? String(estItem.quantity ?? 1) : '';
                })();

                return (
                  <div key={a.id} className="listRow">
                    {selectMode && !inAssemblyPicker ? (
                      <input
                        type="checkbox"
                        checked={!!selectedItemIds[a.id]}
                        onChange={() => setSelectedItemIds((p) => ({ ...p, [a.id]: !p[a.id] }))}
                        onClick={(e) => e.stopPropagation()}
                        style={{ marginRight: 10, width: 18, height: 18 }}
                        aria-label={`Select ${a.name}`}
                      />
                    ) : null}
                    <div
                      className={inAssemblyPicker ? '' : 'clickable'}
                      style={{ flex: 1 }}
                      onClick={() => {
                        if (inAssemblyPicker) return;
                        if (selectMode) {
                          setSelectedItemIds((p) => ({ ...p, [a.id]: !p[a.id] }));
                          return;
                        }
                        nav(`/assemblies/${libraryType === 'app' ? 'app' : 'user'}/${a.id}`, {
                          state: { returnTo: location.pathname },
                        });
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{a.name}</div>
                      <div className="muted small">{((a as any).item_count ?? (a.items ?? []).length) as any} items</div>
                    </div>

                    <div className="row" style={{ gap: 8 }}>
                      {inAssemblyPicker ? (
                        (() => {
                          const draftText = draftQtyByAssemblyId[a.id] ?? (selectedQty || '1');
                          const isSelected = (selectedQty ?? '').trim() !== '';
                          return (
                            <div className="row" style={{ gap: 6, alignItems: 'center' }}>
                              <Button
                                onClick={() =>
                                  setDraftQtyByAssemblyId((prev) => ({
                                    ...prev,
                                    [a.id]: String(Math.max(1, clampAssemblyQty(Number(draftText)) - 1)),
                                  }))
                                }
                              >
                                -
                              </Button>
                              <Input
                                style={{ width: 90 }}
                                type="text"
                                inputMode="numeric"
                                placeholder="Qty"
                                value={draftText}
                                onChange={(e) => setDraftQtyByAssemblyId((prev) => ({ ...prev, [a.id]: e.target.value }))}
                                onBlur={() =>
                                  setDraftQtyByAssemblyId((prev) => ({
                                    ...prev,
                                    [a.id]: String(clampAssemblyQty(Number((prev[a.id] ?? '').trim() || 1))),
                                  }))
                                }
                              />
                              <Button
                                onClick={() =>
                                  setDraftQtyByAssemblyId((prev) => ({
                                    ...prev,
                                    [a.id]: String(clampAssemblyQty(Number(draftText)) + 1),
                                  }))
                                }
                              >
                                +
                              </Button>
                              {isSelected ? (
                                <Button variant="danger" onClick={() => handlePickAssembly(a.id, '')}>
                                  Remove
                                </Button>
                              ) : (
                                <Button variant="primary" onClick={() => handlePickAssembly(a.id, draftText)}>
                                  Add
                                </Button>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <Button onClick={() => openMoveModal({ type: 'assembly', id: a.id, currentFolderId: a.folder_id ?? null })}>Move</Button>
                      )}
                    </div>
                  </div>
                );
              })}
              {assemblies.length === 0 ? <div className="muted">No assemblies in this folder.</div> : null}
            </div>
          )}

          {status ? <div className="muted small mt">{status}</div> : null}
        </div>
      </Card>

      {moveTarget ? (
        <Modal
          title="Move To…"
          onClose={() => setMoveTarget(null)}
          footer={
            <div className="row">
              <Button onClick={() => setMoveTarget(null)}>Cancel</Button>
              <Button variant="primary" onClick={confirmMove}>
                Move
              </Button>
            </div>
          }
        >
          <div className="stack">
            <div className="muted">Select destination folder:</div>
            <select className="input" value={moveFolderId} onChange={(e) => setMoveFolderId(e.target.value)}>
              <option value="">Root</option>
              {moveFolders
                .filter((f) => f.id !== null)
                .map((f) => (
                  <option key={f.id as any} value={f.id as any}>
                    {`${'—'.repeat(Math.max(0, f.depth - 1))} ${f.name}`}
                  </option>
                ))}
            </select>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

