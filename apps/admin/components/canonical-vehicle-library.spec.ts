// @vitest-environment jsdom
import { createElement } from 'react';
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CanonicalVehicleLibrary } from './canonical-vehicle-library';
import { CanonicalVehicleMakesModels } from './canonical-vehicle-makes-models';

vi.mock('./admin-session', () => ({
  useAdminPrincipal: () => ({ permissions: ['vehicle.manage'] }),
}));
const stamp = '2026-11-03T00:00:00Z';
const make = {
  id: 'toyota',
  name: 'Toyota',
  code: 'TOYOTA',
  status: 'ACTIVE',
  version: 1,
  createdAt: stamp,
  updatedAt: stamp,
};
const model = {
  ...make,
  id: 'corolla',
  makeId: make.id,
  name: 'Corolla',
  code: 'COROLLA',
};
const vehicle = {
  id: 'vehicle-1',
  identityCode: 'VC-1',
  code: 'COROLLA-GLI',
  make,
  model,
  derivative: null,
  generation: {
    id: 'e140',
    name: 'E140',
    code: 'E140',
    startYear: 2006,
    endYear: 2013,
    endStatus: 'ENDED',
  },
  trim: {
    id: 'gli',
    name: 'GLI',
    code: 'GLI',
    startYear: 2006,
    endYear: 2013,
    equipmentLevel: 'GLI',
  },
  engine: {
    id: 'engine',
    name: '1.8L',
    code: '2ZR',
    family: 'ZR',
    displacementCc: 1798,
    fuelType: 'PETROL',
    cylinderCount: 4,
    aspiration: null,
    powerKw: 100,
    torqueNm: 175,
  },
  transmission: {
    id: 'auto',
    code: 'AT',
    transmissionType: 'AUTOMATIC',
    gearCount: 4,
    driveType: 'FWD',
  },
  bodyType: { id: 'sedan', code: 'SEDAN', name: 'Sedan' },
  market: { id: 'gcc', code: 'GCC', name: 'GCC' },
  modelYear: 2010,
  productionStartYear: 2006,
  productionStartMonth: null,
  productionEndYear: 2013,
  productionEndMonth: null,
  productionEndStatus: 'ENDED',
  steeringSide: 'LHD',
  status: 'DRAFT',
  version: 1,
  createdAt: stamp,
  updatedAt: stamp,
};
const fetchMock = vi.fn();
let failLibrary = false;
let emptyLibrary = false;
let savedViews: unknown[] = [];
const page = (items: unknown[], query: URLSearchParams) => ({
  items,
  total: 51,
  page: Number(query.get('page') ?? 1),
  pageSize: Number(query.get('pageSize') ?? 25),
  pageCount: 3,
});
beforeEach(() => {
  failLibrary = false;
  emptyLibrary = false;
  savedViews = [];
  fetchMock
    .mockReset()
    .mockImplementation(async (input: string, init?: RequestInit) => {
      const url = new URL(input, 'http://localhost');
      if (url.pathname === '/api/admin/vehicles/configuration-library') {
        return {
          ok: !failLibrary,
          json: async () =>
            emptyLibrary
              ? { ...page([], url.searchParams), total: 0, pageCount: 0 }
              : page([vehicle], url.searchParams),
        };
      }
      if (url.pathname.includes('saved-views'))
        return {
          ok: true,
          json: async () =>
            init?.method === 'POST'
              ? {
                  id: 'saved',
                  ...JSON.parse(
                    typeof init.body === 'string' ? init.body : '{}',
                  ),
                }
              : savedViews,
        };
      if (url.pathname.endsWith('/summary'))
        return {
          ok: true,
          json: async () => ({
            totalMakes: 1,
            totalModels: 1,
            modelCountsByMake: { toyota: 1 },
          }),
        };
      if (url.pathname.endsWith('/makes/page'))
        return { ok: true, json: async () => page([make], url.searchParams) };
      if (url.pathname.endsWith('/models/page'))
        return { ok: true, json: async () => page([model], url.searchParams) };
      if (url.pathname.endsWith('/makes'))
        return { ok: true, json: async () => [make] };
      if (url.pathname.endsWith('/models'))
        return { ok: true, json: async () => [model] };
      throw new Error(`Unexpected request ${input}`);
    });
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
function libraryQueries() {
  return fetchMock.mock.calls
    .filter(([url]) => String(url).includes('/configuration-library?'))
    .map(([url]) => new URL(String(url), 'http://localhost').searchParams);
}
function expectNoCanonicalWrites() {
  for (const [url, options] of fetchMock.mock.calls) {
    if (String(url).includes('/vehicles/'))
      expect(options?.method ?? 'GET').toBe('GET');
  }
  expect(
    screen.queryByRole('button', {
      name: /add make|add model|save configured|validate|activate|^edit$/i,
    }),
  ).toBeNull();
}
describe('synchronized vehicle browsing', () => {
  it('retains the hierarchy and technical presentation without canonical operations', async () => {
    const { container } = render(createElement(CanonicalVehicleLibrary));
    await screen.findByText('COROLLA-GLI');
    expect(
      container.querySelector('.configured-vehicle-library__make-heading')
        ?.textContent,
    ).toContain('Toyota');
    expect(
      container.querySelector('.configured-vehicle-library__model-heading')
        ?.textContent,
    ).toContain('Corolla');
    expect(
      container.querySelector('.configured-vehicle-library__generation-heading')
        ?.textContent,
    ).toContain('E140');
    expect(
      container.querySelector('.configured-vehicle-library__trim-heading')
        ?.textContent,
    ).toContain('GLI');
    expect(screen.getByText(/Engine:.*1798 cc/).textContent).toContain(
      'Market: GCC',
    );
    expect(
      screen.getByRole('navigation', { name: 'Vehicle administration' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Export CSV' })).toBeTruthy();
    expectNoCanonicalWrites();
  });

  it('preserves deep links, search, sorting, pagination and clearing filters', async () => {
    render(
      createElement(CanonicalVehicleLibrary, {
        initialConfigurationId: 'vehicle-1',
        initialModelId: model.id,
      }),
    );
    await screen.findByText('COROLLA-GLI');
    await waitFor(() =>
      expect(libraryQueries().at(-1)?.get('makeId')).toBe(make.id),
    );
    expect(libraryQueries().at(-1)?.get('configurationId')).toBe('vehicle-1');
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Corolla' },
    });
    await waitFor(() =>
      expect(libraryQueries().at(-1)?.get('search')).toBe('Corolla'),
    );
    expect(libraryQueries().at(-1)?.has('configurationId')).toBe(false);
    fireEvent.change(screen.getByLabelText('Sort by'), {
      target: { value: 'CODE' },
    });
    await waitFor(() =>
      expect(libraryQueries().at(-1)?.get('sortBy')).toBe('CODE'),
    );
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(libraryQueries().at(-1)?.get('page')).toBe('2'));
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
    await waitFor(() =>
      expect(libraryQueries().at(-1)?.has('modelId')).toBe(false),
    );
    expect(libraryQueries().at(-1)?.get('page')).toBe('1');
    expectNoCanonicalWrites();
  });

  it('recovers from read errors and shows an empty state', async () => {
    failLibrary = true;
    render(createElement(CanonicalVehicleLibrary));
    await screen.findByText(/Configured Vehicle library could not be loaded/);
    failLibrary = false;
    emptyLibrary = true;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    await screen.findByText(
      'No configured vehicles match the current search and filters.',
    );
    expect(screen.queryByText('COROLLA-GLI')).toBeNull();
    expectNoCanonicalWrites();
  });

  it('keeps saved views as local preferences and clears configuration deep links on selection', async () => {
    savedViews = [
      {
        id: 'view-1',
        name: 'Active vehicles',
        state: { status: 'ACTIVE', sortBy: 'CODE' },
      },
    ];
    render(
      createElement(CanonicalVehicleLibrary, {
        initialConfigurationId: 'vehicle-1',
      }),
    );
    await screen.findByText('COROLLA-GLI');
    fireEvent.change(screen.getByLabelText('Saved view'), {
      target: { value: 'view-1' },
    });
    await waitFor(() =>
      expect(libraryQueries().at(-1)?.get('status')).toBe('ACTIVE'),
    );
    expect(libraryQueries().at(-1)?.has('configurationId')).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: 'Save as new' }));
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          ([url, options]) =>
            url === '/api/admin/preferences/saved-views' &&
            options?.method === 'POST',
        ),
      ).toBe(true),
    );
    expectNoCanonicalWrites();
  });

  it.each(['makes', 'models'] as const)(
    'restores the %s table with filters and no editor',
    async (view) => {
      render(createElement(CanonicalVehicleMakesModels, { view }));
      const table = await screen.findByRole('table');
      expect(table.textContent).toContain(
        view === 'makes' ? 'Toyota' : 'Corolla',
      );
      expect(table.textContent).not.toContain('Action');
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: 'Toyota' },
      });
      await waitFor(() =>
        expect(
          fetchMock.mock.calls.some(
            ([url]) =>
              String(url).includes(`/${view}/page?`) &&
              String(url).includes('search=Toyota'),
          ),
        ).toBe(true),
      );
      if (view === 'models')
        expect(
          screen
            .getByRole('link', { name: 'View vehicles' })
            .getAttribute('href'),
        ).toBe('/admin/vehicles/configurations?modelId=corolla');
      expectNoCanonicalWrites();
    },
  );
});
