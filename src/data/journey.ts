export interface SceneCopy {
  id: number;
  className: string;
  ariaLabel: string;
  eyebrow: string;
  titlePrefix: string;
  titleEmphasis: string;
  headingLevel: 1 | 2;
  lede: string;
  ctaLabel: string;
  ctaGo?: number;
  ctaToast?: boolean;
  note?: string;
}

export const SCENES: SceneCopy[] = [
  {
    id: 0,
    className: 's1',
    ariaLabel: 'Tepi danau',
    eyebrow: 'Hari 1 · Tepi danau',
    titlePrefix: 'Pelan-pelan, hari terasa ',
    titleEmphasis: 'lebih terang.',
    headingLevel: 1,
    lede: 'Berangkat tanpa jadwal. Parkir di tepi danau, nyalakan kompor kecil, dan biarkan pagi berjalan sesuka hatinya.',
    ctaLabel: 'Mulai perjalanan',
    ctaGo: 1,
  },
  {
    id: 1,
    className: 's2',
    ariaLabel: 'Pulau gerbang batu',
    eyebrow: 'Hari 1 · Pulau gerbang batu',
    titlePrefix: 'Di antara siang ',
    titleEmphasis: 'dan malam.',
    headingLevel: 2,
    lede: 'Matahari turun tepat di tengah gerbang batu. Lima belas menit paling keemasan, dan tidak ada yang buru-buru.',
    ctaLabel: 'Lihat dermaganya',
    ctaGo: 2,
  },
  {
    id: 2,
    className: 's3',
    ariaLabel: 'Dermaga',
    eyebrow: 'Hari 1 · Dermaga',
    titlePrefix: 'Sunyi yang ',
    titleEmphasis: 'dirancang indah.',
    headingLevel: 2,
    lede: 'Lampu dermaga menyala satu per satu. Danau diam, langit penuh, dan sinyal ponsel menyerah dengan sopan.',
    ctaLabel: 'Cari tempat parkir',
    ctaGo: 3,
    note: 'Ketuk langit untuk memanggil bintang jatuh.',
  },
  {
    id: 3,
    className: 's4',
    ariaLabel: 'Padang rumput',
    eyebrow: 'Hari 1 · Padang rumput',
    titlePrefix: 'Jelajah. Temukan. ',
    titleEmphasis: 'Ulangi.',
    headingLevel: 2,
    lede: 'Malam ini cuma ada kamu, sebuah van kecil, dan komet yang lewat tanpa permisi. Besok, rute baru.',
    ctaLabel: 'Pesan Van Rantau',
    ctaToast: true,
    note: 'Ketuk langit untuk memanggil komet.',
  },
];

export const ALFAN_LINES: string[][] = [
  [
    'Hai, aku Alfan.',
    'Ini hari pertamaku resign.',
    'Jam segini biasanya aku sudah di rapat.',
    'Sekarang? Cuma ikan yang menunggu balasanku.',
  ],
  [
    'Lihat gerbang batu itu? Matahari lewat tepat di tengahnya.',
    'Dulu jam segini aku masih bales email.',
    'Ternyata sore bisa seindah ini.',
  ],
  [
    'Lampunya nyala satu-satu.',
    'Kata orang, resign itu nekat.',
    'Menurutku, ini cuma pindah arah.',
    'Sinyal hilang, pikiran malah pulang.',
  ],
  [
    'Itu komet! Cepat bikin permohonan.',
    'Aku minta: berani mulai lagi.',
    'Besok rute baru. Malam ini, cukup di sini.',
    'Terima kasih sudah ikut hari pertamaku.',
  ],
];

export const STOP_LABELS = [
  'Tepi danau',
  'Pulau gerbang batu',
  'Dermaga',
  'Padang rumput',
] as const;
