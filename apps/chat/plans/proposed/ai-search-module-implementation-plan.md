# AI Search Module Implementation Plan

## Goal
Implement `AI Search` as a modal/popover experience that can be opened from the main page without replacing the existing `AI Chat` flow.

The search surface should:
- feel transient and fast
- use more viewport space than the inline module
- keep the generated answer visually separate from the source results
- avoid blending into the normal conversations panel

## Product Shape

### Entry Point
- Add a small `AI Search` launcher in the main page chrome.
- The launcher should open a modal/popover overlay.
- Closing the overlay should preserve the current chat view unchanged.

### Modal Layout
The modal should use an internal two-pane layout on larger screens:
1. Query/header row
2. Generated answer panel
3. Search results / source list panel

On smaller screens:
- stack the answer above the results
- keep the query bar visible near the top
- avoid forcing horizontal scrolling

### Conversation Strategy
Search still uses the public RAG flow, but it must not look like a normal chat session.

- Tag search-created conversations with `ai-search`
- Keep those conversations out of the default chat list
- Allow an optional dedicated search-history section if we want it later

### UI State Strategy
Keep modal open/close state in the UI store.

- `aiSearchOpen`
- `setAiSearchOpen(open)`

Keep query/result state local to the search component or a dedicated hook.

## Proposed Component Breakdown

### 1. `AiSearchLauncher`
Compact trigger button or pill that opens the modal.

Likely location:
- [`frontend/src/pages/HomePage.tsx`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/pages/HomePage.tsx)
- or the top of the main content column

### 2. `AiSearchModule`
The modal/popover container and search logic owner.

Responsibilities:
- render the overlay/backdrop
- manage close behavior
- run the query flow
- coordinate answer and results rendering

### 3. `AiSearchAnswerPanel`
Displays the synthesized answer and citations.

### 4. `AiSearchResultsPanel`
Displays source cards or search result snippets.

### 5. `AiSearchResultItem`
Renders a single source card with expand/collapse behavior.

### 6. `conversation-tags` utility
Shared helpers for normalizing and checking `ai-search` tags.

## Data Flow

1. User opens `AI Search`.
2. User submits a query.
3. Client resolves dataset scope with `/api/retrieve`.
4. Client sends the actual `/api/rag` query with the returned tenant and dataset config key.
5. Response returns generated answer, source chunks, and optionally a conversation id.
6. If a conversation id is returned, client tags that conversation with `ai-search`.
7. Sidebar shows chat conversations separately from search conversations.

## Delivery Order
1. Add modal open/close state to the UI store.
2. Add the launcher button in the main page chrome.
3. Convert the existing search surface into a modal/popover layout.
4. Split the modal body into answer and results panes.
5. Keep the `ai-search` tag filtering in the sidebar.
6. Verify chat remains unchanged.

## Acceptance Criteria
- `AI Search` opens in a modal/popover instead of occupying the top of the page
- the answer and evidence are visibly separated
- search conversations are tagged and do not mix with normal chat threads
- the current chat experience remains intact
- the modal works on both desktop and smaller screens
