// Open a PDF in a new tab reliably — even from async handlers.
//
// Both window.open() and anchor.click() with target="_blank" lose the trusted
// user-gesture context after the first await, so browsers block them as popups.
// Solution: open a blank tab synchronously (before any await), then navigate
// it to the blob URL once the data arrives.
//
// Usage:
//   const pdfTab = openPdfTab()          // call BEFORE await — synchronous
//   const blob  = await someApi.pdf(id)  // async fetch
//   pdfTab(blob)                          // navigate the already-open tab

export function openPdfTab() {
  const win = window.open('about:blank', '_blank')
  return function load(blob) {
    if (!win) return
    const url = URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }))
    win.location.href = url
    setTimeout(() => URL.revokeObjectURL(url), 30000)
  }
}
