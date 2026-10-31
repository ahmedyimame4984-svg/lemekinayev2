import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const stylesheet = readFileSync(
  new URL('../app/globals.css', import.meta.url),
  'utf8',
);
const readableDensityStylesheet = readFileSync(
  new URL('../app/admin-readable-density.css', import.meta.url),
  'utf8',
);

const floorMarker = '/* Admin Pro correction #16: readable density floor';
const operationalPattern =
  /(table|row|library|pagination|status|badge|hint|meta|criteria|seller|supplier|vehicle|attribute|product|import|fitment|classification|workspace|navigator|mapping|readiness|schema|assignment|allowed-value|account|audit|combobox|toolbar|filter|action|catalog|sourcing|manufacturer|article|branded-part|external)/iu;
const decorativePattern =
  /(brand-mark|sidebar__identity|nav-item--disabled|welcome-panel__badge|topbar__eyebrow|signal-card|module-card)/iu;

describe('Admin readable-density floor', () => {
  it('keeps every operational micro-type declaration covered by the readability floor', () => {
    expect(readableDensityStylesheet).toContain(floorMarker);

    const covered = selectorsWithFontSize(readableDensityStylesheet);

    const uncovered = declarationsWithFontSize(stylesheet)
      .filter(({ size }) => size < 0.65)
      .flatMap(({ selectors, size }) =>
        selectors.map((selector) => ({ selector, size })),
      )
      .filter(
        ({ selector }) =>
          operationalPattern.test(selector) &&
          !decorativePattern.test(selector) &&
          !covered.has(selector),
      );

    expect(uncovered).toEqual([]);
  });

  it('does not define an operational readability override below 0.65rem', () => {
    expect(readableDensityStylesheet).toContain(floorMarker);

    const belowFloor = declarationsWithFontSize(readableDensityStylesheet)
      .filter(({ size }) => size < 0.65)
      .flatMap(({ selectors, size }) =>
        selectors.map((selector) => ({ selector, size })),
      )
      .filter(({ selector }) => operationalPattern.test(selector));

    expect(belowFloor).toEqual([]);
  });
});

function selectorsWithFontSize(css: string): Set<string> {
  return new Set(
    declarationsWithFontSize(css).flatMap(({ selectors }) => selectors),
  );
}

function declarationsWithFontSize(css: string): Array<{
  selectors: string[];
  size: number;
}> {
  return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/gu)].flatMap((match) => {
    const sizeMatch = match[2]?.match(/font-size:\s*([0-9.]+)rem/iu);
    if (!sizeMatch) return [];

    const selectors = (match[1] ?? '')
      .split(',')
      .map((selector) =>
        selector
          .replace(/\/\*[\s\S]*?\*\//gu, '')
          .trim()
          .replace(/\s+/gu, ' '),
      )
      .filter(Boolean);

    return [
      {
        selectors,
        size: Number(sizeMatch[1]),
      },
    ];
  });
}
