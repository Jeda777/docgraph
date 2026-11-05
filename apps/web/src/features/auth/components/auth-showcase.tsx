/**
 * Brand panel of the logged-out pages: a small diagram built from the four item types
 * (database table, document, process, decision), drawn as plain geometry.
 */
export const AuthShowcase = () => (
  <aside
    aria-hidden='true'
    className='relative hidden overflow-hidden bg-[oklch(0.3_0.055_168)] text-[oklch(0.97_0.02_165)] lg:flex lg:flex-col lg:justify-between lg:p-12'
  >
    {/* Dot grid: the canvas the editors draw on. */}
    <div className='absolute inset-0 bg-[radial-gradient(oklch(1_0_0/12%)_1px,transparent_1px)] bg-size-[22px_22px] mask-[radial-gradient(ellipse_at_60%_45%,black_30%,transparent_75%)]' />

    <svg
      aria-hidden='true'
      viewBox='0 0 480 400'
      className='relative mx-auto mt-6 w-full max-w-xl'
      fill='none'
      xmlns='http://www.w3.org/2000/svg'
    >
      <g
        className='auth-edges'
        stroke='oklch(0.86 0.12 162)'
        strokeWidth='1.5'
        strokeLinecap='round'
      >
        <path d='M200 110 C 240 110, 240 82, 280 82' />
        <path d='M120 192 C 120 230, 150 236, 150 278' />
        <path d='M220 306 C 255 306, 262 290, 296 290' />
        <path d='M355 140 C 355 190, 335 205, 335 252' />
      </g>
      <g fill='oklch(0.86 0.12 162)'>
        <circle cx='200' cy='110' r='3.5' />
        <circle cx='280' cy='82' r='3.5' />
        <circle cx='120' cy='192' r='3.5' />
        <circle cx='150' cy='278' r='3.5' />
        <circle cx='220' cy='306' r='3.5' />
        <circle cx='296' cy='290' r='3.5' />
        <circle cx='355' cy='140' r='3.5' />
        <circle cx='335' cy='252' r='3.5' />
      </g>

      {/* Database table */}
      <g>
        <rect x='40' y='56' width='160' height='136' rx='10' fill='oklch(0.99 0.005 165)' />
        <path
          d='M40 66a10 10 0 0 1 10-10h140a10 10 0 0 1 10 10v20H40z'
          fill='oklch(0.6 0.13 163)'
        />
        <rect x='54' y='67' width='56' height='8' rx='4' fill='oklch(0.97 0.03 165)' />
        {[100, 122, 144, 166].map((y, index) => (
          <g key={y}>
            <rect
              x='54'
              y={y}
              width={[64, 52, 72, 44][index]}
              height='7'
              rx='3.5'
              fill='oklch(0.82 0.02 170)'
            />
            <rect x='150' y={y} width='36' height='7' rx='3.5' fill='oklch(0.9 0.015 170)' />
          </g>
        ))}
      </g>

      {/* Document */}
      <g>
        <rect x='280' y='24' width='150' height='116' rx='10' fill='oklch(0.99 0.005 165)' />
        <rect x='296' y='42' width='84' height='10' rx='5' fill='oklch(0.55 0.15 250)' />
        {[64, 80, 96, 112].map((y, index) => (
          <rect
            key={y}
            x='296'
            y={y}
            width={[118, 104, 112, 70][index]}
            height='6'
            rx='3'
            fill='oklch(0.86 0.015 170)'
          />
        ))}
      </g>

      {/* Process step */}
      <g>
        <rect x='80' y='278' width='140' height='56' rx='12' fill='oklch(0.99 0.005 165)' />
        <rect x='98' y='302' width='70' height='8' rx='4' fill='oklch(0.6 0.14 60)' />
      </g>

      {/* Decision */}
      <g>
        <rect
          x='296'
          y='252'
          width='76'
          height='76'
          rx='10'
          transform='rotate(45 334 290)'
          fill='oklch(0.99 0.005 165)'
        />
        <rect x='314' y='286' width='40' height='8' rx='4' fill='oklch(0.52 0.17 295)' />
      </g>
    </svg>

    <div className='relative flex max-w-md flex-col gap-3'>
      <p className='text-3xl leading-tight font-semibold tracking-tight text-balance'>
        Your system, mapped in one place.
      </p>
      <p className='text-[0.9375rem] leading-relaxed text-[oklch(0.86_0.04_165)]'>
        Database diagrams, flowcharts, business processes and documents, edited together in real
        time.
      </p>
    </div>
  </aside>
)
