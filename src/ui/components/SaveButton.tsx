import { ButtonHTMLAttributes } from 'react';
import { Button } from './Button';
import clsx from 'clsx';
import './saveButton.css';

export type SaveUiState = 'idle' | 'saving' | 'saved' | 'error';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  state: SaveUiState;
  /** Optional custom labels. */
  labels?: {
    idle?: string;
    saving?: string;
    saved?: string;
    error?: string;
  };
};

/**
 * Standard Save button feedback: Saving → Saved.
 *
 * Contract:
 * - state must be updated on user action (onClick) and on completion.
 * - normalization/validation should happen on blur/save, not on every keypress.
 */
export function SaveButton({ state, labels, className, disabled, ...rest }: Props) {
  const label =
    state === 'saving'
      ? labels?.saving ?? 'Saving…'
      : state === 'saved'
        ? labels?.saved ?? 'Saved'
        : state === 'error'
          ? labels?.error ?? 'Error'
          : labels?.idle ?? 'Save';

  const isBusy = state === 'saving';

  return (
    <Button
      variant="primary"
      {...rest}
      disabled={disabled || isBusy}
      aria-busy={isBusy}
      className={clsx('save-btn', className)}
    >
      {state === 'saving' ? <span className="sb-spinner" aria-hidden /> : null}
      {state === 'saved' ? <span className="sb-check" aria-hidden>
        ✓
      </span> : null}
      <span className="sb-label">{label}</span>
    </Button>
  );
}

