import { CatalogArticleImportFileFormat } from './dto/catalog-article-import.dto.js';
import {
  catalogArticleImportFingerprint,
  parseCatalogArticleImportFile,
} from './catalog-article-import-file.js';

const xlsxFixtureBase64 =
  'UEsDBBQAAAAIAE8nR11KNQlPrwAAAN4AAAAPAAAAeGwvd29ya2Jvb2sueG1sNY7NjsIwDITvPEXkO6RwQKuqLUJCSNzZBwipS6M2dmWH/Xn7tRY4eWxr5pvm8JNn94WiiamF7aYChxS5T3Rv4fN6Xn+A0xKoDzMTtvCLCodu1XyzTDfmyZmftJYWxlKW2nuNI+agG16Q7Dew5FBslbvnYUgRTxwfGan4XVXtveAcirF1TIuCBeuIWLR7TkchG/QoJcXZyO7/eumtKTipkwm59FvwXeNfxlXj3926P1BLAwQUAAAACABPJ0ddbyXPILQAAAArAQAAGgAAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzjc/NCsIwDADgu09RcnfZPIjIul1E2FXmA5Qu+2FbW5r6s7e3eBAVD55CEvIlycv7PIkreR6skZAlKQgy2jaD6SSc6+N6B4KDMo2arCEJCzGUxSo/0aRCnOF+cCwiYlhCH4LbI7LuaVacWEcmdlrrZxVi6jt0So+qI9yk6Rb9uwFfqKgaCb5qMhD14ugf3LbtoOlg9WUmE37swJv1I/dEIaLKdxQkvEqMz5AlUQWM1+DHj8UDUEsDBBQAAAAIAE8nR12ucML9vwAAACgBAAAUAAAAeGwvc2hhcmVkU3RyaW5ncy54bWxdj81qwzAQhO99CrH3REoOoRRJgRZyDIE6DyCsbSxirRztOjRvXyelP/g438zOsHb7mXt1xcqpkIPV0oBCaktMdHJwbHaLZ1AsgWLoC6GDGzJs/ZNlFjWdEjvoRIYXrbntMAdelgFpcj5KzUEmWU+ah4ohcocouddrYzY6h0Sg2jKSONiAGildRnz70feF5K34Qy1xbEU1twGtFm/1nX9774/FOd2H/Jf8rWkWxqzm0fUcvNZwRnUI8V+Bnl71X1BLAwQUAAAACABPJ0ddESn9l8YAAAB2AQAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbF2QUW7CMAyG33eKyO/gtgM0TUkQY9oJ4ABR69GKJqniqLDbkyFUQt/sfM7/JZbbq+3FSIE77xSUywIEudo3nTspOB5+Fh8gOBrXmN47UvBHDFv9Ji8+nLkliiIFOFbQxjh8InLdkjW89AO5RH59sCamNpyQh0CmuV+yPVZFsUFrOgcp7X74baJJdfAXEdJTQMv6v9iVIKICTv2oC4mjllg/2FfOyle2z1k1MUz5T0s1Waps+n1mydlqZsnZem7B58ckTivTN1BLAQIUAxQAAAAIAE8nR11KNQlPrwAAAN4AAAAPAAAAAAAAAAAAAACAAQAAAAB4bC93b3JrYm9vay54bWxQSwECFAMUAAAACABPJ0ddbyXPILQAAAArAQAAGgAAAAAAAAAAAAAAgAHcAAAAeGwvX3JlbHMvd29ya2Jvb2sueG1sLnJlbHNQSwECFAMUAAAACABPJ0ddrnDC/b8AAAAoAQAAFAAAAAAAAAAAAAAAgAHIAQAAeGwvc2hhcmVkU3RyaW5ncy54bWxQSwECFAMUAAAACABPJ0ddESn9l8YAAAB2AQAAGAAAAAAAAAAAAAAAgAG5AgAAeGwvd29ya3NoZWV0cy9zaGVldDEueG1sUEsFBgAAAAAEAAQADQEAALUDAAAAAA==';

describe('catalog Article import file parser', () => {
  it('parses quoted CSV and preserves physical source row numbers', () => {
    const csv = [
      'Product Type,Schema,Name,Note',
      'PT-001,2,"Brake Pad, Front","quoted ""value"""',
      '',
      'PT-002,3,Oil Filter,',
    ].join('\r\n');

    const result = parseCatalogArticleImportFile({
      format: CatalogArticleImportFileFormat.CSV,
      fileBase64: Buffer.from(csv, 'utf8').toString('base64'),
    });

    expect(result).toEqual({
      headers: ['Product Type', 'Schema', 'Name', 'Note'],
      sheetName: null,
      rows: [
        {
          sourceRowNumber: 2,
          cells: {
            'Product Type': 'PT-001',
            Schema: '2',
            Name: 'Brake Pad, Front',
            Note: 'quoted "value"',
          },
        },
        {
          sourceRowNumber: 4,
          cells: {
            'Product Type': 'PT-002',
            Schema: '3',
            Name: 'Oil Filter',
            Note: '',
          },
        },
      ],
    });
  });

  it('parses the selected XLSX worksheet without an external spreadsheet dependency', () => {
    const result = parseCatalogArticleImportFile({
      format: CatalogArticleImportFileFormat.XLSX,
      fileBase64: xlsxFixtureBase64,
      sheetName: 'Articles',
    });

    expect(result).toEqual({
      headers: ['Product Type', 'Schema', 'Name'],
      sheetName: 'Articles',
      rows: [
        {
          sourceRowNumber: 2,
          cells: {
            'Product Type': 'PT-001',
            Schema: '2',
            Name: 'Brake Pad',
          },
        },
      ],
    });
  });

  it('rejects duplicate headers case-insensitively', () => {
    const csv = 'Name,name\nA,B\n';

    expect(() =>
      parseCatalogArticleImportFile({
        format: CatalogArticleImportFileFormat.CSV,
        fileBase64: Buffer.from(csv, 'utf8').toString('base64'),
      }),
    ).toThrow(/Duplicate Article import header/u);
  });

  it('creates a stable fingerprint independent of object key insertion order', () => {
    expect(
      catalogArticleImportFingerprint({
        b: 2,
        a: { y: 2, x: 1 },
      }),
    ).toBe(
      catalogArticleImportFingerprint({
        a: { x: 1, y: 2 },
        b: 2,
      }),
    );
  });
});
