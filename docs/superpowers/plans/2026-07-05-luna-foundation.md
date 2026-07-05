# Luna — Plan 1: Fundación web (Implementation Plan)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Luna **web app** (React + TS + Vite) with Supabase auth + Postgres persistence (per-user, RLS-isolated), a case library, the case shell with three phase tabs, and a working Preparación form that autosaves — then deploy to Vercel. No AI yet.

**Architecture:** React SPA (Vite) talking to Supabase (`@supabase/supabase-js`) for auth and data. One case = one row in `cases` (nested structures as JSONB). RLS ensures each user only sees their rows. Pure mapping functions (`rowToCase`/`caseToRow`) isolate the data shape and are unit-tested; network CRUD is verified manually. Deployed on Vercel from GitHub `luna-lexagis/luna`.

**Tech Stack:** React 18, TypeScript, Vite, @supabase/supabase-js v2, Vitest, plain CSS. Package manager: npm. Hosting: Vercel. DB/Auth: Supabase.

**Spec:** `docs/superpowers/specs/2026-07-05-luna-design.md` (sections 4, 5, 6, 7, 11, 12).

**Roadmap position:** Plan 1 of 5 (web). Delivers a deployed app: sign up / log in, create/open/delete your cases, fill Preparación, data persists in Supabase.

**Prerequisite (user, manual):** a Supabase project exists and its **Project URL** and **anon public key** are available (Supabase dashboard → Project Settings → API). GitHub repo `luna-lexagis/luna` exists (empty).

---

## File Structure

```
luna/
├─ index.html
├─ package.json
├─ vite.config.ts
├─ vitest.config.ts
├─ tsconfig.json
├─ .env.local                 # VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY (gitignored)
├─ .env.example               # documented, committed
├─ supabase/schema.sql        # tables + RLS (run in Supabase SQL editor)
├─ src/
│  ├─ main.tsx                # React mount
│  ├─ App.tsx                 # session gate: Login vs authed app
│  ├─ theme.css
│  ├─ shared/types.ts         # Case model + factories (single source of truth)
│  ├─ lib/
│  │  ├─ supabase.ts          # supabase client from env
│  │  ├─ mapping.ts           # rowToCase / caseToRow / rowToMeta (pure, tested)
│  │  ├─ casesRepo.ts         # list/get/create/save/delete via supabase
│  │  └─ useSession.ts        # auth session hook
│  ├─ hooks/
│  │  ├─ useCaseList.ts
│  │  └─ useCase.ts           # load one case + debounced autosave
│  ├─ screens/
│  │  ├─ Login.tsx
│  │  ├─ Library.tsx
│  │  └─ CaseView.tsx
│  └─ phases/
│     ├─ Preparacion.tsx
│     ├─ SeleccionPlaceholder.tsx
│     └─ DebatePlaceholder.tsx
└─ tests/
   └─ mapping.test.ts
```

---

## Task 1: Scaffold the Vite React + TS app and wire the repo

**Files:** whole project (scaffolder), `.gitignore`, `.env.example`.

- [ ] **Step 1: Scaffold into a temp folder** (repo root already has `docs/`, `.superpowers/`)

Run:
```bash
cd /c/Users/Usuario/Desktop/luna
npm create vite@latest .scaffold -- --template react-ts
cd .scaffold && cp -r ./. ../ && cd .. && rm -rf .scaffold
```

- [ ] **Step 2: Install deps (incl. Supabase + Vitest)**

Run:
```bash
cd /c/Users/Usuario/Desktop/luna
npm install
npm install @supabase/supabase-js
npm install -D vitest
```

- [ ] **Step 3: Create `.gitignore` and `.env.example`**

`.gitignore`:
```
node_modules/
dist/
.superpowers/
.env.local
*.log
```

`.env.example`:
```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

- [ ] **Step 4: Verify the app boots**

Run:
```bash
npm run dev
```
Expected: Vite dev server starts; opening the printed localhost URL shows the default Vite+React page. Stop it (Ctrl+C).

- [ ] **Step 5: Init git, connect remote, first commit & push**

Run:
```bash
git init
git add -A
git commit -m "chore: scaffold vite react-ts app"
git branch -M main
git remote add origin https://github.com/luna-lexagis/luna.git
git push -u origin main
```
Expected: repo appears on GitHub with the scaffold.
> If `git push` prompts for auth, the user completes GitHub login (browser/credential manager). Do not hardcode credentials.

---

## Task 2: Vitest config

**Files:** Create `vitest.config.ts`; modify `package.json`.

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
})
```

- [ ] **Step 2: Add scripts to `package.json`**

In `"scripts"`, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 3: Smoke test**

