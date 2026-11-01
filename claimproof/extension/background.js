/* ClaimProof Suite — Manifest V3 Background Service Worker
 * Opens the ClaimProof application in a full browser tab when the extension action icon is clicked.
 * Requires zero host permissions and minimal extension privileges. */

chrome.action.onClicked.addListener(async () => {
  const targetUrl = chrome.runtime.getURL('index.html');
  try {
    const tabs = await chrome.tabs.query({ url: targetUrl });
    if (tabs.length > 0 && tabs[0].id) {
      await chrome.tabs.update(tabs[0].id, { active: true });
      if (tabs[0].windowId) {
        await chrome.windows.update(tabs[0].windowId, { focused: true });
      }
      return;
    }
  } catch {
    /* Fallback directly to creating a new tab */
  }
  await chrome.tabs.create({ url: targetUrl });
});

