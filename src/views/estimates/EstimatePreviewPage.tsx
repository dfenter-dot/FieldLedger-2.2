import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useData } from '../../providers/data/DataContext';
import type { Assembly, BrandingSettings, CompanySettings, Estimate, Material } from '../../providers/data/types';
import { computeEstimatePricing } from '../../providers/data/pricing';
import { supabase } from '../../supabase/client';

async function signedLogoUrl(branding: BrandingSettings | null): Promise<string | null> {
  const path = branding?.logo_url ?? null;
  if (!path) return null;
  const { data, error } = await supabase.storage.from('company-logos').createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function EstimatePreviewPage() {
  const { estimateId } = useParams();
  const nav = useNavigate();
  const data = useData();

  const [e, setE] = useState<Estimate | null>(null);
  const [status, setStatus] = useState('');
  const [companySettings, setCompanySettings] = useState<CompanySettings | null>(null);
  const [brandingSettings, setBrandingSettings] = useState<BrandingSettings | null>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [jobTypes, setJobTypes] = useState<any[]>([]);
  const [materialCache, setMaterialCache] = useState<Record<string, Material | null>>({});
  const [assemblyCache, setAssemblyCache] = useState<Record<string, Assembly | null>>({});

  useEffect(() => {
    if (!estimateId) return;
    data.getEstimate(estimateId).then(setE).catch((err) => setStatus(String((err as any)?.message ?? err)));
  }, [data, estimateId]);

  useEffect(() => {
    Promise.all([data.getCompanySettings(), data.getBrandingSettings(), data.listJobTypes()])
      .then(async ([s, b, jts]) => {
        setCompanySettings(s);
        setBrandingSettings(b);
        setJobTypes(jts);
        setLogoUrl(await signedLogoUrl(b));
      })
      .catch(() => {});
  }, [data]);

  useEffect(() => {
    const items = e?.items ?? [];
    const matIds = Array.from(new Set(items.map((it: any) => it.material_id).filter(Boolean)));
    const asmIds = Array.from(new Set(items.map((it: any) => it.assembly_id).filter(Boolean)));
    let cancelled = false;
    (async () => {
      const nextM: Record<string, Material | null> = {};
      for (const id of matIds) {
        try {
          nextM[id] = await data.getMaterial(id);
        } catch {
          nextM[id] = null;
        }
      }
      const nextA: Record<string, Assembly | null> = {};
      for (const id of asmIds) {
        try {
          nextA[id] = await data.getAssembly(id);
        } catch {
          nextA[id] = null;
        }
      }
      if (!cancelled) {
        setMaterialCache(nextM);
        setAssemblyCache(nextA);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, e]);

  const totals = useMemo(() => {
    if (!e || !companySettings) return null;
    const jobTypesById = Object.fromEntries(jobTypes.map((j) => [j.id, j]));
    return computeEstimatePricing({
      estimate: e,
      materialsById: materialCache,
      assembliesById: assemblyCache,
      jobTypesById,
      companySettings,
    });
  }, [assemblyCache, companySettings, e, jobTypes, materialCache]);

  if (!e) return <div className="muted">Loading…</div>;

  return (
    <div className="stack">
      <Card
        title={`Customer View • Estimate #${e.estimate_number}`}
        right={
          <div className="row">
            <Button onClick={() => nav(-1)}>Back</Button>
            <Button variant="secondary" onClick={() => window.print()}>Print / Save PDF</Button>
          </div>
        }
      >
        {status ? <div className="muted small">{status}</div> : null}

        <div className="printPage">
          <div className="printHeader">
            {logoUrl ? <img src={logoUrl} alt="Logo" className="printLogo" /> : <div />}
            <div className="printHeaderRight">
              <div className="printTitle">Estimate</div>
              <div className="muted small">Estimate #{e.estimate_number}</div>
            </div>
          </div>

          <div className="printGrid">
            <div>
              <div className="muted small">Estimate Name</div>
              <div style={{ fontWeight: 700 }}>{e.name}</div>
            </div>
            <div>
              <div className="muted small">Customer</div>
              <div style={{ fontWeight: 650 }}>{e.customer_name ?? '—'}</div>
              <div className="muted small">
                {e.customer_phone ?? ''} {e.customer_email ? `• ${e.customer_email}` : ''}
              </div>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <div className="muted small">Address</div>
              <div>{e.customer_address ?? '—'}</div>
            </div>
          </div>

          <div className="printSection">
            <div className="printSectionTitle">Line Items</div>
            <table className="printTable">
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Item</th>
                  <th style={{ textAlign: 'left' }}>Type</th>
                  <th style={{ textAlign: 'right' }}>Qty</th>
                </tr>
              </thead>
              <tbody>
                {(e.items ?? []).map((it: any) => {
                  const qty = Number(it.quantity ?? 1) || 1;
                  const mat = it.material_id ? materialCache[it.material_id] : null;
                  const asm = it.assembly_id ? assemblyCache[it.assembly_id] : null;
                  const title = mat?.name ?? asm?.name ?? 'Item';
                  const type = mat ? 'Material' : asm ? 'Assembly' : 'Item';
                  return (
                    <tr key={it.id}>
                      <td>{title}</td>
                      <td className="muted">{type}</td>
                      <td style={{ textAlign: 'right' }}>{qty}</td>
                    </tr>
                  );
                })}
                {(e.items ?? []).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="muted">No items yet.</td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>

          {totals ? (
            <div className="printSection">
              <div className="printSectionTitle">Totals</div>
              <table className="printTotals">
                <tbody>
                  <tr>
                    <td>Pre-discount total</td>
                    <td style={{ textAlign: 'right' }}>${totals.pre_discount_total.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Discount ({totals.discount_percent.toFixed(2)}%)</td>
                    <td style={{ textAlign: 'right' }}>-${totals.discount_amount.toFixed(2)}</td>
                  </tr>
                  <tr>
                    <td>Subtotal</td>
                    <td style={{ textAlign: 'right' }}>${totals.subtotal_before_processing.toFixed(2)}</td>
                  </tr>
                  {e.apply_processing_fees ? (
                    <tr>
                      <td>Processing fee</td>
                      <td style={{ textAlign: 'right' }}>${totals.processing_fee.toFixed(2)}</td>
                    </tr>
                  ) : null}
                  <tr className="printTotalRow">
                    <td>Total</td>
                    <td style={{ textAlign: 'right' }}>${totals.total.toFixed(2)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="printMetrics">
                <div className="muted small">Reporting (COGS targets)</div>
                <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
                  <div className="pill">Material COGS: ${totals.material_cost.toFixed(2)}</div>
                  <div className="pill">Labor COGS: ${totals.labor_cost.toFixed(2)}</div>
                  <div className="pill">Expected Labor: {(totals.labor_minutes_expected / 60).toFixed(2)} hrs</div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="printFooter">
            {companySettings?.company_license_text ? (
              <div>
                <div className="printFooterTitle">License / Credentials</div>
                <div className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{companySettings.company_license_text}</div>
              </div>
            ) : null}
            {companySettings?.company_warranty_text ? (
              <div>
                <div className="printFooterTitle">Warranty / Terms</div>
                <div className="muted small" style={{ whiteSpace: 'pre-wrap' }}>{companySettings.company_warranty_text}</div>
              </div>
            ) : null}
          </div>
        </div>
      </Card>
    </div>
  );
}

