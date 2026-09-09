import crypto from "crypto";

/**
 * Verifies a Werkzeug pbkdf2 or scrypt password hash.
 * Examples of hashes:
 * pbkdf2:sha256:600000$salt$hash
 * scrypt:32768:8:1$salt$hash
 */
export async function verifyWerkzeugHash(
  hashString: string,
  password: string
): Promise<boolean> {
  if (hashString.startsWith("pbkdf2:")) {
    return verifyPbkdf2(hashString, password);
  } else if (hashString.startsWith("scrypt:")) {
    return verifyScrypt(hashString, password);
  } else {
    // Unsupported format
    console.warn("Unsupported hash format:", hashString.split("$")[0]);
    return false;
  }
}

function verifyPbkdf2(hashString: string, password: string): boolean {
  // pbkdf2:sha256:iterations$salt$hash
  const parts = hashString.split("$");
  if (parts.length !== 3) return false;

  const methodArgs = parts[0].split(":");
  if (methodArgs.length !== 3) return false;

  const algo = methodArgs[1]; // sha256
  const iterations = parseInt(methodArgs[2], 10);
  const salt = parts[1];
  const expectedHash = parts[2];

  const derivedKey = crypto.pbkdf2Sync(
    password,
    salt,
    iterations,
    expectedHash.length / 2, // length in bytes (hex string length / 2)
    algo
  );

  return derivedKey.toString("hex") === expectedHash;
}

function verifyScrypt(hashString: string, password: string): boolean {
  // scrypt:N:r:p$salt$hash
  const parts = hashString.split("$");
  if (parts.length !== 3) return false;

  const methodArgs = parts[0].split(":");
  if (methodArgs.length !== 4) return false;

  const N = parseInt(methodArgs[1], 10);
  const r = parseInt(methodArgs[2], 10);
  const p = parseInt(methodArgs[3], 10);
  const salt = parts[1];
  const expectedHash = parts[2];

  // Scrypt key length in Werkzeug is typically 32 (when base64 encoded, but wait, hex or base64?)
  // Wait, Werkzeug's generate_password_hash generates hex or base64?
  // Usually Werkzeug generates base64 for scrypt and hex for pbkdf2. Let's check python output.
  // Actually, pbkdf2 produces hex string. Scrypt might produce base64? No, Werkzeug uses hex for scrypt too.
  const derivedKey = crypto.scryptSync(password, salt, expectedHash.length / 2, { N, r, p });
  
  return derivedKey.toString("hex") === expectedHash;
}
