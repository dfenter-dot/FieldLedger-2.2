import type { JobType, Material } from '../../providers/data/types';
import { Button } from '../../ui/components/Button';
import { Modal } from '../../ui/components/Modal';

function fmtMoney(n: any) {
  const v = Number(n ?? 0);
  if (!Number.isFinite(v)) return '$0.00';
  return v.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtMinutesToHM(totalMinutes: number) {
  const mins = Math.max(0, Math.floor(totalMinutes || 0));
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

export function MaterialDetailsModal({
  material,
  jobTypesById,
  onClose,
}: {
  material: Material;
  jobTypesById?: Record<string, JobType | undefined>;
  onClose: () => void;
}) {
  const jobTypeName = material.job_type_id ? (jobTypesById?.[material.job_type_id]?.name ?? material.job_type_id) : '—';
  const laborMinutes =
    Math.max(0, Math.floor(Number((material as any).labor_hours ?? (material as any).laborHours ?? 0) * 60)) +
    Math.max(0, Math.floor(Number((material as any).labor_minutes ?? (material as any).laborMinutes ?? 0)));

  return (
    <Modal
      title="Material Details"
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
          <div><b>{material.name}</b></div>
        </div>

        <div>
          <div className="muted">SKU / Part #</div>
          <div>{(material as any).sku ?? (material as any).part_number ?? '—'}</div>
        </div>

        <div>
          <div className="muted">Description</div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{(material as any).description ?? '—'}</div>
        </div>

        <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="muted">Base Cost</div>
            <div>{fmtMoney((material as any).base_cost ?? (material as any).unit_cost ?? 0)}</div>
          </div>
          <div>
            <div className="muted">Custom Cost</div>
            <div>{fmtMoney((material as any).custom_cost ?? 0)}</div>
          </div>
          <div>
            <div className="muted">Use Custom Cost</div>
            <div>{(material as any).use_custom_cost ? 'Yes' : 'No'}</div>
          </div>
          <div>
            <div className="muted">Taxable</div>
            <div>{material.taxable ? 'Yes' : 'No'}</div>
          </div>
        </div>

        <div className="row" style={{ gap: 24, flexWrap: 'wrap' }}>
          <div>
            <div className="muted">Labor Time</div>
            <div>{fmtMinutesToHM(laborMinutes)}</div>
          </div>
          <div>
            <div className="muted">Job Type</div>
            <div>{jobTypeName}</div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

