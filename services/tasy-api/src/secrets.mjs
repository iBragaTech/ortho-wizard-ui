import { createDecipheriv } from "node:crypto";
import { readFile } from "node:fs/promises";

const encodedKeyLength = 32;

function decodeBase64(value, label) {
  const decoded = Buffer.from(value.trim(), "base64");
  if (!decoded.length) throw new Error(`${label} vazio.`);
  return decoded;
}

export async function readEncryptedSecret({ encryptedValue, keyFile, fallbackValue }) {
  if (fallbackValue && !encryptedValue) return fallbackValue;
  if (!encryptedValue || !keyFile) throw new Error("Segredo cifrado não configurado.");

  const key = decodeBase64(await readFile(keyFile, "utf8"), "Chave de descriptografia");
  if (key.length !== encodedKeyLength) throw new Error("Chave de descriptografia inválida.");

  const parts = encryptedValue.split(":");
  if (parts.length !== 5 || parts[0] !== "aes-256-gcm" || parts[1] !== "v1") {
    throw new Error("Formato de segredo cifrado inválido.");
  }
  const iv = decodeBase64(parts[2], "IV");
  const tag = decodeBase64(parts[3], "Tag");
  const ciphertext = decodeBase64(parts[4], "Texto cifrado");
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Metadados de segredo inválidos.");

  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
