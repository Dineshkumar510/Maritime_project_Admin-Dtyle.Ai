const crypto = require('crypto');

const ALGORITHM = 'aes-256-cbc';
const KEY_LENGTH = 32; 

function getKey() {
  const raw = process.env.SHIP_URL_ENCRYPT_KEY || 'MRT_DTYLE_2024_SEC_KEY_32BYTES!!';
  return Buffer.from(raw.padEnd(KEY_LENGTH, '0').slice(0, KEY_LENGTH), 'utf8');
}


function encrypt(plaintext) {
  if (!plaintext) return plaintext;          
  const iv     = crypto.randomBytes(16);       
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
}


function decrypt(value) {
  if (!value || !value.includes(':')) return value;  
  try {
    const [ivHex, ciphertextHex] = value.split(':');
    const iv         = Buffer.from(ivHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const decipher   = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    const decrypted  = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    console.warn('[crypto] decrypt failed, returning raw value:', err.message);
    return value;   
  }
}

module.exports = { encrypt, decrypt };