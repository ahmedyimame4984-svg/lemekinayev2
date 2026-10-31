import 'server-only';

import { NextResponse } from 'next/server';

const noStoreHeaders = {
  'Cache-Control': 'no-store',
  Pragma: 'no-cache',
};

export function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: noStoreHeaders });
}

export function jsonNoStore<T>(value: T, status = 200): NextResponse<T> {
  return NextResponse.json(value, { status, headers: noStoreHeaders });
}
