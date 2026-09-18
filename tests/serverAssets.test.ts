import { describe, expect, it } from 'vitest'
import {
  ALLOWED_EXTENSIONS,
  assetUrl,
  contentTypeFor,
  kindFor,
  safeFilename,
  safeItemId,
} from '../server/lib/assets.mjs'

describe('safeFilename', () => {
  it('accepts an ordinary generated filename unchanged', () => {
    expect(safeFilename('frame-01.png')).toBe('frame-01.png')
    expect(safeFilename('puck prep 02.mp4')).toBe('puck prep 02.mp4')
  })

  it.each([
    ['../../etc/passwd.png', 'path separator'],
    ['..\\windows\\system32\\a.png', 'path separator'],
    ['sub/dir/a.png', 'path separator'],
  ])('rejects traversal: %s', (name) => {
    expect(() => safeFilename(name)).toThrow(/path separator/)
  })

  it('rejects a dots-only name', () => {
    expect(() => safeFilename('..')).toThrow(/dots only/)
  })

  it('rejects a dotfile', () => {
    expect(() => safeFilename('.env')).toThrow(/start with a dot/)
  })

  it('rejects control characters, including a null byte', () => {
    expect(() => safeFilename('a\u0000.png')).toThrow(/control characters/)
    expect(() => safeFilename('a\n.png')).toThrow(/control characters/)
  })

  it('rejects an empty name', () => {
    expect(() => safeFilename('')).toThrow(/required/)
    expect(() => safeFilename(undefined)).toThrow(/required/)
  })

  it('rejects an over-long name', () => {
    expect(() => safeFilename(`${'a'.repeat(200)}.png`)).toThrow(/longer than/)
  })

  it('rejects a Windows device name', () => {
    expect(() => safeFilename('con.png')).toThrow(/reserved device name/)
    expect(() => safeFilename('LPT1.mp4')).toThrow(/reserved device name/)
  })

  it('rejects script-bearing types even though they are images or markup', () => {
    // Both execute script when served from the console's own origin.
    expect(() => safeFilename('diagram.svg')).toThrow(/not an allowed asset type/)
    expect(() => safeFilename('page.html')).toThrow(/not an allowed asset type/)
    expect(() => safeFilename('payload.js')).toThrow(/not an allowed asset type/)
  })

  it('rejects an extensionless name', () => {
    expect(() => safeFilename('frame')).toThrow(/not an allowed asset type/)
  })

  it('rejects a double extension whose final type is not allowed', () => {
    expect(() => safeFilename('frame.png.html')).toThrow(/not an allowed asset type/)
  })

  it('accepts an allowed extension in any case', () => {
    expect(safeFilename('FRAME.PNG')).toBe('FRAME.PNG')
  })
})

describe('contentTypeFor / kindFor', () => {
  it('maps every allowed extension to a type and a kind', () => {
    for (const extension of ALLOWED_EXTENSIONS) {
      const name = `asset${extension}`
      expect(contentTypeFor(name)).toMatch(/^(image|video)\//)
      expect(['image', 'video']).toContain(kindFor(name))
    }
  })

  it('classifies video separately from image', () => {
    expect(kindFor('a.mp4')).toBe('video')
    expect(kindFor('a.png')).toBe('image')
  })

  it('never yields a script-executing content type', () => {
    for (const extension of ALLOWED_EXTENSIONS) {
      expect(contentTypeFor(`a${extension}`)).not.toMatch(/svg|html|javascript/)
    }
  })
})

describe('assetUrl', () => {
  it('encodes a filename containing a space', () => {
    expect(assetUrl('q-3', 'puck prep.png')).toBe('/api/assets/q-3/puck%20prep.png')
  })
})

describe('safeItemId', () => {
  it('accepts a generated id', () => {
    expect(safeItemId('q-12')).toBe('q-12')
  })

  it.each(['../q-1', 'q/1', '', '.hidden', 'a'.repeat(100)])('rejects %s', (id) => {
    expect(() => safeItemId(id)).toThrow(/not a valid queue item id/)
  })
})
