export { }


// Plasmo content script: handles overlay, selection, and submit
let overlay: HTMLDivElement = null
let selection: HTMLDivElement = null
let selectionWindow: HTMLDivElement = null // Transparent window to show original content
let startX = 0, startY = 0, endX = 0, endY = 0
let isSelecting = false

function createOverlay() {
  // Remove any existing overlay first
  if (overlay) {
    overlay.remove()
  }
  
  overlay = document.createElement("div")
  overlay.style.position = "fixed"
  overlay.style.left = "0"
  overlay.style.top = "0"
  overlay.style.width = "100vw"
  overlay.style.height = "100vh"
  overlay.style.background = "rgba(0,0,0,0.5)" // Dark overlay for contrast
  overlay.style.zIndex = "2147483646" // Below selection but above page content
  overlay.style.cursor = "crosshair"
  overlay.style.userSelect = "none"
  overlay.style.pointerEvents = "auto"
  overlay.id = "screenshot-overlay" // Add ID for easier reference
  
  // Ensure overlay is visible immediately
  document.body.appendChild(overlay)
  
  // Force reflow to ensure overlay is rendered
  overlay.offsetHeight
}

function updateOverlayMask(x: number, y: number, w: number, h: number) {
  if (!overlay) return
  
  // Use CSS mask to create a "hole" in the overlay where selection is
  // This makes the selected area show original page content
  const maskImage = `radial-gradient(circle at ${x + w/2}px ${y + h/2}px, transparent ${Math.max(w, h)/2}px, rgba(0,0,0,0.5) ${Math.max(w, h)/2 + 100}px)`
  
  // Better approach: Use clip-path with inverse
  // Create a mask that hides overlay in selection area
  const clipPath = `polygon(
    0% 0%,
    0% 100%,
    ${x}px 100%,
    ${x}px ${y}px,
    ${x + w}px ${y}px,
    ${x + w}px ${y + h}px,
    ${x}px ${y + h}px,
    ${x}px 100%,
    100% 100%,
    100% 0%
  )`
  
  // Apply inverse clip-path (dark overlay everywhere except selection)
  overlay.style.clipPath = clipPath
}

function removeOverlay() {
  console.log('Removing overlay and screenshot UI...')
  
  // Remove submit button if exists
  if (selection && (selection as any).submitButton) {
    try {
      (selection as any).submitButton.remove()
    } catch (e) {
      console.warn('Error removing submit button:', e)
    }
    (selection as any).submitButton = null
  }
  
  // Also remove any submit buttons directly in body
  try {
    document.querySelectorAll('button[data-selection-ref]').forEach(btn => {
      try {
        btn.remove()
      } catch (e) {
        console.warn('Error removing button:', e)
      }
    })
  } catch (e) {
    console.warn('Error querying buttons:', e)
  }
  
  // Remove overlay
  if (overlay) {
    try {
      overlay.remove()
    } catch (e) {
      console.warn('Error removing overlay:', e)
    }
    overlay = null
  }
  
  // Remove selection window
  if (selectionWindow) {
    try {
      selectionWindow.remove()
    } catch (e) {
      console.warn('Error removing selection window:', e)
    }
    selectionWindow = null
  }
  
  // Remove selection
  if (selection) {
    try {
      selection.remove()
    } catch (e) {
      console.warn('Error removing selection:', e)
    }
    selection = null
  }
  
  // Reset selection state
  isSelecting = false
  
  console.log('Overlay and screenshot UI removed')
}

function createSelectionRect(x, y, w, h) {
  // Update overlay mask to show original content in selection area
  updateOverlayMask(x, y, w, h)
  
  if (!selection) {
    // Create border for selection area
    selection = document.createElement("div")
    selection.style.position = "fixed"
    selection.style.border = "2px solid #4f8cff"
    selection.style.background = "transparent"
    selection.style.zIndex = "2147483647" // Highest z-index for border
    selection.style.pointerEvents = "none" // Don't block events
    document.body.appendChild(selection)
  }
  
  // Update selection border position and size
  selection.style.left = x + "px"
  selection.style.top = y + "px"
  selection.style.width = w + "px"
  selection.style.height = h + "px"
  selection.style.display = "block"
  
  // Create a transparent window overlay to ensure original content is visible
  // This is a "hole" in the overlay
  if (!selectionWindow) {
    selectionWindow = document.createElement("div")
    selectionWindow.style.position = "fixed"
    selectionWindow.style.background = "transparent"
    selectionWindow.style.zIndex = "2147483645" // Between overlay and border
    selectionWindow.style.pointerEvents = "none"
    selectionWindow.style.border = "none"
    document.body.appendChild(selectionWindow)
  }
  selectionWindow.style.left = x + "px"
  selectionWindow.style.top = y + "px"
  selectionWindow.style.width = w + "px"
  selectionWindow.style.height = h + "px"
  selectionWindow.style.display = "block"
}

