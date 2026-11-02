import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';

/** Canonical reference identities are owned by Autotechdoc, not marketplace Admin. */
@Injectable()
export class CanonicalReferenceReadOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (request.method === 'GET' || request.method === 'HEAD' || request.method === 'OPTIONS') {
      return true;
    }
    const path = request.path.replace(/\/+$/u, '');
    if (path.includes('/admin/vehicles')) {
      // Identifier resolution is a query, not a canonical mutation.
      if (request.method === 'POST' && path.endsWith('/admin/vehicles/identifiers/resolve')) return true;
      throw new ForbiddenException('Vehicle reference data is managed and published in Autotechdoc. LemekinayeV2 is read-only.');
    }
    if (path.includes('/admin/catalog/lifecycle/')) {
      if (/\/CRITERIA_TEMPLATE\//u.test(path)) return true;
      throw new ForbiddenException('Canonical catalog lifecycle is controlled by Autotechdoc.');
    }
    if (path.includes('/admin/catalog/')) {
      const suffix = path.slice(path.indexOf('/admin/catalog/') + '/admin/catalog/'.length);
      if (/^product-types\/[^/]+\/marketplace-rules$/u.test(suffix)) return true;
      // Marketplace-owned Product Type attribute policies remain editable.
      if (/^product-types\/[^/]+\/attributes(?:\/|$)/u.test(suffix)) return true;
      // Client-only criteria application remains editable.
      if (/^product-types\/[^/]+\/criteria-templates\/[^/]+\/apply$/u.test(suffix)) return true;
      // Canonical masters, identity, publication, import, mapping, and localization are source-owned.
      if (/^(?:categories|product-families|units-of-measure|product-types|attributes|attribute-groups|attribute-option-sets|unit-dimensions)(?:\/|$)/u.test(suffix)) {
        throw new ForbiddenException('Canonical catalog reference data is managed in Autotechdoc. Configure marketplace rules locally.');
      }
    }
    return true;
  }
}
