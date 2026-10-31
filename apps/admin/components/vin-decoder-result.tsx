import { formatAdminEnumLabel } from '@/lib/admin-display';
import type { VehicleIdentifierResolution } from '@/lib/vehicle-identification-contracts';

export function VinDecoderResult({
  result,
}: {
  result: VehicleIdentifierResolution;
}) {
  if (result.resolutionSource !== 'VIN_PROVIDER' || !result.decoded)
    return null;

  const decoded = result.decoded;
  const fields: [string, string | number | undefined][] = [
    ['Make', decoded.make],
    ['Model', decoded.model],
    ['Model year', decoded.modelYear],
    ['Trim', decoded.trim],
    ['Engine', decoded.engine],
    [
      'Transmission',
      decoded.transmission
        ? formatAdminEnumLabel(decoded.transmission)
        : undefined,
    ],
    [
      'Body type',
      decoded.bodyType ? formatAdminEnumLabel(decoded.bodyType) : undefined,
    ],
    ['Market', decoded.market],
    ['Steering side', decoded.steeringSide],
    ['Generation', decoded.generation],
    ['Derivative', decoded.derivative],
    ['Provider series', decoded.series],
  ];

  return (
    <section
      className="catalog-card vehicle-identification-decoded"
      aria-labelledby="vin-decoder-result-title"
    >
      <div className="catalog-section-heading">
        <div>
          <span className="eyebrow">{result.provider ?? 'VIN provider'}</span>
          <h2 id="vin-decoder-result-title">VIN decoder result</h2>
          <p>
            Returned vehicle details are shown even when the vehicle library has
            no match.
          </p>
        </div>
      </div>

      {result.warnings?.length ? (
        <div className="vehicle-identification-decoder-warning" role="status">
          <strong>Decoder verification needed</strong>
          {result.warnings.map((warning, index) => (
            <p key={`${index}-${warning}`}>{warning}</p>
          ))}
        </div>
      ) : null}

      <dl className="vehicle-identification-decoded-fields">
        {fields.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>
              {value ?? (
                <span className="vehicle-identification-not-returned">
                  Not returned
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <p className="vehicle-identification-more">
        Use these details to review canonical candidates below. Missing
        specifications require verification; a decoder result alone does not
        confirm parts fitment.
      </p>
    </section>
  );
}
