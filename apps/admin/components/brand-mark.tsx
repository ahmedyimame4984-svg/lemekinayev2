import Link from 'next/link';

export function BrandMark({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link
      className={`brand-mark${inverse ? ' brand-mark--inverse' : ''}`}
      href="/"
    >
      <span className="brand-mark__symbol" aria-hidden="true">
        <svg viewBox="0 0 42 42" role="img">
          <path d="M8 6h9v22h17v8H8V6Z" fill="currentColor" />
          <path d="m22 6 12 12-6 6L16 12l6-6Z" fill="var(--brand-red)" />
        </svg>
      </span>
      <span className="brand-mark__text">
        <strong>LEMEKINAYE</strong>
        <small>ADMINISTRATION</small>
      </span>
    </Link>
  );
}
