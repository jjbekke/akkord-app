import { jsPDF } from 'jspdf'
import { autoTable, type CellHookData } from 'jspdf-autotable'
import writeXlsxFile, { type SheetData } from 'write-excel-file/browser'
import { beregnLoen } from '../../domain/beregning'
import { kr, timer } from '../../domain/tal'
import type { ProjektData } from '../../domain/typer'
import { datoKort } from '../faelles'

// Filerne der laves, når et projekt afsluttes. Indlæses først, når de skal bruges,
// så PDF- og Excel-bibliotekerne ikke gør appen langsommere at åbne.

export function filnavn(data: ProjektData, slags: string, endelse: string): string {
  const navn = data.projekt.navn
    .normalize('NFKD')
    .replace(/æ/gi, 'ae')
    .replace(/ø/gi, 'oe')
    .replace(/å/gi, 'aa')
    .replace(/[^\w-]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `${slags}-${navn || 'projekt'}.${endelse}`
}

function periode(data: ProjektData): string {
  const datoer = [...data.timer, ...data.materialeRegistreringer].map((x) => x.dato).sort()
  if (datoer.length === 0) return 'Ingen registreringer'
  return `${datoKort(datoer[0])} – ${datoKort(datoer.at(-1)!)}`
}

/** Kvittering: det samlede akkordregnskab som PDF. */
export async function lavKvittering(data: ProjektData): Promise<Blob> {
  const r = beregnLoen(data)
  const navn = (id: string) => data.medlemmer.find((m) => m.id === id)?.navn ?? 'Ukendt'
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })
  const venstre = 15
  const groen: [number, number, number] = [47, 107, 79]

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(18)
  doc.text(`Akkordregnskab: ${data.projekt.navn}`, venstre, 20)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.text(`Periode: ${periode(data)}`, venstre, 27)
  doc.text(`Afsluttet: ${data.projekt.afsluttet ? datoKort(data.projekt.afsluttet) : datoKort(new Date().toISOString())}`, venstre, 32)

  const tabel = { theme: 'grid' as const, headStyles: { fillColor: groen }, styles: { fontSize: 9 }, margin: { left: venstre, right: venstre } }
  /** Talkolonner højrestilles i alle rækker — også overskrift og total. */
  const hoejre = (...kolonner: number[]) => ({
    didParseCell: (c: CellHookData) => {
      if (kolonner.includes(c.column.index)) c.cell.styles.halign = 'right'
    },
  })
  const efter = () => (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8

  // Hovedtal
  autoTable(doc, {
    ...tabel,
    startY: 38,
    head: [['Samlet', 'Beløb']],
    body: [
      ['Akkordsum (materialer)', kr(r.akkord.akkordsum)],
      [`Akkordløn (${timer(r.akkord.akkordtimer)} t)`, kr(r.akkord.akkordloen)],
      ['Overskud', kr(r.akkord.overskud)],
      ['Gns. kr. pr. akkordtime pr. person', kr(r.akkord.gnsKrPrAkkordtimePrPerson)],
      ['Kr. pr. akkordtime i alt (akkordsum ÷ timer)', kr(r.akkord.krPrAkkordtime)],
      ['Timeløn, syg og vejrlig', kr(r.total.timeloen + r.total.syg + r.total.vejrlig)],
      ['Rettelser', kr(r.total.justeringer)],
      ['I alt', kr(r.total.iAlt)],
    ],
    didParseCell: (c) => {
      if (c.column.index === 1) c.cell.styles.halign = 'right'
      if (c.section === 'body' && c.row.index === 7) c.cell.styles.fontStyle = 'bold'
    },
  })

  // Materialer
  autoTable(doc, {
    ...tabel,
    startY: efter(),
    head: [['Materiale', 'Antal', 'Stykpris', 'Beløb']],
    body: r.akkord.linjer.map((l) => [l.navn, timer(l.antal), kr(l.stykpris), kr(l.beloeb)]),
    foot: [['Akkordsum', '', '', kr(r.akkord.akkordsum)]],
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    ...hoejre(1, 2, 3),
  })

  // Akkord pr. person
  autoTable(doc, {
    ...tabel,
    startY: efter(),
    head: [['Akkord', 'Timer', 'Akkordløn', 'Overskud', 'I alt', 'Kr./t']],
    body: r.akkord.personer.map((p) => [navn(p.medlemId), timer(p.akkordtimer), kr(p.akkordloen), kr(p.overskud), kr(p.iAlt), kr(p.krPrAkkordtime)]),
    foot: [['I alt', timer(r.akkord.akkordtimer), kr(r.akkord.akkordloen), kr(r.akkord.overskud), kr(r.akkord.akkordloen + r.akkord.overskud), kr(r.akkord.krPrAkkordtime)]],
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    ...hoejre(1, 2, 3, 4, 5),
  })

  // Samlet løn pr. person
  autoTable(doc, {
    ...tabel,
    startY: efter(),
    head: [['Løn i alt', 'Akkord', 'Timeløn', 'Syg', 'Vejrlig', 'Rettelser', 'I alt']],
    body: r.personer.map((p) => [
      navn(p.medlemId),
      kr(p.akkordloen + p.overskud),
      kr(p.timeloen),
      kr(p.syg),
      kr(p.vejrlig),
      kr(p.justeringer),
      kr(p.iAlt),
    ]),
    foot: [
      [
        'I alt',
        kr(r.total.akkordloen + r.total.overskud),
        kr(r.total.timeloen),
        kr(r.total.syg),
        kr(r.total.vejrlig),
        kr(r.total.justeringer),
        kr(r.total.iAlt),
      ],
    ],
    footStyles: { fillColor: [240, 240, 240], textColor: 20 },
    styles: { fontSize: 8 },
    ...hoejre(1, 2, 3, 4, 5, 6),
  })

  if (data.justeringer.length > 0) {
    autoTable(doc, {
      ...tabel,
      startY: efter(),
      head: [['Rettelse', 'Begrundelse', 'Beløb']],
      body: data.justeringer.map((j) => [navn(j.medlemId), j.begrundelse, kr(j.beloeb)]),
      ...hoejre(2),
    })
  }

  const sider = doc.getNumberOfPages()
  for (let i = 1; i <= sider; i++) {
    doc.setPage(i)
    doc.setFontSize(8)
    doc.setTextColor(120)
    doc.text(`AKBOG · udskrevet ${datoKort(new Date().toISOString())} · side ${i} af ${sider}`, venstre, 290)
  }
  return doc.output('blob')
}

