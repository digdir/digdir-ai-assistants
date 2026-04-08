const en = {
  // ChatArea - welcome screen
  "welcome.title": "Welcome to Chat App",
  "welcome.subtitle": "Start a new conversation or select an existing one from the sidebar.",
  "welcome.sidebarHint": "Use the sidebar to:",
  "welcome.createConversation": "Create a new conversation",
  "welcome.browseHistory": "Browse your conversation history",
  "welcome.searchPast": "Search through past conversations",

  // ChatArea - messages
  "chat.newConversation": "New Conversation",
  "chat.loadingMessages": "Loading messages...",
  "chat.noMessages": "No messages yet. Start the conversation!",
  "chat.viewSources": "View {count} source(s) \u2192",
  "chat.retry": "Retry",
  "chat.streaming": "Streaming...",
  "chat.placeholder": "Type your message...",
  "chat.sending": "Sending...",
  "chat.send": "Send",

  // ChunksSidebar
  "sources.title": "Sources ({count})",
  "sources.description": "Chunks used to generate the answer",
  "sources.close": "Close sources panel",
  "sources.untitledDocument": "Untitled Document",
  "sources.document": "Document: {value}",
  "sources.chunkId": "Chunk ID: {value}",
  "sources.contentNotAvailable": "Content not available",
  "sources.na": "N/A",

  // CodeBlock
  "code.copied": "Copied!",
  "code.copy": "Copy",
  "code.defaultLanguage": "text",

  // CitationMarker
  "citation.source": "Source {num}",

  // Sidebar
  "sidebar.createNewChat": "Create new chat",
  "sidebar.creatingChat": "Creating chat...",
  "sidebar.expandPanel": "Expand conversations panel",
  "sidebar.conversations": "Conversations",
  "sidebar.collapsePanel": "Collapse conversations panel",
  "sidebar.creating": "Creating...",
  "sidebar.newChat": "+ New Chat",
  "sidebar.searchPlaceholder": "Search conversations...",
  "sidebar.loading": "Loading...",
  "sidebar.noConversationsFound": "No conversations found",
  "sidebar.noConversationsYet": "No conversations yet",
  "sidebar.deleteConversation": "Delete conversation",
  "sidebar.logout": "Logout",

  // LoginPage
  "login.checkingSession": "Checking session...",
  "login.title": "Login",
  "login.slackError": "Slack login failed. Please try again or use email login.",
  "login.continueWithSlack": "Continue with Slack",
  "login.orUseEmail": "Or use email",
  "login.emailLabel": "Email",
  "login.emailPlaceholder": "your.email@company.no",
  "login.domainError": "Domain not authorized. Please use your company email.",
  "login.loggingIn": "Logging in...",
  "login.loginButton": "Login",
  "login.authorizedDomainsOnly": "Only authorized email domains can access this application.",

  // Language
  "language.en": "English",
  "language.no": "Norsk",
} as const;

export type TranslationKey = keyof typeof en;
export type Translations = Record<TranslationKey, string>;
export default en;
