export function buildLoginMessage(address: string, nonce: string): string {
  return `Sign this message to login your account.\n\nAddress: ${address}\nNonce: ${nonce}`;
}

export function buildRegisterMessage(
  address: string,
  nonce: string,
  refCode: string,
): string {
  return `Sign this message to register your account.\n\nAddress: ${address}\nNonce: ${nonce}\nReferral Code: ${refCode}`;
}
