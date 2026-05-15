import { NextRequest, NextResponse } from 'next/server';
import { AuthService, SessionData } from './auth';

export async function withAuth(
  request: NextRequest,
  handler: (req: NextRequest, session: SessionData) => Promise<NextResponse>
): Promise<NextResponse> {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    );
  }

  const session = await AuthService.validateSession(token);

  if (!session) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired session' },
      { status: 401 }
    );
  }

  return handler(request, session);
}

export async function withRole(
  request: NextRequest,
  roles: string[],
  handler: (req: NextRequest, session: SessionData) => Promise<NextResponse>
): Promise<NextResponse> {
  return withAuth(request, async (req, session) => {
    if (!roles.includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      );
    }
    return handler(req, session);
  });
}