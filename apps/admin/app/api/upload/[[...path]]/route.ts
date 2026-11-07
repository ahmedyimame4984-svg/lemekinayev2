import { NextRequest, NextResponse } from 'next/server';

const getApiBase = () => {
  const base = process.env.ADMIN_API_BASE_URL || 'http://127.0.0.1:5000/api/v1';
  return base.replace(/\/+$/, '');
};

async function forward(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> },
) {
  try {
    const { path = [] } = await context.params;
    const subpath = path.length ? `/${path.join('/')}` : '';
    const targetUrl = `${getApiBase()}/upload${subpath}`;

    const headers = new Headers();
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);

    const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)
      ? await request.text()
      : undefined;

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        'content-type': response.headers.get('content-type') || 'application/json',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: { message: err?.message || 'Failed to reach upload service' } },
      { status: 502 },
    );
  }
}

export {
  forward as GET,
  forward as POST,
  forward as PUT,
  forward as DELETE,
};
