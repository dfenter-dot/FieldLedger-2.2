
import { computePricingBreakdown, PricingInput } from '../../providers/data/pricing';

type Props = {
  showPricing?: boolean;
  isAdmin?: boolean;
  pricingInput: PricingInput;
};

export function EstimatePricingBreakdown({ pricingInput }: Props) {
  if (!isAdmin && !showPricing) return null;
  const breakdown = computePricingBreakdown(pricingInput);

  return (
    <div className="card">
      <h3>Pricing Breakdown (Tech View)</h3>

      <section>
        <h4>Labor</h4>
        <div>Actual Minutes: {breakdown.labor.actual_minutes}</div>
        <div>Expected Minutes: {breakdown.labor.expected_minutes}</div>
        <div>Base Rate: ${breakdown.labor.base_rate.toFixed(2)}</div>
        <div>Effective Rate: ${breakdown.labor.effective_rate.toFixed(2)}</div>
        <div>Labor Sell: ${breakdown.labor.labor_sell.toFixed(2)}</div>
      </section>

      <section>
        <h4>Materials</h4>
        <div>Material Sell: ${breakdown.materials.material_sell.toFixed(2)}</div>
        <div>Misc Material: ${breakdown.materials.misc_material.toFixed(2)}</div>
      </section>

      <section>
        <h4>Totals</h4>
        <div>Pre-Discount Subtotal: ${breakdown.subtotals.pre_discount_subtotal.toFixed(2)}</div>
        <div>Discount: ${breakdown.subtotals.discount_amount.toFixed(2)}</div>
        <div>Final Subtotal: ${breakdown.totals.final_subtotal.toFixed(2)}</div>
        <div>Processing Fee: ${breakdown.processing_fee.toFixed(2)}</div>
        <strong>Final Total: ${breakdown.totals.final_total.toFixed(2)}</strong>
      </section>
    </div>
  );
}

