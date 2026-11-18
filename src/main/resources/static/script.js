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

const appShell = document.getElementById("app");
const sidebar = document.getElementById("sidebar");
const sidebarBackdrop = document.getElementById("sidebarBackdrop");
const closeSidebar = document.getElementById("closeSidebar");
const desktopSidebarToggle = document.getElementById("desktopSidebarToggle");

const railExpand = document.getElementById("railExpand");
const railNewChat = document.getElementById("railNewChat");
const railHistory = document.getElementById("railHistory");

// Original button markup, captured before any temporary label is set.
const INDEX_BUTTON_LABEL = indexButton.innerHTML;
const ASK_BUTTON_ICON = askButton.innerHTML;
const ARCHITECTURE_BUTTON_LABEL = architectureButton.innerHTML;

let isAsking = false;

const chatHistory = document.getElementById("chatHistory");

let conversations = [];
let activeChatId = null;

function getActiveConversation() {
  return conversations.find((chat) => chat.id === activeChatId);
}

async function loadConversations() {
  try {
    conversations = await fetchDbConversations();
    renderChatHistory();
  } catch (error) {
    console.error("Failed to load conversations:", error);
    chatHistory.replaceChildren();

    const empty = document.createElement("div");
    empty.className = "chat-history-empty";
    empty.textContent = "Unable to load conversations.";
    chatHistory.appendChild(empty);
  }
}

async function migrateLocalConversations() {
  const storageKey = "codeArcheologistChats";
  const migrationKey = "codeArcheologistChatsMigrated";

  if (localStorage.getItem(migrationKey) === "true") return;

  const storedChats = JSON.parse(localStorage.getItem(storageKey) || "[]");

  if (!Array.isArray(storedChats) || storedChats.length === 0) {
    localStorage.setItem(migrationKey, "true");
    return;
  }

  const migratedIds = JSON.parse(
    localStorage.getItem("codeArcheologistMigratedIds") || "[]",
  );

  for (const oldChat of storedChats) {
    if (migratedIds.includes(oldChat.id)) continue;

    const created = await createDbConversation(oldChat.repositoryUrl || "");

    for (const message of oldChat.messages || []) {
      await saveDbMessage(created.id, message.role, message.content);
    }

    migratedIds.push(oldChat.id);

    localStorage.setItem(
      "codeArcheologistMigratedIds",
      JSON.stringify(migratedIds),
    );
  }

  localStorage.removeItem(storageKey);
  localStorage.removeItem("codeArcheologistMigratedIds");
  localStorage.setItem(migrationKey, "true");
}

async function createConversation() {
  const conversation = await createDbConversation(repositoryInput.value.trim());

  conversation.messages = [];

  conversations.unshift(conversation);
  activeChatId = conversation.id;

  renderChatHistory();

  messages.replaceChildren();
  welcomeScreen.classList.remove("hidden");

  return conversation;
}

async function saveMessage(role, content) {
  const conversation = getActiveConversation();

  if (!conversation) return;

  const savedMessage = await saveDbMessage(conversation.id, role, content);

  conversation.messages = conversation.messages || [];
  conversation.messages.push(savedMessage);

  if (role === "user" && conversation.title === "New chat") {
    conversation.title =
      content.length > 35 ? content.substring(0, 35) + "..." : content;
  }

  conversation.updatedAt = savedMessage.createdAt;

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
    deleteButton.setAttribute("aria-label", "Delete conversation");

    deleteButton.addEventListener("click", async (event) => {
      event.stopPropagation();
      await deleteConversation(conversation.id);
    });

    item.addEventListener("click", async () => {
      await openConversation(conversation.id);
    });

    item.appendChild(title);
    item.appendChild(deleteButton);

    chatHistory.appendChild(item);
  });
}

async function openConversation(id) {
  try {
    const conversation = await fetchDbConversation(id);

    const existingIndex = conversations.findIndex((chat) => chat.id === id);

    if (existingIndex !== -1) {
      conversations[existingIndex] = conversation;
    }

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
    closeMobileSidebar();
  } catch (error) {
    console.error("Failed to open conversation:", error);
    alert("Unable to open this conversation. Please try again.");
  }
}

async function deleteConversation(id) {
  try {
    await deleteDbConversation(id);

    conversations = conversations.filter(
      (conversation) => conversation.id !== id,
    );

    if (activeChatId === id) {
      activeChatId = null;
      messages.replaceChildren();
      welcomeScreen.classList.remove("hidden");
    }

    renderChatHistory();
  } catch (error) {
    console.error("Failed to delete conversation:", error);
    alert("Unable to delete this conversation. Please try again.");
  }
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

// DATABASE CHAT HISTORY API

async function createDbConversation(repositoryUrl) {
  const response = await fetch("/api/conversations", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ repositoryUrl }),
  });

  return handleResponse(response);
}

async function fetchDbConversations() {
  const response = await fetch("/api/conversations");
  return handleResponse(response);
}

async function fetchDbConversation(id) {
  const response = await fetch(`/api/conversations/${id}`);
  return handleResponse(response);
}

