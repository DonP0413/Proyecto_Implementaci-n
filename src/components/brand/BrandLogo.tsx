/** Objetivo: logotipo e isotipo oficiales de PINTO TECH según el Manual de Marca. */
import { env } from '../../config/env';

interface BrandIsotipoProps {
  color?: string;
  size?: number;
  className?: string;
}

export function BrandIsotipo({ color = '#1377BC', size = 40, className = '' }: BrandIsotipoProps) {
  const height = Math.round((size * 136) / 120);
  return (
    <svg
      viewBox="0 0 120 136"
      width={size}
      height={height}
      className={`brand-isotipo ${className}`.trim()}
      aria-hidden="true"
    >
      <path
        fill="none"
        stroke={color}
        strokeWidth="11"
        strokeLinejoin="round"
        d="M 28,10 H 92 A 18,18 0 0 1 110,28 V 86 A 18,18 0 0 1 92,104 H 28 A 18,18 0 0 1 10,86 V 28 A 18,18 0 0 1 28,10 Z"
      />
      <path fill={color} d="M 35,101 L 31,130 L 63,101 Z" />
      <path
        fill="none"
        stroke={color}
        strokeWidth="10.5"
        strokeLinecap="butt"
        strokeLinejoin="round"
        d="M 41.25,99 V 64 H 71 A 10,10 0 0 0 81,54 V 41 A 10,10 0 0 0 71,31 H 49.25 A 8,8 0 0 0 41.25,39 V 50"
      />
    </svg>
  );
}

interface BrandLogoProps {
  /** 'positivo' = #1377BC sobre blanco | 'negativo' = #FFFFFF sobre #1377BC */
  variant?: 'positivo' | 'negativo';
  size?: 'sm' | 'md' | 'lg';
  showTagline?: boolean;
  className?: string;
}

export function BrandLogo({ variant = 'positivo', size = 'md', showTagline = false, className = '' }: BrandLogoProps) {
  const color = variant === 'negativo' ? '#FFFFFF' : '#1377BC';

  return (
    <div className={`brand-lockup brand-lockup-${size} brand-lockup-${variant} ${className}`.trim()}>
      <svg viewBox="0 0 420 140" className="brand-svg" role="img" aria-label={`${env.appName} — Servicio Técnico`}>
        <g transform="translate(4, 2)">
          <path
            fill="none"
            stroke={color}
            strokeWidth="11"
            strokeLinejoin="round"
            d="M 28,10 H 92 A 18,18 0 0 1 110,28 V 86 A 18,18 0 0 1 92,104 H 28 A 18,18 0 0 1 10,86 V 28 A 18,18 0 0 1 28,10 Z"
          />
          <path fill={color} d="M 35,101 L 31,130 L 63,101 Z" />
          <path
            fill="none"
            stroke={color}
            strokeWidth="10.5"
            strokeLinecap="butt"
            strokeLinejoin="round"
            d="M 41.25,99 V 64 H 71 A 10,10 0 0 0 81,54 V 41 A 10,10 0 0 0 71,31 H 49.25 A 8,8 0 0 0 41.25,39 V 50"
          />
        </g>
        <g fill={color}>
          {/* Letra P (Impact) */}
          <path
            fillRule="evenodd"
            d="M 134,16 H 163 C 175,16 181,22 181,34 C 181,46 174,52 161,52 H 150 V 74 H 134 Z M 150,27 V 41 H 159 C 164,41 166,39 166,34 C 166,29 164,27 159,27 Z"
          />
          {/* Destornillador reemplazando a la letra I */}
          <path
            fillRule="evenodd"
            d="M 196,6 H 206 L 204,15 H 203.5 V 38 H 208.5 C 210,38 211,39 211,41 V 43 H 210 C 211,44 211.5,45.5 211.5,47.5 V 69 C 211.5,72.5 209,74.5 205.5,74.5 H 196.5 C 193,74.5 190.5,72.5 190.5,69 V 47.5 C 190.5,45.5 191,44 192,43 H 191 V 41 C 191,39 192,38 193.5,38 H 198.5 V 15 H 198 Z M 196,49 A 1.5,1.5 0 0 0 194.5,50.5 V 66.5 A 1.5,1.5 0 0 0 197.5,66.5 V 50.5 A 1.5,1.5 0 0 0 196,49 Z M 206,49 A 1.5,1.5 0 0 0 204.5,50.5 V 66.5 A 1.5,1.5 0 0 0 207.5,66.5 V 50.5 A 1.5,1.5 0 0 0 206,49 Z"
          />
          {/* Letra N (Impact) */}
          <path d="M 225,16 H 240 L 257,49 V 16 H 271 V 74 H 256 L 239,40 V 74 H 225 Z" />
          {/* Letra T (Impact) */}
          <path d="M 283,16 H 329 V 29 H 314 V 74 H 298 V 29 H 283 Z" />
          {/* Botón de encendido reemplazando a la letra O */}
          <path
            fill="none"
            stroke={color}
            strokeWidth="9.5"
            strokeLinecap="round"
            d="M 382.46,29.76 A 22.5,22.5 0 1 1 353.54,29.76"
          />
          <line x1="368" y1="10" x2="368" y2="46" stroke={color} strokeWidth="9.5" strokeLinecap="round" />
          {/* Subtítulo TECH (Arial) */}
          <text
            x="284"
            y="116"
            textAnchor="middle"
            fontFamily="Arial, Helvetica, sans-serif"
            fontSize="40"
            fontWeight="400"
            letterSpacing="11"
          >
            TECH
          </text>
        </g>
      </svg>
      {showTagline && <span className="brand-tagline">SERVICIO TÉCNICO</span>}
      <span className="sr-only">{env.appName}</span>
    </div>
  );
}
