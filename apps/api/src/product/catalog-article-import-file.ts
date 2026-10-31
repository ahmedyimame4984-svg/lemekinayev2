import { createHash } from 'node:crypto';
import { posix as pathPosix } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { BadRequestException } from '@nestjs/common';
import { parseCsv } from '../common/admin-csv.js';
import { CatalogArticleImportFileFormat } from './dto/catalog-article-import.dto.js';

const MAX_DECODED_FILE_BYTES = 6_000_000;
const MAX_XLSX_ENTRY_BYTES = 12_000_000;
const MAX_XLSX_TOTAL_EXTRACTED_BYTES = 24_000_000;
const MAX_IMPORT_COLUMNS = 300;
const MAX_IMPORT_ROWS = 500;

export type ParsedCatalogImportSourceRow = {
  sourceRowNumber: number;
  cells: Record<string, string>;
};

export type ParsedCatalogImportTable = {
  headers: string[];
  rows: ParsedCatalogImportSourceRow[];
  sheetName: string | null;
};

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
  flags: number;
};

type WorksheetCell = {
  columnIndex: number;
  value: string;
};

type WorksheetRow = {
  rowNumber: number;
  cells: WorksheetCell[];
};

export function parseCatalogArticleImportFile(input: {
  format: CatalogArticleImportFileFormat;
  fileBase64: string;
  sheetName?: string;
}): ParsedCatalogImportTable {
  const bytes = decodeBase64File(input.fileBase64);

  if (input.format === CatalogArticleImportFileFormat.CSV) {
    return tableFromCsv(bytes);
  }
  if (input.format === CatalogArticleImportFileFormat.XLSX) {
    return tableFromXlsx(bytes, input.sheetName?.trim() || undefined);
  }

  throw importFileError(
    'CATALOG_ARTICLE_IMPORT_FORMAT_UNSUPPORTED',
    'Only CSV and XLSX Article import files are supported',
  );
}

export function catalogArticleImportFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(stableStringify(value))
    .digest('hex');
}

function decodeBase64File(value: string): Buffer {
  const compact = value.replace(/\s+/gu, '');
  if (
    compact.length === 0 ||
    compact.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/u.test(compact)
  ) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_FILE_BASE64_INVALID',
      'The Article import file is not valid base64 data',
    );
  }

  const bytes = Buffer.from(compact, 'base64');
  if (bytes.length === 0 || bytes.length > MAX_DECODED_FILE_BYTES) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_FILE_SIZE_INVALID',
      'The decoded Article import file must be between 1 byte and 6 MB',
    );
  }
  return bytes;
}

function tableFromCsv(bytes: Buffer): ParsedCatalogImportTable {
  let matrix: string[][];
  try {
    matrix = parseCsv(bytes.toString('utf8'));
  } catch (error) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_CSV_INVALID',
      error instanceof Error ? error.message : 'CSV parsing failed',
    );
  }

  return matrixToTable(
    matrix.map((values, index) => ({
      rowNumber: index + 1,
      values,
    })),
    null,
  );
}

function tableFromXlsx(
  bytes: Buffer,
  requestedSheetName?: string,
): ParsedCatalogImportTable {
  if (
    bytes.length < 4 ||
    bytes.readUInt32LE(0) !== 0x04034b50
  ) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_INVALID',
      'XLSX input must be an Office Open XML ZIP workbook',
    );
  }

  const archive = parseZipDirectory(bytes);
  const workbookXml = readZipText(
    bytes,
    archive,
    'xl/workbook.xml',
    true,
  );
  const relationshipsXml = readZipText(
    bytes,
    archive,
    'xl/_rels/workbook.xml.rels',
    true,
  );

  const sheets = parseWorkbookSheets(workbookXml);
  if (sheets.length === 0) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_NO_SHEETS',
      'The XLSX workbook does not contain a worksheet',
    );
  }

  const selected = requestedSheetName
    ? sheets.find((sheet) => sheet.name === requestedSheetName)
    : sheets[0];
  if (!selected) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_SHEET_NOT_FOUND',
      `Worksheet "${requestedSheetName}" was not found in the XLSX workbook`,
    );
  }

  const relationships = parseWorkbookRelationships(relationshipsXml);
  const target = relationships.get(selected.relationshipId);
  if (!target) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_RELATIONSHIP_INVALID',
      `Worksheet "${selected.name}" has no workbook relationship target`,
    );
  }

  const sheetPath = resolveWorkbookTarget(target);
  const sheetXml = readZipText(bytes, archive, sheetPath, true);
  const sharedStringsXml = readZipText(
    bytes,
    archive,
    'xl/sharedStrings.xml',
    false,
  );
  const sharedStrings = sharedStringsXml
    ? parseSharedStrings(sharedStringsXml)
    : [];
  const worksheetRows = parseWorksheetRows(sheetXml, sharedStrings);

  return matrixToTable(
    worksheetRows.map((row) => ({
      rowNumber: row.rowNumber,
      values: cellsToValues(row.cells),
    })),
    selected.name,
  );
}

