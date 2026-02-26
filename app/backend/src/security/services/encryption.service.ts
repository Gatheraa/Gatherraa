import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { 
  createCipheriv, 
  createDecipheriv, 
  randomBytes, 
  scrypt, 
  createHash, 
  timingSafeEqual 
} from 'crypto';
import { promisify } from 'util';

export interface EncryptionResult {
  encrypted: string;
  iv: string;
  tag?: string;
  keyId?: string;
}

export interface KeyRotationResult {
  success: boolean;
  reencryptedCount: number;
  failedCount: number;
  errors: string[];
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly encryptionKeys = new Map<string, Buffer>();
  private readonly keyVersions = new Map<string, number>();
  private currentKeyId: string = 'default';

  constructor(private readonly configService: ConfigService) {
    this.initializeKeys();
  }

  private async initializeKeys(): Promise<void> {
    try {
      // Initialize primary encryption key
      const primaryKey = await this.deriveKey(
        this.configService.get<string>('ENCRYPTION_PRIMARY_KEY') || 'default-primary-key',
        this.configService.get<string>('ENCRYPTION_SALT') || 'default-salt'
      );
      
      this.encryptionKeys.set('default', primaryKey);
      this.keyVersions.set('default', 1);

      // Initialize backup key for key rotation
      const backupKey = await this.deriveKey(
        this.configService.get<string>('ENCRYPTION_BACKUP_KEY') || 'default-backup-key',
        this.configService.get<string>('ENCRYPTION_BACKUP_SALT') || 'default-backup-salt'
      );
      
      this.encryptionKeys.set('backup', backupKey);
      this.keyVersions.set('backup', 1);

      this.logger.log('Encryption keys initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize encryption keys:', error);
      throw error;
    }
  }

  async encrypt(data: string, keyId?: string): Promise<EncryptionResult> {
    const targetKeyId = keyId || this.currentKeyId;
    const key = this.encryptionKeys.get(targetKeyId);
    
    if (!key) {
      throw new Error(`Encryption key not found: ${targetKeyId}`);
    }

    try {
      const iv = randomBytes(16);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      
      let encrypted = cipher.update(data, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const tag = cipher.getAuthTag();
      
      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        keyId: targetKeyId,
      };
    } catch (error) {
      this.logger.error('Encryption failed:', error);
      throw new Error('Encryption operation failed');
    }
  }

