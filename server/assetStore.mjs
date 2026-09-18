import { createWriteStream, mkdirSync, readdirSync, renameSync, statSync, unlinkSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { pipeline } from 'node:stream/promises'
import { config } from './config.mjs'
import { assetUrl, contentTypeFor, kindFor, safeFilename, safeItemId } from './lib/assets.mjs'

/**
 * Generated assets on disk, at `data/assets/<itemId>/<filename>`.
 *
 * The filesystem is the source of truth — nothing about assets is duplicated in
 * queue.json. A file dropped into an item's folder by hand shows up in the
 * console on the next read, which is the workflow when you generate in Claude
 * and save the result yourself.
 */

const MAX_ASSET_BYTES = 64 * 1024 * 1024

function assetsRoot() {
  return resolve(config.dataDir, 'assets')
}

/**
 * Absolute path for one asset, verified to sit inside the assets root.
 *
 * safeFilename already rejects separators and traversal, so this is the second
 * of two independent checks rather than the only one: a containment assert that
 * holds even if the naming rules are ever loosened.
 *
 * @param {string} itemId
 * @param {string} filename
 */
export function resolveAssetPath(itemId, filename) {
  const root = assetsRoot()
  const path = resolve(root, safeItemId(itemId), safeFilename(filename))
  if (path !== root && !path.startsWith(root + sep)) {
    throw new Error('resolved asset path escapes the assets directory')
  }
  return path
}

/**
 * Assets attached to one item, oldest first.
 *
 * Unreadable or disallowed files are skipped rather than thrown: a stray
 * `.DS_Store` in the folder should not take down the whole queue view.
 *
 * @param {string} itemId
 */
export function listAssets(itemId) {
  let names
  try {
    names = readdirSync(resolve(assetsRoot(), safeItemId(itemId)))
  } catch (error) {
    if (error && /** @type {any} */ (error).code === 'ENOENT') return []
    throw error
  }

  const assets = []
  for (const name of names) {
    let filename
    try {
      filename = safeFilename(name)
    } catch {
      continue
    }
    try {
      const stats = statSync(resolveAssetPath(itemId, filename))
      if (!stats.isFile()) continue
      assets.push({
        id: `${itemId}/${filename}`,
        filename,
        url: assetUrl(itemId, filename),
        kind: kindFor(filename),
        contentType: contentTypeFor(filename),
        bytes: stats.size,
        addedAt: stats.mtime.toISOString(),
      })
    } catch {
      continue
    }
  }
  return assets.sort((a, b) => (a.addedAt < b.addedAt ? -1 : a.addedAt > b.addedAt ? 1 : 0))
}

/**
 * Stream an upload to disk, refusing anything over the cap mid-transfer rather
 * than after buffering it. Writes to a temp file and renames, so an aborted
 * upload cannot leave a truncated asset that looks complete.
 *
 * @param {string} itemId
 * @param {string} filename
 * @param {import('node:stream').Readable} source
 */
export async function saveAsset(itemId, filename, source) {
  const target = resolveAssetPath(itemId, filename)
  mkdirSync(resolve(assetsRoot(), safeItemId(itemId)), { recursive: true })

  const temp = `${target}.part`
  let written = 0
  let tooLarge = false

  source.on('data', (chunk) => {
    written += chunk.length
    if (written > MAX_ASSET_BYTES && !tooLarge) {
      tooLarge = true
      source.destroy(new Error(`asset is larger than ${MAX_ASSET_BYTES / 1024 / 1024} MB`))
    }
  })

  try {
    await pipeline(source, createWriteStream(temp))
  } catch (error) {
    try {
      unlinkSync(temp)
    } catch {
      // Nothing to clean up.
    }
    throw error
  }

  if (written === 0) {
    unlinkSync(temp)
    throw new Error('asset upload was empty')
  }

  renameSync(temp, target)
  return listAssets(itemId).find((asset) => asset.filename === filename)
}

/**
 * Attach each item's assets for the snapshot. Derived, never persisted — see
 * stripDerived before anything is written back to queue.json.
 *
 * @param {Array<any>} queue
 */
export function decorateQueue(queue) {
  return queue.map((item) => ({ ...item, assets: listAssets(item.id) }))
}

/**
 * Remove derived fields before writing. The filesystem owns assets; storing
 * them in queue.json too would give us two answers to the same question.
 *
 * @param {Array<any>} queue
 */
export function stripDerived(queue) {
  return queue.map((item) => {
    const { assets, ...rest } = item
    void assets
    return rest
  })
}