function matrixToTable(
  rows: Array<{ rowNumber: number; values: string[] }>,
  sheetName: string | null,
): ParsedCatalogImportTable {
  const nonEmpty = rows.filter((row) =>
    row.values.some((value) => value.trim().length > 0),
  );
  const headerRow = nonEmpty[0];
  if (!headerRow) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_FILE_EMPTY',
      'The Article import file has no non-empty rows',
    );
  }

  const headers = headerRow.values.map((value) => value.trim());
  while (headers.length > 0 && headers.at(-1) === '') headers.pop();

  if (headers.length === 0) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_HEADER_EMPTY',
      'The Article import file header row is empty',
    );
  }
  if (headers.length > MAX_IMPORT_COLUMNS) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_TOO_MANY_COLUMNS',
      `Article import supports at most ${MAX_IMPORT_COLUMNS} columns`,
    );
  }

  const seen = new Set<string>();
  for (const header of headers) {
    if (!header) {
      throw importFileError(
        'CATALOG_ARTICLE_IMPORT_HEADER_BLANK',
        'Mapped Article import columns require non-empty header names',
      );
    }
    const key = header.toLocaleLowerCase('en-US');
    if (seen.has(key)) {
      throw importFileError(
        'CATALOG_ARTICLE_IMPORT_HEADER_DUPLICATE',
        `Duplicate Article import header: ${header}`,
      );
    }
    seen.add(key);
  }

  const dataRows = nonEmpty
    .filter((row) => row.rowNumber > headerRow.rowNumber)
    .slice(0, MAX_IMPORT_ROWS + 1);
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_TOO_MANY_ROWS',
      `Article import supports at most ${MAX_IMPORT_ROWS} data rows per job`,
    );
  }

  return {
    headers,
    rows: dataRows.map((row) => ({
      sourceRowNumber: row.rowNumber,
      cells: Object.fromEntries(
        headers.map((header, index) => [
          header,
          row.values[index]?.trim() ?? '',
        ]),
      ),
    })),
    sheetName,
  };
}

function parseZipDirectory(bytes: Buffer): Map<string, ZipEntry> {
  const eocdOffset = findEndOfCentralDirectory(bytes);
  const totalEntries = bytes.readUInt16LE(eocdOffset + 10);
  const centralSize = bytes.readUInt32LE(eocdOffset + 12);
  const centralOffset = bytes.readUInt32LE(eocdOffset + 16);

  if (
    totalEntries > 10_000 ||
    centralOffset + centralSize > bytes.length
  ) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_ZIP_INVALID',
      'The XLSX ZIP directory is invalid or exceeds safe limits',
    );
  }

  const entries = new Map<string, ZipEntry>();
  let offset = centralOffset;
  for (let index = 0; index < totalEntries; index += 1) {
    if (
      offset + 46 > bytes.length ||
      bytes.readUInt32LE(offset) !== 0x02014b50
    ) {
      throw importFileError(
        'CATALOG_ARTICLE_IMPORT_XLSX_ZIP_INVALID',
        'The XLSX central directory is malformed',
      );
    }

    const flags = bytes.readUInt16LE(offset + 8);
    const compressionMethod = bytes.readUInt16LE(offset + 10);
    const compressedSize = bytes.readUInt32LE(offset + 20);
    const uncompressedSize = bytes.readUInt32LE(offset + 24);
    const fileNameLength = bytes.readUInt16LE(offset + 28);
    const extraLength = bytes.readUInt16LE(offset + 30);
    const commentLength = bytes.readUInt16LE(offset + 32);
    const localHeaderOffset = bytes.readUInt32LE(offset + 42);
    const nameStart = offset + 46;
    const nameEnd = nameStart + fileNameLength;

    if (nameEnd > bytes.length) {
      throw importFileError(
        'CATALOG_ARTICLE_IMPORT_XLSX_ZIP_INVALID',
        'The XLSX ZIP entry name is malformed',
      );
    }

    const name = bytes.subarray(nameStart, nameEnd).toString('utf8');
    if (
      name.startsWith('xl/') &&
      !name.endsWith('/') &&
      uncompressedSize > MAX_XLSX_ENTRY_BYTES
    ) {
      throw importFileError(
        'CATALOG_ARTICLE_IMPORT_XLSX_ENTRY_TOO_LARGE',
        `XLSX entry exceeds the safe extraction limit: ${name}`,
      );
    }

    entries.set(name, {
      name,
      flags,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });
    offset = nameEnd + extraLength + commentLength;
  }

  const totalUncompressed = [...entries.values()]
    .filter((entry) => entry.name.startsWith('xl/'))
    .reduce((sum, entry) => sum + entry.uncompressedSize, 0);
  if (totalUncompressed > MAX_XLSX_TOTAL_EXTRACTED_BYTES) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_TOO_LARGE',
      'The XLSX workbook expands beyond the safe extraction limit',
    );
  }

  return entries;
}

