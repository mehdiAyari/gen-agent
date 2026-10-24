/** Hex SHA-256 of a text, with Web Crypto: the same in Node and in browsers. */
export async function sha256(content: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(content));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
