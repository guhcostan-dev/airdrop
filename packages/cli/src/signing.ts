import crypto from "node:crypto";
import fs from "node:fs";
import { signingMessage, type SignableUpdate } from "@rn-airdrop/core";

/**
 * Keys are ECDSA P-256. The public key is distributed as the base64 of the
 * 65-byte uncompressed point (0x04 || X || Y) because that is what both
 * iOS (SecKeyCreateWithData) and Android (via a fixed SPKI prefix) import
 * without any ASN.1 parsing.
 */
export function generateKeyPair(): { privateKeyPem: string; publicKey: string } {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return {
    privateKeyPem: privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    publicKey: rawPublicKey(publicKey),
  };
}

export function rawPublicKey(key: crypto.KeyObject): string {
  const jwk = key.export({ format: "jwk" });
  if (jwk.crv !== "P-256" || !jwk.x || !jwk.y) throw new Error("expected a P-256 key");
  return Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x, "base64url"), Buffer.from(jwk.y, "base64url")]).toString(
    "base64",
  );
}

export function loadPrivateKey(file: string): crypto.KeyObject {
  const key = crypto.createPrivateKey(fs.readFileSync(file));
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1")
    throw new Error(`${file} is not a P-256 private key`);
  return key;
}

export function publicKeyFromPrivate(key: crypto.KeyObject): string {
  return rawPublicKey(crypto.createPublicKey(key));
}

/** Returns a base64 DER signature. */
export function signUpdate(update: SignableUpdate, key: crypto.KeyObject): string {
  return crypto.sign("sha256", Buffer.from(signingMessage(update), "utf8"), key).toString("base64");
}

export function verifyUpdate(update: SignableUpdate, signature: string, publicKey: string): boolean {
  const raw = Buffer.from(publicKey, "base64");
  const key = crypto.createPublicKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x: raw.subarray(1, 33).toString("base64url"),
      y: raw.subarray(33, 65).toString("base64url"),
    },
    format: "jwk",
  });
  return crypto.verify("sha256", Buffer.from(signingMessage(update), "utf8"), key, Buffer.from(signature, "base64"));
}
