#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { isAbsolute, resolve } from "node:path";
import { createPrivateKey, createSign } from "node:crypto";

function printUsage() {
  console.log(`Generate an Apple Music developer token from a .p8 key.

Usage:
  node scripts/generate-apple-music-token.mjs --team-id TEAM_ID --key-id KEY_ID --p8-path ~/Downloads/AuthKey_ABC123XYZ.p8 [--days 30]

You can also use environment variables:
  APPLE_TEAM_ID
  APPLE_KEY_ID
  APPLE_P8_PATH
  APPLE_TOKEN_TTL_DAYS

Examples:
  npm run generate:apple-music-token -- --team-id TEAM123ABC --key-id ABC123XYZ --p8-path ~/Downloads/AuthKey_ABC123XYZ.p8
  APPLE_TEAM_ID=TEAM123ABC APPLE_KEY_ID=ABC123XYZ APPLE_P8_PATH=~/Downloads/AuthKey_ABC123XYZ.p8 npm run generate:apple-music-token
`);
}

function expandPath(filePath) {
  if (!filePath) {
    return "";
  }

  if (filePath === "~") {
    return homedir();
  }

  if (filePath.startsWith("~/")) {
    return resolve(homedir(), filePath.slice(2));
  }

  return isAbsolute(filePath) ? filePath : resolve(process.cwd(), filePath);
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      options.help = true;
      continue;
    }

    if (!arg.startsWith("--")) {
      continue;
    }

    const name = arg.slice(2);
    const nextValue = argv[index + 1];

    if (!nextValue || nextValue.startsWith("--")) {
      throw new Error(`Missing value for --${name}`);
    }

    options[name] = nextValue;
    index += 1;
  }

  return options;
}

function base64UrlEncode(value) {
  return Buffer.from(value).toString("base64url");
}

function signJwt(signingInput, privateKeyPem) {
  const signer = createSign("sha256");
  signer.update(signingInput);
  signer.end();

  return signer.sign({
    key: createPrivateKey(privateKeyPem),
    dsaEncoding: "ieee-p1363",
  });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printUsage();
    process.exit(0);
  }

  const teamId = args["team-id"] ?? process.env.APPLE_TEAM_ID;
  const keyId = args["key-id"] ?? process.env.APPLE_KEY_ID;
  const rawP8Path = args["p8-path"] ?? process.env.APPLE_P8_PATH;
  const ttlDaysRaw = args.days ?? process.env.APPLE_TOKEN_TTL_DAYS ?? "30";
  const ttlDays = Number(ttlDaysRaw);

  if (!teamId || !keyId || !rawP8Path) {
    printUsage();
    throw new Error("Missing required Apple Music token inputs.");
  }

  if (!Number.isFinite(ttlDays) || ttlDays <= 0) {
    throw new Error("--days must be a positive number.");
  }

  const p8Path = expandPath(rawP8Path);
  const privateKeyPem = readFileSync(p8Path, "utf8");
  const now = Math.floor(Date.now() / 1000);
  const expiresAt = now + Math.floor(ttlDays * 24 * 60 * 60);

  const header = {
    alg: "ES256",
    kid: keyId,
    typ: "JWT",
  };

  const payload = {
    iss: teamId,
    iat: now,
    exp: expiresAt,
  };

  const signingInput = `${base64UrlEncode(JSON.stringify(header))}.${base64UrlEncode(JSON.stringify(payload))}`;
  const signature = signJwt(signingInput, privateKeyPem).toString("base64url");
  const token = `${signingInput}.${signature}`;

  console.log("");
  console.log("Apple Music developer token:");
  console.log(token);
  console.log("");
  console.log("Add this to iliterate/.env.local:");
  console.log(`APPLE_MUSIC_DEVELOPER_TOKEN=${token}`);
  console.log("");
  console.log(`Token expires at: ${new Date(expiresAt * 1000).toISOString()}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
