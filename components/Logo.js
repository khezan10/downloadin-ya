'use client'

/**
 * The Downloadin Ya logo.
 *
 * The mark and the wordmark are real SVG files in /public, so they render
 * pixel-crisp at any size and need no webfont. They are plain <img> tags
 * rather than inline SVG because the wordmark is ~120 rects — inlining it
 * would bloat the client bundle for no visual gain.
 */
export default function Logo({ size = 40, showWordmark = true, className = '' }) {
  return (
    <span className={`logo ${className}`.trim()}>
      <img
        src="/logo-mark.svg"
        width={size}
        height={size}
        alt=""
        className="logo-mark"
        aria-hidden="true"
      />
      {showWordmark && (
        <img
          src="/logo-wordmark.svg"
          height={Math.round(size * 0.5)}
          alt="Downloadin Ya"
          className="logo-wordmark"
        />
      )}
    </span>
  )
}
