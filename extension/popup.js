const API_BASE = "https://abvx.xyz";

const apiKeyInput = document.getElementById("apiKey");
const btn = document.getElementById("shortenBtn");
const statusEl = document.getElementById("status");

function setStatus(msg) {
  statusEl.textContent = msg;
}

async function loadKey() {
  const { apiKey } = await chrome.storage.local.get(["apiKey"]);
  if (apiKey) apiKeyInput.value = apiKey;
}

async function saveKey(value) {
  await chrome.storage.local.set({ apiKey: value });
}

async function getActiveTabUrl() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab?.url;
}

async function copyToClipboard(text) {
  await navigator.clipboard.writeText(text);
}

btn.addEventListener("click", async () => {
  try {
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      setStatus("Enter API key first.");
      return;
    }
    await saveKey(apiKey);

    setStatus("Reading tab URL...");
    const url = await getActiveTabUrl();
    if (!url) {
      setStatus("No active tab URL.");
      return;
    }

    setStatus("Shortening...");
    const res = await fetch(`${API_BASE}/api/shorten`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-API-Key": apiKey
      },
      body: JSON.stringify({ url })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus(`Error ${res.status}: ${data?.error || "unknown"}`);
      return;
    }

    const shortUrl = data.shortUrl;
    if (!shortUrl) {
      setStatus("Unexpected response.");
      return;
    }

    await copyToClipboard(shortUrl);
    setStatus(`Copied:\n${shortUrl}`);
  } catch (e) {
    setStatus(String(e));
  }
});

loadKey();
