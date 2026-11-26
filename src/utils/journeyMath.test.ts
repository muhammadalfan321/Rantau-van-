import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeCompassState,
  computeHudReadout,
  computeUiPalette,
  computeWeatherState,
} from './journeyMath';

test('computeHudReadout returns exact stop values at integer stops', () => {
  assert.deepEqual(computeHudReadout(0), {
    clock: '10.05 WIB',
    tempText: '27°C · Tepi danau',
    stopIndex: 0,
  });
  assert.deepEqual(computeHudReadout(1), {
    clock: '17.52 WIB',
    tempText: '24°C · Pulau gerbang batu',
    stopIndex: 1,
  });
  assert.deepEqual(computeHudReadout(2), {
    clock: '20.30 WIB',
    tempText: '21°C · Dermaga',
    stopIndex: 2,
  });
  assert.deepEqual(computeHudReadout(3), {
    clock: '23.40 WIB',
    tempText: '18°C · Padang rumput',
    stopIndex: 3,
  });
});

test('computeWeatherState smoothly transitions mist and rain across locations', () => {
  const morning = computeWeatherState(0);
  assert.equal(morning.label, 'Kabut pagi');
  assert.equal(morning.rainIntensity, 0);
  assert.equal(morning.mistIntensity > 0.7, true);

  const sunset = computeWeatherState(1);
  assert.equal(sunset.label, 'Gerimis senja');
  assert.equal(sunset.rainIntensity > 0.3, true);

  const pier = computeWeatherState(2);
  assert.equal(pier.label, 'Hujan ringan');
  assert.equal(pier.rainIntensity > 0.7, true);

  const meadow = computeWeatherState(3);
  assert.equal(meadow.label, 'Kabut padang');
  assert.equal(meadow.rainIntensity, 0);
  assert.equal(meadow.fogElevation > 0.8, true);
});

test('computeCompassState follows van heading smoothly across stops and bounds steering bias', () => {
  const s0 = computeCompassState(0);
  assert.equal(s0.normalizedDeg, 65);
  assert.equal(s0.cardinal, 'TL');
  assert.equal(s0.bearingText, '065° TL');

  const s1 = computeCompassState(1);
  assert.equal(s1.normalizedDeg, 125);
  assert.equal(s1.cardinal, 'TG');

  const s2 = computeCompassState(2);
  assert.equal(s2.normalizedDeg, 205);
  assert.equal(s2.cardinal, 'BD');

  const s3 = computeCompassState(3);
  assert.equal(s3.normalizedDeg, 315);
  assert.equal(s3.cardinal, 'BL');

  // Monotonic clockwise interpolation between stops
  const mid = computeCompassState(1.5);
  assert.equal(mid.headingDeg > s1.headingDeg && mid.headingDeg < s2.headingDeg, true);

  // Steering bias is bounded to ±10 degrees
  const biased = computeCompassState(0, 5);
  assert.equal(biased.normalizedDeg, 75);
});

test('computeUiPalette dims UI text, accents, and HUD elements at night pier scene', () => {
  const day = computeUiPalette(0);
  assert.equal(day.scheme, 'day');
  assert.equal(day.dimFactor, 0);
  assert.equal(day.hudAlpha, 1);
  assert.deepEqual(day.ink, [14, 34, 56]);

  const sunset = computeUiPalette(1);
  assert.equal(sunset.scheme, 'sunset');
  assert.equal(sunset.dimFactor, 0);
  assert.equal(sunset.hudAlpha, 1);
  assert.deepEqual(sunset.ink, [246, 241, 230]);

  const pier = computeUiPalette(2);
  assert.equal(pier.scheme, 'night-dim');
  assert.equal(pier.dimFactor, 1);
  assert.equal(pier.hudAlpha < 0.85, true);
  assert.equal(pier.ink[0] < sunset.ink[0], true);
  assert.equal(pier.em[0] < sunset.em[0], true);
  assert.equal(pier.btnBg[0] < sunset.btnBg[0], true);
  assert.equal(pier.sayBg[0] < 180, true);
  assert.equal(pier.btnBg[0] - pier.btnInk[0] > 100, true);

  const midTransition = computeUiPalette(1.68);
  assert.equal(midTransition.dimFactor > 0 && midTransition.dimFactor < 1, true);
  assert.equal(midTransition.btnBg[0] - midTransition.btnInk[0] > 100, true);
  assert.equal(midTransition.sayBg[0] - midTransition.sayInk[0] > 100, true);
});