Create `tests/smoke.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
describe('smoke', () => { it('runs', () => { expect(1 + 1).toBe(2) }) })
```

Run:
```bash
npm test
```
Expected: PASS (1 test).

- [ ] **Step 4: Commit**

```bash
git add vitest.config.ts package.json package-lock.json tests/smoke.test.ts
git commit -m "test: add vitest with smoke test"
```

---

## Task 3: Shared data model

**Files:** Create `src/shared/types.ts`.

- [ ] **Step 1: Write the types** (single source of truth; spec §5)

```ts
// src/shared/types.ts
export type Rol = 'defensa' | 'fiscalia_querella'

export type AspiranteEstado =
  | 'pendiente' | 'favorable' | 'en_observacion' | 'desfavorable'
  | 'recusado_con_causa' | 'recusado_sin_causa' | 'en_el_jurado'

export type Genero = 'M' | 'F' | 'X'

export interface Aspirante {
  id: string
  numero: number
  nombre?: string
  genero?: Genero
  estado: AspiranteEstado
  notas: string
  recusadoPor?: Rol
}

export type NotaEtiqueta = 'dato' | 'contradiccion' | 'alegato'
export type EtapaExamen = 'directo' | 'contraexamen'

export interface NotaTestigo {
  id: string
  timestamp: string
  texto: string
  etiqueta: NotaEtiqueta
  etapa: EtapaExamen
}

export interface Testigo {
  id: string
  nombre: string
  ofrecidoPor: 'acusacion' | 'defensa'
  tipo: string
  credibilidad?: 'alta' | 'media' | 'baja'
  notas: NotaTestigo[]
}

export type Fase = 'preparacion' | 'seleccion' | 'debate'

export interface ChatMsg { role: 'user' | 'assistant'; content: string; error?: boolean }

/** The nested part that lives in the JSONB `data` column. */
export interface CaseData {
  teoriaDelCaso: { teoria: string; expediente: string }
  perfiles: { buscado: string; evitar: string }
  seleccion: {
    config: { aspirantesConvocados: number; perentoriasPorParte: number }
    aspirantes: Aspirante[]
  }
  debate: { testigos: Testigo[] }
  chatsLuna: { preparacion: ChatMsg[]; seleccion: ChatMsg[]; debate: ChatMsg[] }
}

export interface Case {
  id: string
  creado: string
  ultimaEdicion: string
  identificacion: {
    caratula: string
    delito: string
    rol: Rol
    departamentoJudicial?: string
    faseActual: Fase
  }
  teoriaDelCaso: CaseData['teoriaDelCaso']
  perfiles: CaseData['perfiles']
  seleccion: CaseData['seleccion']
  debate: CaseData['debate']
  chatsLuna: CaseData['chatsLuna']
}

export interface CaseMeta {
  id: string
  caratula: string
  delito: string
  rol: Rol
  faseActual: Fase
  ultimaEdicion: string
}

/** Fresh case data with legally-correct defaults (spec §3, §7). */
export function nuevoCaseData(): CaseData {
  return {
    teoriaDelCaso: { teoria: '', expediente: '' },
    perfiles: { buscado: '', evitar: '' },
    seleccion: { config: { aspirantesConvocados: 48, perentoriasPorParte: 4 }, aspirantes: [] },
    debate: { testigos: [] },
    chatsLuna: { preparacion: [], seleccion: [], debate: [] },
  }
}
```

- [ ] **Step 2: Compile check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors from `src/shared/types.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/shared/types.ts
git commit -m "feat: shared case data model with legal defaults"
```

---

## Task 4: Supabase schema + RLS

**Files:** Create `supabase/schema.sql`.

- [ ] **Step 1: Write the schema**

```sql
-- supabase/schema.sql
-- Run this in Supabase dashboard → SQL Editor → New query → Run.

create extension if not exists pgcrypto;

create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  caratula text not null default '',
  delito text not null default '',
  rol text not null default 'defensa',
  departamento_judicial text,
  fase_actual text not null default 'preparacion',
  data jsonb not null default '{}'::jsonb
);

alter table public.cases enable row level security;

create policy "own cases - select" on public.cases
  for select using (auth.uid() = user_id);
create policy "own cases - insert" on public.cases
  for insert with check (auth.uid() = user_id);
create policy "own cases - update" on public.cases
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "own cases - delete" on public.cases
  for delete using (auth.uid() = user_id);
```

- [ ] **Step 2: Apply it (manual, user)**

In the Supabase dashboard, open **SQL Editor**, paste `supabase/schema.sql`, and Run. Confirm the `cases` table exists (Table Editor) with RLS enabled.