function findEndOfCentralDirectory(bytes: Buffer): number {
  const minimum = Math.max(0, bytes.length - 65_557);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (bytes.readUInt32LE(offset) === 0x06054b50) return offset;
  }
  throw importFileError(
    'CATALOG_ARTICLE_IMPORT_XLSX_ZIP_INVALID',
    'The XLSX ZIP end-of-directory record is missing',
  );
}

function readZipText(
  bytes: Buffer,
  entries: Map<string, ZipEntry>,
  name: string,
  required: true,
): string;
function readZipText(
  bytes: Buffer,
  entries: Map<string, ZipEntry>,
  name: string,
  required: false,
): string | null;
function readZipText(
  bytes: Buffer,
  entries: Map<string, ZipEntry>,
  name: string,
  required: true,
): string;
function readZipText(
  bytes: Buffer,
  entries: Map<string, ZipEntry>,
  name: string,
  required: false,
): string | null;
function readZipText(
  bytes: Buffer,
  entries: Map<string, ZipEntry>,
  name: string,
  required: boolean,
): string | null {
  const entry = entries.get(name);
  if (!entry) {
    if (!required) return null;
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_ENTRY_MISSING',
      `Required XLSX entry is missing: ${name}`,
    );
  }
  if ((entry.flags & 0x1) !== 0) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_ENCRYPTED',
      'Encrypted XLSX workbooks are not supported',
    );
  }
  if (entry.compressionMethod !== 0 && entry.compressionMethod !== 8) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_COMPRESSION_UNSUPPORTED',
      `Unsupported XLSX ZIP compression method for ${name}`,
    );
  }

  const localOffset = entry.localHeaderOffset;
  if (
    localOffset + 30 > bytes.length ||
    bytes.readUInt32LE(localOffset) !== 0x04034b50
  ) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_ZIP_INVALID',
      `Invalid local XLSX ZIP header for ${name}`,
    );
  }

  const nameLength = bytes.readUInt16LE(localOffset + 26);
  const extraLength = bytes.readUInt16LE(localOffset + 28);
  const dataStart = localOffset + 30 + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > bytes.length) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_ZIP_INVALID',
      `Truncated XLSX ZIP entry: ${name}`,
    );
  }

  const compressed = bytes.subarray(dataStart, dataEnd);
  let output: Buffer;
  try {
    output =
      entry.compressionMethod === 0
        ? Buffer.from(compressed)
        : inflateRawSync(compressed, {
            maxOutputLength: MAX_XLSX_ENTRY_BYTES,
          });
  } catch {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_ZIP_INVALID',
      `Unable to decompress XLSX entry: ${name}`,
    );
  }

  if (
    output.length > MAX_XLSX_ENTRY_BYTES ||
    (entry.uncompressedSize !== 0 &&
      output.length !== entry.uncompressedSize)
  ) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_ZIP_INVALID',
      `XLSX entry size mismatch: ${name}`,
    );
  }
  return output.toString('utf8');
}

function parseWorkbookSheets(
  xml: string,
): Array<{ name: string; relationshipId: string }> {
  const result: Array<{ name: string; relationshipId: string }> = [];
  const regex = /<sheet\b([^>]*)\/?\s*>/gu;
  for (const match of xml.matchAll(regex)) {
    const attrs = parseXmlAttributes(match[1] ?? '');
    const name = attrs.get('name');
    const relationshipId = attrs.get('r:id');
    if (name && relationshipId) {
      result.push({
        name: decodeXmlText(name),
        relationshipId,
      });
    }
  }
  return result;
}

function parseWorkbookRelationships(xml: string): Map<string, string> {
  const result = new Map<string, string>();
  const regex = /<Relationship\b([^>]*)\/?\s*>/gu;
  for (const match of xml.matchAll(regex)) {
    const attrs = parseXmlAttributes(match[1] ?? '');
    const id = attrs.get('Id');
    const target = attrs.get('Target');
    if (id && target) result.set(id, decodeXmlText(target));
  }
  return result;
}

