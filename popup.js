function sanitizeFilename(name) {
    return name.replace(/[\\/:*?"<>|]/g, "_").trim();
}

function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}

function render(data) {
    const content = document.getElementById("content");

    if (!data || !data.transcodes || data.transcodes.length === 0) {
        content.innerHTML = `<div class="notification is-info">
            <p>No intercepted request yet.<br/>Reload the page and open the popup again.</p>
        </div>`;
        return;
    }

    const sortedStreams = [...data.transcodes].sort((a, b) => 
        (b.transcodeMetadata.height) - (a.transcodeMetadata.height)
    );

    const title = data.title;
    let html = `<h1 class="title is-4">${escapeHtml(title)}</h1>`;

    sortedStreams.forEach((stream, i) => {
        const dimensions = `${stream.transcodeMetadata.width}x${stream.transcodeMetadata.height}`;
        const mimetype = stream.transcodeMetadata.mimeType ? stream.transcodeMetadata.mimeType : "";
        const qualityLabel = `${stream.transcodeMetadata.height}p${stream.transcodeMetadata.videoFps === 60 
            ? stream.transcodeMetadata.videoFps : ""
        }`;

        html += `<div class="stream box">
                    <div class="level is-mobile">
                        <div class="level-left">
                            <div class="level-item">
                                <div>
                                    <div class="tag is-info">${escapeHtml(qualityLabel)}</div>
                                    <p class="is-size-7 has-text-grey-light">${escapeHtml([dimensions, mimetype].filter(Boolean).join(" - "))}</p>
                                </div>
                            </div>
                        </div>
                        <div class="level-right">
                            <div class="level-item">
                                <button class="download button is-info is-small" data-index="${i}" ${stream.url ? "" : "disabled"}>
                                    ${stream.url ? "Download" : "No URL"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>`;
    });

    content.innerHTML = html;

    content.querySelectorAll("button.download").forEach((btn) => {
        btn.addEventListener("click", () => {
            const idx = Number(btn.dataset.index);
            const stream = data.transcodes[idx];
            if (!stream || !stream.url) return;

            btn.disabled = true;
            btn.textContent = "Downloading";

            const filename = sanitizeFilename(title);

            browser.downloads
                .download({
                    url: stream.url,
                    filename,
                    saveAs: false
                })
                .then(() => {
                    btn.textContent = "Downloaded";
                })
                .catch((err) => {
                    console.error("[drive-video-downloader]: error downloading", err);
                    btn.disabled = false;
                    btn.textContent = "Retry";
                });
        });
    });

    content.innerHTML = html;
}

async function init() {
    try {
        console.log("hi")
        const tab = await browser.tabs.query({
            active: true,
            currentWindow: true
        }).then(r => r[0]);
        if (!tab) {
            render();
            return;
        }

        const data = await browser.runtime.sendMessage({
            type: "GET_TAB_DATA",
            tabId: tab.id
        });

        render(data);
    } catch (err) {
        console.error(err);
        render();
    }
}

init();