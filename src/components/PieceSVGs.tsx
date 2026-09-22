import React from 'react';

// Standard "cburnett" chess pieces by Colin M.L. Burnett (CC BY-SA 3.0),
// the set used by Wikipedia and Lichess.

interface SVGProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

const base = {
  fill: 'none',
  fillRule: 'evenodd' as const,
  stroke: '#000',
  strokeWidth: 1.5,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const Svg: React.FC<SVGProps & { children: React.ReactNode }> = ({ className, children }) => (
  <svg viewBox="0 0 45 45" className={className} xmlns="http://www.w3.org/2000/svg">
    {children}
  </svg>
);

const PAWN = 'm 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z';

export const WP: React.FC<SVGProps> = ({ className }) => (
  <Svg className={className}>
    <path d={PAWN} fill="#fff" stroke="#000" strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

export const BP: React.FC<SVGProps> = ({ className }) => (
  <Svg className={className}>
    <path d={PAWN} fill="#000" stroke="#000" strokeWidth={1.5} strokeLinecap="round" />
  </Svg>
);

const KNIGHT_BODY = 'M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18';
const KNIGHT_HEAD = 'M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10';
const KNIGHT_EYE = 'M 9.5 25.5 A 0.5 0.5 0 1 1 8.5,25.5 A 0.5 0.5 0 1 1 9.5 25.5 z';
const KNIGHT_NOSTRIL = 'M 15 15.5 A 0.5 1.5 0 1 1 14,15.5 A 0.5 1.5 0 1 1 15 15.5 z';
const NOSTRIL_TRANSFORM = 'matrix(0.866,0.5,-0.5,0.866,9.693,-5.173)';

export const WN: React.FC<SVGProps> = ({ className }) => (
  <Svg className={className}>
    <g {...base}>
      <path d={KNIGHT_BODY} fill="#fff" />
      <path d={KNIGHT_HEAD} fill="#fff" />
      <path d={KNIGHT_EYE} fill="#000" />
      <path d={KNIGHT_NOSTRIL} transform={NOSTRIL_TRANSFORM} fill="#000" />
    </g>
  </Svg>
);

export const BN: React.FC<SVGProps> = ({ className }) => (
  <Svg className={className}>
    <g {...base}>
      <path d={KNIGHT_BODY} fill="#000" />
      <path d={KNIGHT_HEAD} fill="#000" />
      <path d={KNIGHT_EYE} fill="#ececec" stroke="#ececec" />
      <path d={KNIGHT_NOSTRIL} transform={NOSTRIL_TRANSFORM} fill="#ececec" stroke="#ececec" />
      <path
        d="M 24.55,10.4 L 24.1,11.85 L 24.6,12 C 27.75,13 30.25,14.49 32.5,18.75 C 34.75,23.01 35.75,29.06 35.25,39 L 35.2,39.5 L 37.45,39.5 L 37.5,39 C 38,28.94 36.62,22.15 34.25,17.66 C 31.88,13.17 28.46,11.02 25.06,10.5 L 24.55,10.4 z"
        fill="#ececec"
        stroke="none"
      />
    </g>
  </Svg>
);

const BISHOP_BASE = 'M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z';
const BISHOP_BODY = 'M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z';
const BISHOP_TOP = 'M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z';
const BISHOP_DETAILS = 'M 17.5,26 L 27.5,26 M 15,30 L 30,30 M 22.5,15.5 L 22.5,20.5 M 20,18 L 25,18';

const Bishop: React.FC<{ className?: string; fill: string; detail: string }> = ({ className, fill, detail }) => (
  <Svg className={className}>
    <g {...base}>
      <g fill={fill} strokeLinecap="butt">
        <path d={BISHOP_BASE} />
        <path d={BISHOP_BODY} />
        <path d={BISHOP_TOP} />
      </g>
      <path d={BISHOP_DETAILS} fill="none" stroke={detail} strokeLinejoin="miter" />
    </g>
  </Svg>
);

export const WB: React.FC<SVGProps> = ({ className }) => <Bishop className={className} fill="#fff" detail="#000" />;
export const BB: React.FC<SVGProps> = ({ className }) => <Bishop className={className} fill="#000" detail="#fff" />;

export const WR: React.FC<SVGProps> = ({ className }) => (
  <Svg className={className}>
    <g {...base} fill="#fff">
      <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" strokeLinecap="butt" />
      <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" strokeLinecap="butt" />
      <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14" strokeLinecap="butt" />
      <path d="M 34,14 L 31,17 L 14,17 L 11,14" />
      <path d="M 31,17 L 31,29.5 L 14,29.5 L 14,17" strokeLinecap="butt" strokeLinejoin="miter" />
      <path d="M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5" />
      <path d="M 11,14 L 34,14" fill="none" strokeLinejoin="miter" />
    </g>
  </Svg>
);

export const BR: React.FC<SVGProps> = ({ className }) => (
  <Svg className={className}>
    <g {...base} fill="#000">
      <path d="M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z" strokeLinecap="butt" />
      <path d="M 12.5,32 L 14,29.5 L 31,29.5 L 32.5,32 L 12.5,32 z" strokeLinecap="butt" />
      <path d="M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z" strokeLinecap="butt" />
      <path d="M 14,29.5 L 14,16.5 L 31,16.5 L 31,29.5 L 14,29.5 z" strokeLinecap="butt" strokeLinejoin="miter" />
      <path d="M 14,16.5 L 11,14 L 34,14 L 31,16.5 L 14,16.5 z" strokeLinecap="butt" />
      <path d="M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 L 11,14 z" strokeLinecap="butt" />
      <path d="M 12,35.5 L 33,35.5 M 13,31.5 L 32,31.5 M 14,29.5 L 31,29.5 M 14,16.5 L 31,16.5 M 11,14 L 34,14" fill="none" stroke="#fff" strokeWidth={1} strokeLinejoin="miter" />
    </g>
  </Svg>
);

const QUEEN_CROWN = 'M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z';
const QUEEN_BASE = 'M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z';
const QUEEN_BALLS = [[6, 12], [14, 9], [22.5, 8], [31, 9], [39, 12]];

const Queen: React.FC<{ className?: string; fill: string; detail: string }> = ({ className, fill, detail }) => (
  <Svg className={className}>
    <g {...base} fill={fill}>
      {QUEEN_BALLS.map(([cx, cy]) => <circle key={cx} cx={cx} cy={cy} r={2} />)}
      <path d={QUEEN_CROWN} strokeLinecap="butt" />
      <path d={QUEEN_BASE} strokeLinecap="butt" />
      <path d="M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5 M 11,38.5 C 17.5,37.5 27.5,37.5 34,38.5" fill="none" stroke={detail} />
    </g>
  </Svg>
);

export const WQ: React.FC<SVGProps> = ({ className }) => <Queen className={className} fill="#fff" detail="#000" />;
export const BQ: React.FC<SVGProps> = ({ className }) => <Queen className={className} fill="#000" detail="#ececec" />;

const KING_HEAD = 'M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25';
const KING_BODY = 'M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37';
const KING_BANDS = 'M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37';

export const WK: React.FC<SVGProps> = ({ className }) => (
  <Svg className={className}>
    <g {...base}>
      <path d="M 22.5,11.63 L 22.5,6 M 20,8 L 25,8" strokeLinejoin="miter" />
      <path d={KING_HEAD} fill="#fff" strokeLinecap="butt" strokeLinejoin="miter" />
      <path d={KING_BODY} fill="#fff" />
      <path d={KING_BANDS} />
    </g>
  </Svg>
);

export const BK: React.FC<SVGProps> = ({ className }) => (
  <Svg className={className}>
    <g {...base}>
      <path d="M 22.5,11.63 L 22.5,6 M 20,8 L 25,8" strokeLinejoin="miter" />
      <path d={KING_HEAD} fill="#000" strokeLinecap="butt" strokeLinejoin="miter" />
      <path d={KING_BODY} fill="#000" />
      <path d="M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5" stroke="#fff" />
      <path d={KING_BANDS} stroke="#fff" />
    </g>
  </Svg>
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
