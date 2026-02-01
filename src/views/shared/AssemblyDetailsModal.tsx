import type { Assembly, Material } from '../../providers/data/types';
import { Button } from '../../ui/components/Button';
import { Modal } from '../../ui/components/Modal';

function fmtMoney(n: any) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '$0.00';
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function AssemblyDetailsModal({
  assembly,
  materialsById,
  onViewMaterial,
  onClose,
}: {
  assembly: Assembly;
  materialsById: Record<string, Material | null | undefined>;
  onViewMaterial: (id: string) => void;
  onClose: () => void;
}) {
  const items: any[] = ((assembly as any).items ?? []) as any[];

  return (
    <Modal
      title="Assembly Details"
      onClose={onClose}
      footer={
        <>
          <Button variant="primary" onClick={onClose}>
            Close
          </Button>
        </>
      }
    >
      <div className="stack">
        <div>
          <div className="muted">Name</div>
          <div><b>{assembly.name}</b></div>
        </div>

        <div>
          <div className="muted">Description</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{(assembly as any).description ?? '—'}</div>
        </div>

        <div>
          <div className="muted">Items</div>
          <div className="stack" style={{ gap: 10 }}>
            {items.length === 0 ? <div className="muted">No items.</div> : null}
            {items.map((it: any) => {
              const t = it.type ?? it.item_type ?? 'material';
              if (t === 'labor') {
                return (
                  <div key={it.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <b>{it.name ?? 'Labor'}</b>
                      <div className="muted">{(it.description ?? '').trim() || '—'}</div>
                    </div>
                    <div className="muted">{Math.max(0, Math.floor(Number(it.minutes ?? it.labor_minutes ?? 0)))} min</div>
                  </div>
                );
              }

              if (t === 'blank_material') {
                return (
                  <div key={it.id} className="row" style={{ justifyContent: 'space-between' }}>
                    <div>
                      <b>{it.name ?? 'Material'}</b>
                      <div className="muted">{(it.description ?? '').trim() || '—'}</div>
                    </div>
                    <div className="muted">
                      Qty {Math.max(1, Math.floor(Number(it.quantity ?? 1)))} • {fmtMoney(it.unit_cost ?? 0)}
                    </div>
                  </div>
                );
              }

              const materialId = it.material_id ?? it.materialId;
              const m = materialId ? materialsById[materialId] : null;
              const label = m?.name ?? `Material ${materialId ?? ''}`.trim() || 'Material';
              return (
                <div key={it.id} className="row" style={{ justifyContent: 'space-between' }}>
                  <div>
                    <button
                      type="button"
                      onClick={() => materialId && onViewMaterial(materialId)}
                      style={{
                        padding: 0,
                        border: 'none',
                        background: 'transparent',
                        cursor: materialId ? 'pointer' : 'default',
                        textAlign: 'left',
                        fontWeight: 700,
                      }}
                      disabled={!materialId}
                    >
                      {label}
                    </button>
                    <div className="muted">{(m as any)?.description ?? '—'}</div>
                  </div>
                  <div className="muted">Qty {Math.max(1, Math.floor(Number(it.quantity ?? 1)))}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