function addSubmitButton() {
  if (!selection) return
  
  // Remove old button if exists
  const oldBtn = selection.querySelector("button")
  if (oldBtn) oldBtn.remove()
  
  // Create button directly in body to avoid overlay interference
  const btn = document.createElement("button")
  btn.innerText = "Submit"
  
  // Get selection position
  const rect = selection.getBoundingClientRect()
  
  // Position button outside the selection area (to the right and below)
  // This ensures it won't be included in the screenshot
  btn.style.position = "fixed"
  btn.style.left = (rect.right + 8) + "px"
  btn.style.top = (rect.bottom - 40) + "px" // Position above bottom, or outside if needed
  // If button would be outside viewport, position it differently
  if (rect.right + 8 + 80 > window.innerWidth) {
    // Put it to the left of selection
    btn.style.left = (rect.left - 88) + "px"
  }
  if (rect.bottom + 10 > window.innerHeight) {
    // Put it above selection
    btn.style.top = (rect.top - 40) + "px"
  }
  btn.style.zIndex = "2147483647" // Maximum z-index
  btn.style.background = "#4f8cff"
  btn.style.color = "#fff"
  btn.style.border = "none"
  btn.style.borderRadius = "4px"
  btn.style.padding = "6px 12px"
  btn.style.cursor = "pointer"
  btn.style.fontSize = "12px"
  btn.style.fontWeight = "500"
  btn.style.boxShadow = "0 2px 4px rgba(0,0,0,0.2)"
  btn.style.pointerEvents = "auto"
  btn.style.display = "block"
  
  // Store reference to selection for cleanup
  btn.setAttribute('data-selection-ref', 'true')
  
  const handleClick = async (e: MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    e.stopImmediatePropagation()
    
    console.log('Submit button clicked!')
    
    if (!selection) {
      console.warn('No selection found when submitting')
      removeOverlay()
      return
    }
    
    // Get selection rect BEFORE removing overlay
    const selectionRect = selection.getBoundingClientRect()
    const devicePixelRatio = window.devicePixelRatio
    
    console.log('Submitting screenshot with rect:', selectionRect)
    
    // Remove submit button FIRST before taking screenshot
    // This ensures the button won't appear in the screenshot
    if ((selection as any).submitButton) {
      try {
        (selection as any).submitButton.remove()
        ;(selection as any).submitButton = null
      } catch (e) {
        console.warn('Error removing submit button:', e)
      }
    }
    
    // Also remove button from DOM using query selector
    try {
      document.querySelectorAll('button[data-selection-ref]').forEach(btn => {
        try {
          btn.remove()
        } catch (e) {
          console.warn('Error removing button:', e)
        }
      })
    } catch (e) {
      console.warn('Error querying buttons:', e)
    }
    
    // Wait a tiny bit for DOM to update (remove button visually)
    setTimeout(() => {
      // Remove overlay and selection after button is removed
      removeOverlay()
      
      // Send message to capture the region
      chrome.runtime.sendMessage({
        type: "captureRegion",
        rect: {
          x: selectionRect.left,
          y: selectionRect.top,
          width: selectionRect.width,
          height: selectionRect.height
        },
        devicePixelRatio
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Error capturing region:', chrome.runtime.lastError)
        } else {
          console.log('Screenshot captured successfully')
        }
      })
    }, 10) // Small delay to ensure button is removed from DOM
  }
  
  btn.onclick = handleClick
  btn.addEventListener('click', handleClick, true)
  btn.addEventListener('mousedown', (e) => {
    e.stopPropagation()
    e.stopImmediatePropagation()
  }, true)
  btn.addEventListener('mouseup', (e) => {
    e.stopPropagation()
    e.stopImmediatePropagation()
  }, true)
  
  // Append button to body directly, not to selection
  document.body.appendChild(btn)
  
  // Store button reference in selection for cleanup
  ;(selection as any).submitButton = btn
}

function startScreenshotMode() {
  // Remove any existing overlay first
  removeOverlay()
  
  // Wait for DOM to be ready, then create overlay
  if (document.body) {
    createOverlay()
    setupScreenshotEvents()
  } else {
    // If body not ready, wait for it
    const checkBody = setInterval(() => {
      if (document.body) {
        clearInterval(checkBody)
        createOverlay()
        setupScreenshotEvents()
      }
    }, 50)
    // Timeout after 1 second
    setTimeout(() => clearInterval(checkBody), 1000)
  }
}

