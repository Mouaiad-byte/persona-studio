import { QueueAsset } from '../data/types'

function sizeLabel(bytes?: number): string {
  if (!bytes) return ''
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${Math.max(1, Math.round(bytes / 1024))} KB`
}

/**
 * What the reviewer looks at. Videos render as a muted inline element rather
 * than a still, because whether the motion holds up is most of what you are
 * judging; clicking opens the file at full size.
 */
export function AssetStrip({ assets }: { assets: QueueAsset[] }) {
  if (assets.length === 0) {
    return (
      <div className="asset-strip">
        <div className="asset-empty" title="Nothing generated yet">
          no
          <br />
          asset
        </div>
      </div>
    )
  }

  return (
    <div className="asset-strip">
      {assets.map((asset) => (
        <button
          key={asset.id}
          className="asset-thumb"
          title={`${asset.filename}${asset.bytes ? ` · ${sizeLabel(asset.bytes)}` : ''}`}
          onClick={() => window.open(asset.url, '_blank', 'noopener,noreferrer')}
        >
          {asset.kind === 'video' ? (
            <video src={asset.url} muted playsInline preload="metadata" />
          ) : (
            <img src={asset.url} alt={`Generated asset ${asset.filename}`} />
          )}
        </button>
      ))}
    </div>
  )
}
