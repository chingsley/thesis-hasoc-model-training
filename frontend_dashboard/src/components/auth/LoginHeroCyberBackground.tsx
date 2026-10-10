/**
 * Decorative animated backdrop for the login hero.
 *
 * The centrepiece is a cybersecurity emblem: a faint shield and padlock in the
 * background, with a scanner beam that briefly brightens the lock where it passes.
 */
export function LoginHeroCyberBackground() {
  const shieldPath =
    'M480 152 L648 208 L648 366 C648 466 572 548 480 596 C388 548 312 466 312 366 L312 208 Z';

  const scanBand = { x: 300, y: 88, width: 360, height: 76 };

  const traces = [
    'M312 296 L206 250 L92 250',
    'M648 296 L754 250 L868 250',
    'M420 580 L330 656 L196 656',
  ];

  const nodes: [number, number][] = [
    [92, 250],
    [206, 250],
    [868, 250],
    [754, 250],
    [196, 656],
    [330, 656],
  ];

  const renderPadlock = (variant: 'base' | 'lit') => {
    const faint = variant === 'base';
    const strokeOpacity = faint ? 0.28 : 0.92;
    const bodyFill = faint ? 0.04 : 0.14;
    const keyholeOpacity = faint ? 0.22 : 0.75;

    return (
      <>
        <path
          d="M442 366 V322 A38 38 0 0 1 518 322 V366"
          stroke="currentColor"
          strokeWidth={faint ? 12 : 14}
          strokeLinecap="round"
          strokeOpacity={strokeOpacity}
          fill="none"
        />
        <rect
          x="412"
          y="366"
          width="136"
          height="104"
          rx="16"
          fill="currentColor"
          fillOpacity={bodyFill}
          stroke="currentColor"
          strokeWidth={faint ? 2 : 3}
          strokeOpacity={strokeOpacity}
        />
        <g fill="currentColor" opacity={keyholeOpacity}>
          <circle cx="480" cy="406" r="12" />
          <path
            d="M480 414 L480 442"
            stroke="currentColor"
            strokeWidth="13"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      </>
    );
  };

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden
    >
      <svg
        className="login-hero-cyber-svg absolute inset-0 h-full w-full text-white"
        viewBox="0 0 960 720"
        preserveAspectRatio="xMidYMid slice"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <pattern
            id="login-hero-hex"
            width="56"
            height="48"
            patternUnits="userSpaceOnUse"
            patternTransform="scale(1.15) rotate(12)"
          >
            <path
              d="M28 2 L52 14 L52 34 L28 46 L4 34 L4 14 Z"
              stroke="currentColor"
              strokeWidth="0.75"
              opacity="0.3"
            />
          </pattern>

          <radialGradient id="login-hero-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="55%" stopColor="currentColor" stopOpacity="0.08" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="login-hero-scan" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0" />
            <stop offset="50%" stopColor="currentColor" stopOpacity="0.9" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>

          <clipPath id="login-hero-shield-clip">
            <path d={shieldPath} />
          </clipPath>

          {/* Moving band — shared by the scan beam and lock highlight */}
          <clipPath id="login-hero-scan-band-clip" clipPathUnits="userSpaceOnUse">
            <rect
              className="login-hero-cyber-scan"
              x={scanBand.x}
              y={scanBand.y}
              width={scanBand.width}
              height={scanBand.height}
            />
          </clipPath>
        </defs>

        <rect width="960" height="720" fill="url(#login-hero-hex)" opacity="0.5" />

        <circle cx="480" cy="374" r="330" fill="url(#login-hero-glow)" />

        <g opacity="0.3" stroke="currentColor" strokeWidth="1.25">
          {traces.map((d, i) => (
            <path
              key={d}
              className={
                i === 1
                  ? 'login-hero-cyber-flow login-hero-cyber-flow-reverse'
                  : 'login-hero-cyber-flow'
              }
              d={d}
              strokeDasharray="6 10"
            />
          ))}
        </g>

        <g fill="currentColor">
          {nodes.map(([cx, cy], i) => (
            <circle
              key={`${cx}-${cy}`}
              cx={cx}
              cy={cy}
              r={i % 2 === 0 ? 4 : 3}
              className="login-hero-cyber-node"
              style={{ animationDelay: `${i * 0.4}s` }}
              opacity={0.45}
            />
          ))}
        </g>

        <g opacity="0.24" stroke="currentColor" strokeWidth="1">
          <circle
            cx="480"
            cy="374"
            r="252"
            strokeDasharray="3 16"
            className="login-hero-cyber-orbit"
          />
          <circle cx="480" cy="374" r="230" className="login-hero-cyber-ring" />
          <circle
            cx="480"
            cy="374"
            r="276"
            className="login-hero-cyber-ring login-hero-cyber-ring-delay"
          />
        </g>

        <g className="login-hero-cyber-orbit-dots" opacity="0.5" fill="currentColor">
          <circle cx="732" cy="374" r="5" />
          <circle cx="354" cy="155" r="4" />
          <circle cx="354" cy="593" r="4" />
        </g>

        {/* Faint shield + padlock (stays in the background behind copy) */}
        <g className="login-hero-cyber-emblem-faint">
          <path
            d={shieldPath}
            fill="currentColor"
            fillOpacity="0.02"
            stroke="currentColor"
            strokeWidth="2"
            strokeOpacity="0.26"
            strokeLinejoin="round"
          />
          {renderPadlock('base')}
        </g>

        {/* Scanner beam — brightness unchanged */}
        <g clipPath="url(#login-hero-shield-clip)">
          <rect
            className="login-hero-cyber-scan"
            x={scanBand.x}
            y={scanBand.y}
            width={scanBand.width}
            height={scanBand.height}
            fill="url(#login-hero-scan)"
            opacity="0.65"
          />
        </g>

        {/* Padlock briefly brightens only where the scan band overlaps */}
        <g clipPath="url(#login-hero-scan-band-clip)" className="login-hero-cyber-lock-lit">
          {renderPadlock('lit')}
        </g>
      </svg>
    </div>
  );
}
