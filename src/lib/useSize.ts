import { useEffect, useRef, useState } from 'react'

/** Measured content width of an element, so SVG geometry is in real pixels. */
export function useSize<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [width, setWidth] = useState(640)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setWidth(w)
    })
    observer.observe(el)
    setWidth(el.getBoundingClientRect().width || 640)
    return () => observer.disconnect()
  }, [])

  return { ref, width }
}
