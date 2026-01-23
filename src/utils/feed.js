// Feed scrolling controller: step-by-step vertical snapping with wheel/keys/touch
// Usage:
//   const ctrl = createFeedController({
//     getItemCount: () => items.value.length,
//     onIndexChange: (idx) => { /* update UI */ },
//     onMaybeLoadMore: (idx) => { /* pagination */ },
//     gap: 0,
//     initialIndex: 0,
//     smoothMs: 360,
//   })
//   onMounted(() => ctrl.mount(feedRef.value))
//   onBeforeUnmount(() => ctrl.unmount())

export function createFeedController({ getItemCount, onIndexChange, onMaybeLoadMore, gap = 0, initialIndex = 0, smoothMs = 360 }) {
  let feedEl = null
  let index = initialIndex || 0
  let isAnimating = false
  let animTimer = null
  let queuedDir = 0

  const stride = () => {
    if (!feedEl) return 0
    return Math.max(1, feedEl.clientHeight - gap)
  }
  const clamp = (i) => {
    const max = Math.max(0, (getItemCount?.() || 1) - 1)
    if (i < 0) return 0
    if (i > max) return max
    return i
  }
  const goTo = (i) => {
    if (!feedEl) return
    const target = clamp(i)
    index = target
    onIndexChange && onIndexChange(index)
    isAnimating = true
    feedEl.scrollTo({ top: target * stride(), behavior: 'smooth' })
    if (animTimer) clearTimeout(animTimer)
    animTimer = setTimeout(() => {
      isAnimating = false
      if (queuedDir) {
        const dir = queuedDir; queuedDir = 0
        goTo(index + dir)
      }
    }, smoothMs)
    onMaybeLoadMore && onMaybeLoadMore(target)
  }

  const onWheel = (e) => {
    if (!feedEl) return
    if (!feedEl.contains(e.target)) return
    if (isAnimating) { e.preventDefault(); queuedDir = Math.sign(e.deltaY); return }
    const dy = e.deltaY
    if (Math.abs(dy) < 8) return
    e.preventDefault()
    goTo(index + (dy > 0 ? 1 : -1))
  }
  const onKey = (e) => {
    if (isAnimating) return
    switch (e.key) {
      case 'ArrowDown': case ' ': case 'PageDown': e.preventDefault(); goTo(index + (e.key === 'PageDown' ? 5 : 1)); break
      case 'ArrowUp': case 'PageUp': e.preventDefault(); goTo(index - (e.key === 'PageUp' ? 5 : 1)); break
      case 'Home': e.preventDefault(); goTo(0); break
      case 'End': e.preventDefault(); goTo(getItemCount() - 1); break
    }
  }
  let touchStartY = 0, touchDeltaY = 0
  const onTouchStart = (ev) => { const t = ev.touches && ev.touches[0]; if (!t) return; touchStartY = t.clientY; touchDeltaY = 0 }
  const onTouchMove = (ev) => { const t = ev.touches && ev.touches[0]; if (!t) return; touchDeltaY = t.clientY - touchStartY }
  const onTouchEnd = () => { const THRESH = 60; if (Math.abs(touchDeltaY) > THRESH) goTo(index + (touchDeltaY < 0 ? 1 : -1)); touchStartY = 0; touchDeltaY = 0 }
  const onScroll = () => {
    if (!feedEl || isAnimating) return
    const s = stride(); if (!s) return
    const idx = Math.round(feedEl.scrollTop / s)
    if (idx !== index) { index = clamp(idx); onIndexChange && onIndexChange(index) }
  }
  const onResize = () => { goTo(index) }

  const mount = (el) => {
    feedEl = el
    if (!feedEl) return
    feedEl.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: false })
    window.addEventListener('keydown', onKey, { passive: false })
    window.addEventListener('resize', onResize)
    feedEl.addEventListener('touchstart', onTouchStart, { passive: true })
    feedEl.addEventListener('touchmove', onTouchMove, { passive: true })
    feedEl.addEventListener('touchend', onTouchEnd, { passive: true })
    // initial align
    setTimeout(() => goTo(index), 0)
  }

  const unmount = () => {
    if (!feedEl) return
    feedEl.removeEventListener('scroll', onScroll)
    window.removeEventListener('wheel', onWheel)
    window.removeEventListener('keydown', onKey)
    window.removeEventListener('resize', onResize)
    feedEl.removeEventListener('touchstart', onTouchStart)
    feedEl.removeEventListener('touchmove', onTouchMove)
    feedEl.removeEventListener('touchend', onTouchEnd)
    feedEl = null
  }

  return { mount, unmount, goTo }
}
