const repositoryInput = document.getElementById("repositoryUrl");
const questionInput = document.getElementById("questionInput");

const indexButton = document.getElementById("indexButton");
const askButton = document.getElementById("askButton");
const architectureButton = document.getElementById("architectureButton");
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

const chatHistory = document.getElementById("chatHistory");

let conversations = JSON.parse(
  localStorage.getItem("codeArcheologistChats") || "[]",
);

let activeChatId = null;

const CHAT_STORAGE_KEY = "codeArcheologistChats";

function saveConversations() {
  localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(conversations));
}

function getActiveConversation() {
  return conversations.find((chat) => chat.id === activeChatId);
}

function createConversation() {
  const conversation = {
    id: crypto.randomUUID(),
    title: "New chat",
    repositoryUrl: repositoryInput.value.trim(),
    messages: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  conversations.unshift(conversation);
  activeChatId = conversation.id;

  saveConversations();
  renderChatHistory();

  messages.replaceChildren();
  welcomeScreen.classList.remove("hidden");

  return conversation;
}

function saveMessage(role, content) {
  const conversation = getActiveConversation();

  if (!conversation) return;

  conversation.messages.push({
    role,
    content,
    timestamp: Date.now(),
  });

  if (role === "user" && conversation.title === "New chat") {
    conversation.title =
      content.length > 35 ? content.substring(0, 35) + "..." : content;
  }

  conversation.updatedAt = Date.now();

  saveConversations();
  renderChatHistory();
}

function renderChatHistory() {
  chatHistory.replaceChildren();

  if (conversations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "Your conversations will appear here.";
    chatHistory.appendChild(empty);
    return;
  }

  conversations.forEach((conversation) => {
    const item = document.createElement("div");

    item.className =
      "chat-history-item" + (conversation.id === activeChatId ? " active" : "");

    const title = document.createElement("span");
    title.className = "chat-history-title";
    title.textContent = conversation.title;

    const deleteButton = document.createElement("button");
    deleteButton.className = "chat-history-delete";
    deleteButton.textContent = "×";
    deleteButton.title = "Delete conversation";

    deleteButton.addEventListener("click", (event) => {
      event.stopPropagation();
      deleteConversation(conversation.id);
    });

    item.addEventListener("click", () => {
      openConversation(conversation.id);
    });

    item.appendChild(title);
    item.appendChild(deleteButton);

    chatHistory.appendChild(item);
  });
}

function openConversation(id) {
  const conversation = conversations.find((chat) => chat.id === id);

  if (!conversation) return;

  activeChatId = id;

  messages.replaceChildren();

  welcomeScreen.classList.toggle("hidden", conversation.messages.length > 0);

  repositoryInput.value = conversation.repositoryUrl || "";

  if (conversation.repositoryUrl) {
    setRepositoryConnected(conversation.repositoryUrl);
  }

  conversation.messages.forEach((message) => {
    addMessage(message.role, message.content);
  });

  renderChatHistory();
  scrollToBottom();
}

function deleteConversation(id) {
  conversations = conversations.filter(
    (conversation) => conversation.id !== id,
  );

  if (activeChatId === id) {
    activeChatId = null;
    messages.replaceChildren();
    welcomeScreen.classList.remove("hidden");
  }

  saveConversations();
  renderChatHistory();
}

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

  // Normalize malformed Markdown generated by the AI.
  markdown = markdown
    .replace(/\r\n/g, "\n")
    .replace(/\\(?=#{1,6}\s|---)/g, "")
    .replace(/&#x20;/gi, " ")
    .replace(/&nbsp;/gi, " ");

  const lines = markdown.split("\n");

  let paragraph = [];
  let list = null;
  let codeLines = [];
  let inCodeBlock = false;

  function flushParagraph() {
    if (!paragraph.length) return;

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

  for (const originalLine of lines) {
    const line = originalLine.trimEnd();
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
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

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    // Horizontal rule
    if (/^([-*_])\1{2,}\s*$/.test(trimmed)) {
      flushParagraph();
      flushList();

      container.appendChild(document.createElement("hr"));
      continue;
    }

    // Headings
    const heading = trimmed.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      flushParagraph();
      flushList();

      const level = Math.min(heading[1].length, 4);
      const element = document.createElement(`h${level}`);

      element.innerHTML = formatInlineMarkdown(heading[2]);
      container.appendChild(element);
      continue;
    }

    // Lists
    const bullet = line.match(/^(\s*)[-*+]\s+(.+)$/);
    const numbered = line.match(/^(\s*)\d+[.)]\s+(.+)$/);

    if (bullet || numbered) {
      flushParagraph();

      const match = bullet || numbered;
      const isOrdered = Boolean(numbered);
      const type = isOrdered ? "ol" : "ul";

      if (!list || list.tagName.toLowerCase() !== type) {
        flushList();
        list = document.createElement(type);
      }

      const item = document.createElement("li");
      item.innerHTML = formatInlineMarkdown(match[2]);

      list.appendChild(item);
      continue;
    }

    flushList();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();

  // Handle an unfinished code block safely.
  if (inCodeBlock && codeLines.length) {
    flushCode();
  }
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

// CREATE ANIMATED THINKING INDICATOR
function addThinkingIndicator() {
  const message = addMessage("assistant", "");

  const text = message.querySelector(".message-text");

  text.innerHTML = `
    <div class="thinking-indicator">
      <span></span>
      <span></span>
      <span></span>
    </div>
  `;

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

async function askQuestion(question) {
  if (isAsking || !question.trim()) return;

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

  isAsking = true;

  if (!activeChatId || !getActiveConversation()) {
    createConversation();
  }

  const conversation = getActiveConversation();
  conversation.repositoryUrl = repositoryUrl;

  welcomeScreen.classList.add("hidden");

  addMessage("user", question);
  saveMessage("user", question);

  questionInput.value = "";

  askButton.disabled = true;
  askButton.textContent = "…";

  const loadingMessage = addThinkingIndicator();

  setRepositoryConnected(repositoryUrl);
  scrollToBottom();

  try {
    const response = await fetch("/api/repositories/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        repositoryUrl,
        question,
      }),
    });

    const data = await handleResponse(response);

    loadingMessage.remove();

    const answer = data.answer || "No answer was returned.";

    addMessage("assistant", answer);
    saveMessage("assistant", answer);

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

    const errorMessage = `Sorry, something went wrong: ${error.message}`;

    addMessage("assistant", errorMessage);
    saveMessage("assistant", errorMessage);
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
  createConversation();
  questionInput.focus();
});

// MOBILE SIDEBAR

const sidebar = document.getElementById("sidebar");
const closeSidebar = document.getElementById("closeSidebar");

mobileMenu.addEventListener("click", () => {
  sidebar.classList.add("open");
});

closeSidebar.addEventListener("click", () => {
  sidebar.classList.remove("open");
});

// Close sidebar after selecting a conversation
const originalOpenConversation = openConversation;

openConversation = function (id) {
  originalOpenConversation(id);
  sidebar.classList.remove("open");
};

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

// INITIALIZE CHAT HISTORY
renderChatHistory();

const savedRepository = localStorage.getItem("codeArcheologistRepositoryUrl");

if (savedRepository) {
  repositoryInput.value = savedRepository;
  setRepositoryConnected(savedRepository);

  showIndexStatus("Previously connected repository.");
}

// ANALYZE REPOSITORY ARCHITECTURE
architectureButton.addEventListener("click", async () => {
  const repositoryUrl = repositoryInput.value.trim();

  if (!repositoryUrl) {
    addMessage("assistant", "Please connect a GitHub repository first.");
    return;
  }

  architectureButton.disabled = true;
  architectureButton.innerHTML = "<span>Analyzing architecture...</span>";

  welcomeScreen.classList.add("hidden");

  addMessage("user", "Analyze the repository architecture.");
  saveMessage("user", "Analyze the repository architecture.");

  const loadingMessage = addThinkingIndicator();

  try {
    const response = await fetch("/api/repositories/architecture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ repositoryUrl }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.message || data.error || "Architecture analysis failed.",
      );
    }

    const answer = data.architecture || "No architecture overview returned.";

    loadingMessage.remove();

    addMessage("assistant", answer);
    saveMessage("assistant", answer);
  } catch (error) {
    loadingMessage.remove();

    const errorMessage = `Architecture analysis failed: ${error.message}`;

    addMessage("assistant", errorMessage);
    saveMessage("assistant", errorMessage);
  } finally {
    architectureButton.disabled = false;
    architectureButton.innerHTML =
      "<span>Analyze Architecture</span><span>⌘</span>";

    scrollToBottom();
  }
});
