import { randomBytes } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import jwt from 'jsonwebtoken';
import { prisma } from './prisma';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ============================================
// SESSION-BASED AUTH (существующий код)
// ============================================

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  artistId?: string;
}

export class AuthService {
  static generateToken(): string {
    return randomBytes(32).toString('hex');
  }

  static async createSession(
    userId: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const userExists = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true },
    });

    if (!userExists) {
      console.error('[AUTH] User not found:', userId);
      throw new Error(`User with id ${userId} not found`);
    }

    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    try {
      await prisma.session.create({
        data: {
          userId,
          token,
          expiresAt,
          ipAddress,
          userAgent
        }
      });

      console.log('[AUTH] Session created successfully for user:', userId);
    } catch (error) {
      console.error('[AUTH] Error creating session:', error);
      throw error;
    }

    return token;
  }

  static async validateSession(token: string): Promise<SessionData | null> {
    const session = await prisma.session.findUnique({
      where: { token },
      include: {
        user: {
          include: {
            artistProfile: {
              select: { id: true }
            }
          }
        }
      }
    });

    if (!session || session.expiresAt < new Date()) {
      return null;
    }

    if (session.user.status !== 'ACTIVE') {
      return null;
    }

    return {
      userId: session.user.id,
      email: session.user.email,
      role: session.user.role,
      artistId: session.user.artistProfile?.id
    };
  }

  static async deleteSession(token: string): Promise<void> {
    try {
      await prisma.session.delete({
        where: { token }
      });
    } catch (error) {
      console.log('[AUTH] Session already deleted or not found');
    }
  }

  static async deleteUserSessions(userId: string): Promise<void> {
    await prisma.session.deleteMany({
      where: { userId }
    });
  }

  static async cleanupExpiredSessions(): Promise<void> {
    await prisma.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date()
        }
      }
    });
  }
}

// ============================================
// JWT-BASED AUTH (для админ API)
// ============================================

export interface AuthUser {
  id: string | number;
  email: string;
  role: string;
}

/**
 * Генерация JWT токена
 */
export function generateJWT(userId: number): string {
  return jwt.sign(
    { userId },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Проверка JWT токена и извлечение пользователя
 */
export async function verifyJWT(token: string): Promise<AuthUser | null> {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId.toString() },
      select: {
        id: true,
        email: true,
        role: true,
        status: true
      }
    });

    if (!user || user.status !== 'ACTIVE') {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      role: user.role
    };
  } catch (error) {
    console.error('[AUTH] JWT verification failed:', error);
    return null;
  }
}

/**
 * Middleware для проверки роли через JWT (для админ API)
 */
export function withRole(
  handler: (req: NextRequest, ...args: any[]) => Promise<NextResponse>,
  ...allowedRoles: string[]
) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const authHeader = req.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { success: false, error: 'Требуется авторизация' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      
      // Сначала пробуем JWT
      let user = await verifyJWT(token);
      
      // Если JWT не сработал, пробуем session token
      if (!user) {
        const sessionData = await AuthService.validateSession(token);
        if (sessionData) {
          user = {
            id: sessionData.userId,
            email: sessionData.email,
            role: sessionData.role
          };
        }
      }

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Недействительный токен' },
          { status: 401 }
        );
      }

      if (!allowedRoles.includes(user.role)) {
        return NextResponse.json(
          { 
            success: false, 
            error: `Доступ запрещён. Требуется роль: ${allowedRoles.join(' или ')}` 
          },
          { status: 403 }
        );
      }

      console.log(`[AUTH] Access granted for ${user.email} (${user.role})`);
      return handler(req, ...args);
    } catch (error) {
      console.error('[AUTH] Role check error:', error);
      return NextResponse.json(
        { success: false, error: 'Ошибка проверки прав доступа' },
        { status: 500 }
      );
    }
  };
}

/**
 * Middleware для проверки авторизации (любого типа)
 */
export function requireAuth(
  handler: (req: NextRequest, user: AuthUser, ...args: any[]) => Promise<NextResponse>
) {
  return async (req: NextRequest, ...args: any[]) => {
    try {
      const authHeader = req.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return NextResponse.json(
          { success: false, error: 'Требуется авторизация' },
          { status: 401 }
        );
      }

      const token = authHeader.substring(7);
      
      // Пробуем JWT
      let user = await verifyJWT(token);
      
      // Если JWT не сработал, пробуем session
      if (!user) {
        const sessionData = await AuthService.validateSession(token);
        if (sessionData) {
          user = {
            id: sessionData.userId,
            email: sessionData.email,
            role: sessionData.role
          };
        }
      }

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Недействительный токен' },
          { status: 401 }
        );
      }

      return handler(req, user, ...args);
    } catch (error) {
      console.error('[AUTH] Authentication error:', error);
      return NextResponse.json(
        { success: false, error: 'Ошибка авторизации' },
        { status: 500 }
      );
    }
  };
}

/**
 * Проверка администратора
 */
export async function checkAdmin(req: NextRequest): Promise<{ user: AuthUser | null; error?: string }> {
  try {
    const authHeader = req.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { user: null, error: 'Требуется авторизация' };
    }

    const token = authHeader.substring(7);
    
    let user = await verifyJWT(token);
    
    if (!user) {
      const sessionData = await AuthService.validateSession(token);
      if (sessionData) {
        user = {
          id: sessionData.userId,
          email: sessionData.email,
          role: sessionData.role
        };
      }
    }

    if (!user) {
      return { user: null, error: 'Недействительный токен' };
    }

    if (user.role !== 'ADMIN' && user.role !== 'SUPER_ADMIN') {
      return { user: null, error: 'Недостаточно прав' };
    }

    return { user };
  } catch (error) {
    console.error('[AUTH] Admin check error:', error);
    return { user: null, error: 'Ошибка проверки прав' };
  }
}
