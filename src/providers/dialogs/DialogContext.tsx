import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button } from '../../ui/components/Button';
import { Input } from '../../ui/components/Input';
import { Modal } from '../../ui/components/Modal';

type ConfirmOptions = {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
};

type PromptOptions = {
  title?: string;
  label?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
};

type DialogApi = {
  confirm: (opts: ConfirmOptions) => Promise<boolean>;
  prompt: (opts: PromptOptions) => Promise<string | null>;
};

type ActiveDialog =
  | {
      kind: 'confirm';
      opts: ConfirmOptions;
      resolve: (value: boolean) => void;
    }
  | {
      kind: 'prompt';
      opts: PromptOptions;
      resolve: (value: string | null) => void;
    };

const DialogContext = createContext<DialogApi | null>(null);

export function useDialogs(): DialogApi {
  const ctx = useContext(DialogContext);
  if (!ctx) {
    throw new Error('useDialogs must be used within DialogProvider');
  }
  return ctx;
}

export function DialogProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState<ActiveDialog | null>(null);
  const [promptValue, setPromptValue] = useState('');
  const inputRef = useRef<HTMLInputElement | null>(null);

  const confirm = useCallback((opts: ConfirmOptions) => {
    return new Promise<boolean>(resolve => {
      setActive({ kind: 'confirm', opts, resolve });
    });
  }, []);

  const prompt = useCallback((opts: PromptOptions) => {
    return new Promise<string | null>(resolve => {
      setPromptValue(opts.defaultValue ?? '');
      setActive({ kind: 'prompt', opts, resolve });
      // focus after mount
      setTimeout(() => inputRef.current?.focus(), 0);
    });
  }, []);

  const api = useMemo(() => ({ confirm, prompt }), [confirm, prompt]);

  const close = () => {
    // treat overlay click / escape as cancel
    if (!active) return;
    if (active.kind === 'confirm') active.resolve(false);
    if (active.kind === 'prompt') active.resolve(null);
    setActive(null);
  };

  const onConfirm = () => {
    if (!active) return;
    if (active.kind === 'confirm') active.resolve(true);
    if (active.kind === 'prompt') active.resolve(promptValue.trim());
    setActive(null);
  };

  const onCancel = () => close();

  return (
    <DialogContext.Provider value={api}>
      {children}

      {active ? (
        <Modal title={active.opts.title} onClose={onCancel}
          footer={
            <>
              <Button variant="secondary" onClick={onCancel}>
                {active.opts.cancelText ?? 'Cancel'}
              </Button>
              <Button
                variant={active.kind === 'confirm' && active.opts.danger ? 'danger' : 'primary'}
                onClick={onConfirm}
              >
                {active.opts.confirmText ?? 'OK'}
              </Button>
            </>
          }
        >
          {active.kind === 'confirm' ? (
            <div className="modalMessage">{active.opts.message}</div>
          ) : (
            <div>
              <label className="modalFieldLabel">{active.opts.label ?? 'Name'}</label>
              <Input
                ref={el => {
                  inputRef.current = el;
                }}
                value={promptValue}
                placeholder={active.opts.placeholder}
                onChange={e => setPromptValue(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') onConfirm();
                }}
              />
            </div>
          )}
        </Modal>
      ) : null}
    </DialogContext.Provider>
  );
}

