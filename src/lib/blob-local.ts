// Local file storage fallback for dev — replaces @vercel/blob put/del
import { mkdir, writeFile, unlink } from 'fs/promises'
import path from 'path'

const BLOB_DIR = path.join(process.cwd(), 'public', 'blob')

export async function putLocal(key: string, file: File, _opts?: unknown): Promise<{ url: string }> {
  const dest = path.join(BLOB_DIR, key)
  await mkdir(path.dirname(dest), { recursive: true })
  const buf = Buffer.from(await file.arrayBuffer())
  await writeFile(dest, buf)
  return { url: `/blob/${key}` }
}

export async function delLocal(url: string) {
  try { await unlink(path.join(process.cwd(), 'public', url)) } catch {}
}
