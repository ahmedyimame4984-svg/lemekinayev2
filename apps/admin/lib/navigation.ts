export function safeAdminReturnTo(value?: string): string {
  if (
    !value ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\s]/u.test(value)
  ) {
    return '/admin';
  }
  try {
    const url = new URL(value, 'https://admin.invalid');
    if (
      url.origin === 'https://admin.invalid' &&
      (url.pathname === '/admin' || url.pathname.startsWith('/admin/'))
    ) {
      return canonicalAdminDestination(url);
    }
  } catch {
    // Reject malformed targets rather than passing them to the router.
  }
  return '/admin';
}

function canonicalAdminDestination(url: URL): string {
  const search = new URLSearchParams(url.search);
  let pathname = url.pathname;

  if (pathname === '/admin/vehicles') {
    pathname = '/admin/vehicles/makes';
  } else if (matchesRouteRoot(pathname, '/admin/sourcing/offers')) {
    pathname = '/admin/sourcing/suppliers';
  } else if (matchesRouteRoot(pathname, '/admin/marketplace/listings')) {
    pathname = '/admin/marketplace/sellers';
  } else if (matchesRouteRoot(pathname, '/admin/catalog/product-structure')) {
    pathname = '/admin/catalog/part-groups';
  } else if (matchesRouteRoot(pathname, '/admin/catalog/workspace')) {
    pathname = '/admin/catalog/product-types';
  } else if (matchesRouteRoot(pathname, '/admin/catalog/products')) {
    pathname = '/admin/catalog/product-types';
  } else if (pathname === '/admin/catalog/product-types/new') {
    pathname = '/admin/catalog/product-types';
    search.set('create', '1');
  } else {
    const productTypeAlias = pathname.match(
      /^\/admin\/catalog\/product-types\/([^/]+)\/(?:edit|attributes)$/u,
    );
    if (productTypeAlias) {
      pathname = '/admin/catalog/product-types';
      search.set('productTypeId', productTypeAlias[1]);
    }
  }

  const query = search.toString();
  return `${pathname}${query ? `?${query}` : ''}${url.hash}`;
}

function matchesRouteRoot(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function adminWorkspaceTitle(pathname: string): string {
  if (pathname === '/admin') return 'Platform overview';
  if (pathname.startsWith('/admin/search')) return 'Global Catalog Search';
  if (pathname.startsWith('/admin/imports')) return 'Imports & Jobs';
  if (pathname === '/admin/catalog/product-types/new') return 'Create Product Type';
  if (
    pathname.startsWith('/admin/catalog/product-types/') &&
    pathname.endsWith('/edit')
  ) {
    return 'Edit Product Type';
  }
  if (pathname.startsWith('/admin/catalog/product-types/') && pathname.includes('/attributes')) {
    return 'Product Type schema';
  }
  if (pathname.startsWith('/admin/catalog/article-relations')) return 'Article Relations & Supersession';
  if (pathname.startsWith('/admin/catalog/oe-references')) return 'OE & Cross-reference Review';
  if (pathname.startsWith('/admin/catalog/article-review')) return 'Manufacturer Article Review';
  if (pathname.startsWith('/admin/catalog/quality')) return 'Catalog Quality';
  if (pathname.startsWith('/admin/catalog/workspace')) return 'Product Types';
  if (pathname.startsWith('/admin/catalog/product-types')) return 'Product Types';
  if (pathname.startsWith('/admin/catalog/part-groups')) return 'Part Groups';
  if (pathname.startsWith('/admin/catalog/product-structure')) return 'Part Groups';
  if (pathname.startsWith('/admin/catalog/products')) return 'Product Types';
  if (pathname.startsWith('/admin/catalog/brands')) return 'Brand Master';
  if (pathname.startsWith('/admin/catalog/attributes')) return 'Attribute Library';
  if (pathname.startsWith('/admin/catalog/criteria-templates')) return 'Criteria Templates';
  if (pathname.startsWith('/admin/catalog/categories')) return 'Categories';
  if (pathname.startsWith('/admin/catalog')) return 'Product Catalog';
  if (pathname.startsWith('/admin/vehicles/identification')) {
    return 'VIN / Chassis Lookup';
  }
  if (pathname.startsWith('/admin/vehicles/configurations/masters')) {
    return 'Advanced Vehicle Master Libraries';
  }
  if (pathname.startsWith('/admin/vehicles/configurations')) {
    return 'Configured Vehicles Library';
  }
  if (pathname.startsWith('/admin/vehicles/generation-families')) return 'Generation Families';
  if (pathname.startsWith('/admin/vehicles/models')) return 'Vehicle models';
  if (pathname.startsWith('/admin/vehicles')) return 'Vehicle makes';
  if (pathname.startsWith('/admin/sourcing/suppliers')) {
    return 'Supplier Master';
  }
  if (pathname.startsWith('/admin/sourcing/offers')) {
    return 'Supplier Master';
  }
  if (pathname.startsWith('/admin/sourcing')) return 'Global sourcing';
  if (pathname.startsWith('/admin/marketplace/listings')) {
    return 'Seller governance';
  }
  if (pathname.startsWith('/admin/marketplace/sellers')) {
    return 'Seller governance';
  }
  if (pathname.startsWith('/admin/marketplace')) return 'Marketplace operations';
  if (pathname.startsWith('/admin/accounts')) return 'Admin accounts';
  if (pathname.startsWith('/admin/audit')) return 'Audit History';
  return 'Administration';
}


export function adminWorkspaceSection(pathname: string): string {
  if (pathname === '/admin') return 'Overview';
  if (pathname.startsWith('/admin/search')) return 'Search';
  if (pathname.startsWith('/admin/imports')) return 'Operations';
  if (pathname.startsWith('/admin/catalog')) return 'Catalog';
  if (pathname.startsWith('/admin/vehicles')) return 'Vehicles';
  if (pathname.startsWith('/admin/sourcing')) return 'Sourcing';
  if (pathname.startsWith('/admin/marketplace')) return 'Marketplace';
  if (pathname.startsWith('/admin/accounts')) return 'Administration';
  if (pathname.startsWith('/admin/audit')) return 'Administration';
  return 'Administration';
}
