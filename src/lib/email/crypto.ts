import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// AES-256-GCM symmetric encryption for SMTP passwords stored in Supabase.
// Key must be a 32-byte hex string in env var EMAIL_ENCRYPTION_KEY.
// If the key is not set (local dev), encrypt/decrypt are no-ops that return the value as-is.

const ALG = "aes-256-gcm";

function getKey(): Buffer | null {
  const hex = process.env.EMAIL_ENCRYPTION_KEY;
  if (!hex || hex.length < 64) return null;
  return Buffer.from(hex.slice(0, 64), "hex");
}

export function encryptPassword(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // local dev fallback — not for production

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALG, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: iv(24 hex) + tag(32 hex) + ciphertext(hex)
  return iv.toString("hex") + tag.toString("hex") + encrypted.toString("hex");
}

export function decryptPassword(stored: string): string {
  const key = getKey();
  if (!key) return stored; // local dev fallback

  try {
    const iv = Buffer.from(stored.slice(0, 24), "hex");
    const tag = Buffer.from(stored.slice(24, 56), "hex");
    const ciphertext = Buffer.from(stored.slice(56), "hex");

    const decipher = createDecipheriv(ALG, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(ciphertext).toString("utf8") + decipher.final("utf8");
  } catch {
    return ""; // decryption failed — treat as no password
  }
}
