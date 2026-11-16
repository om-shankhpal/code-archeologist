const repositoryInput = document.getElementById("repositoryUrl");
const questionInput = document.getElementById("questionInput");

const indexButton = document.getElementById("indexButton");
const askButton = document.getElementById("askButton");
const newChatButton = document.getElementById("newChatButton");
const mobileMenu = document.getElementById("mobileMenu");

const indexStatus = document.getElementById("indexStatus");
const indexResult = document.getElementById("indexResult");

const messages = document.getElementById("messages");
const welcomeScreen = document.getElementById("welcomeScreen");
const chatContent = document.getElementById("chatContent");

const repoSidebarStatus = document.getElementById("repoSidebarStatus");
const repoDot = document.getElementById("repoDot");

let isAsking = false;

// API RESPONSE HANDLER
async function handleResponse(response) {
  const text = await response.text();

  let data;

  try {
    data = JSON.parse(text);
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.message ||
        data?.error ||
        text ||
        `Request failed: ${response.status}`,
    );
  }

  return data;
}

// STATUS DISPLAY
function showIndexStatus(message, type = "") {
  indexStatus.textContent = message;
  indexStatus.className = "sidebar-status";

  if (type) {
    indexStatus.classList.add(type);
  }
}

// CHAT SCROLL
function scrollToBottom() {
  chatContent.scrollTop = chatContent.scrollHeight;
}

function escapeHTML(value) {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[character],
  );
}

function formatInlineMarkdown(value) {
  let html = escapeHTML(value);

  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  html = html.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/\*(.*?)\*/g, "<em>$1</em>");

  return html;
}

function renderMarkdown(container, markdown) {
  container.replaceChildren();

  const lines = markdown.split("\n");

  let paragraph = [];
  let list = null;
  let codeLines = [];
  let inCodeBlock = false;

  function flushParagraph() {
    if (paragraph.length === 0) return;

    const p = document.createElement("p");
    p.innerHTML = paragraph.map(formatInlineMarkdown).join("<br>");

    container.appendChild(p);
    paragraph = [];
  }

  function flushList() {
    if (!list) return;

    container.appendChild(list);
    list = null;
  }

  function flushCode() {
    const pre = document.createElement("pre");
    const code = document.createElement("code");

    code.textContent = codeLines.join("\n");

    pre.appendChild(code);
    container.appendChild(pre);

    codeLines = [];
  }

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushList();

      if (inCodeBlock) {
        flushCode();
      }

      inCodeBlock = !inCodeBlock;
      continue;
    }

    if (inCodeBlock) {
      codeLines.push(line);
      continue;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      continue;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();

      const element = document.createElement(`h${heading[1].length}`);

      element.innerHTML = formatInlineMarkdown(heading[2]);
      container.appendChild(element);
      continue;
    }

    const bullet = line.match(/^\s*[-*]\s+(.+)$/);
    const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (bullet || numbered) {
      flushParagraph();

      const isOrdered = Boolean(numbered);
      const type = isOrdered ? "ol" : "ul";

      if (!list || list.tagName.toLowerCase() !== type) {
        flushList();
        list = document.createElement(type);
      }

      const item = document.createElement("li");

      item.innerHTML = formatInlineMarkdown((bullet || numbered)[1]);

      list.appendChild(item);
      continue;
    }

    flushList();
    paragraph.push(line);
  }

  if (inCodeBlock) {
    flushCode();
  }

  flushParagraph();
  flushList();
}

// CREATE CHAT MESSAGE
function addMessage(role, content) {
  const message = document.createElement("div");

  message.className =
    role === "user"
      ? "chat-message user-message"
      : "chat-message assistant-message";

  const roleContainer = document.createElement("div");
  roleContainer.className = "message-role";

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.textContent = role === "user" ? "Y" : "⌘";

  const name = document.createElement("span");
  name.textContent = role === "user" ? "You" : "Code Archeologist";

  roleContainer.appendChild(avatar);
  roleContainer.appendChild(name);

  const text = document.createElement("div");
  text.className = "message-text";

  renderMarkdown(text, content);

  message.appendChild(roleContainer);
  message.appendChild(text);

  messages.appendChild(message);

  return message;
}

// SHOW CONNECTED REPOSITORY
function setRepositoryConnected(repositoryUrl) {
  const parts = repositoryUrl.replace(/\.git$/, "").split("/");
  const repositoryName = parts.slice(-2).join("/");

  repoSidebarStatus.textContent = repositoryName;
  repoDot.classList.add("connected");
}

