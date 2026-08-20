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
- CI (`.github/workflows/ci.yml`) runs `npm ci` and `xvfb-run -a npm test` on Ubuntu for pushes to `main` and pull requests, plus an `npm audit --omit=dev` job that only emits a warning until fast-xml-parser is upgraded to v5 (v4 has open advisories).
- Press F5 in VS Code to launch an Extension Development Host for manual testing.
- Code style is enforced by Prettier (`.prettierrc`: single quotes, semicolons, trailing commas, 100 cols) and ESLint. Run `npm run lint` before finishing a change.

## Architecture

Only two files contain live logic:

- `src/extension.ts` — `activate()` registers the `smartXmlDiff:` virtual-document scheme (`XmlDiffContentProvider`, in-memory map keyed by URI; an entry is deleted when `onDidCloseTextDocument` fires for its URI, and a missing entry is served as `EXPIRED_COMPARISON_TEXT`, e.g. for tabs restored after a reload) and the `smartXmlDiff.compareWithClipboard` command. `XmlDiffHandler.compareWithClipboard()` reads the selection (or whole document if the selection is empty), reads the clipboard, normalizes both with `XmlProcessingService`, stores the results in the provider, and opens them with the built-in `vscode.diff` command. Errors are surfaced via `showErrorMessage` and logged to the "Smart XML Diff" output channel.
- `src/services/xmlProcessingService.ts` — `XmlProcessingService.parseNormalizeAll(xml)` is the whole pipeline: trim + basic checks (`validateXmlBasics`) → `XMLValidator` → `validateEntityReferences` → `fast-xml-parser` parse (`preserveOrder: true`) → `readNodes` (into typed `XmlNode`s) → `normalizeElement` / `normalizeContent` → `serialize` (its own serializer; `XMLBuilder` is not used). It has no `vscode` dependency, so it is unit-testable without the extension host.

`src/utils/fileUtils.ts` is used (10 MB limit, `isTextWithinSizeLimit`, applied to the selection-or-document text and to the clipboard text; both inputs are read and checked before either is normalized).

**`src/utils/nodeSorter.ts`, `whitespaceUtils.ts` and `namespaceUtils.ts` are not imported anywhere** — they are leftover from an earlier design. Sorting and whitespace handling live as private methods in `XmlProcessingService`. Change behavior there, not in those files, and don't assume namespace normalization (moving `xmlns` to the root) happens. Check with grep before relying on or deleting them.

## Normalization behavior (the core idea)

- **Sorting:** `normalizeContent` stable-sorts the children of elements that contain only elements (and processing instructions, keyed `?target`) by name, so *different* tag names end up alphabetical while *same-name* siblings keep their relative order. Mixed content (non-whitespace text next to elements or processing instructions) is never reordered. The document's top level keeps document order (the declaration must stay first). Attributes are sorted by name; processing-instruction pseudo-attributes are not. Names are compared by UTF-16 code unit (`compareNames`), not `localeCompare`, so the order doesn't depend on the host locale.
- **Comments** are dropped (`ignoreComments: true`). The XML declaration and other processing instructions are rebuilt from the parser's attribute-style reading of their content (`<?target data?>` gives `data: true`, printed back as a bare name), so content that isn't `name="value"` pairs is not reproduced exactly. The DOCTYPE is dropped. `__proto__` element names come back from the parser as `#__proto__` and are mapped back.
- **Whitespace:** the parser keeps all whitespace (`trimValues: false`); `normalizeContent` handles it. Whitespace-only text (XML whitespace: space, tab, CR, LF) between the children of an element without other text is formatting and always dropped. Text-only content and attribute values are collapsed (`normalizeWhitespaceInTextNodes`) and trimmed (unless `preserveLeadingTrailingWhitespaceInText`) by `normalizeValue`. In mixed content each text node is collapsed but only the ends of the whole content are trimmed, so the spaces between text and elements survive (text-only children such as `<b> big </b>` are still trimmed, as configured).
- **Entities:** the parser does not decode (`processEntities: false`), `escapeXml` encodes `& < > ' "` in text and attribute values (as `XMLBuilder` did), but not in processing instructions. `validateEntityReferences` accepts only `lt gt amp apos quot` plus well-formed numeric references in text and attribute values (not inside comments, CDATA or processing instructions); DTD-defined entities are rejected by design. When the raw string contains an unsupported reference (or an `&` running into markup), it decides from a second parse that keeps CDATA apart (`cdataPropName`, with `preserveOrder: false`), so it sees exactly what the parser sees; don't replace that with a regex lexer over the raw string.
- **Validation** runs on the same trimmed string the parser receives (so whitespace or a BOM before `<?xml ...?>` is fine); `XMLValidator` decides well-formedness (with `allowBooleanAttributes: false`, so `<a disabled/>` is rejected, while the parser allows them only to read processing instructions; plus a check that the document ends with `>`, for truncated input it lets through), so don't add raw-string heuristics such as bracket counting.
- **Output:** always pretty-printed with `<tag></tag>` (never `<tag/>`) for consistency, one child element per line; elements with text or mixed content are written on one line (`serializeInline`), since indenting would add whitespace to their content. Each traversal recurses once per nesting level without callbacks in between, to keep deep documents within the stack.
- Parser errors are rethrown as `Malformed XML...` or `XML processing error: ...`; `extension.ts` prefixes them with which side (selection or clipboard) was invalid. Tests assert on these message prefixes, so don't reword them casually.

## Configuration

User settings live under `smartXmlDiff.*` and are declared in `package.json` (`contributes.configuration`) — add new settings there *and* in the `config.get(...)` block in `compareWithClipboard`, then map them onto `XmlNormalizationOptions`.

| Setting | Default | Maps to `XmlNormalizationOptions` |
|---|---|---|
| `preserveLeadingTrailingWhitespace` | `false` | `preserveLeadingTrailingWhitespaceInText` |
| `normalizeWhitespaceInTextNodes` | `true` | `normalizeWhitespaceInTextNodes` |
| `indentation` | `2` | `indentationString` (`' '.repeat(indentationWidth(n))`, clamped to 0-16) |

Settings are read with the document URI as scope, so folder-level values of resource-scoped settings (`indentation`) apply. `XmlNormalizationOptions.prettyPrintOutput` has no setting: the extension always pretty-prints, and the tests use `false` for single-line output.

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
