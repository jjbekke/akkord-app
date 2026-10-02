# AKBOG — instruktioner til Claude

Se README.md for struktur og regler. Svar brugeren på dansk.

## Test hver ændring — altid

Ny eller ændret funktionalitet er ikke færdig, før den er testet. Ved **hver** ændring:

1. **Skriv eller udvid en test for det nye**, inden opgaven meldes færdig:
   - Beregninger og tal → `src/domain/*.test.ts` (Viby-facit må aldrig ændre sig).
   - Data, adgang, edge function eller fillager → `tests/e2e.test.ts`.
   - Skema, RLS eller triggere → `supabase/tests/rls.sql`.
2. **Kør det hele og se det bestå:**
   - `npm run tjek` — typecheck, lint, enhedstests og build.
   - `npm run test:e2e` — mod den rigtige Supabase med testbrugerne
     `leder@akbog-test.dk` og `medlem@akbog-test.dk` (adgangskoden ligger i
     `.env.test.local`, som ikke committes). Kør den ved alt, der rører data,
     adgang, edge function eller fillager.
   - Ved ændringer i databasen: kør `supabase/tests/rls.sql` via Supabase MCP
     (`execute_sql`). Den skal slutte med `ALLE RLS-TESTS OK`, og kør
     `get_advisors` (security og performance) bagefter.
3. **Prøv funktionen i appen** på `npm run dev` (http://localhost:5173/), hvis det
   kan lade sig gøre, og fortæl brugeren præcis, hvad der er testet, og hvad
   brugeren selv bør prøve på telefonen.
4. Rapportér ærligt: fejler en test, så sig det og vis outputtet. Push aldrig et
   rødt build.

## Git

Brugeren vil gerne kunne følge med: commit og push til `main` løbende, når
`npm run tjek` er grøn. Push til `main` udgiver https://jjbekke.github.io/akkord-app/.

## Supabase

- Skemaændringer: ny fil i `supabase/migrations/` + `apply_migration` via MCP.
- Edge-funktionen `mit-regnskab` importerer `src/domain/*` og
  `src/data/raekker.ts`. Ændres de filer, skal funktionen udrulles igen
  (`deploy_edge_function` med alle importerede filer), ellers regner serveren
  anderledes end appen. E2E-testen fanger det.
- Domænefiler importerer med `.ts`-endelse, så Deno kan bruge dem.
