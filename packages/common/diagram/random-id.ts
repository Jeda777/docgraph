// Web Crypto is global in browsers and Node 19+; declared here because this package
// is type-checked without DOM or Node types.
declare const crypto: { randomUUID: () => string }

export const randomId = () => crypto.randomUUID()