// INDEX OR CONNECT REPOSITORY
indexButton.addEventListener("click", async () => {
  const repositoryUrl = repositoryInput.value.trim();

  if (
    !/^https:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/.test(
      repositoryUrl.replace(/\.git$/, ""),
    )
  ) {
    showIndexStatus("Enter a valid public GitHub repository URL.", "error");
    return;
  }

  indexButton.disabled = true;
  indexButton.innerHTML = "<span>Checking repository...</span>";

  indexResult.classList.add("hidden");

  try {
    // STEP 1: Check whether repository is already indexed
    const statusResponse = await fetch(
      `/api/repositories/status?repositoryUrl=${encodeURIComponent(repositoryUrl)}`,
    );

    const statusData = await handleResponse(statusResponse);

    if (statusData.indexed) {
      // Repository already exists: do not index again
      setRepositoryConnected(repositoryUrl);

      localStorage.setItem("codeArcheologistRepositoryUrl", repositoryUrl);

      showIndexStatus(
        "Repository already indexed. Connected successfully!",
        "success",
      );

      indexResult.textContent =
        "Existing Pinecone data reused. No re-indexing required.";

      indexResult.classList.remove("hidden");

      return;
    }

    // STEP 2: Repository is not indexed, so index it
    indexButton.innerHTML = "<span>Indexing...</span>";

    showIndexStatus("Repository not indexed. Starting indexing process...");

    const response = await fetch("/api/repositories/ingest", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repositoryUrl: repositoryUrl,
      }),
    });

    const data = await handleResponse(response);

    setRepositoryConnected(repositoryUrl);

    localStorage.setItem("codeArcheologistRepositoryUrl", repositoryUrl);

    showIndexStatus("Repository indexed successfully!", "success");

    indexResult.textContent = `${data.totalFiles} files · ${data.totalChunks} chunks`;

    indexResult.classList.remove("hidden");
  } catch (error) {
    showIndexStatus(error.message, "error");
  } finally {
    indexButton.disabled = false;

    indexButton.innerHTML = "<span>Connect & Index</span><span>→</span>";
  }
});

// ASK GEMINI A QUESTION
async function askQuestion(question) {
  if (isAsking) {
    return;
  }

  const repositoryUrl = repositoryInput.value.trim();

  if (
    !/^https:\/\/(www\.)?github\.com\/[^/]+\/[^/]+\/?$/.test(
      repositoryUrl.replace(/\.git$/, ""),
    )
  ) {
    addMessage(
      "assistant",
      "Please enter a valid GitHub repository URL in the sidebar first.",
    );
    return;
  }

  if (!question.trim()) {
    return;
  }

  isAsking = true;

  welcomeScreen.classList.add("hidden");

  addMessage("user", question);

  questionInput.value = "";

  askButton.disabled = true;
  askButton.textContent = "…";

  const loadingMessage = addMessage(
    "assistant",
    "Searching the repository and analyzing relevant code...",
  );

  setRepositoryConnected(repositoryUrl);

  scrollToBottom();

  try {
    const response = await fetch("/api/repositories/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repositoryUrl: repositoryUrl,
        question: question,
      }),
    });

    const data = await handleResponse(response);

    loadingMessage.remove();

    addMessage("assistant", data.answer || "No answer was returned.");

    // Display source files
    if (data.sources && data.sources.length > 0) {
      const sourcesContainer = document.createElement("div");
      sourcesContainer.className = "answer-panel";

      const heading = document.createElement("div");
      heading.className = "sources-section";

      const title = document.createElement("h3");
      title.textContent = "REFERENCED FILES";

      heading.appendChild(title);

      data.sources.forEach((source) => {
        const item = document.createElement("div");
        item.className = "source-item";
        item.textContent = source;
        heading.appendChild(item);
      });

      sourcesContainer.appendChild(heading);
      messages.appendChild(sourcesContainer);
    }
  } catch (error) {
    loadingMessage.remove();

    addMessage("assistant", `Sorry, something went wrong: ${error.message}`);
  } finally {
    isAsking = false;
    askButton.disabled = false;
    askButton.textContent = "↑";

    questionInput.focus();
    scrollToBottom();
  }
}

// SEND BUTTON
askButton.addEventListener("click", () => {
  askQuestion(questionInput.value.trim());
});

// ENTER TO SEND, SHIFT + ENTER FOR NEW LINE
questionInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    askQuestion(questionInput.value.trim());
  }
});

// SUGGESTED QUESTIONS
document.querySelectorAll(".suggestion-card").forEach((card) => {
  card.addEventListener("click", () => {
    const question = card.dataset.question;
    askQuestion(question);
  });
});

// NEW CHAT
newChatButton.addEventListener("click", () => {
  messages.replaceChildren();

  welcomeScreen.classList.remove("hidden");

  questionInput.value = "";

  questionInput.focus();

  scrollToBottom();
});

// MOBILE SIDEBAR
mobileMenu.addEventListener("click", () => {
  document.getElementById("sidebar").classList.toggle("open");
});

// RESTORE LAST CONNECTED REPOSITORY
window.addEventListener("DOMContentLoaded", () => {
  const savedRepository = localStorage.getItem("codeArcheologistRepositoryUrl");

  if (savedRepository) {
    repositoryInput.value = savedRepository;

    setRepositoryConnected(savedRepository);

    showIndexStatus(
      "Previously connected repository. Checking availability...",
    );
  }
});
