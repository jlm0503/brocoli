<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- Business rules (demand calc, plan/advance validation) live as pure functions in `src/lib/campo/calc.ts`, covered by `src/test/campo-reglas.test.ts`; screens never re-implement them. Why: keeps the recipe math testable and identical across screens.
- App state lives in a single React context (`src/lib/campo/store.tsx`) loaded from Lovable Cloud table `registros` (coleccion, id, data jsonb); each flat id-keyed list is auto-saved by diffing against the last saved map (`src/lib/campo/sync.ts`) and other users' changes arrive via realtime. Why: keeps business logic as pure in-memory list updates while everyone shares the same data.
- The current week is the real date in Mexico City (`hoyEnMexico`); on load the first client to win a conditional update of `sistema/semana` closes missed weeks with `ponerAlDia`. Why: week rollover must happen exactly once even with several devices.
- Each lote copies its variety's crop and cycle (`cultivo`, `cicloDias`, optional `fechaCosecha`) at planning; recipes are one per crop (`Recetas`), demand stops at the lote's harvest week, and harvested lotes are flagged `finalizado` (via `finalizarCosechados`) to free their tabla while keeping their costs. Why: varieties have different cycles and tablas are reused across seasons.
- Varieties live in `src/lib/campo/seed.ts`; the starting products and recipes were seeded into `registros` by migration, and ranchos, tablas and plantings are captured in the app. Why: the user wants to enter their own field data.
- The week simulator is practice: while weeks are advanced nothing is saved, it snapshots operational state to step back, and "Hoy" (or stepping back to the start) reloads from the cloud. Why: simulated weeks must never change shared real data.
- Accounts use email/password; puestos live in `user_roles` (never on profiles) and the first account becomes admin via the signup trigger; users without a puesto see nothing. Screens (NAV) and action permissions are declared in `src/lib/campo/roles.ts` and enforced in `AppShell`, while RLS (`puede_escribir`: catalogs admin-only) and the `proteger_fechas_lote` trigger enforce them in the database. Why: client checks are UX only; the database is the real guard.
- Protected pages live under `src/routes/_authenticated/`; evidence photos go to the private `evidencias` bucket and records store only the file path. Why: one sign-in gate and photos that survive reloads.
