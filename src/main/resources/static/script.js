
const repositoryInput = document.getElementById("repositoryUrl");
const questionInput = document.getElementById("questionInput");

const indexButton = document.getElementById("indexButton");
const askButton = document.getElementById("askButton");

const indexStatus = document.getElementById("indexStatus");
const answerStatus = document.getElementById("answerStatus");

const indexResult = document.getElementById("indexResult");
const answerPanel = document.getElementById("answerPanel");

const answerContent = document.getElementById("answerContent");
const sourcesList = document.getElementById("sourcesList");

let indexedRepository = null;


// Display status messages
function showStatus(element, message, type = "") {
    element.className = "status-message";

    if (type) {
        element.classList.add(type);
    }

    element.querySelector("span:last-child").textContent = message;
}


// Handle API responses
async function handleResponse(response) {
    const text = await response.text();

    let data;

    try {
        data = JSON.parse(text);
    } catch {
        data = null;
    }

    if (!response.ok) {
        const message =
            data?.message ||
            data?.error ||
            text ||
            `Request failed (${response.status})`;

        throw new Error(message);
    }

    return data;
}


// INDEX REPOSITORY
indexButton.addEventListener("click", async () => {

    const repositoryUrl = repositoryInput.value.trim();

    if (!repositoryUrl) {
        showStatus(indexStatus, "Please enter a GitHub repository URL.", "error");
        return;
    }

    if (!/^https:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/.test(repositoryUrl.replace(/\.git$/, ""))) {
        showStatus(indexStatus, "Please enter a valid public GitHub repository URL.", "error");
        return;
    }

    indexButton.disabled = true;
    indexButton.textContent = "Indexing...";

    indexResult.classList.add("hidden");
    answerPanel.classList.add("hidden");
    indexedRepository = null;

    showStatus(
        indexStatus,
        "Downloading, chunking, embedding and indexing repository. This may take several minutes..."
    );

    try {
        const response = await fetch("/api/repositories/ingest", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                repositoryUrl: repositoryUrl
            })
        });

        const data = await handleResponse(response);

        indexedRepository = repositoryUrl;

        showStatus(
            indexStatus,
            "Repository indexed successfully!",
            "success"
        );

        indexResult.textContent =
            `${data.message} | Files: ${data.totalFiles} | Chunks: ${data.totalChunks}`;

        indexResult.classList.remove("hidden");

        showStatus(
            answerStatus,
            "Repository is ready. You can now ask questions.",
            "success"
        );

    } catch (error) {
        showStatus(indexStatus, error.message, "error");
    } finally {
        indexButton.disabled = false;
        indexButton.innerHTML =
            '<span>Index Repository</span><span class="button-arrow">→</span>';
    }
});


// ASK QUESTION
askButton.addEventListener("click", async () => {

    const question = questionInput.value.trim();

    if (!indexedRepository) {
        showStatus(
            answerStatus,
            "Please index a repository before asking questions.",
            "error"
        );
        return;
    }

    if (!question) {
        showStatus(answerStatus, "Please enter a question.", "error");
        return;
    }

    askButton.disabled = true;
    askButton.textContent = "Analyzing...";

    answerPanel.classList.add("hidden");

    showStatus(answerStatus, "Searching repository and generating an AI answer...");

    try {
        const response = await fetch("/api/repositories/ask", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                repositoryUrl: indexedRepository,
                question: question
            })
        });

        const data = await handleResponse(response);

        answerContent.textContent = data.answer || "No answer returned.";

        sourcesList.replaceChildren();

        if (data.sources && data.sources.length > 0) {
            data.sources.forEach(source => {
                const item = document.createElement("div");
                item.className = "source-item";
                item.textContent = source;
                sourcesList.appendChild(item);
            });
        } else {
            sourcesList.textContent = "No source files returned.";
        }

        answerPanel.classList.remove("hidden");

        showStatus(answerStatus, "Analysis completed successfully!", "success");

    } catch (error) {
        showStatus(answerStatus, error.message, "error");
    } finally {
        askButton.disabled = false;
        askButton.innerHTML =
            '<span>Analyze Codebase</span><span class="button-arrow">↗</span>';
    }
});
