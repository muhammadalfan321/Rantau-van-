export type RGB = [number, number, number];

export const clamp = (v: number, a: number, b: number): number =>
  Math.max(a, Math.min(b, v));

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const smoothstep = (a: number, b: number, x: number): number => {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

export const hexToRgb = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];

export const mixRgb = (a: RGB, b: RGB, t: number): RGB => [
  lerp(a[0], b[0], t),
  lerp(a[1], b[1], t),
  lerp(a[2], b[2], t),
];

export const rgbCss = (c: RGB, a = 1): string =>
  `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;

export const STOP_MINUTES = [605, 1072, 1230, 1420] as const;
export const STOP_TEMPS = [27, 24, 21, 18] as const;
export const STOP_PLACES = [
  'Tepi danau',
  'Pulau gerbang batu',
  'Dermaga',
  'Padang rumput',
] as const;

export const STOP_WEATHERS = [
  'Kabut pagi',
  'Gerimis senja',
  'Hujan ringan',
  'Kabut padang',
] as const;

export interface WeatherState {
  mistIntensity: number;
  rainIntensity: number;
  fogElevation: number;
  label: string;
}

const STOP_MIST = [0.82, 0.28, 0.48, 0.78] as const;
const STOP_RAIN = [0.0, 0.42, 0.82, 0.0] as const;
const STOP_FOG_ELEV = [0.15, 0.25, 0.35, 0.88] as const;

export function computeWeatherState(tc: number): WeatherState {
  const c = clamp(tc, 0, 3);
  const i = Math.min(2, Math.floor(c));
  const frac = smoothstep(0, 1, c - i);
  const stopIndex = Math.round(c);

  return {
    mistIntensity: lerp(STOP_MIST[i], STOP_MIST[i + 1], frac),
    rainIntensity: lerp(STOP_RAIN[i], STOP_RAIN[i + 1], frac),
    fogElevation: lerp(STOP_FOG_ELEV[i], STOP_FOG_ELEV[i + 1], frac),
    label: STOP_WEATHERS[stopIndex],
  };
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

export interface HudReadout {
  clock: string;
  tempText: string;
  stopIndex: number;
}

export function computeHudReadout(tc: number): HudReadout {
  const clamped = clamp(tc, 0, 3);
  const i = Math.min(2, Math.floor(clamped));
  const frac = clamped - i;
  const mins = lerp(STOP_MINUTES[i], STOP_MINUTES[i + 1], frac);
  const clock = `${pad2(Math.floor(mins / 60) % 24)}.${pad2(Math.floor(mins % 60))} WIB`;
  const temp = Math.round(lerp(STOP_TEMPS[i], STOP_TEMPS[i + 1], frac));
  const stopIndex = Math.round(clamped);
  return {
    clock,
    tempText: `${temp}°C · ${STOP_PLACES[stopIndex]}`,
    stopIndex,
  };
}

export const STOP_HEADINGS = [65, 125, 205, 315] as const;

const CARDINALS_ID = ['U', 'TL', 'T', 'TG', 'S', 'BD', 'B', 'BL'] as const;

export interface CompassState {
  headingDeg: number;
  normalizedDeg: number;
  cardinal: string;
  bearingText: string;
}

export function formatBearing(headingDeg: number): Omit<CompassState, 'headingDeg'> {
  const normalizedDeg = ((Math.round(headingDeg) % 360) + 360) % 360;
  const cardinalIndex = Math.round(normalizedDeg / 45) % 8;
  const cardinal = CARDINALS_ID[cardinalIndex];
  return {
    normalizedDeg,
    cardinal,
    bearingText: `${String(normalizedDeg).padStart(3, '0')}° ${cardinal}`,
  };
}

export function computeCompassState(tc: number, steeringDelta = 0): CompassState {
  const clamped = clamp(tc, 0, 3);
  const i = Math.min(2, Math.floor(clamped));
  const frac = smoothstep(0, 1, clamped - i);
  const baseHeading = lerp(STOP_HEADINGS[i], STOP_HEADINGS[i + 1], frac);
  const steerOffset = clamp(steeringDelta, -1, 1) * 10;
  const headingDeg = baseHeading + steerOffset;
  return {
    headingDeg,
    ...formatBearing(headingDeg),
  };
}

export type UiScheme = 'day' | 'sunset' | 'night-dim';

export interface UiPaletteState {
  ink: RGB;
  inv: RGB;
  em: RGB;
  btnBg: RGB;
  btnInk: RGB;
  btnBorderAlpha: number;
  sayBg: RGB;
  sayInk: RGB;
  sayEm: RGB;
  hudAlpha: number;
  dimFactor: number;
  scheme: UiScheme;
}

const INK_DAY: RGB = [14, 34, 56];
const INK_SUNSET: RGB = [246, 241, 230];
const INK_DIM: RGB = [172, 182, 204];

const INV_DIM: RGB = [12, 20, 40];

const EM_DAY: RGB = [194, 65, 12];
const EM_SUNSET: RGB = [255, 180, 84];
const EM_DIM: RGB = [209, 152, 94];

const BTN_BG_DIM: RGB = [138, 148, 170];
const BTN_INK_DIM: RGB = [11, 19, 38];

const SAY_BG_DAY: RGB = [246, 241, 230];
const SAY_BG_DIM: RGB = [156, 166, 188];
const SAY_INK_DIM: RGB = [12, 21, 42];
const SAY_EM_DIM: RGB = [132, 48, 16];

export function computeUiPalette(tc: number): UiPaletteState {
  const clamped = clamp(tc, 0, 3);
  const sunsetFactor = smoothstep(0.55, 1, clamped);
  const dimFactor = smoothstep(1.35, 2, clamped);

  const ink = mixRgb(mixRgb(INK_DAY, INK_SUNSET, sunsetFactor), INK_DIM, dimFactor);
  const inv = mixRgb(mixRgb(INK_SUNSET, INK_DAY, sunsetFactor), INV_DIM, dimFactor);
  const em = mixRgb(mixRgb(EM_DAY, EM_SUNSET, sunsetFactor), EM_DIM, dimFactor);

  const btnBg = mixRgb(
    mixRgb(INK_DAY, INK_SUNSET, sunsetFactor),
    BTN_BG_DIM,
    dimFactor,
  );
  const btnInk = mixRgb(
    mixRgb(INK_SUNSET, INK_DAY, sunsetFactor),
    BTN_INK_DIM,
    dimFactor,
  );

  const sayBg = mixRgb(SAY_BG_DAY, SAY_BG_DIM, dimFactor);
  const sayInk = mixRgb(INK_DAY, SAY_INK_DIM, dimFactor);
  const sayEm = mixRgb(EM_DAY, SAY_EM_DIM, dimFactor);

  const scheme: UiScheme =
    dimFactor >= 0.5 ? 'night-dim' : sunsetFactor >= 0.5 ? 'sunset' : 'day';

  return {
    ink,
    inv,
    em,
    btnBg,
    btnInk,
    btnBorderAlpha: lerp(0, 0.28, dimFactor),
    sayBg,
    sayInk,
    sayEm,
    hudAlpha: lerp(1, 0.78, dimFactor),
    dimFactor,
    scheme,
  };
}