/** Excel med hver timeløn-postering pr. dag og dagens noter — til mester. */
export async function lavTimeloenExcel(data: ProjektData): Promise<Blob> {
  const navn = (id: string) => data.medlemmer.find((m) => m.id === id)?.navn ?? 'Ukendt'
  const noter = (dato: string) =>
    data.noter
      .filter((n) => n.dato === dato)
      .map((n) => n.tekst)
      .join('\n')

  const posteringer = data.timer
    .filter((t) => t.type === 'timeloen')
    .sort((a, b) => a.dato.localeCompare(b.dato) || navn(a.medlemId).localeCompare(navn(b.medlemId), 'da'))

  const fed = { fontWeight: 'bold' as const }
  const ark: SheetData = [
    [
      { value: 'Dato', ...fed },
      { value: 'Navn', ...fed },
      { value: 'Timer', ...fed },
      { value: 'Arbejde', ...fed },
      { value: 'Dagens noter', ...fed },
    ],
    ...posteringer.map((t) => [
      { value: new Date(t.dato + 'T12:00:00'), type: Date, format: 'dd-mm-yyyy' },
      navn(t.medlemId),
      { value: t.timer / 100, type: Number, format: '0.00' },
      t.beskrivelse ?? '',
      { value: noter(t.dato), wrap: true },
    ]),
    [
      { value: 'I alt', ...fed },
      null,
      { value: posteringer.reduce((s, t) => s + t.timer, 0) / 100, type: Number, format: '0.00', ...fed },
      null,
      null,
    ],
  ]

  return writeXlsxFile(ark, {
    sheet: 'Timeløn',
    columns: [{ width: 12 }, { width: 18 }, { width: 8 }, { width: 40 }, { width: 60 }],
    stickyRowsCount: 1,
  }).toBlob()
}
