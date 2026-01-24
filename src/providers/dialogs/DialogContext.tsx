import { createContext, useContext, useState, ReactNode } from 'react';

type PromptOptions = {
  title: string;
  placeholder?: string;
};

type DialogContextType = {
  prompt(options: PromptOptions): Promise<string | null>;
  confirm(message: string): Promise<boolean>;
};

const DialogContext = createContext<DialogContextType | null>(null);

export function DialogProvider({ children }: { children: ReactNode }) {
  const [resolver, setResolver] = useState<
    ((value: string | null | boolean) => void) | null
  >(null);
  const [mode, setMode] = useState<'prompt' | 'confirm' | null>(null);
  const [value, setValue] = useState('');
  const [message, setMessage] = useState('');

  const close = (result: any) => {
    resolver?.(result);
    setResolver(null);
    setMode(null);
    setValue('');
    setMessage('');
  };

  const prompt = (options: PromptOptions) =>
    new Promise<string | null>(resolve => {
      setMode('prompt');
      setMessage(options.title);
      setResolver(resolve);
    });

  const confirm = (msg: string) =>
    new Promise<boolean>(resolve => {
      setMode('confirm');
      setMessage(msg);
      setResolver(resolve);
    });

  return (
    <DialogContext.Provider value={{ prompt, confirm }}>
      {children}

      {mode && (
        <div className="modal-backdrop">
          <div className="modal">
            <h3>{message}</h3>

            {mode === 'prompt' && (
              <input
                autoFocus
                value={value}
                onChange={e => setValue(e.target.value)}
              />
            )}

            <div className="actions">
              <button onClick={() => close(null)}>Cancel</button>
              <button
                onClick={() =>
                  close(mode === 'prompt' ? value : true)
                }
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
}

export function useDialogs() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogs must be used inside DialogProvider');
  return ctx;
}
