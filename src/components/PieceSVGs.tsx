import React from 'react';

interface SVGProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

export const WP: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <path
      d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-.83.62-1.41 1.61-1.41 2.72 0 .28.04.55.11.81H27.9c.07-.26.11-.53.11-.81 0-1.11-.58-2.1-1.41-2.72C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
      fill="#fff"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const WN: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <path
      d="M 22,10 C 32.5,11 38.5,18 38,28.5 F"
      fill="none"
    />
    <path
      d="M 22,10 C 24,11 24,12 25,14 C 26,16 28,17 31,17 C 34,17 35,19 35,22 C 35,24 33,26 30,26 C 27,26 26,29 26,31 C 26,32 25,33 24,33 C 23,33 22,34 21,34 C 18,34 16,33 16,33 C 15,31 15,29 15,29 C 15,27 14,26 13,26 C 11.5,26 8.5,27 8.5,25 C 8.5,23 10,21 12,21 C 14,21 16,19 16,17 C 16,15 17,14 18,12 C 19,10 20,10 22,10 z"
      fill="#fff"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
      fill="#000"
    />
    <path
      d="M 20 18 A 1.5 1.5 0 1 1 17,18 A 1.5 1.5 0 1 1 20 18 z"
      fill="#000"
    />
  </svg>
);

export const WB: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <g
      fill="none"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 36c3.39 0 7.66-.69 11.77-2.3 4-1.6 10.13-4.83 13.13-10.15 1.48-2.6 2.1-5.63 2.1-8.55 0-3.17-.67-6.55-2.85-8.8C31 3.93 27.26 3 22.5 3c-4.76 0-8.5 1-10.65 3.2-2.18 2.25-2.85 5.63-2.85 8.8 0 2.92.62 5.95 2.1 8.55 3 5.32 9.13 8.55 13.13 10.15C28.34 35.31 32.61 36 36 36" />
      <path d="M36 18H9" />
      <path d="M22.5 3v21M17.5 18l5-5 5 5M17.5 13l5 5 5-5" fill="none" fillRule="evenodd" />
      <circle cx="22.5" cy="8" r="1.5" fill="#fff" />
    </g>
  </svg>
);

export const WR: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <g
      fill="#fff"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 39h27v-3H9v3zm3-3h21v-4H12v4zm2.25-4l-1.25-18h19l-1.25 18h-16.5z" />
      <path d="M9 17h27v-5H9v5zm3-5h4V9h5v3h5V9h5v3h5V9h4v3z" />
    </g>
  </svg>
);

export const WQ: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <g
      fill="#fff"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm34 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM22.5 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12 14.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm26 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
      <path d="M9 37h27v-3H9v3zm3-3h21L36.5 18h-28L12 34zm-3-16h27L38.5 9.5 27 21l-4.5-16.5L18 21 6.5 9.5 9 18z" />
    </g>
  </svg>
);

export const WK: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <g
      fill="none"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22.5 11.63V6M20 8h5" />
      <path
        d="M22.5 25c4.42 0 8-3.58 8-8 0-4.42-3.58-8-8-8s-8 3.58-8 8c0 4.42 3.58 8 8 8z"
        fill="#fff"
      />
      <path d="M11.5 30c2.42-1.32 5.58-2 11-2s8.58.68 11 2" />
      <path d="M12 36h21v-3H12v3zm0-3h21v-3H12v3z" fill="#fff" />
    </g>
  </svg>
);

export const BP: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <path
      d="M22.5 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-.83.62-1.41 1.61-1.41 2.72 0 .28.04.55.11.81H27.9c.07-.26.11-.53.11-.81 0-1.11-.58-2.1-1.41-2.72C28.06 24.84 29 23.03 29 21c0-2.41-1.33-4.5-3.28-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"
      fill="#5b5b5b"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
    />
  </svg>
);

