const avatarSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160">
  <defs>
    <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#101632"/>
      <stop offset="100%" stop-color="#0a3a2f"/>
    </linearGradient>
  </defs>
  <rect width="160" height="160" rx="36" fill="url(#bg)"/>
  <circle cx="80" cy="66" r="34" fill="#1edc9a" opacity="0.85"/>
  <path d="M40 132c8-28 32-36 40-36s32 8 40 36" fill="#0a1c2f" opacity="0.8"/>
</svg>
`;

export const DEFAULT_AVATAR = `data:image/svg+xml,${encodeURIComponent(avatarSvg)}`;

