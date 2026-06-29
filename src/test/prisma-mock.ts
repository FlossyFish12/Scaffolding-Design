export class PrismaClientKnownRequestError extends Error {
  code: string
  clientVersion: string
  constructor(message: string, { code, clientVersion }: { code: string; clientVersion: string }) {
    super(message)
    this.code = code
    this.clientVersion = clientVersion
  }
}
