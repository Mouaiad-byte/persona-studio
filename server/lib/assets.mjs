/**
 * Asset naming and typing rules.
 *
 * Pure, and tested hard, because this is the layer standing between a filename
 * someone chose and the local filesystem. Everything here refuses rather than
 * repairs: a name that is not obviously safe is not quietly rewritten into
 * something safe-looking, it is rejected.
 */

/** Only what a review actually needs to display. Note what is absent. */
const TYPES = {
  '.png': { contentType: 'image/png', kind: 'image' },
  '.jpg': { contentType: 'image/jpeg', kind: 'image' },
  '.jpeg': { contentType: 'image/jpeg', kind: 'image' },
  '.webp': { contentType: 'image/webp', kind: 'image' },
  '.gif': { contentType: 'image/gif', kind: 'image' },
  '.mp4': { contentType: 'video/mp4', kind: 'video' },
  '.webm': { contentType: 'video/webm', kind: 'video' },
  '.mov': { contentType: 'video/quicktime', kind: 'video' },
}

export const ALLOWED_EXTENSIONS = Object.keys(TYPES)

const MAX_NAME_LENGTH = 120

/**
 * A filename safe to join onto a directory path.
 *
 * Rejects anything with a path separator, any traversal, control characters, a
 * leading dot, or a Windows-reserved device name. `.svg` and `.html` are absent
 * from the type table on purpose: both execute script when served, and serving
 * them from a local origin alongside the console would be a stored-XSS hole
 * against the operator's own browser.
 *
 * @param {unknown} name
 * @returns {string} the name, unchanged, when it is safe
 */
export function safeFilename(name) {
  const value = String(name ?? '')
  if (!value) throw new Error('asset filename is required')
  if (value.length > MAX_NAME_LENGTH) {
    throw new Error(`asset filename is longer than ${MAX_NAME_LENGTH} characters`)
  }
  if (value.includes('/') || value.includes('\\')) {
    throw new Error('asset filename may not contain a path separator')
  }
  // Catches '..' itself and any name that is only dots.
  if (/^\.+$/.test(value)) throw new Error('asset filename may not be dots only')
  if (value.startsWith('.')) throw new Error('asset filename may not start with a dot')
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(value)) {
    throw new Error('asset filename may not contain control characters')
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._ -]*$/.test(value)) {
    throw new Error('asset filename may only contain letters, numbers, dot, dash, underscore and space')
  }
  if (/^(con|prn|aux|nul|com\d|lpt\d)(\.|$)/i.test(value)) {
    throw new Error(`"${value}" is a reserved device name`)
  }
  extensionOf(value) // throws when the type is not allowed
  return value
}

/** @param {string} filename */
function extensionOf(filename) {
  const at = filename.lastIndexOf('.')
  const extension = at === -1 ? '' : filename.slice(at).toLowerCase()
  if (!TYPES[extension]) {
    throw new Error(
      `"${extension || filename}" is not an allowed asset type — expected one of ${ALLOWED_EXTENSIONS.join(', ')}`,
    )
  }
  return extension
}

/** @param {string} filename */
export function contentTypeFor(filename) {
  return TYPES[extensionOf(filename)].contentType
}

/** @param {string} filename @returns {'image' | 'video'} */
export function kindFor(filename) {
  return /** @type {'image' | 'video'} */ (TYPES[extensionOf(filename)].kind)
}

/**
 * The URL the console loads an asset from. Encoded, because a safe filename may
 * still contain a space.
 *
 * @param {string} itemId
 * @param {string} filename
 */
export function assetUrl(itemId, filename) {
  return `/api/assets/${encodeURIComponent(itemId)}/${encodeURIComponent(filename)}`
}

/**
 * Queue ids are used as directory names, so they get the same treatment —
 * narrower, since the server generates them.
 *
 * @param {unknown} id
 */
export function safeItemId(id) {
  const value = String(id ?? '')
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(value)) {
    throw new Error(`"${value}" is not a valid queue item id`)
  }
  return value
}