export const BN: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <path
      d="M 22,10 C 32.5,11 38.5,18 38,28.5 F"
      fill="none"
    />
    <path
      d="M 22,10 C 24,11 24,12 25,14 C 26,16 28,17 31,17 C 34,17 35,19 35,22 C 35,24 33,26 30,26 C 27,26 26,29 26,31 C 26,32 25,33 24,33 C 23,33 22,34 21,34 C 18,34 16,33 16,33 C 15,31 15,29 15,29 C 15,27 14,26 13,26 C 11.5,26 8.5,27 8.5,25 C 8.5,23 10,21 12,21 C 14,21 16,19 16,17 C 16,15 17,14 18,12 C 19,10 20,10 22,10 z"
      fill="#5b5b5b"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z"
      fill="#fff"
    />
    <path
      d="M 20 18 A 1.5 1.5 0 1 1 17,18 A 1.5 1.5 0 1 1 20 18 z"
      fill="#fff"
    />
  </svg>
);

export const BB: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <g
      fill="none"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path
        d="M9 36c3.39 0 7.66-.69 11.77-2.3 4-1.6 10.13-4.83 13.13-10.15 1.48-2.6 2.1-5.63 2.1-8.55 0-3.17-.67-6.55-2.85-8.8C31 3.93 27.26 3 22.5 3c-4.76 0-8.5 1-10.65 3.2-2.18 2.25-2.85 5.63-2.85 8.8 0 2.92.62 5.95 2.1 8.55 3 5.32 9.13 8.55 13.13 10.15C28.34 35.31 32.61 36 36 36"
        fill="#5b5b5b"
      />
      <path d="M36 18H9" />
      <path d="M22.5 3v21M17.5 18l5-5 5 5M17.5 13l5 5 5-5" fill="none" fillRule="evenodd" />
      <circle cx="22.5" cy="8" r="1.5" fill="#5b5b5b" />
    </g>
  </svg>
);

export const BR: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <g
      fill="#5b5b5b"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 39h27v-3H9v3zm3-3h21v-4H12v4zm2.25-4l-1.25-18h19l-1.25 18h-16.5z" />
      <path d="M9 17h27v-5H9v5zm3-5h4V9h5v3h5V9h5v3h5V9h4v3z" />
    </g>
  </svg>
);

export const BQ: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <g
      fill="#5b5b5b"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M8 12a2 2 0 1 1-4 0 2 2 0 0 1 4 0zm34 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0zM22.5 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM12 14.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0zm26 0a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0z" />
      <path d="M9 37h27v-3H9v3zm3-3h21L36.5 18h-28L12 34zm-3-16h27L38.5 9.5 27 21l-4.5-16.5L18 21 6.5 9.5 9 18z" />
    </g>
  </svg>
);

export const BK: React.FC<SVGProps> = (props) => (
  <svg viewBox="0 0 45 45" className={props.className} {...props}>
    <g
      fill="none"
      stroke="#000"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22.5 11.63V6M20 8h5" />
      <path
        d="M22.5 25c4.42 0 8-3.58 8-8 0-4.42-3.58-8-8-8s-8 3.58-8 8c0 4.42 3.58 8 8 8z"
        fill="#5b5b5b"
      />
      <path d="M11.5 30c2.42-1.32 5.58-2 11-2s8.58.68 11 2" />
      <path d="M12 36h21v-3H12v3zm0-3h21v-3H12v3z" fill="#5b5b5b" />
    </g>
  </svg>
);

export const renderPieceSVG = (color: 'w' | 'b', type: string, className?: string) => {
  const pieceKey = `${color}${type.toLowerCase()}`;
  switch (pieceKey) {
    case 'wp': return <WP className={className} />;
    case 'wn': return <WN className={className} />;
    case 'wb': return <WB className={className} />;
    case 'wr': return <WR className={className} />;
    case 'wq': return <WQ className={className} />;
    case 'wk': return <WK className={className} />;
    case 'bp': return <BP className={className} />;
    case 'bn': return <BN className={className} />;
    case 'bb': return <BB className={className} />;
    case 'br': return <BR className={className} />;
    case 'bq': return <BQ className={className} />;
    case 'bk': return <BK className={className} />;
    default: return null;
  }
};
