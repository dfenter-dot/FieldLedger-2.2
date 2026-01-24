import { Card } from '../../ui/components/Card';
import { Button } from '../../ui/components/Button';
import { useNavigate } from 'react-router-dom';

const items: { title: string; path: string; desc: string }[] = [
  { title: 'Company Setup', path: '/admin/company-setup', desc: 'Company-wide pricing and estimate defaults.' },
  { title: 'Job Types', path: '/admin/job-types', desc: 'Margin, efficiency, hourly vs flat-rate mode.' },
  { title: 'Job Costing', path: '/admin/job-costing', desc: 'Compare expected vs actual and capture notes.' },
  { title: 'Rules', path: '/admin/rules', desc: 'Admin rules (priority based) for job type selection.' },
  { title: 'CSV', path: '/admin/csv', desc: 'Import / export settings and tools.' },
  { title: 'Branding', path: '/admin/branding', desc: 'Company name, license info, and PDF details.' },
];

export function AdminHomePage() {
  const nav = useNavigate();

  return (
    <div className="stack">
      <Card title="Admin">
        <div className="muted">Select a section to manage company settings.</div>
      </Card>

      <div className="grid2">
        {items.map((i) => (
          <Card
            key={i.path}
            title={i.title}
            right={<Button variant="primary" onClick={() => nav(i.path)}>Open</Button>}
          >
            <div className="muted">{i.desc}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
