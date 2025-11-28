document.addEventListener('DOMContentLoaded', () => {
  const injectBtn = document.getElementById('injectBtn');
  const controlsDiv = document.getElementById('controls');

  // UI Elements
  const ui = {
    wide: {
      toggle: document.getElementById('toggleWide'),
      slider: document.getElementById('sliderWide'),
      label: document.getElementById('valWide')
    },
    depth: {
      toggle: document.getElementById('toggleDepth'),
      slider: document.getElementById('sliderDepth'),
      label: document.getElementById('valDepth')
    }
  };

  // Helper to send state
  const sendUpdate = async () => {
    const state = {
      action: "UPDATE_FX",
      widener: {
        enabled: ui.wide.toggle.checked,
        width: parseFloat(ui.wide.slider.value)
      },
      depth: {
        enabled: ui.depth.toggle.checked,
        strength: parseFloat(ui.depth.slider.value)
      }
    };

    // Update labels
    ui.wide.label.textContent = state.widener.width.toFixed(1);
    ui.depth.label.textContent = state.depth.strength;

    // Send to tab
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) chrome.tabs.sendMessage(tab.id, state);
    } catch (e) { /* Ignore errors if tab not ready */ }
  };

  // Event Listeners
  injectBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js']
    });
    injectBtn.style.display = 'none';
    controlsDiv.style.display = 'block';
    sendUpdate(); // Send initial state
  });

  // Attach listeners to all inputs
  Object.values(ui).forEach(group => {
    group.toggle.addEventListener('change', sendUpdate);
    group.slider.addEventListener('input', sendUpdate);
  });
});