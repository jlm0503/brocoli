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
- Prototype state lives in a single React context (`src/lib/campo/store.tsx`) seeded from `src/lib/campo/seed.ts`; only the chosen role persists in localStorage. Lotes, planning orders, alerts and late-planning records are flat lists keyed by id (lote → tabla → rancho), and the current week is state advanced by a prototype "simular semana" action that runs `cerrarSemana`. Why: clickable prototype without a backend; flat id-keyed lists map 1:1 to future tables.
- Each lote copies its variety's crop and cycle (`cultivo`, `cicloDias`, optional `fechaCosecha`) at planning; recipes are one per crop (`Recetas`), demand stops at the lote's harvest week, and harvested lotes are flagged `finalizado` (via `finalizarCosechados`) to free their tabla while keeping their costs. Why: varieties have different cycles and tablas are reused across seasons.
- `src/lib/campo/seed.ts` holds only the catalog the app starts with (products, varieties, recipes); ranchos, tablas and plantings start empty and are captured in the app (catálogos, "registrar plantación ya hecha"). Why: the user wants to enter their own field data.
- The week simulator snapshots operational state (lots, orders, alerts, receptions) on each "next week" so it can step back or return to today; catalogs (ranchos, tablas, products, recipes) are not snapshotted. Why: going back must not erase captured catalogs.
- Role-based screen access is declared once in `src/lib/campo/roles.ts` (NAV) and enforced by `AppShell`. Why: one source of truth for who sees what.
