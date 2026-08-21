import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from './env';

/**
 * AES-256-GCM for refresh tokens at rest.
 *
 * Storing refresh tokens in plaintext means a read-only DB leak is a full
 * account compromise across every connected inbox. Encrypting with a key held
 * in the environment means an attacker needs both the database and the
 * deployment's env to use anything they steal.
 *
 * Wire format: base64( iv[12] | authTag[16] | ciphertext )
 */

const IV_LEN = 12;
const TAG_LEN = 16;

function key(): Buffer {
  const k = Buffer.from(env.tokenEncKey(), 'base64');
  if (k.length !== 32) {
    throw new Error('TOKEN_ENC_KEY must be 32 bytes base64-encoded (openssl rand -base64 32)');
  }
  return k;
}

export function encrypt(plaintext: string): string {
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), ct]).toString('base64');
}

export function decrypt(payload: string): string {
  const buf = Buffer.from(payload, 'base64');
  const iv = buf.subarray(0, IV_LEN);
  const tag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
  const ct = buf.subarray(IV_LEN + TAG_LEN);
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ct), decipher.final()]).toString('utf8');
}
