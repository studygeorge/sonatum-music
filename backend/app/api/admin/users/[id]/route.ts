import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

// Обновить пользователя
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const body = await request.json();
      const { role, status } = body;

      const user = await prisma.user.findUnique({
        where: { id: params.id }
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      if (session.role === 'ADMIN' && user.role === 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Cannot modify super admin' },
          { status: 403 }
        );
      }

      if (session.role === 'ADMIN' && role === 'SUPER_ADMIN') {
        return NextResponse.json(
          { success: false, error: 'Cannot assign super admin role' },
          { status: 403 }
        );
      }

      const updated = await prisma.user.update({
        where: { id: params.id },
        data: {
          role,
          status
        },
        select: {
          id: true,
          email: true,
          username: true,
          role: true,
          status: true,
          updatedAt: true
        }
      });

      return NextResponse.json({
        success: true,
        data: updated
      });

    } catch (error) {
      console.error('Update user error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to update user' },
        { status: 500 }
      );
    }
  });
}

// Удалить пользователя
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  return withRole(request, ['SUPER_ADMIN'], async (req, session) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: params.id }
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      if (user.role === 'SUPER_ADMIN' && user.id !== session.userId) {
        return NextResponse.json(
          { success: false, error: 'Cannot delete another super admin' },
          { status: 403 }
        );
      }

      await prisma.user.update({
        where: { id: params.id },
        data: { status: 'DELETED' }
      });

      return NextResponse.json({
        success: true,
        message: 'User deleted'
      });

    } catch (error) {
      console.error('Delete user error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to delete user' },
        { status: 500 }
      );
    }
  });
}
