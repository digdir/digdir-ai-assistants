# AI Search Module Implementation Plan

## Goal
Implement a new `AI Search` module above the current chat interface, while preserving the existing `AI Chat` layout and behavior.

## Proposed Workstreams

### 1. Add Mode State
Introduce a UI-level mode switch that tracks whether the user is looking at:
- `chat`
- `search`

Likely location:
- [`frontend/src/stores/ui.ts`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/stores/ui.ts)

Expected behavior:
- default to the current chat experience unless explicitly switched
- persist the selected mode for the session if practical
- keep conversation selection independent from mode

### 2. Build the Search Module Shell
Create a new component for the search surface and mount it at the top of the home view.

Likely component split:
- new `AI Search` wrapper component
- query input bar
- answer summary card
- source preview list

Likely location:
- [`frontend/src/components/`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/components/)
- [`frontend/src/pages/HomePage.tsx`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/pages/HomePage.tsx)

### 3. Reuse Existing Evidence Data
Use the existing `chunks` and citation model as the source-of-truth for evidence display.

Likely reuse points:
- [`frontend/src/components/CitationMarker.tsx`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/components/CitationMarker.tsx)
- [`frontend/src/components/ChunksSidebar.tsx`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/components/ChunksSidebar.tsx)
- [`frontend/src/types/index.ts`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/types/index.ts)

Implementation detail:
- render chunks inline in the new module rather than only in a right rail
- preserve click-to-highlight behavior
- keep source content collapsible

### 4. Add Search-Specific Rendering
The search module should render:
- the answer in a compact card
- citation-linked claims
- a ranked source list or evidence cards

Behavior:
- the answer should be shown before the sources
- each citation should map to a visible source item
- source expansion should be shallow by default, deeper on demand

### 5. Keep Chat Unchanged
Leave the current chat layout intact for `AI Chat`.

Implementation approach:
- keep the current `ChatArea` path operational
- place the search module above it in `HomePage`
- ensure the page still renders correctly when the search module is hidden or empty

### 6. Update Copy and Labels
Add new i18n keys for the search mode and its UI copy.

Likely files:
- [`frontend/src/i18n/en.ts`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/i18n/en.ts)
- [`frontend/src/i18n/no.ts`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/i18n/no.ts)

Suggested content:
- mode labels
- search placeholder text
- source/evidence labels
- compact helper copy for embedded use

### 7. Add Styling for Compact Embeds
Create a dedicated visual treatment for the search module.

Styling requirements:
- reduced padding and margins
- strong answer/source hierarchy
- responsive one-column layout
- no dependency on the right sidebar
- mobile-safe scrolling and expansion behavior

Likely file:
- [`frontend/src/index.css`](/Users/bdbrodie/dev/altinn/assistants/apps/chat/frontend/src/index.css)

## Suggested Delivery Order
1. Add mode state and shared labels
2. Build the search module shell
3. Wire in evidence rendering and citation navigation
4. Style the module for embedded/mobile use
5. Verify chat still behaves exactly as before

## Acceptance Criteria
- `AI Search` appears above the existing chat area
- the search module shows answer plus sources in one surface
- the module remains usable in a narrow embedded container
- the current chat experience is still available
- citations continue to work against displayed source content
