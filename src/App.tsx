import { useCallback, useEffect, useRef, useState } from 'react';
import { CompassHud } from './components/CompassHud';
import { PanoramaCanvas } from './components/PanoramaCanvas';
import { SCENES, STOP_LABELS } from './data/journey';

export default function App() {
  const [toastMsg, setToastMsg] = useState('');
  const [isToastVisible, setIsToastVisible] = useState(false);

  const trackRef = useRef<HTMLElement | null>(null);
  const clockElRef = useRef<HTMLSpanElement | null>(null);
  const tempElRef = useRef<HTMLElement | null>(null);
  const compassElRef = useRef<HTMLDivElement | null>(null);
  const compassNeedleRef = useRef<SVGGElement | null>(null);
  const compassBearingRef = useRef<HTMLSpanElement | null>(null);
  const hintElRef = useRef<HTMLDivElement | null>(null);
  const sayElRef = useRef<HTMLDivElement | null>(null);
  const sceneRefs = useRef<(HTMLElement | null)[]>([]);
  const dotRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const toastTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current !== null) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setIsToastVisible(true);
    if (toastTimerRef.current !== null) {
      window.clearTimeout(toastTimerRef.current);
    }
    toastTimerRef.current = window.setTimeout(() => {
      setIsToastVisible(false);
    }, 2800);
  }, []);

  const goScene = useCallback((index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const rm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const max = track.offsetHeight - window.innerHeight;
    window.scrollTo({
      top: (max * index) / 3,
      behavior: rm ? 'auto' : 'smooth',
    });
  }, []);

  return (
    <>
      <PanoramaCanvas
        trackRef={trackRef}
        clockElRef={clockElRef}
        tempElRef={tempElRef}
        compassElRef={compassElRef}
        compassNeedleRef={compassNeedleRef}
        compassBearingRef={compassBearingRef}
        hintElRef={hintElRef}
        sayElRef={sayElRef}
        sceneRefs={sceneRefs}
        dotRefs={dotRefs}
      />

      <header className="nav">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            goScene(0);
          }}
          aria-label="Rantau, ke awal"
        >
          <svg
            viewBox="0 0 34 20"
            width="34"
            height="20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M2 14V6.5A3.5 3.5 0 0 1 5.5 3H19a3 3 0 0 1 2.4 1.2l4.6 6.1c1.3.5 2 1.7 2 3V14h-2.2a3.3 3.3 0 0 0-6.4 0H11.2a3.3 3.3 0 0 0-6.4 0z" />
            <circle cx="8" cy="15" r="2.4" />
            <circle cx="23" cy="15" r="2.4" />
          </svg>
          <span>Rantau</span>
        </a>
        <nav className="links" aria-label="Navigasi">
          <button type="button" className="link" onClick={() => goScene(1)}>
            Rute
          </button>
          <button type="button" className="link" onClick={() => goScene(3)}>
            Van
          </button>
          <button type="button" className="link" onClick={() => goScene(2)}>
            Jurnal
          </button>
        </nav>
        <button
          type="button"
          className="btn small"
          onClick={() =>
            showToast('Ini halaman contoh, belum ada pemesanan sungguhan.')
          }
        >
          Pesan van
        </button>
      </header>

      <nav className="dots" aria-label="Adegan perjalanan">
        {STOP_LABELS.map((label, i) => (
          <button
            key={label}
            ref={(el) => {
              dotRefs.current[i] = el;
            }}
            type="button"
            className={`dot ${i === 0 ? 'on' : ''}`}
            onClick={() => goScene(i)}
            aria-label={`Adegan ${i + 1}, ${label.toLowerCase()}`}
          >
            <span />
          </button>
        ))}
      </nav>

      <div className="hud" aria-hidden="true">
        <span ref={clockElRef} id="clock">
          10.05 WIB
        </span>
        <small ref={tempElRef} id="temp">
          27°C
        </small>
      </div>

      <CompassHud
        compassElRef={compassElRef}
        needleElRef={compassNeedleRef}
        bearingElRef={compassBearingRef}
      />

      <div ref={hintElRef} className="hint" id="hint" aria-hidden="true">
        Gulir
        <i />
      </div>

      <div ref={sayElRef} className="say" id="say" aria-hidden="true">
        <b>Alfan</b>
        <span className="t" />
        <span className="r" />
        <span className="car" />
      </div>

      <div
        className={`toast ${isToastVisible ? 'show' : ''}`}
        id="toast"
        role="status"
      >
        {toastMsg}
      </div>

      <div className="sr">
        Alfan: Hai, aku Alfan. Ini hari pertamaku resign. Aku ingin pelan-pelan
        menikmati hari. Kata orang resign itu nekat. Menurutku ini cuma pindah
        arah. Terima kasih sudah ikut hari pertamaku.
      </div>

      <main ref={trackRef} id="track">
        {SCENES.map((scene, idx) => (
          <section
            key={scene.id}
            ref={(el) => {
              sceneRefs.current[idx] = el;
            }}
            className={`scene ${scene.className}`}
            aria-label={scene.ariaLabel}
          >
            <div className="copy">
              <p className="eyebrow">{scene.eyebrow}</p>
              {scene.headingLevel === 1 ? (
                <h1>
                  {scene.titlePrefix}
                  <em>{scene.titleEmphasis}</em>
                </h1>
              ) : (
                <h2>
                  {scene.titlePrefix}
                  <em>{scene.titleEmphasis}</em>
                </h2>
              )}
              <p className="lede">{scene.lede}</p>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  if (scene.ctaGo !== undefined) {
                    goScene(scene.ctaGo);
                  } else if (scene.ctaToast) {
                    showToast(
                      'Ini halaman contoh, belum ada pemesanan sungguhan.',
                    );
                  }
                }}
              >
                {scene.ctaLabel}
              </button>
              {scene.note && <p className="note">{scene.note}</p>}
            </div>
          </section>
        ))}
      </main>
    </>
  );
}
