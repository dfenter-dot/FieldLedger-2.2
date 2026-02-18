import { ButtonHTMLAttributes } from 'react';
import clsx from 'clsx';
import { Button } from './Button';

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
 * Notes:
 * - Uses existing shared Button styling (no extra CSS dependency).
 * - Icon feedback is done with simple characters to avoid build issues if a CSS file is missing.
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
      className={clsx(className)}
    >
      {/* Visible feedback without requiring additional CSS */}
      {state === 'saving' ? <span aria-hidden style={{ marginRight: 8 }}>⏳</span> : null}
      {state === 'saved' ? <span aria-hidden style={{ marginRight: 8 }}>✓</span> : null}
      {state === 'error' ? <span aria-hidden style={{ marginRight: 8 }}>⚠</span> : null}
      <span>{label}</span>
    </Button>
  );
}

