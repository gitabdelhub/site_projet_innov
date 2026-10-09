import React from 'react';

// One consistent set of line icons (24px grid, round caps), drawn for Chess Hub.
// They inherit the text color, so `className="text-accent w-5 h-5"` is all it takes.
const PATHS = {
  home: 'M4 11.5 12 5l8 6.5M6.5 9.8V19h4.25v-5h2.5v5h4.25V9.8',
  board: 'M4 4h16v16H4zM4 12h16M12 4v16M8 4v4H4M16 8h4M12 12h4v4h-4M8 16v4',
  book: 'M12 6.5C10.4 5.2 8 4.6 4 4.8v13.4c4-.2 6.4.4 8 1.7 1.6-1.3 4-1.9 8-1.7V4.8c-4-.2-6.4.4-8 1.7zM12 6.5v13.4',
  target: 'M12 3a9 9 0 1 0 9 9M12 7.5a4.5 4.5 0 1 0 4.5 4.5M12 12l7-7M15.5 5H19v3.5',
  puzzle: 'M5 9h3a2 2 0 1 1 4 0h3v3a2 2 0 1 1 0 4v3h-3a2 2 0 1 0-4 0H5v-3a2 2 0 1 0 0-4z',
  chart: 'M4 19h16M6 16l4-5 3.5 3L19 7M15 7h4v4',
  trophy: 'M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 3.5M16 6h3a3 3 0 0 1-3 3.5M12 13v3.5M8.5 20h7M10 16.5h4l.5 3.5h-5z',
  users: 'M9 11a3.25 3.25 0 1 0 0-6.5A3.25 3.25 0 0 0 9 11zM3.5 19.5c.6-3.2 2.8-5 5.5-5s4.9 1.8 5.5 5M15.5 10.5a2.75 2.75 0 1 0 0-5.5M17 14.6c2 .5 3.2 2.1 3.5 4.9',
  user: 'M12 11.5a3.75 3.75 0 1 0 0-7.5 3.75 3.75 0 0 0 0 7.5zM5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.5 9h17M3.5 15h17M12 3c2.4 2.5 3.5 5.5 3.5 9s-1.1 6.5-3.5 9c-2.4-2.5-3.5-5.5-3.5-9S9.6 5.5 12 3z',
  swords: 'M5 4l9 9M4 5l1-1 3.5.5L18 14M14 13l-1 3 1.5 1.5 3-3L19 16M13 6.5 19 4.5l-1.5 6M9.5 14.5 6 18M5 15.5 8.5 19',
  clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 7.5V12l3 2',
  flag: 'M6 20V4.5M6 5c3-1.6 5.5 1.6 8.5 0S18.5 4 18.5 4v8.5s-1 1.4-4 1.4S9 12.4 6 13.9',
  undo: 'M9 7 5 11l4 4M5.5 11H14a5 5 0 0 1 0 10h-2',
  refresh: 'M19.5 12a7.5 7.5 0 1 1-2.2-5.3M19.5 4.5v4h-4',
  eye: 'M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12zM12 14.75a2.75 2.75 0 1 0 0-5.5 2.75 2.75 0 0 0 0 5.5z',
  bulb: 'M9.5 17.5h5M10 20.5h4M12 3.5a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.4 1.1 2.2v1h5v-1c0-.8.4-1.6 1.1-2.2A6 6 0 0 0 12 3.5z',
  check: 'M5 12.5 10 17.5 19 7',
  close: 'M6 6l12 12M18 6 6 18',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  arrowLeft: 'M19 12H5M11 6l-6 6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  menu: 'M4 7h16M4 12h16M4 17h16',
  flame: 'M12 21c3.9 0 6.5-2.6 6.5-6.3 0-3.4-2.3-5.6-3.9-7.7-.4 2-1.5 3.2-2.8 3.6.2-2.7-.9-5.4-3.4-7.1.2 3-1.7 4.8-3.2 6.8A7.2 7.2 0 0 0 5.5 14.7C5.5 18.4 8.1 21 12 21z',
  message: 'M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8.5A1.5 1.5 0 0 1 19 17h-8l-4.5 3.5V17H5a1.5 1.5 0 0 1-1.5-1.5V7A1.5 1.5 0 0 1 5 5.5z',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1.2 1.2M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1.2-1.2',
  logout: 'M14.5 4.5H18A1.5 1.5 0 0 1 19.5 6v12a1.5 1.5 0 0 1-1.5 1.5h-3.5M10 8l-4 4 4 4M6 12h9',
  play: 'M8 5.5v13l10-6.5z',
  pause: 'M8 5.5v13M16 5.5v13',
  skipBack: 'M6 5.5v13M18 5.5l-9 6.5 9 6.5z',
  skipForward: 'M18 5.5v13M6 5.5l9 6.5-9 6.5z',
  stepBack: 'M15 6l-6 6 6 6',
  stepForward: 'M9 6l6 6-6 6',
  download: 'M12 4v11M7 10.5l5 5 5-5M5 19.5h14',
  sparkle: 'M12 4v4M12 16v4M4 12h4M16 12h4M6.5 6.5l2.3 2.3M15.2 15.2l2.3 2.3M6.5 17.5l2.3-2.3M15.2 8.8l2.3-2.3',
  shield: 'M12 3.5 19 6v5.5c0 4.5-3 7.8-7 9-4-1.2-7-4.5-7-9V6z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  layers: 'M12 4 3.5 8.5 12 13l8.5-4.5zM3.5 12.5 12 17l8.5-4.5M3.5 16.5 12 21l8.5-4.5',
  crown: 'M4.5 17.5h15M5 17.5 4 7.5l4.5 4L12 5l3.5 6.5 4.5-4-1 10',
  send: 'M20.5 3.5 10 14M20.5 3.5 14 20.5l-4-6.5-6.5-4z',
  copy: 'M9 9h10.5v11.5H9zM15 9V4.5H4.5V15H9',
  star: 'M12 3.8l2.5 5.1 5.6.8-4 4 .9 5.6-5-2.7-5 2.7.9-5.6-4-4 5.6-.8z',
  lock: 'M6.5 11h11v9h-11zM8.5 11V8a3.5 3.5 0 0 1 7 0v3',
  graduation: 'M2.5 9.5 12 5l9.5 4.5L12 14zM6.5 11.5v4.5c3.2 2.3 7.8 2.3 11 0v-4.5M21.5 9.5v5',
} as const;

export type IconName = keyof typeof PATHS;

interface IconProps extends React.SVGProps<SVGSVGElement> {
  name: IconName;
  // Accessible label; without it the icon is decorative
  label?: string;
}

export const Icon: React.FC<IconProps> = ({ name, label, className = 'w-5 h-5', strokeWidth = 1.75, ...rest }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    role={label ? 'img' : undefined}
    aria-label={label}
    aria-hidden={label ? undefined : true}
    {...rest}
  >
    <path d={PATHS[name]} />
  </svg>
);
