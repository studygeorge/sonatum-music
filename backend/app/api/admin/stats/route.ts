import { NextRequest, NextResponse } from 'next/server';
import { withRole } from '@/lib/middleware';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

// Получить общую статистику
export async function GET(request: NextRequest) {
  return withRole(request, ['ADMIN', 'SUPER_ADMIN'], async (req, session) => {
    try {
      const [
        totalUsers,
        totalArtists,
        totalTracks,
        totalPurchases,
        pendingTracks,
        activeUsers,
        totalRevenue,
        topGenres,
        recentActivity
      ] = await Promise.all([
        prisma.user.count(),
        
        prisma.artist.count(),
        
        prisma.track.count({ where: { status: 'PUBLISHED' } }),
        
        prisma.purchase.count({ where: { status: 'COMPLETED' } }),
        
        prisma.track.count({ where: { status: 'PENDING' } }),
        
        prisma.user.count({
          where: {
            lastLoginAt: {
              gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            }
          }
        }),
        
        prisma.purchase.aggregate({
          where: { status: 'COMPLETED' },
          _sum: { price: true }
        }),
        
        prisma.genre.findMany({
          take: 10,
          include: {
            _count: {
              select: {
                tracks: true,
                artists: true
              }
            }
          },
          orderBy: {
            tracks: {
              _count: 'desc'
            }
          }
        }),
        
        prisma.track.findMany({
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            artist: {
              select: {
                name: true,
                slug: true
              }
            }
          }
        })
      ]);

      const usersByRole = await prisma.user.groupBy({
        by: ['role'],
        _count: true
      });

      const tracksByStatus = await prisma.track.groupBy({
        by: ['status'],
        _count: true
      });

      return NextResponse.json({
        success: true,
        data: {
          overview: {
            totalUsers,
            totalArtists,
            totalTracks,
            totalPurchases,
            pendingTracks,
            activeUsers,
            totalRevenue: totalRevenue._sum.price || 0
          },
          usersByRole: usersByRole.reduce((acc, item) => {
            acc[item.role] = item._count;
            return acc;
          }, {} as Record<string, number>),
          tracksByStatus: tracksByStatus.reduce((acc, item) => {
            acc[item.status] = item._count;
            return acc;
          }, {} as Record<string, number>),
          topGenres: topGenres.map(g => ({
            name: g.name,
            slug: g.slug,
            color: g.color,
            trackCount: g._count.tracks,
            artistCount: g._count.artists
          })),
          recentActivity: recentActivity.map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist.name,
            status: t.status,
            createdAt: t.createdAt
          }))
        }
      });

    } catch (error) {
      console.error('Admin stats error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to fetch statistics' },
        { status: 500 }
      );
    }
  });
}
