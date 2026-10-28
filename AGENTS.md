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
- Prototype state lives in a single React context (`src/lib/campo/store.tsx`) seeded from `src/lib/campo/seed.ts`; only the chosen role persists in localStorage. Why: the app is a clickable prototype without a backend yet; swap the store for real persistence later.
- Role-based screen access is declared once in `src/lib/campo/roles.ts` (NAV) and enforced by `AppShell`. Why: one source of truth for who sees what.
