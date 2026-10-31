import { readFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { validateVehicleProductionManifest } from '../vehicle/vehicle-reconstruction-standard.js';

const { values } = parseArgs({
  options: { input: { type: 'string' } },
  strict: true,
});
if (!values.input)
  throw new Error(
    'Usage: admin:vehicles:validate -- --input=vehicle-manifest.json',
  );
const manifest: unknown = JSON.parse(await readFile(values.input, 'utf8'));
const result = validateVehicleProductionManifest(manifest);
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
if (!result.valid) process.exitCode = 1;
