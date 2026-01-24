import { ForwardedRef, InputHTMLAttributes, forwardRef } from 'react';
import './input.css';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string; // '$' or '%'
};

export const Input = forwardRef(function Input(
  { prefix, ...rest }: Props,
  ref: ForwardedRef<HTMLInputElement>
) {
  // Allow decimals for number inputs unless caller overrides step.
  const stepProps =
    rest.type === 'number' && rest.step === undefined ? { step: 'any' } : {};

  return (
    <div className="inputWrap">
      {prefix ? <div className="inputPrefix">{prefix}</div> : null}
      <input ref={ref} className="input" {...stepProps} {...rest} />
    </div>
  );
});

