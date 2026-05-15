import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/middleware';
import { getCorsHeaders } from '@/lib/cors';

export async function OPTIONS(request: NextRequest) {
  return new Response(null, {
    status: 204,
    headers: getCorsHeaders(request.headers.get('origin') || undefined),
  });
}

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin || undefined);
    try {
      const groups = await prisma.eduGroup.findMany({
        where: {
          OR: [
            { ownerId: session.userId },
            { members: { some: { userId: session.userId } } }
          ]
        },
        include: {
          owner: { select: { id: true, firstName: true, lastName: true, avatar: true, username: true } },
          _count: { select: { members: true } },
          members: {
            include: {
              user: { select: { id: true, firstName: true, avatar: true, username: true } }
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      return NextResponse.json({ success: true, data: groups }, { headers: corsHeaders });
    } catch (error) {
      console.error('[GROUPS_GET]', error);
      return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
    }
  });
}

export async function POST(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin || undefined);
    
    try {
      const body = await req.json();
      const { name, description } = body;

      if (!name) {
        return NextResponse.json({ success: false, error: 'Group name is required' }, { status: 400, headers: corsHeaders });
      }

      const group = await prisma.eduGroup.create({
        data: {
          name,
          description: description || null,
          ownerId: session.userId
        }
      });

      return NextResponse.json({ success: true, data: group }, { status: 201, headers: corsHeaders });
    } catch (error) {
      console.error('[GROUPS_POST]', error);
      return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
    }
  });
}