async function saveDbMessage(conversationId, role, content) {
  const response = await fetch(
    `/api/conversations/${conversationId}/messages`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ role, content }),
    },
  );

  return handleResponse(response);
}

async function deleteDbConversation(id) {
  const response = await fetch(`/api/conversations/${id}`, {
    method: "DELETE",
  });

  if (!response.ok) {
    await handleResponse(response);
  }
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
  avatar.textContent = role === "user" ? "Y" : "CA";

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
    indexButton.innerHTML = INDEX_BUTTON_LABEL;
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
      "Please enter a valid GitHub repository URL in the repository section above first.",
    );
    return;
  }

  isAsking = true;

  askButton.disabled = true;
  askButton.textContent = "…";

  questionInput.value = "";

  const loadingMessage = addThinkingIndicator();

  setRepositoryConnected(repositoryUrl);

  try {
    if (!activeChatId || !getActiveConversation()) {
      await createConversation();
    }

    const conversation = getActiveConversation();
    conversation.repositoryUrl = repositoryUrl;

    welcomeScreen.classList.add("hidden");

    addMessage("user", question);
    await saveMessage("user", question);

    scrollToBottom();

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
    await saveMessage("assistant", answer);

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

    try {
      await saveMessage("assistant", errorMessage);
    } catch (saveError) {
      console.error("Failed to save error message:", saveError);
    }
  } finally {
    isAsking = false;
    askButton.disabled = false;
    askButton.innerHTML = ASK_BUTTON_ICON;

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

// SUGGESTED QUESTIONS (welcome screen)
document.querySelectorAll(".suggestion-card").forEach((card) => {
  card.addEventListener("click", () => {
    askQuestion(card.dataset.question);
  });
});

// ANALYSIS ACTIONS (above composer). Architecture has its own handler below.
document
  .querySelectorAll(".analysis-button[data-question]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      askQuestion(button.dataset.question);
    });
  });

// NEW CHAT
newChatButton.addEventListener("click", async () => {
  newChatButton.disabled = true;

  try {
    await createConversation();
    questionInput.focus();
  } catch (error) {
    console.error("Failed to create conversation:", error);
    alert("Unable to create a new conversation. Please try again.");
  } finally {
    newChatButton.disabled = false;
  }
});

// SIDEBAR: DESKTOP COLLAPSE / EXPAND

function toggleDesktopSidebar() {
  const isCollapsed = appShell.classList.toggle("sidebar-collapsed");

  desktopSidebarToggle.setAttribute("aria-expanded", String(!isCollapsed));
  desktopSidebarToggle.setAttribute(
    "aria-label",
    isCollapsed ? "Show sidebar" : "Hide sidebar",
  );
  desktopSidebarToggle.title = isCollapsed ? "Show sidebar" : "Hide sidebar";
}

function expandDesktopSidebar() {
  if (appShell.classList.contains("sidebar-collapsed")) {
    toggleDesktopSidebar();
  }
}

desktopSidebarToggle.addEventListener("click", toggleDesktopSidebar);
railExpand.addEventListener("click", toggleDesktopSidebar);

railNewChat.addEventListener("click", () => {
  newChatButton.click();
});

railHistory.addEventListener("click", () => {
  expandDesktopSidebar();
  chatHistory.scrollIntoView({ behavior: "smooth", block: "start" });
});

// SIDEBAR: MOBILE DRAWER

function openMobileSidebar() {
  sidebar.classList.add("open");
}

function closeMobileSidebar() {
  sidebar.classList.remove("open");
}

mobileMenu.addEventListener("click", openMobileSidebar);
closeSidebar.addEventListener("click", closeMobileSidebar);
sidebarBackdrop.addEventListener("click", closeMobileSidebar);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeMobileSidebar();
  }
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

// INITIALIZE CHAT HISTORY
async function initializeChatHistory() {
  try {
    await migrateLocalConversations();
  } catch (error) {
    console.error("Local conversation migration failed:", error);
  }

  await loadConversations();
}

initializeChatHistory();

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
  architectureButton.innerHTML = "<span>Analyzing...</span>";

  const loadingMessage = addThinkingIndicator();

  try {
    if (!activeChatId || !getActiveConversation()) {
      await createConversation();
    }

    const conversation = getActiveConversation();
    conversation.repositoryUrl = repositoryUrl;

    welcomeScreen.classList.add("hidden");

    addMessage("user", "Analyze the repository architecture.");
    await saveMessage("user", "Analyze the repository architecture.");

    const response = await fetch("/api/repositories/architecture", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ repositoryUrl }),
    });

    const data = await handleResponse(response);

    const answer = data.architecture || "No architecture overview returned.";

    loadingMessage.remove();

    addMessage("assistant", answer);
    await saveMessage("assistant", answer);
  } catch (error) {
    loadingMessage.remove();

    const errorMessage = `Architecture analysis failed: ${error.message}`;

    addMessage("assistant", errorMessage);

    try {
      await saveMessage("assistant", errorMessage);
    } catch (saveError) {
      console.error("Failed to save architecture error:", saveError);
    }
  } finally {
    architectureButton.disabled = false;
    architectureButton.innerHTML = ARCHITECTURE_BUTTON_LABEL;

    scrollToBottom();
  }
});
