import { ReactNode } from 'react';
import './card.css';

export function Card({ title, children, right }: { title?: string; children: ReactNode; right?: ReactNode }) {
  return (
    <section className="card">
      {(title || right) && (
        <div className="cardHeader">
          {title ? <h2 className="cardTitle">{title}</h2> : <div />}
          {right}
        </div>
      )}
      <div className="cardBody">{children}</div>
    </section>
  );
}