- [ ] **Step 3: Create `.env.local`** with the project's real values (from Supabase → Settings → API):

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR-ANON-PUBLIC-KEY
```
> `.env.local` is gitignored; never commit it.

- [ ] **Step 4: Commit the schema (not the env)**

```bash
git add supabase/schema.sql
git commit -m "feat: supabase cases schema with RLS"
```

---

## Task 5: Supabase client + mapping (TDD on mapping)

**Files:** Create `src/lib/supabase.ts`, `src/lib/mapping.ts`; Test `tests/mapping.test.ts`.

- [ ] **Step 1: Supabase client**

```ts
// src/lib/supabase.ts
import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!url || !anon) {
  throw new Error('Faltan VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY en .env.local')
}

export const supabase = createClient(url, anon)
```

- [ ] **Step 2: Write failing mapping tests**

```ts
// tests/mapping.test.ts
import { describe, it, expect } from 'vitest'
import { caseToRow, rowToCase, type CaseRow } from '../src/lib/mapping'
import type { Case } from '../src/shared/types'
import { nuevoCaseData } from '../src/shared/types'

function sampleCase(): Case {
  const d = nuevoCaseData()
  d.teoriaDelCaso.teoria = 'Legítima defensa'
  return {
    id: 'c1',
    creado: '2026-07-05T10:00:00.000Z',
    ultimaEdicion: '2026-07-05T10:00:00.000Z',
    identificacion: {
      caratula: 'F. c/ Pérez', delito: 'homicidio', rol: 'defensa',
      departamentoJudicial: 'San Martín', faseActual: 'preparacion',
    },
    teoriaDelCaso: d.teoriaDelCaso, perfiles: d.perfiles,
    seleccion: d.seleccion, debate: d.debate, chatsLuna: d.chatsLuna,
  }
}

