
import { computePricingBreakdown, PricingInput } from '../../providers/data/pricing';

type Props = {
  pricingInput: PricingInput;
};

export function EstimateTotals({ pricingInput }: Props) {
  const breakdown = computePricingBreakdown(pricingInput);

  return (
    <div className="estimate-totals">
      <div>Subtotal: ${breakdown.totals.final_subtotal.toFixed(2)}</div>
      <div>Total: ${breakdown.totals.final_total.toFixed(2)}</div>
    </div>
  );
}

