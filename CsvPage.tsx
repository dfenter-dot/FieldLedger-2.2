import { Card } from '../../ui/components/Card';

export function CsvPage() {
  return (
    <div className="stack">
      <Card title="CSV Import / Export">
        <ul className="bullets">
          <li>Exports: Materials, Assemblies, Estimates (backup)</li>
          <li>Imports: Materials, Assemblies (no estimate imports)</li>
          <li>Folder paths use backslashes, e.g. Devices\Outlets\TR Duplex</li>
          <li>Categories/subcategories are auto-created from CSV</li>
          <li>Booleans use true/false; taxable defaults to true</li>
          <li>Labor time uses decimal hours in CSV (1.5 = 1h 30m) and converts on import/export</li>
          <li>App-owned items cannot be exported line-by-line; export must be bulk summary if present</li>
        </ul>
      </Card>
    </div>
  );
}
