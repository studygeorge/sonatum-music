import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  return withAuth(request, async (req, session) => {
    try {
      const user = await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          email: true,
          username: true,
          firstName: true,
          lastName: true,
          avatar: true,
          bio: true,
          role: true,
          status: true,
          createdAt: true,
          balance: true,
          subscription: true,
          artistProfile: {
            select: {
              id: true,
              name: true,
              slug: true,
              avatar: true,
              verified: true,
              followers: true,
              canSellMusic: true
            }
          }
        }
      });

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'User not found' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        data: user
      });

    } catch (error) {
      console.error('Get user error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to get user data' },
        { status: 500 }
      );
    }
  });
}
