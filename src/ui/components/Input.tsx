import { InputHTMLAttributes } from 'react';
import './input.css';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string; // '$' or '%'
};

export function Input({ prefix, ...rest }: Props) {
  // Allow decimals for number inputs unless caller overrides step.
  const stepProps =
    rest.type === 'number' && rest.step === undefined ? { step: 'any' } : {};

  return (
    <div className="inputWrap">
      {prefix ? <div className="inputPrefix">{prefix}</div> : null}
      <input className="input" {...stepProps} {...rest} />
    </div>
  );
}