describe('mapping', () => {
  it('round-trips Case -> row -> Case', () => {
    const c = sampleCase()
    const partialRow = caseToRow(c)
    const row: CaseRow = {
      ...partialRow,
      created_at: c.creado,
      updated_at: c.ultimaEdicion,
    }
    expect(rowToCase(row)).toEqual(c)
  })

  it('maps null departamento_judicial to undefined', () => {
    const c = sampleCase()
    c.identificacion.departamentoJudicial = undefined
    const row: CaseRow = { ...caseToRow(c), created_at: c.creado, updated_at: c.ultimaEdicion }
    expect(row.departamento_judicial).toBeNull()
    expect(rowToCase(row).identificacion.departamentoJudicial).toBeUndefined()
  })

  it('preserves default panel config (48 / 4)', () => {
    const c = sampleCase()
    const row: CaseRow = { ...caseToRow(c), created_at: c.creado, updated_at: c.ultimaEdicion }
    expect(row.data.seleccion.config).toEqual({ aspirantesConvocados: 48, perentoriasPorParte: 4 })
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run:
```bash
npm test -- tests/mapping.test.ts
```
Expected: FAIL — `src/lib/mapping` not found.

- [ ] **Step 4: Implement mapping**

```ts
// src/lib/mapping.ts
import type { Case, CaseData, CaseMeta, Rol, Fase } from '../shared/types'

export interface CaseRow {
  id: string
  created_at: string
  updated_at: string
  caratula: string
  delito: string
  rol: Rol
  departamento_judicial: string | null
  fase_actual: Fase
  data: CaseData
}

export function rowToCase(r: CaseRow): Case {
  return {
    id: r.id,
    creado: r.created_at,
    ultimaEdicion: r.updated_at,
    identificacion: {
      caratula: r.caratula,
      delito: r.delito,
      rol: r.rol,
      departamentoJudicial: r.departamento_judicial ?? undefined,
      faseActual: r.fase_actual,
    },
    teoriaDelCaso: r.data.teoriaDelCaso,
    perfiles: r.data.perfiles,
    seleccion: r.data.seleccion,
    debate: r.data.debate,
    chatsLuna: r.data.chatsLuna,
  }
}

export function caseToRow(c: Case): Omit<CaseRow, 'created_at' | 'updated_at'> {
  return {
    id: c.id,
    caratula: c.identificacion.caratula,
    delito: c.identificacion.delito,
    rol: c.identificacion.rol,
    departamento_judicial: c.identificacion.departamentoJudicial ?? null,
    fase_actual: c.identificacion.faseActual,
    data: {
      teoriaDelCaso: c.teoriaDelCaso,
      perfiles: c.perfiles,
      seleccion: c.seleccion,
      debate: c.debate,
      chatsLuna: c.chatsLuna,
    },
  }
}

export function rowToMeta(r: Pick<CaseRow,
  'id' | 'caratula' | 'delito' | 'rol' | 'fase_actual' | 'updated_at'>): CaseMeta {
  return {
    id: r.id,
    caratula: r.caratula,
    delito: r.delito,
    rol: r.rol,
    faseActual: r.fase_actual,
    ultimaEdicion: r.updated_at,
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:
```bash
npm test -- tests/mapping.test.ts
```
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/supabase.ts src/lib/mapping.ts tests/mapping.test.ts
git commit -m "feat: supabase client and tested row<->case mapping"
```

---

## Task 6: Cases repository (Supabase CRUD)

**Files:** Create `src/lib/casesRepo.ts`.

- [ ] **Step 1: Implement the repo**

```ts
// src/lib/casesRepo.ts
import { supabase } from './supabase'
import { caseToRow, rowToCase, rowToMeta, type CaseRow } from './mapping'
import { nuevoCaseData, type Case, type CaseMeta } from '../shared/types'

const META_COLS = 'id,caratula,delito,rol,fase_actual,updated_at'

export async function listCases(): Promise<CaseMeta[]> {
  const { data, error } = await supabase
    .from('cases')
    .select(META_COLS)
    .order('updated_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(rowToMeta as any)
}

export async function getCase(id: string): Promise<Case | null> {
  const { data, error } = await supabase.from('cases').select('*').eq('id', id).maybeSingle()
  if (error) throw error
  return data ? rowToCase(data as CaseRow) : null
}

export async function createCase(): Promise<Case> {
  // user_id defaults to auth.uid() in the DB; do not send it.
  const insert = {
    caratula: '',
    delito: '',
    rol: 'defensa',
    departamento_judicial: null,
    fase_actual: 'preparacion',
    data: nuevoCaseData(),
  }
  const { data, error } = await supabase.from('cases').insert(insert).select('*').single()
  if (error) throw error
  return rowToCase(data as CaseRow)
}

export async function saveCase(c: Case): Promise<string> {
  const row = caseToRow(c)
  const patch = { ...row, updated_at: new Date().toISOString() }
  const { data, error } = await supabase
    .from('cases')
    .update(patch)
    .eq('id', c.id)
    .select('updated_at')
    .single()
  if (error) throw error
  return (data as { updated_at: string }).updated_at
}

export async function deleteCase(id: string): Promise<void> {
  const { error } = await supabase.from('cases').delete().eq('id', id)
  if (error) throw error
}
```

- [ ] **Step 2: Compile check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/casesRepo.ts
git commit -m "feat: cases repository over supabase"
```

---

## Task 7: Auth session hook + Login screen

**Files:** Create `src/lib/useSession.ts`, `src/screens/Login.tsx`.

- [ ] **Step 1: Session hook**

```ts
// src/lib/useSession.ts
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

// undefined = still loading; null = signed out; Session = signed in
export function useSession(): Session | null | undefined {
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])
  return session
}
```

- [ ] **Step 2: Login screen (email + password, with register toggle)**

```tsx
// src/screens/Login.tsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

export function Login() {
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true); setMsg(null)
    const fn = mode === 'in'
      ? supabase.auth.signInWithPassword({ email, password: pass })
      : supabase.auth.signUp({ email, password: pass })
    const { error } = await fn
    if (error) setMsg(error.message)
    else if (mode === 'up') setMsg('Cuenta creada. Revisá tu email si pide confirmación, o iniciá sesión.')
    setBusy(false)
  }

  return (
    <div style={{ display: 'grid', placeItems: 'center', height: '100vh' }}>
      <form onSubmit={submit} style={{
        width: 340, background: 'var(--panel)', border: '1px solid var(--line)',
        borderRadius: 14, padding: 24,
      }}>
        <div style={{ fontWeight: 700, fontSize: 20, marginBottom: 2 }}>Luna</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--dim)', marginBottom: 18 }}>
          {mode === 'in' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'}
        </div>
        <label>Email</label>
        <input className="inp" type="email" value={email} required
          onChange={e => setEmail(e.target.value)} style={{ marginBottom: 12 }} />
        <label>Contraseña</label>
        <input className="inp" type="password" value={pass} required minLength={6}
          onChange={e => setPass(e.target.value)} style={{ marginBottom: 16 }} />
        <button className="primary-btn" style={{ width: '100%' }} disabled={busy}>
          {busy ? '…' : mode === 'in' ? 'Entrar' : 'Registrarme'}
        </button>
        {msg && <p style={{ color: 'var(--obs)', fontSize: 12, marginTop: 12 }}>{msg}</p>}
        <button type="button" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}
          style={{ color: 'var(--dim)', fontSize: 12, marginTop: 14 }}>
          {mode === 'in' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 3: Compile check**

Run:
```bash
npx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/useSession.ts src/screens/Login.tsx
git commit -m "feat: supabase auth session hook and login screen"
```

---

## Task 8: Theme + hooks

**Files:** Create `src/theme.css`, `src/hooks/useCaseList.ts`, `src/hooks/useCase.ts`; modify `src/main.tsx`.

- [ ] **Step 1: Theme** — create `src/theme.css`:

```css
:root{
  --bg:#0D1117; --panel:#161B22; --elev:#1C232B; --line:#2A333D; --line2:#374250;
  --text:#E6EDF3; --dim:#8B97A5; --faint:#5A6673;
  --accent:#E0A44C; --accent-d:#8a6a30;
  --favorable:#3FB68B; --obs:#E0A44C; --hostil:#E06C5E;
  --rec-causa:#B23B3B; --rec-sin:#9B6DD6; --aceptado:#2E9E6B; --pend:#6B7684;
  --font:'Inter',system-ui,sans-serif; --mono:'JetBrains Mono',monospace;
}
*{box-sizing:border-box;margin:0;padding:0}
html,body,#root{height:100%}
body{font-family:var(--font);background:var(--bg);color:var(--text);font-size:14px;line-height:1.5}
button{font-family:inherit;cursor:pointer;border:none;background:none;color:inherit}
input,textarea,select{font-family:inherit;font-size:14px}
.mono{font-family:var(--mono)}
.primary-btn{background:var(--accent);color:#1a1206;font-weight:700;padding:9px 16px;border-radius:9px;font-size:13px}
.ghost-btn{background:var(--elev);border:1px solid var(--line);border-radius:8px;padding:7px 12px;font-size:12px;font-weight:600;color:var(--dim)}
.inp{width:100%;background:var(--bg);border:1px solid var(--line);border-radius:9px;padding:10px 12px;color:var(--text)}
.inp:focus{outline:none;border-color:var(--accent-d);box-shadow:0 0 0 3px rgba(224,164,76,.12)}
label{display:block;font-size:12px;font-weight:600;color:var(--dim);margin-bottom:6px}
```

- [ ] **Step 2: Import theme in `src/main.tsx`** — add at the top:
```ts
import './theme.css'
```
(Remove the scaffold's default `import './index.css'` and delete `App.css`/`index.css` usage to avoid clashing styles.)

- [ ] **Step 3: `useCaseList` hook**

```ts
// src/hooks/useCaseList.ts
import { useCallback, useEffect, useState } from 'react'
import type { CaseMeta } from '../shared/types'
import { listCases, createCase, deleteCase } from '../lib/casesRepo'

export function useCaseList() {
  const [cases, setCases] = useState<CaseMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true); setError(null)
    try { setCases(await listCases()) }
    catch (e: any) { setError(e.message ?? 'Error al cargar casos') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  const create = useCallback(async () => {
    const c = await createCase(); await refresh(); return c.id
  }, [refresh])

  const remove = useCallback(async (id: string) => {
    await deleteCase(id); await refresh()
  }, [refresh])

  return { cases, loading, error, refresh, create, remove }
}
```

- [ ] **Step 4: `useCase` hook (debounced autosave)**

```ts
// src/hooks/useCase.ts
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Case } from '../shared/types'
import { getCase, saveCase } from '../lib/casesRepo'

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

export function useCase(id: string) {
  const [caso, setCaso] = useState<Case | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    let alive = true
    void getCase(id).then(c => { if (alive) setCaso(c) })
    return () => { alive = false }
  }, [id])

  const update = useCallback((mutator: (draft: Case) => void) => {
    setCaso(prev => {
      if (!prev) return prev
      const next: Case = structuredClone(prev)
      mutator(next)
      if (timer.current) clearTimeout(timer.current)
      setSaveState('saving')
      timer.current = setTimeout(async () => {
        try {
          const stamp = await saveCase(next)
          setCaso(cur => (cur ? { ...cur, ultimaEdicion: stamp } : cur))
          setSaveState('saved')
        } catch {
          setSaveState('error')
        }
      }, 600)
      return next
    })
  }, [])

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])

  return { caso, saveState, update }
}
```

- [ ] **Step 5: Compile check + commit**

Run:
```bash
npx tsc --noEmit
git add src/theme.css src/main.tsx src/hooks
git commit -m "feat: theme and data hooks (list + autosaving case)"
```

---

## Task 9: Library screen + phase placeholders

**Files:** Create `src/screens/Library.tsx`, `src/phases/SeleccionPlaceholder.tsx`, `src/phases/DebatePlaceholder.tsx`.

- [ ] **Step 1: Placeholders**

```tsx
// src/phases/SeleccionPlaceholder.tsx
export function SeleccionPlaceholder() {
  return <div style={{ padding: 24, color: 'var(--faint)' }}>Audiencia de selección — próximamente (Plan 2).</div>
}
```
```tsx
// src/phases/DebatePlaceholder.tsx
export function DebatePlaceholder() {
  return <div style={{ padding: 24, color: 'var(--faint)' }}>Debate / testigos — próximamente (Plan 3).</div>
}
```

- [ ] **Step 2: Library**

```tsx
// src/screens/Library.tsx
import { useCaseList } from '../hooks/useCaseList'
import { supabase } from '../lib/supabase'

const ROL_LABEL: Record<string, string> = { defensa: 'Defensa', fiscalia_querella: 'Fiscalía/Querella' }
const FASE_LABEL: Record<string, string> = { preparacion: 'Preparación', seleccion: 'Selección', debate: 'Debate' }

export function Library({ onOpen }: { onOpen: (id: string) => void }) {
  const { cases, loading, error, create, remove } = useCaseList()
  return (
    <div style={{ maxWidth: 860, margin: '0 auto', padding: '32px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20 }}>Luna</h1>
          <div className="mono" style={{ color: 'var(--dim)', fontSize: 12 }}>BIBLIOTECA DE CASOS</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="ghost-btn" onClick={() => supabase.auth.signOut()}>Cerrar sesión</button>
          <button className="primary-btn" onClick={async () => onOpen(await create())}>+ Nuevo caso</button>
        </div>
      </div>
      {error && <p style={{ color: 'var(--hostil)' }}>{error}</p>}
      {loading ? <p style={{ color: 'var(--faint)' }}>Cargando…</p>
        : cases.length === 0 ? <p style={{ color: 'var(--faint)' }}>Todavía no hay casos. Creá el primero.</p>
        : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cases.map(c => (
              <div key={c.id} onClick={() => onOpen(c.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
                background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 12, padding: '14px 16px',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700 }}>{c.caratula || '(sin carátula)'}</div>
                  <div style={{ fontSize: 12, color: 'var(--dim)' }}>
                    {ROL_LABEL[c.rol]} · {c.delito || 'sin delito'} · {FASE_LABEL[c.faseActual]}
                  </div>
                </div>
                <button className="ghost-btn" style={{ marginLeft: 'auto' }}
                  onClick={e => { e.stopPropagation(); if (confirm('¿Eliminar este caso?')) void remove(c.id) }}>
                  Eliminar
                </button>
              </div>
            ))}
          </div>
        )}
    </div>
  )
}
```

- [ ] **Step 3: Compile check + commit**

```bash
npx tsc --noEmit
git add src/screens/Library.tsx src/phases/SeleccionPlaceholder.tsx src/phases/DebatePlaceholder.tsx
git commit -m "feat: case library screen and phase placeholders"
```

---

## Task 10: Case shell + Preparación form + App wiring

**Files:** Create `src/screens/CaseView.tsx`, `src/phases/Preparacion.tsx`; replace `src/App.tsx`.

- [ ] **Step 1: Preparación form** (spec §7)

```tsx
// src/phases/Preparacion.tsx
import type { Case, Rol } from '../shared/types'

const card: React.CSSProperties = { background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 14, padding: 20, marginBottom: 16 }
const title: React.CSSProperties = { fontFamily: 'var(--mono)', fontSize: 10.5, letterSpacing: '.15em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 16 }

export function Preparacion({ caso, update }: { caso: Case; update: (m: (d: Case) => void) => void }) {
  const id = caso.identificacion
  const roles: { key: Rol; t: string; d: string }[] = [
    { key: 'defensa', t: 'Defensa', d: 'Busco duda razonable · evito el punitivismo' },
    { key: 'fiscalia_querella', t: 'Fiscalía / Querella', d: 'Busco firmeza · evito la sobre-empatía con el reo' },
  ]
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '22px 24px' }}>
      <section style={card}>
        <div style={title}>Identificación</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label>Carátula</label>
            <input className="inp" value={id.caratula}
              onChange={e => update(d => { d.identificacion.caratula = e.target.value })}
              placeholder="Fiscalía c/ Pérez, Juan s/ homicidio simple" />
          </div>
          <div>
            <label>Delito imputado</label>
            <input className="inp" value={id.delito}
              onChange={e => update(d => { d.identificacion.delito = e.target.value })}
              placeholder="Homicidio agravado por el vínculo" />
          </div>
        </div>
        <label>Represento a la</label>
        <div style={{ display: 'flex', gap: 10 }}>
          {roles.map(r => {
            const on = id.rol === r.key
            return (
              <button key={r.key} onClick={() => update(d => { d.identificacion.rol = r.key })}
                style={{ flex: 1, textAlign: 'left', borderRadius: 10, padding: '12px 14px',
                  background: on ? 'rgba(224,164,76,.08)' : 'var(--bg)',
                  border: `1px solid ${on ? 'var(--accent)' : 'var(--line)'}` }}>
                <div style={{ fontWeight: 700, color: on ? 'var(--accent)' : 'var(--text)' }}>{r.t}</div>
                <div style={{ fontSize: 11.5, color: 'var(--dim)', marginTop: 3 }}>{r.d}</div>
              </button>
            )
          })}
        </div>
        <div style={{ marginTop: 14 }}>
          <label>Departamento judicial (opcional)</label>
          <input className="inp" value={id.departamentoJudicial ?? ''}
            onChange={e => update(d => { d.identificacion.departamentoJudicial = e.target.value })}
            placeholder="San Martín" />
        </div>
      </section>

      <section style={card}>
        <div style={title}>Teoría del caso</div>
        <label>Tu línea de fuerza: qué vas a probar y con qué</label>
        <textarea className="inp" style={{ minHeight: 90, resize: 'vertical' }} value={caso.teoriaDelCaso.teoria}
          onChange={e => update(d => { d.teoriaDelCaso.teoria = e.target.value })} />
      </section>

      <section style={card}>
        <div style={title}>Datos clave del expediente</div>
        <label>Hechos, prueba, particularidades</label>
        <textarea className="inp" style={{ minHeight: 90, resize: 'vertical' }} value={caso.teoriaDelCaso.expediente}
          onChange={e => update(d => { d.teoriaDelCaso.expediente = e.target.value })} />
      </section>

      <section style={card}>
        <div style={title}>Panel</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div>
            <label>Aspirantes convocados</label>
            <input className="inp" type="number" min={1} max={80}
              value={caso.seleccion.config.aspirantesConvocados}
              onChange={e => update(d => { d.seleccion.config.aspirantesConvocados = Number(e.target.value) })} />
          </div>
          <div>
            <label>Recusaciones sin causa por parte</label>
            <input className="inp" type="number" min={0} max={12}
              value={caso.seleccion.config.perentoriasPorParte}
              onChange={e => update(d => { d.seleccion.config.perentoriasPorParte = Number(e.target.value) })} />
          </div>
        </div>
      </section>
    </div>
  )
}
```
> PDF upload and "Detectar perfiles con Luna" are deferred (PDF to a later follow-up; profiles to Plan 4/AI).

- [ ] **Step 2: Case shell**

```tsx
// src/screens/CaseView.tsx
import { useCase } from '../hooks/useCase'
import { Preparacion } from '../phases/Preparacion'
import { SeleccionPlaceholder } from '../phases/SeleccionPlaceholder'
import { DebatePlaceholder } from '../phases/DebatePlaceholder'
import type { Fase } from '../shared/types'

const TABS: { key: Fase; label: string }[] = [
  { key: 'preparacion', label: 'Preparación' },
  { key: 'seleccion', label: 'Audiencia de selección' },
  { key: 'debate', label: 'Debate' },
]

export function CaseView({ id, onBack }: { id: string; onBack: () => void }) {
  const { caso, saveState, update } = useCase(id)
  if (!caso) return <div style={{ padding: 24 }}>Cargando caso…</div>
  const fase = caso.identificacion.faseActual
  const setFase = (f: Fase) => update(d => { d.identificacion.faseActual = f })

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '0 16px', height: 56,
        background: 'var(--panel)', borderBottom: '1px solid var(--line)' }}>
        <button className="ghost-btn" onClick={onBack}>← Biblioteca</button>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
            {caso.identificacion.caratula || '(sin carátula)'}
          </div>
          <div style={{ fontSize: 11, color: 'var(--dim)' }}>
            {caso.identificacion.rol === 'defensa' ? 'Defensa' : 'Fiscalía/Querella'}
            {caso.identificacion.delito ? ` · ${caso.identificacion.delito}` : ''}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setFase(t.key)}
              style={{ padding: '8px 12px', borderRadius: 8, fontSize: 13,
                color: fase === t.key ? 'var(--accent)' : 'var(--dim)',
                background: fase === t.key ? 'rgba(224,164,76,.08)' : 'transparent',
                border: fase === t.key ? '1px solid var(--accent-d)' : '1px solid transparent' }}>
              {t.label}
            </button>
          ))}
        </div>
        <span style={{ fontSize: 11, color: saveState === 'error' ? 'var(--hostil)' : 'var(--faint)', width: 72, textAlign: 'right' }}>
          {saveState === 'saving' ? 'Guardando…' : saveState === 'saved' ? 'Guardado' : saveState === 'error' ? 'Error al guardar' : ''}
        </span>
      </header>
      <main style={{ flex: 1, overflow: 'auto' }}>
        {fase === 'preparacion' && <Preparacion caso={caso} update={update} />}
        {fase === 'seleccion' && <SeleccionPlaceholder />}
        {fase === 'debate' && <DebatePlaceholder />}
      </main>
    </div>
  )
}
```

- [ ] **Step 3: App (session gate + routing)** — replace `src/App.tsx`:

```tsx
import { useState } from 'react'
import { useSession } from './lib/useSession'
import { Login } from './screens/Login'
import { Library } from './screens/Library'
import { CaseView } from './screens/CaseView'

export default function App() {
  const session = useSession()
  const [openId, setOpenId] = useState<string | null>(null)

  if (session === undefined) return <div style={{ padding: 24 }}>Cargando…</div>
  if (session === null) return <Login />
  return openId
    ? <CaseView id={openId} onBack={() => setOpenId(null)} />
    : <Library onOpen={setOpenId} />
}
```

- [ ] **Step 4: Run and verify end-to-end (local, against real Supabase)**

Run:
```bash
npm run dev
```
Manually verify:
1. You see the Login screen. Register a new account (or sign in). If Supabase requires email confirmation, confirm via the email link, then sign in.
2. Library shows; click "+ Nuevo caso" → opens a case.
3. Type carátula, delito, pick Fiscalía/Querella, edit teoría → header shows "Guardando…" then "Guardado".
4. Click "← Biblioteca" → the case shows with your carátula/rol.
5. Refresh the browser (F5) → still logged in, case still there (persisted in Supabase).
6. In the Supabase Table Editor, confirm the row exists under your user_id.
7. "Cerrar sesión" → back to Login.

- [ ] **Step 5: Commit**

```bash
git add src/screens/CaseView.tsx src/phases/Preparacion.tsx src/App.tsx
git commit -m "feat: case shell, Preparación form, and auth-gated app"
```

---

## Task 11: Deploy to Vercel

**Files:** none (dashboard config). Optionally `vercel.json` if needed.

- [ ] **Step 1: Push latest**

```bash
git push
```

- [ ] **Step 2: Import the project in Vercel (manual, user)**

In Vercel: **Add New → Project → Import** `luna-lexagis/luna`. Framework preset: **Vite**. Build command `npm run build`, output `dist` (Vite defaults).

- [ ] **Step 3: Set environment variables in Vercel (manual, user)**

Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (same values as `.env.local`) for Production (and Preview). Do NOT add the Anthropic key yet (that comes with Plan 4).

- [ ] **Step 4: Deploy and verify**

Trigger the deploy. Open the Vercel URL: the Login screen loads, you can sign in, create a case, and it persists. Add the Supabase project's deployed URL to Supabase **Auth → URL Configuration** (Site URL / redirect) if email confirmation links are used.

- [ ] **Step 5: Commit any config**

```bash
git add -A
git commit -m "chore: vercel deploy config" --allow-empty
git push
```

---

## Self-Review (completed by planner)

- **Spec coverage (Plan 1 slice):** Web stack React/TS/Vite + Vercel (§4) → Tasks 1, 11. Supabase auth + RLS + multi-user (§2, §4, §5) → Tasks 4, 7, 10. Data model as row+JSONB (§5) → Tasks 3, 5. CRUD + autosave (§11) → Tasks 6, 8, 10. Case library + navigation (§6) → Tasks 9, 10. Preparación + 48/4 defaults + depto (§3, §7) → Tasks 3, 10. Theme (§12) → Task 8. Mapping tests (§13) → Task 5. AI (§10), Audiencia (§8), Debate (§9), export (§6) → deferred to Plans 2–5.
- **Placeholder scan:** No "TBD/handle edge cases". "Note"/"deferred" lines flag intentionally-out-of-scope features or manual (dashboard) steps, not unfinished plan steps.
- **Type consistency:** `Case`, `CaseData`, `CaseMeta`, `Rol`, `Fase`, `nuevoCaseData` defined in Task 3; `CaseRow`, `rowToCase`, `caseToRow`, `rowToMeta` in Task 5, used unchanged in Tasks 6, 8. Repo functions `listCases/getCase/createCase/saveCase/deleteCase` (Task 6) match hook imports (Task 8). `useSession` return contract (undefined|null|Session) matches `App.tsx` gate (Task 10).

---

## Next

After this deploys green, write **Plan 2 — Audiencia de selección** (grid of 48, statuses, challenge counting with the 4-per-side block, gender-parity meter, final 12+6 panel) on this web foundation.
```