function setupScreenshotEvents() {
  if (!overlay) return
  
  // Reset selection state
  isSelecting = false
  startX = 0
  startY = 0
  endX = 0
  endY = 0
  
  overlay.onmousedown = (e) => {
    // Check if clicking on the submit button
    const target = e.target as HTMLElement
    if (target && target.tagName === 'BUTTON' && target.getAttribute('data-selection-ref') === 'true') {
      // Let the button handle the click completely
      return
    }
    if (target && target.closest('button[data-selection-ref]')) {
      return
    }
    
    e.preventDefault()
    e.stopPropagation()
    isSelecting = true
    startX = e.clientX
    startY = e.clientY
    // Remove existing selection when starting new one
    if (selection) {
      // Also remove submit button
      if ((selection as any).submitButton) {
        (selection as any).submitButton.remove()
        (selection as any).submitButton = null
      }
      selection.remove()
      selection = null
    }
  }
  
  overlay.onmousemove = (e) => {
    if (!isSelecting) return
    
    // Check if mouse is over a button (don't interfere with button interactions)
    const target = e.target as HTMLElement
    if (target && (target.tagName === 'BUTTON' || target.closest('button'))) {
      return // Don't interfere with button
    }
    
    e.preventDefault()
    e.stopPropagation()
    endX = e.clientX
    endY = e.clientY
    const x = Math.min(startX, endX)
    const y = Math.min(startY, endY)
    const w = Math.abs(endX - startX)
    const h = Math.abs(endY - startY)
    
    // Only show selection if there's a meaningful size
    if (w > 5 && h > 5) {
      createSelectionRect(x, y, w, h)
    }
  }
  
  overlay.onmouseup = (e) => {
    // Check if clicking on the submit button
    const target = e.target as HTMLElement
    if (target && target.tagName === 'BUTTON' && target.getAttribute('data-selection-ref') === 'true') {
      // Let the button handle the click completely
      return
    }
    if (target && target.closest('button[data-selection-ref]')) {
      return
    }
    
    // Only prevent default if not clicking on button
    e.preventDefault()
    e.stopPropagation()
    isSelecting = false
    
    // Only add submit button if we have a valid selection
    if (selection) {
      const rect = selection.getBoundingClientRect()
      if (rect.width > 5 && rect.height > 5) {
        addSubmitButton()
      } else {
        // Selection too small, remove it
        selection.remove()
        selection = null
      }
    }
  }
  
  overlay.oncontextmenu = (e) => {
    e.preventDefault()
    e.stopPropagation()
    removeOverlay()
  }
  
  // Also allow ESC key to cancel
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && overlay) {
      removeOverlay()
      document.removeEventListener('keydown', handleEscape)
    }
  }
  document.addEventListener('keydown', handleEscape)
}

// Listen for background messages
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("content msg", msg);
  if (msg.type === "startScreenshot") {
    console.log("Starting screenshot mode...");
    startScreenshotMode();
    sendResponse({ ok: true });
    return true;
  }
  if (msg.type === "fullScreenshot") {
    const { dataUrl, rect, devicePixelRatio } = msg
    const img = new window.Image()
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = rect.width * devicePixelRatio
      canvas.height = rect.height * devicePixelRatio
      const ctx = canvas.getContext("2d")
      ctx.drawImage(
        img,
        rect.x * devicePixelRatio,
        rect.y * devicePixelRatio,
        rect.width * devicePixelRatio,
        rect.height * devicePixelRatio,
        0,
        0,
        rect.width * devicePixelRatio,
        rect.height * devicePixelRatio
      )
      const cropped = canvas.toDataURL("image/png")
      chrome.runtime.sendMessage({
        type: "nanostudy-cropped-image",
        dataUrl: cropped
      })
    }
    img.src = dataUrl
  }
  if (msg?.type === "captureRegion") {
    const { rect, devicePixelRatio } = msg
    const tabId = sender.tab?.id
    if (typeof tabId === "number") {
      // Note: chrome.tabs.captureVisibleTab can only be called from background script
      // This code may not work in content script, but kept for compatibility
      chrome.tabs.captureVisibleTab(null, { format: "png" }, (dataUrl) => {
        chrome.tabs.sendMessage(tabId, {
          type: "fullScreenshot",
          dataUrl,
          rect,
          devicePixelRatio
        })
      })
    }
    sendResponse({ ok: true })
    return true
  }
})

