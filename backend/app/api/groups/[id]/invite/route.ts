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

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  return withAuth(request, async (req, session) => {
    const origin = req.headers.get('origin');
    const corsHeaders = getCorsHeaders(origin || undefined);
    
    try {
      const groupId = params.id;
      const body = await req.json();
      const { email } = body;

      if (!email) {
        return NextResponse.json({ success: false, error: 'Student email is required' }, { status: 400, headers: corsHeaders });
      }

      // Checking if group exists and caller is owner
      const group = await prisma.eduGroup.findUnique({ where: { id: groupId } });
      if (!group) return NextResponse.json({ success: false, error: 'Group not found' }, { status: 404, headers: corsHeaders });
      if (group.ownerId !== session.userId) return NextResponse.json({ success: false, error: 'Only the owner can invite' }, { status: 403, headers: corsHeaders });

      // Finding student
      const student = await prisma.user.findUnique({ where: { email } });
      if (!student) {
        return NextResponse.json({ success: false, error: 'No user found with that email' }, { status: 404, headers: corsHeaders });
      }

      // Adding to group if not already
      const existing = await prisma.eduGroupMember.findUnique({
        where: { groupId_userId: { groupId, userId: student.id } }
      });

      if (existing) {
        return NextResponse.json({ success: false, error: 'User is already in the group' }, { status: 400, headers: corsHeaders });
      }

      const member = await prisma.eduGroupMember.create({
        data: {
          groupId,
          userId: student.id
        },
        include: {
          user: { select: { id: true, firstName: true, lastName: true, avatar: true, username: true } }
        }
      });

      return NextResponse.json({ success: true, data: member }, { status: 201, headers: corsHeaders });
    } catch (error) {
      console.error('[GROUPS_INVITE_POST]', error);
      return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500, headers: corsHeaders });
    }
  });
}
