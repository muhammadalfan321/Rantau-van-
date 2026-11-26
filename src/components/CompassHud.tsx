import React from 'react';

export interface CompassHudProps {
  compassElRef: React.RefObject<HTMLDivElement | null>;
  needleElRef: React.RefObject<SVGGElement | null>;
  bearingElRef: React.RefObject<HTMLSpanElement | null>;
}

const DIAL_TICKS = Array.from({ length: 12 }, (_, idx) => idx * 30);

export function CompassHud({
  compassElRef,
  needleElRef,
  bearingElRef,
}: CompassHudProps) {
  return (
    <div
      ref={compassElRef}
      className="compass-hud"
      data-testid="compass-hud"
      data-heading="65"
      aria-hidden="true"
    >
      <div className="compass-dial">
        <svg viewBox="0 0 48 48" width="48" height="48" fill="none">
          <circle
            cx="24"
            cy="24"
            r="22"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeOpacity="0.32"
          />
          {DIAL_TICKS.map((deg) => {
            const rad = (deg * Math.PI) / 180;
            const isCardinal = deg % 90 === 0;
            const rOuter = 20.5;
            const rInner = isCardinal ? 16.5 : 18.2;
            return (
              <line
                key={deg}
                x1={24 + Math.sin(rad) * rInner}
                y1={24 - Math.cos(rad) * rInner}
                x2={24 + Math.sin(rad) * rOuter}
                y2={24 - Math.cos(rad) * rOuter}
                stroke="currentColor"
                strokeWidth={isCardinal ? '1.35' : '0.9'}
                strokeOpacity={isCardinal ? '0.68' : '0.32'}
                strokeLinecap="round"
              />
            );
          })}
          <text
            x="24"
            y="13"
            textAnchor="middle"
            fill="currentColor"
            fillOpacity="0.68"
            fontSize="5.4"
            fontWeight="700"
            letterSpacing="0.06em"
          >
            U
          </text>
          <g
            ref={needleElRef}
            className="compass-needle"
            style={{ transform: 'rotate(65deg)', transformOrigin: '24px 24px' }}
          >
            <circle
              cx="24"
              cy="24"
              r="11.5"
              stroke="currentColor"
              strokeWidth="0.75"
              strokeOpacity="0.24"
              strokeDasharray="1.5 2.5"
            />
            <path
              d="M24 8.5 L27.2 24 L24 22.1 L20.8 24 Z"
              fill="var(--em)"
            />
            <path
              d="M24 39.5 L26.7 24 L24 25.9 L21.3 24 Z"
              fill="currentColor"
              fillOpacity="0.45"
            />
            <circle cx="24" cy="24" r="2.3" fill="currentColor" />
            <circle cx="24" cy="24" r="1" fill="var(--inv)" />
          </g>
        </svg>
      </div>
      <div className="compass-meta">
        <span ref={bearingElRef}>065° TL</span>
        <small>Arah van</small>
      </div>
    </div>
  );
}
