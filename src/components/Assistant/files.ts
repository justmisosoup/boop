import type { Attachment } from '../../lib/useAnalysis'

/**
 * A file, as the analysis endpoint takes it: name, type, size and its bytes
 * in base64. The endpoint writes it to `analysis/attachments/<id>/` and the
 * session reads it from there.
 */
export const readFile = (file: File) =>
  new Promise<Attachment>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      resolve({
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataBase64: String(reader.result).replace(/^data:[^;]*;base64,/, '')
      })
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
