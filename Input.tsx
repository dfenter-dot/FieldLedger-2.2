import { InputHTMLAttributes } from 'react';
import './input.css';

type Props = InputHTMLAttributes<HTMLInputElement> & {
  prefix?: string; // '$' or '%'
};

export function Input({ prefix, ...rest }: Props) {
  return (
    <div className="inputWrap">
      {prefix ? <div className="inputPrefix">{prefix}</div> : null}
      <input className="input" {...rest} />
    </div>
  );
}
