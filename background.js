const TARGET_URL = "*://workspacevideo-pa.clients6.google.com/v1/drive/media/*/playback*";
const tabData = {};

function concatChunks(chunks) {
    let total = 0;
    for (const c of chunks) total += c.byteLength;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
        out.set(new Uint8Array(c), offset);
        offset += c.byteLength;
    }
    return out;
}

function extractVideoIdFromUrl(url) {
    const m = url.match(/\/v1\/drive\/media\/([^/]+)\/playback/);
    return m ? m[1] : null;
}

function handlePlayerResponse(json, tabId, sourceUrl) {
    const metadata = json.mediaMetadata;
    const transcodes = json.mediaStreamingData?.formatStreamingData?.progressiveTranscodes;
    if (!transcodes) return console.error("[drive-video-downloader] video transcodes are not available");

    tabData[tabId] = {
        videoId: extractVideoIdFromUrl(sourceUrl),
        title: metadata.title || "drivevideo",
        transcodes,
        sourceUrl,
    }

    browser.browserAction.setBadgeText({
        tabId,
        text: String(transcodes.length)
    });
    browser.browserAction.setBadgeBackgroundColor({
        tabId,
        color: "#1a73e8"
    });
};

browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.tabId < 0) return {};
        const filter = browser.webRequest.filterResponseData(details.requestId);
        const decoder = new TextDecoder("utf-8");

        const chunks = [];
        filter.ondata = (event) => {
            chunks.push(event.data);
            filter.write(event.data);
        };

        filter.onstop = () => {
            try {
                const combined = concatChunks(chunks);
                const body = decoder.decode(combined);
                const json = JSON.parse(body);
                handlePlayerResponse(json, details.tabId, details.url);
            } catch (error) {
                console.error("[drive-video-downloader] couldn't parse response", error);
            }
        };

        filter.onerror = () => {
            console.error("[drive-video-downloader] filterResponseData error:", filter.error);
        };

        return {};
    },
    { urls: [TARGET_URL] },
    ["blocking"]
);

/* browser.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.status === "loading" && changeInfo.url) {
        delete tabData[tabId];
        browser.browserAction.setBadgeText({ tabId, text: "" });
    }
}); */

browser.tabs.onRemoved.addListener((tabId) => {
    delete tabData[tabId];
});

browser.runtime.onMessage.addListener((message, sender) => {
    if (message && message.type === "GET_TAB_DATA") {
        return Promise.resolve(tabData[message.tabId] || null);
    }
});