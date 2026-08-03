# CLAUDE.md

Smart XML Diff is a VS Code extension (TypeScript, bundled with esbuild) that diffs the active XML editor/selection against the clipboard. Both sides are normalized first so only semantic differences show up.

## Commands

```bash
npm run compile      # check-types + lint + esbuild (dev build, sourcemaps)
npm run watch        # tsc --noEmit --watch and esbuild --watch in parallel
npm run package      # production build (minified); also runs on vscode:prepublish
npm run check-types  # tsc --noEmit
npm run lint         # eslint src
npm test             # pretest (compile-tests + compile + lint), then Mocha in a VS Code instance
```

- Tests run inside a downloaded VS Code instance via `@vscode/test-electron` (`src/test/runTest.ts` → `src/test/index.ts`), so the first run needs network access and a display. Compiled tests land in `out/` (gitignored, like `dist/`).
- Press F5 in VS Code to launch an Extension Development Host for manual testing.
- Code style is enforced by Prettier (`.prettierrc`: single quotes, semicolons, trailing commas, 100 cols) and ESLint. Run `npm run lint` before finishing a change.

## Architecture

Only two files contain live logic:

- `src/extension.ts` — `activate()` registers the `smartXmlDiff:` virtual-document scheme (`XmlDiffContentProvider`, in-memory map keyed by URI) and the `smartXmlDiff.compareWithClipboard` command. `XmlDiffHandler.compareWithClipboard()` reads the selection (or whole document if the selection is empty), reads the clipboard, normalizes both with `XmlProcessingService`, stores the results in the provider, and opens them with the built-in `vscode.diff` command. Errors are surfaced via `showErrorMessage` and logged to the "Smart XML Diff" output channel.
- `src/services/xmlProcessingService.ts` — `XmlProcessingService.parseNormalizeAll(xml)` is the whole pipeline: trim + basic checks (`validateXmlBasics`) → `XMLValidator` → `validateEntityReferences` → `fast-xml-parser` parse → `normalizeTextContent` → `sortNodes` → `XMLBuilder` build. It has no `vscode` dependency, so it is unit-testable without the extension host.

`src/utils/fileUtils.ts` is used (10 MB limit, `isFileSizeWithinLimit`, applied to the editor document only, not the clipboard).

**`src/utils/nodeSorter.ts`, `whitespaceUtils.ts` and `namespaceUtils.ts` are not imported anywhere** — they are leftover from an earlier design. Sorting and whitespace handling live as private methods in `XmlProcessingService`. Change behavior there, not in those files, and don't assume namespace normalization (moving `xmlns` to the root) happens. Check with grep before relying on or deleting them.

## Normalization behavior (the core idea)

- **Sorting:** `sortNodes` sorts every object's keys with `localeCompare`. With `preserveOrder: false`, `fast-xml-parser` groups siblings by tag name, so *different* tag names end up alphabetical while *same-name* siblings stay an array in their original relative order (arrays are mapped, never sorted). Attributes (`@_` prefix) are sorted in the same pass.
- **Comments** are dropped (`ignoreComments: true`); the XML declaration is parsed like any other node.
- **Whitespace:** parser `trimValues` is the inverse of `preserveLeadingTrailingWhitespaceInText`; `normalizeTextContent` collapses internal whitespace runs to one space and also applies to attribute values.
- **Entities:** the parser does not decode (`processEntities: false`), the builder encodes (`processEntities: true`). `validateEntityReferences` accepts only `lt gt amp apos quot` plus well-formed numeric references in text and attribute values (not inside comments, CDATA or processing instructions); DTD-defined entities are rejected by design. When the raw string contains an unsupported reference (or an `&` running into markup), it decides from a second parse that keeps CDATA apart (`cdataPropName`), so it sees exactly what the parser sees; don't replace that with a regex lexer over the raw string.
- **Validation** runs on the same trimmed string the parser receives (so whitespace or a BOM before `<?xml ...?>` is fine); `XMLValidator` decides well-formedness (plus a check that the document ends with `>`, for truncated input it lets through), so don't add raw-string heuristics such as bracket counting.
- **Output:** always pretty-printed with `<tag></tag>` (never `<tag/>`) for consistency.
- Parser errors are rethrown as `Malformed XML...` or `XML processing error: ...`; `extension.ts` prefixes them with which side (selection or clipboard) was invalid. Tests assert on these message prefixes, so don't reword them casually.

## Configuration

User settings live under `smartXmlDiff.*` and are declared in `package.json` (`contributes.configuration`) — add new settings there *and* in the `config.get(...)` block in `compareWithClipboard`, then map them onto `XmlNormalizationOptions`.

| Setting | Default | Maps to `XmlNormalizationOptions` |
|---|---|---|
| `preserveLeadingTrailingWhitespace` | `false` | `preserveLeadingTrailingWhitespaceInText` |
| `normalizeWhitespaceInTextNodes` | `true` | `normalizeWhitespaceInTextNodes` |
| `indentation` | `2` | `indentationString` (`' '.repeat(indentationWidth(n))`, clamped to 0-16) |

Settings are read with the document URI as scope, so folder-level values of resource-scoped settings (`indentation`) apply. `XmlNormalizationOptions.ignoreInsignificantWhitespace` has no setting: it only matters when pretty-print is off, which the extension never does.

## Tests

- Mocha `describe`/`it` style, files in `src/test/*.test.ts`. `xmlProcessingService.test.ts` is the big one (pure service logic); `integration.test.ts` and `extension.test.ts` need the extension host.
- XML fixtures live in `xml-fixtures/` (`nodes-position/`, `nodes-whitespace/` pairs, plus `edge_*.xml` and `sample*.xml`). Add new fixture pairs there rather than inlining large XML strings.
- When changing normalization, add a test for the new case first; the service is deterministic, so assert on exact output strings.

## Packaging notes

- Entry `src/extension.ts` → single bundle `dist/extension.js`; `vscode` is external (see `esbuild.js`).
- Activation: `onLanguage:xml` and `onSelection`; the context-menu entry only shows when `editorLangId == xml`. Minimum VS Code is `^1.74.0` (keep `@types/vscode` aligned with it; don't use newer APIs).
- Update `CHANGELOG.md` for user-facing changes, and keep its top entry in sync with the `version` in `package.json`.
- Dependencies are deliberately minimal: `fast-xml-parser` (v4) is the only runtime dependency. Don't upgrade to v5 without checking the parser/builder option names used above.

## Task tracking (VS Code Todo MCP)

When the `todo_*` tools are connected, the MCP is this project's task tracker. Reach for it
when the task at hand actually involves tracked work — don't call it on every turn:

- **When the user refers to tasks, todos, plans, or "what's next"** (or you need to find
  existing tracked work), read with `todo_list_items` / `todo_count_items` (`workspace` scope)
  before searching the repo — the MCP is the source of truth for outstanding work.
- **When you produce a multi-step plan worth keeping**, save it with `todo_add_items`
  (`workspace`) and tag every step with one shared plan tag via `todo_set_tags`; re-read it
  with the `tag` filter.
- **When you finish a tracked step**, mark it with `todo_set_completed` (don't delete).

Skip it for quick questions or one-off edits that aren't about tracked work. Each tool's
description covers scopes, notes, filtering, and read-only behavior.
