# AKBOG

Mobil-først webapp til akkord-, timeløns- og lønregnskab for et sjak.
Kører på https://jjbekke.github.io/akkord-app/ med Supabase som backend.

## Kør

```sh
npm install
npm run dev     # åbn "Network"-adressen på telefonen (samme wifi)
npm test        # beregningsmotoren testes mod Viby-regnskabet
npm run build
```

Viby-regnskabet kan hentes som eksempelprojekt under Værktøjskasse → Projekter.

## Struktur

```
src/domain/     Beregningsmotor og datatyper — ren TypeScript, ingen UI/database
  tal.ts          øre/hundrededele, dansk talformat, præcis fordeling
  beregning.ts    akkord (materialer × stykpris), timeløn og samlet løn
  beregning.test.ts  facit fra Viby-regnskabet
src/data/       Repository-interface + SupabaseRepository
  raekker.ts      databaserækker → domænetyper (deles med edge-funktionen)
src/ui/         Skærme: login, forside, værktøjskasse og projektfaner
supabase/
  migrations/     skema, RLS-adgangsregler, triggere og fillager
  functions/mit-regnskab/  et medlems egen løn, beregnet på serveren
```

## Regler

- Beløb gemmes i **øre** og timer/antal i **hundrededele** — altid heltal.
- Der gemmes **timer, antal og satser**, aldrig udregnede beløb.
- Rettelser i lønregnskabet gemmes som justeringer oven på det beregnede.
- UI taler kun med `Repository` — aldrig direkte med databasen.
- Adgang håndhæves i databasen (RLS): projektledere ser alt, andre kun deres egne
  timer, noter og løn. Kun opretteren kan udpege projektledere.
- Materialepriser kan ikke ændres — man opretter en ny pris. Priserne kopieres ind i
  projektet, så gamle regnskaber aldrig ændrer sig.

## Supabase

- Edge-funktionen importerer `src/domain` og `src/data/raekker.ts` direkte, så
  beregningen er den samme i appen og på serveren. Domænefilerne bruger derfor
  `.ts`-endelser på imports.
- Under Authentication → URL Configuration skal Site URL være
  `https://jjbekke.github.io/akkord-app/`, og Redirect URLs skal indeholde den
  samme adresse samt `http://localhost:5173/**` til udvikling.
- Supabase' indbyggede e-mail har en lav grænse for antal mails i timen. Til rigtig
  brug bør der sættes egen SMTP op (Authentication → Emails).

## Næste skridt

- Service worker (fx `vite-plugin-pwa`) og offline-synkronisering.
