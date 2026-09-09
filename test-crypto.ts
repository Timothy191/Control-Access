import { deriveKeyFromSecret, getFernet, encryptField, decryptField, Fernet } from './src/lib/crypto';
import crypto from 'crypto';

function runTests() {
  console.log('--- Testing Crypto Parity ---');
  
  const testSecret = 'my-development-secret-key-12345';
  process.env.SECRET_KEY = testSecret;

  // Derive key the Python way: hashlib.sha256(secret.encode()).digest() -> base64.urlsafe_b64encode
  const derivedKey = deriveKeyFromSecret(testSecret);
  console.log(`Derived Key from secret: ${derivedKey}`);

  const fernet = getFernet();
  if (!fernet) {
    console.error('Failed to initialize Fernet from environment variables');
    process.exit(1);
  }

  const plaintext = '1234567890-ID';
  const encrypted = encryptField(plaintext);
  console.log(`Plaintext: ${plaintext}`);
  console.log(`Encrypted: ${encrypted}`);

  const decrypted = decryptField(encrypted);
  console.log(`Decrypted: ${decrypted}`);

  if (decrypted !== plaintext) {
    console.error('ERROR: Decrypted value does not match original plaintext');
    process.exit(1);
  } else {
    console.log('SUCCESS: Encryption and decryption match perfectly!');
  }
}

runTests();
