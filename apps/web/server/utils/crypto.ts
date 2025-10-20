const encoder = new TextEncoder()

const toBase64 = (buffer: ArrayBuffer): string => {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(buffer).toString('base64')
  }
  let binary = ''
  const bytes = new Uint8Array(buffer)
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }
  return btoa(binary)
}

const toHex = (buffer: ArrayBuffer): string => {
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

export const hmacSha256Base64 = async (secret: string, message: string): Promise<string> => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(message))
  return toBase64(signature)
}

export const deriveTopicSuffix = async (deviceId: string, secret: string): Promise<string> => {
  const digest = await crypto.subtle.digest('SHA-256', encoder.encode(`${deviceId}:${secret}`))
  return toHex(digest).slice(0, 10)
}