function resolveWorkbookTarget(target: string): string {
  const normalized = target.startsWith('/')
    ? target.slice(1)
    : pathPosix.normalize(pathPosix.join('xl', target));
  if (!normalized.startsWith('xl/')) {
    throw importFileError(
      'CATALOG_ARTICLE_IMPORT_XLSX_RELATIONSHIP_INVALID',
      'The selected worksheet target leaves the XLSX workbook namespace',
    );
  }
  return normalized;
}

function parseSharedStrings(xml: string): string[] {
  const values: string[] = [];
  const regex = /<si\b[^>]*>([\s\S]*?)<\/si>/gu;
  for (const match of xml.matchAll(regex)) {
    values.push(extractTextNodes(match[1] ?? ''));
  }
  return values;
}

function parseWorksheetRows(
  xml: string,
  sharedStrings: string[],
): WorksheetRow[] {
  const rows: WorksheetRow[] = [];
  const rowRegex = /<row\b([^>]*)>([\s\S]*?)<\/row>/gu;
  let sequentialRow = 0;

  for (const match of xml.matchAll(rowRegex)) {
    const attrs = parseXmlAttributes(match[1] ?? '');
    const explicitRow = Number(attrs.get('r'));
    const rowNumber =
      Number.isInteger(explicitRow) && explicitRow > 0
        ? explicitRow
        : sequentialRow + 1;
    sequentialRow = rowNumber;

    const cells: WorksheetCell[] = [];
    const body = match[2] ?? '';
    const cellRegex = /<c\b([^>]*)>([\s\S]*?)<\/c>/gu;
    let sequentialColumn = 0;

    for (const cellMatch of body.matchAll(cellRegex)) {
      const cellAttrs = parseXmlAttributes(cellMatch[1] ?? '');
      const reference = cellAttrs.get('r');
      const columnIndex = reference
        ? columnIndexFromReference(reference)
        : sequentialColumn;
      sequentialColumn = columnIndex + 1;
      const type = cellAttrs.get('t') ?? '';
      const cellBody = cellMatch[2] ?? '';
      cells.push({
        columnIndex,
        value: worksheetCellValue(cellBody, type, sharedStrings),
      });
    }

    rows.push({ rowNumber, cells });
  }
  return rows;
}

function worksheetCellValue(
  body: string,
  type: string,
  sharedStrings: string[],
): string {
  if (type === 'inlineStr') return extractTextNodes(body);

  const valueMatch = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/u);
  const raw = valueMatch ? decodeXmlText(valueMatch[1] ?? '') : '';

  if (type === 's') {
    const index = Number(raw);
    return Number.isInteger(index) && index >= 0
      ? (sharedStrings[index] ?? '')
      : '';
  }
  if (type === 'b') return raw === '1' ? 'true' : 'false';
  return raw;
}

function cellsToValues(cells: WorksheetCell[]): string[] {
  if (cells.length === 0) return [];
  const max = Math.max(...cells.map((cell) => cell.columnIndex));
  const values = Array.from({ length: max + 1 }, () => '');
  for (const cell of cells) values[cell.columnIndex] = cell.value;
  return values;
}

function columnIndexFromReference(reference: string): number {
  const match = reference.match(/^([A-Z]+)\d+$/iu);
  if (!match) return 0;
  let value = 0;
  for (const character of match[1]!.toUpperCase()) {
    value = value * 26 + (character.charCodeAt(0) - 64);
  }
  return Math.max(0, value - 1);
}

function extractTextNodes(xml: string): string {
  return [...xml.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gu)]
    .map((match) => decodeXmlText(match[1] ?? ''))
    .join('');
}

function parseXmlAttributes(input: string): Map<string, string> {
  const result = new Map<string, string>();
  const regex = /([:\w-]+)\s*=\s*"([^"]*)"/gu;
  for (const match of input.matchAll(regex)) {
    result.set(match[1]!, match[2] ?? '');
  }
  return result;
}

function decodeXmlText(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replaceAll('&amp;', '&')
    .replace(/&#(\d+);/gu, (_match, code: string) =>
      String.fromCodePoint(Number(code)),
    )
    .replace(/&#x([0-9a-f]+);/giu, (_match, code: string) =>
      String.fromCodePoint(Number.parseInt(code, 16)),
    );
}

function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return '[' + value.map((item) => stableStringify(item)).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  return (
    '{' +
    Object.keys(record)
      .sort()
      .map(
        (key) =>
          JSON.stringify(key) + ':' + stableStringify(record[key]),
      )
      .join(',') +
    '}'
  );
}

function importFileError(code: string, message: string): BadRequestException {
  return new BadRequestException({ code, message });
}
