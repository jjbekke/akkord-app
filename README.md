# Akkord — prototype

Mobil-først webapp til timeregistrering, akkordregnskab, timelønsregnskab og lønregnskab.

## Kør

```sh
npm install
npm run dev     # åbn "Network"-adressen på telefonen (samme wifi)
npm test        # beregningsmotoren testes mod eksempelprojektet
npm run build
```

Første gang appen åbnes, indlæses et opdigtet eksempelprojekt.

## Struktur

```
src/domain/     Beregningsmotor og datatyper — ren TypeScript, ingen UI/database
  tal.ts          øre/hundrededele, dansk talformat, præcis fordeling
  beregning.ts    akkord, timeløn og samlet løn
  beregning.test.ts  facit regnet uafhængigt
src/data/       Repository-interface + LocalRepository (IndexedDB via Dexie)
src/ui/         Skærme og faner
```

## Regler

- Beløb gemmes i **øre** og timer/antal i **hundrededele** — altid heltal.
- Der gemmes **timer og satser**, aldrig udregnede beløb.
- Rettelser i lønregnskabet gemmes som justeringer oven på det beregnede.
- UI taler kun med `Repository` — aldrig direkte med databasen.

## Næste skridt (fase 2)

1. `SupabaseRepository` der implementerer `Repository`.
2. Supabase Auth med magic link + invitationer.
3. RLS: kun medlemmer af et projekt kan læse/skrive dets data.
4. Service worker (fx `vite-plugin-pwa`) så appen virker helt offline.
