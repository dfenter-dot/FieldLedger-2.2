import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import './button.css';

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
};

export function Button({ variant = 'secondary', className, ...rest }: Props) {
  return <button {...rest} className={clsx('btn', `btn-${variant}`, className)} />;
}
