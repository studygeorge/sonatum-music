import { createHash, randomBytes, pbkdf2Sync } from 'crypto';

export class PasswordService {
  private static readonly SALT_LENGTH = 32;
  private static readonly ITERATIONS = 100000;
  private static readonly KEY_LENGTH = 64;
  private static readonly DIGEST = 'sha512';

  static async hash(password: string): Promise<string> {
    const salt = randomBytes(this.SALT_LENGTH).toString('hex');
    const hash = pbkdf2Sync(
      password,
      salt,
      this.ITERATIONS,
      this.KEY_LENGTH,
      this.DIGEST
    ).toString('hex');
    
    return `${salt}:${hash}`;
  }

  static async verify(password: string, storedHash: string): Promise<boolean> {
    const [salt, originalHash] = storedHash.split(':');
    const hash = pbkdf2Sync(
      password,
      salt,
      this.ITERATIONS,
      this.KEY_LENGTH,
      this.DIGEST
    ).toString('hex');
    
    return hash === originalHash;
  }
}