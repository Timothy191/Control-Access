import crypto from 'crypto';

/**
 * Replicates Python's Fernet decryption.
 * A Fernet key is a 32-byte url-safe base64 string.
 * Decoded, the first 16 bytes are the signing key, and the last 16 bytes are the encryption key.
 */
export class Fernet {
  private signingKey: Buffer;
  private encryptionKey: Buffer;

  constructor(key: string) {
    const keyBuf = Buffer.from(key, 'base64url');
    if (keyBuf.length !== 32) {
      throw new Error('Fernet key must be 32 url-safe base64-encoded bytes.');
    }
    this.signingKey = keyBuf.subarray(0, 16);
    this.encryptionKey = keyBuf.subarray(16);
  }

  /**
   * Decrypts a Fernet token.
   * @param token The base64url encoded token to decrypt.
   * @returns The decrypted plaintext string.
   */
  public decrypt(token: string): string {
    const tokenData = Buffer.from(token, 'base64url');
    
    // Fernet format:
    // Version (1 byte) | Timestamp (8 bytes) | IV (16 bytes) | Ciphertext (variable) | HMAC (32 bytes)
    if (tokenData.length < 57) { // 1 + 8 + 16 + 32 = 57 bytes min
      throw new Error('Fernet token is too short');
    }

    const version = tokenData[0];
    if (version !== 0x80) {
      throw new Error('Unsupported Fernet version');
    }

    // Extract parts
    const expectedHmac = tokenData.subarray(tokenData.length - 32);
    const dataToSign = tokenData.subarray(0, tokenData.length - 32);
    const iv = tokenData.subarray(9, 25);
    const ciphertext = tokenData.subarray(25, tokenData.length - 32);

    // Verify HMAC
    const hmac = crypto.createHmac('sha256', this.signingKey);
    hmac.update(dataToSign);
    const actualHmac = hmac.digest();

    if (!crypto.timingSafeEqual(expectedHmac, actualHmac)) {
      throw new Error('Invalid Fernet token (HMAC mismatch)');
    }

    // Decrypt AES-128-CBC
    const decipher = crypto.createDecipheriv('aes-128-cbc', this.encryptionKey, iv);
    let plaintext = decipher.update(ciphertext);
    plaintext = Buffer.concat([plaintext, decipher.final()]);

    return plaintext.toString('utf-8');
  }

  /**
   * Encrypts a plaintext string into a Fernet token.
   * @param plaintext The string to encrypt.
   * @returns The base64url encoded Fernet token.
   */
  public encrypt(plaintext: string): string {
    const version = Buffer.from([0x80]);
    const timestamp = Buffer.alloc(8);
    // Write current timestamp in seconds
    const now = Math.floor(Date.now() / 1000);
    // Need to write 64-bit integer (BE)
    timestamp.writeBigUInt64BE(BigInt(now));
    
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipheriv('aes-128-cbc', this.encryptionKey, iv);
    let ciphertext = cipher.update(Buffer.from(plaintext, 'utf-8'));
    ciphertext = Buffer.concat([ciphertext, cipher.final()]);
    
    const dataToSign = Buffer.concat([version, timestamp, iv, ciphertext]);
    
    const hmac = crypto.createHmac('sha256', this.signingKey);
    hmac.update(dataToSign);
    const actualHmac = hmac.digest();
    
    const token = Buffer.concat([dataToSign, actualHmac]);
    return token.toString('base64url');
  }
}

/**
 * Deterministically derives the 32-byte key from a secret string, just like Python's implementation:
 * hashlib.sha256(secret.encode()).digest() then base64.urlsafe_b64encode
 */
export function deriveKeyFromSecret(secret: string): string {
  const hash = crypto.createHash('sha256').update(secret, 'utf-8').digest();
  return hash.toString('base64url');
}

/**
 * Field-level encryption service singleton.
 * Uses FIELD_ENCRYPTION_KEY or derives from SECRET_KEY.
 */
let fernetInstance: Fernet | null = null;

export function getFernet(): Fernet | null {
  if (fernetInstance) return fernetInstance;
  
  const key = process.env.FIELD_ENCRYPTION_KEY;
  if (key) {
    fernetInstance = new Fernet(key);
    return fernetInstance;
  }
  
  const secret = process.env.SECRET_KEY;
  if (secret) {
    const derived = deriveKeyFromSecret(secret);
    fernetInstance = new Fernet(derived);
    return fernetInstance;
  }
  
  return null;
}

export function encryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const f = getFernet();
  if (!f) return value; // Return plaintext if no key (as per Python implementation)
  
  const marker = 'enc:';
  if (value.startsWith(marker)) return value; // Already encrypted
  
  return marker + f.encrypt(value);
}

export function decryptField(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const marker = 'enc:';
  if (!value.startsWith(marker)) return value; // Not encrypted
  
  const f = getFernet();
  if (!f) return value; // Cannot decrypt
  
  try {
    const token = value.slice(marker.length);
    return f.decrypt(token);
  } catch (error) {
    console.error('Failed to decrypt field', error);
    return value; // Fallback to returning ciphertext
  }
}
