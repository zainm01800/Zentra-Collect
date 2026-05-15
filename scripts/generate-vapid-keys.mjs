#!/usr/bin/env node
/**
 * scripts/generate-vapid-keys.mjs
 *
 * Generates a VAPID key pair for Web Push notifications.
 * Run once, then add the output to your .env.local and Vercel env vars.
 *
 * Usage:
 *   node scripts/generate-vapid-keys.mjs
 *
 * Required env vars (copy output into .env.local):
 *   NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>   ← exposed to browser (safe)
 *   VAPID_PRIVATE_KEY=<privateKey>             ← server-only, keep secret
 *   VAPID_SUBJECT=mailto:hello@zentracollect.co.uk
 *   CRON_SECRET=<random-secret>                ← protects /api/push/send
 */

import webpush from "web-push";

const keys = webpush.generateVAPIDKeys();

console.log("\n✅  VAPID keys generated. Add these to .env.local and Vercel:\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${keys.publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${keys.privateKey}`);
console.log(`VAPID_SUBJECT=mailto:hello@zentracollect.co.uk`);
console.log(`CRON_SECRET=${generateSecret()}`);
console.log(`\n⚠️  VAPID_PRIVATE_KEY and CRON_SECRET are secrets — never commit to git.\n`);

function generateSecret(length = 32) {
  // Simple hex secret without crypto dependency
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
}
