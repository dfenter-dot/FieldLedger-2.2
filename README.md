# FieldLedger (v0.1 scaffold)

This is a starter scaffold for the FieldLedger app.

## Modes
- **Production (Netlify)**: Supabase-only storage (no localStorage)
- **StackBlitz testing**: localStorage data provider (mock "App Owner" login)

Set via env var:

- `VITE_DATA_PROVIDER=local` (StackBlitz)
- `VITE_DATA_PROVIDER=supabase` (Netlify)

> Safety: production builds force `supabase` even if `local` is set.

## Run
```bash
npm install
npm run dev
```

## Build
```bash
npm run build
npm run preview
```

## Next wiring
- Replace `SupabaseDataProvider` stubs with your Supabase queries + RLS schema
- Implement folder navigation, drag/drop ordering, and move modal
- Implement Materials/Assemblies editors and selection flows
- Implement Estimate PDF generation + branding settings