  async decrypt(encryptedData: EncryptionResult): Promise<string> {
    const key = this.encryptionKeys.get(encryptedData.keyId || 'default');
    
    if (!key) {
      throw new Error(`Decryption key not found: ${encryptedData.keyId}`);
    }

    try {
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag || '', 'hex');
      
      const decipher = createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Decryption failed:', error);
      throw new Error('Decryption operation failed');
    }
  }

  async encryptField(data: any, keyId?: string): Promise<string> {
    const jsonString = JSON.stringify(data);
    const encrypted = await this.encrypt(jsonString, keyId);
    
    // Store all components in a single string
    return `${encrypted.keyId}:${encrypted.iv}:${encrypted.tag}:${encrypted.encrypted}`;
  }

  async decryptField(encryptedField: string): Promise<any> {
    try {
      const [keyId, iv, tag, encrypted] = encryptedField.split(':');
      
      const decryptedString = await this.decrypt({
        keyId,
        iv,
        tag,
        encrypted,
      });
      
      return JSON.parse(decryptedString);
    } catch (error) {
      this.logger.error('Field decryption failed:', error);
      throw new Error('Field decryption operation failed');
    }
  }

  async hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const passwordSalt = salt || randomBytes(32).toString('hex');
    const key = (await promisify(scrypt)(password, passwordSalt, 64)) as Buffer;
    const hash = key.toString('hex');
    
    return { hash, salt: passwordSalt };
  }

  async verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
    try {
      const key = (await promisify(scrypt)(password, salt, 64)) as Buffer;
      const hashBuffer = Buffer.from(hash, 'hex');
      
      return timingSafeEqual(key, hashBuffer);
    } catch (error) {
      this.logger.error('Password verification failed:', error);
      return false;
    }
  }

  async hashData(data: string): Promise<string> {
    return createHash('sha256').update(data).digest('hex');
  }

  async generateSecureToken(length: number = 32): Promise<string> {
    return randomBytes(length).toString('hex');
  }

  async rotateEncryptionKey(): Promise<KeyRotationResult> {
    const result: KeyRotationResult = {
      success: true,
      reencryptedCount: 0,
      failedCount: 0,
      errors: [],
    };

    try {
      // Generate new key
      const newKeyId = `key_${Date.now()}`;
      const newKey = await this.deriveKey(
        randomBytes(32).toString('hex'),
        randomBytes(16).toString('hex')
      );
      
      this.encryptionKeys.set(newKeyId, newKey);
      this.keyVersions.set(newKeyId, 1);

      // Update current key ID
      const oldKeyId = this.currentKeyId;
      this.currentKeyId = newKeyId;

      // In a real implementation, you would:
      // 1. Find all encrypted data with the old key
      // 2. Decrypt with old key and encrypt with new key
      // 3. Update database records
      // 4. Archive old key securely

      this.logger.log(`Key rotation completed: ${oldKeyId} -> ${newKeyId}`);
      
    } catch (error) {
      result.success = false;
      result.errors.push(error.message);
      this.logger.error('Key rotation failed:', error);
    }

    return result;
  }

  async encryptForTransit(data: string, publicKey?: string): Promise<string> {
    // In production, use RSA or ECDSA for asymmetric encryption
    // For now, we'll use symmetric encryption with a transit key
    const transitKey = await this.deriveKey(
      this.configService.get<string>('TRANSIT_KEY') || 'default-transit-key',
      this.configService.get<string>('TRANSIT_SALT') || 'default-transit-salt'
    );
    
    const iv = randomBytes(16);
    const cipher = createCipheriv('aes-256-cbc', transitKey, iv);
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return `${iv.toString('hex')}:${encrypted}`;
  }

  async decryptFromTransit(encryptedData: string): Promise<string> {
    const transitKey = await this.deriveKey(
      this.configService.get<string>('TRANSIT_KEY') || 'default-transit-key',
      this.configService.get<string>('TRANSIT_SALT') || 'default-transit-salt'
    );
    
    try {
      const [ivHex, encrypted] = encryptedData.split(':');
      const iv = Buffer.from(ivHex, 'hex');
      
      const decipher = createDecipheriv('aes-256-cbc', transitKey, iv);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      this.logger.error('Transit decryption failed:', error);
      throw new Error('Transit decryption operation failed');
    }
  }

  async generateKeyPair(): Promise<{ publicKey: string; privateKey: string }> {
    // In production, use proper key generation
    const publicKey = randomBytes(32).toString('hex');
    const privateKey = randomBytes(64).toString('hex');
    
    return { publicKey, privateKey };
  }

  async signData(data: string, privateKey: string): Promise<string> {
    // In production, use proper digital signatures (RSA/ECDSA)
    const hash = createHash('sha256').update(data + privateKey).digest('hex');
    return hash;
  }

  async verifySignature(data: string, signature: string, publicKey: string): Promise<boolean> {
    // In production, use proper signature verification
    const expectedHash = createHash('sha256').update(data + publicKey).digest('hex');
    return timingSafeEqual(Buffer.from(signature), Buffer.from(expectedHash));
  }

  getCurrentKeyId(): string {
    return this.currentKeyId;
  }

  getKeyVersion(keyId: string): number {
    return this.keyVersions.get(keyId) || 0;
  }

  async validateKeyIntegrity(): Promise<boolean> {
    try {
      // Test encryption/decryption with current key
      const testData = 'integrity-test-' + Date.now();
      const encrypted = await this.encrypt(testData);
      const decrypted = await this.decrypt(encrypted);
      
      return testData === decrypted;
    } catch (error) {
      this.logger.error('Key integrity validation failed:', error);
      return false;
    }
  }

  private async deriveKey(password: string, salt: string): Promise<Buffer> {
    return (await promisify(scrypt)(password, salt, 32)) as Buffer;
  }

  // Utility methods for database encryption
  async encryptSensitiveFields(data: Record<string, any>, fields: string[]): Promise<Record<string, any>> {
    const result = { ...data };
    
    for (const field of fields) {
      if (result[field] !== undefined && result[field] !== null) {
        result[field] = await this.encryptField(result[field]);
      }
    }
    
    return result;
  }

  async decryptSensitiveFields(data: Record<string, any>, fields: string[]): Promise<Record<string, any>> {
    const result = { ...data };
    
    for (const field of fields) {
      if (result[field] !== undefined && result[field] !== null) {
        try {
          result[field] = await this.decryptField(result[field]);
        } catch (error) {
          this.logger.warn(`Failed to decrypt field ${field}:`, error.message);
          // Keep original value if decryption fails
        }
      }
    }
    
    return result;
  }
}
