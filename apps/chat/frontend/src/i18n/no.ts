import type { Translations } from "./en";

const no: Translations = {
  // ChatArea - velkomstskjerm
  "welcome.title": "Velkommen til Chat-appen",
  "welcome.subtitle": "Start en ny samtale eller velg en eksisterende fra sidepanelet.",
  "welcome.sidebarHint": "Bruk sidepanelet til \u00e5:",
  "welcome.createConversation": "Opprette en ny samtale",
  "welcome.browseHistory": "Bla gjennom samtalehistorikken",
  "welcome.searchPast": "S\u00f8ke i tidligere samtaler",

  // ChatArea - meldinger
  "chat.newConversation": "Ny samtale",
  "chat.loadingMessages": "Laster meldinger...",
  "chat.noMessages": "Ingen meldinger enn\u00e5. Start samtalen!",
  "chat.viewSources": "Vis {count} kilde(r) \u2192",
  "chat.retry": "Pr\u00f8v igjen",
  "chat.streaming": "Streamer...",
  "chat.placeholder": "Skriv meldingen din...",
  "chat.sending": "Sender...",
  "chat.send": "Send",

  // ChunksSidebar
  "sources.title": "Kilder ({count})",
  "sources.description": "Utdrag brukt til \u00e5 generere svaret",
  "sources.close": "Lukk kildepanelet",
  "sources.untitledDocument": "Uten tittel",
  "sources.document": "Dokument: {value}",
  "sources.chunkId": "Utdrags-ID: {value}",
  "sources.contentNotAvailable": "Innhold ikke tilgjengelig",
  "sources.na": "Ikke tilgj.",

  // CodeBlock
  "code.copied": "Kopiert!",
  "code.copy": "Kopier",
  "code.defaultLanguage": "tekst",

  // CitationMarker
  "citation.source": "Kilde {num}",

  // Sidebar
  "sidebar.createNewChat": "Opprett ny chat",
  "sidebar.creatingChat": "Oppretter chat...",
  "sidebar.expandPanel": "Utvid samtalepanelet",
  "sidebar.conversations": "Samtaler",
  "sidebar.collapsePanel": "Skjul samtalepanelet",
  "sidebar.creating": "Oppretter...",
  "sidebar.newChat": "+ Ny chat",
  "sidebar.searchPlaceholder": "S\u00f8k i samtaler...",
  "sidebar.loading": "Laster...",
  "sidebar.noConversationsFound": "Ingen samtaler funnet",
  "sidebar.noConversationsYet": "Ingen samtaler enn\u00e5",
  "sidebar.deleteConversation": "Slett samtale",
  "sidebar.logout": "Logg ut",

  // LoginPage
  "login.checkingSession": "Sjekker \u00f8kt...",
  "login.title": "Logg inn",
  "login.slackError": "Slack-innlogging mislyktes. Pr\u00f8v igjen eller bruk e-post.",
  "login.continueWithSlack": "Fortsett med Slack",
  "login.orUseEmail": "Eller bruk e-post",
  "login.emailLabel": "E-post",
  "login.emailPlaceholder": "din.epost@bedrift.no",
  "login.domainError": "Domenet er ikke autorisert. Bruk bedriftens e-post.",
  "login.loggingIn": "Logger inn...",
  "login.loginButton": "Logg inn",
  "login.authorizedDomainsOnly": "Kun autoriserte e-postdomener har tilgang til denne applikasjonen.",

  // Language
  "language.en": "English",
  "language.no": "Norsk",
};

export default no;
