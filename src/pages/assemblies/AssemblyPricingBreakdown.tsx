
import { computePricingBreakdown, PricingInput } from '../../providers/data/pricing';

type Props = {
  showPricing?: boolean;
  isAdmin?: boolean;
  pricingInput: PricingInput;
};

export function AssemblyPricingBreakdown({ pricingInput }: Props) {
  if (!isAdmin && !showPricing) return null;
  const breakdown = computePricingBreakdown(pricingInput);

  return (
    <div className="card">
      <h3>Assembly Pricing Breakdown (Tech View)</h3>

      <div>Labor Sell: ${breakdown.labor.labor_sell.toFixed(2)}</div>
      <div>Material Sell: ${breakdown.materials.material_sell.toFixed(2)}</div>
      <div>Misc Material: ${breakdown.materials.misc_material.toFixed(2)}</div>
      <strong>Total: ${breakdown.totals.final_total.toFixed(2)}</strong>
    </div>
  );
}

