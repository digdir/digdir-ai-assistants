# AI Search Module Strategy

## Objective
Add a new `AI Search` module at the top of the existing chat view without removing or replacing the current `AI Chat` experience.

The new module should:
- show the generated answer and the relevant source content together
- be optimized for small-screen and embedded usage
- remain available alongside the current chat interface so users can choose the interaction style they want

## Product Strategy

### Positioning
`AI Chat` and `AI Search` should be treated as parallel modes, not a migration path.

- `AI Chat` stays optimized for open-ended back-and-forth interaction.
- `AI Search` is optimized for quick question answering with evidence.
- Both modes should be reachable from the same page without navigation friction.

### Layout Strategy
The new module should sit at the top of the current page as a compact, self-contained surface.

Recommended structure:
1. Mode switcher
2. Search input
3. Answer summary
4. Key claims with inline citations
5. Source cards or compact source previews
6. Optional expanders for deeper context

This keeps the module usable in narrow containers and prevents the current chat UI from being pushed out of view.

### Visual Strategy
The module should feel more like a search result panel than a chat transcript.

- tighter vertical spacing than chat
- smaller type scale
- less visual chrome
- stronger hierarchy between answer and evidence
- source content presented as compact cards instead of a sidebar

### Interaction Strategy
- The user submits a single query and gets an answer immediately.
- Citations should jump to the matching source card and highlight it.
- Source cards should expand inline rather than opening a full secondary pane.
- The module should support quick scanning first, deeper reading second.

### Small-Screen Strategy
The module must work well inside a website embed or constrained page region.

- single-column layout by default
- no persistent right sidebar in the search experience
- compact header and input row
- source expansion should happen inline or in a drawer/bottom sheet
- the module should avoid consuming more than one screen height before the first answer is visible

## UX Principles
- Answer first, evidence second
- Compact before expansive
- Inline before split-pane
- Search results over conversation history
- Keep the current chat experience fully intact

## Non-Goals
- Do not replace the current chat experience
- Do not redesign the whole page around search
- Do not require users to switch away from chat to use search
- Do not make source browsing depend on the right sidebar

## Success Criteria
- Users can see both `AI Chat` and `AI Search` on the same page
- The search module is usable on mobile-sized widths
- The generated answer and its supporting sources are visible together
- Source navigation is clear and fast
- Chat behavior remains unchanged for existing users
