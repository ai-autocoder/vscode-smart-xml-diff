# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Smart XML Diff is a Visual Studio Code extension that provides intelligent XML comparison with clipboard content. The extension normalizes XML before diffing by sorting sibling nodes with different tag names alphabetically (while preserving order of same-tag siblings), normalizing whitespace, and optionally sorting attributes. This reduces noise from semantically insignificant differences.

**Key concept**: The extension sorts sibling elements with *different* tag names alphabetically, but preserves the relative order of sibling elements with the *same* tag name. This is designed for XML where distinct sibling ordering is not semantically meaningful.

## Development Commands

### Build and Watch
- `npm run compile` - Type check, lint, and build with esbuild
- `npm run watch` - Run TypeScript type checking and esbuild in watch mode (parallel)
- `npm run package` - Production build (type check, lint, minify)

### Testing
- `npm test` - Run all tests (compiles, builds, lints, then runs Mocha tests)
- `npm run pretest` - Compile tests, build extension, and lint (runs before tests)
- `npm run compile-tests` - Compile TypeScript tests to `out/` directory

### Code Quality
- `npm run check-types` - Run TypeScript type checking without emitting files
- `npm run lint` - Run ESLint on `src/` directory

### Publishing
- `npm run vscode:prepublish` - Runs automatically before publishing (same as `package`)

## Architecture

### Core Processing Flow

1. **Extension Entry (`src/extension.ts`)**:
   - Registers custom URI scheme (`smartXmlDiff`) via `XmlDiffContentProvider`
   - Implements `XmlDiffHandler` which orchestrates the comparison workflow
   - Command `smartXmlDiff.compareWithClipboard` triggers the diff operation
   - Retrieves selected XML (or full document) and clipboard content
   - Passes both through `XmlProcessingService` for normalization
   - Uses VS Code's native diff view (`vscode.diff` command) to display results

2. **XML Processing Service (`src/services/xmlProcessingService.ts`)**:
   - Uses `fast-xml-parser` library for parsing and building XML
   - Main method: `parseNormalizeAll(xml: string): string`
   - Validates XML structure and entities before parsing
   - Normalizes text content and whitespace based on configuration
   - Sorts all object keys (elements and attributes) alphabetically
   - Rebuilds XML with consistent formatting

3. **Utility Modules** (in `src/utils/`):
   - **`nodeSorter.ts`**: Provides `NodeSorter.sort()` and `NodeSorter.sortAndNormalizeAttributes()` for recursive sorting of XML node trees. Separates attributes (`@_` prefix) from children, sorts child keys alphabetically, and preserves text nodes.
   - **`whitespaceUtils.ts`**: Handles whitespace normalization based on user settings (ignore, preserve leading/trailing, normalize internal whitespace).
   - **`namespaceUtils.ts`**: Normalizes XML namespaces by moving all `xmlns` declarations to the root node and removing duplicates.
   - **`fileUtils.ts`**: Contains `isFileSizeWithinLimit()` to enforce 10MB file size limit.

### Key Data Flow

```
User Selection/Document → XmlDiffHandler.compareWithClipboard()
                           ↓
Clipboard Content -------→ XmlProcessingService.parseNormalizeAll()
                           ↓
                    [Validate → Parse → Normalize Text → Sort Nodes → Build]
                           ↓
                    XmlDiffContentProvider (stores normalized content)
                           ↓
                    VS Code Diff View (vscode.diff command)
```

### Configuration

The extension reads VS Code workspace settings under `smartXmlDiff`:
- `ignoreWhitespace` (default: `true`) - Ignore insignificant whitespace
- `preserveLeadingTrailingWhitespace` (default: `false`) - Preserve leading/trailing whitespace in text nodes
- `normalizeWhitespaceInTextNodes` (default: `true`) - Collapse multiple spaces/tabs/newlines to single space
- `indentation` (default: `2`) - Number of spaces for indentation in diff output

These settings are read in `extension.ts:113-136` and passed to `XmlProcessingService`.

## Build System

- Uses **esbuild** for bundling (configured in `esbuild.js`)
- Entry point: `src/extension.ts`
- Output: `dist/extension.js` (single bundled file)
- External: `vscode` module is not bundled (provided by VS Code runtime)
- Production builds are minified; development builds include sourcemaps

## Testing

- Test framework: Mocha with `@vscode/test-electron`
- Test runner: `src/test/runTest.ts`
- Tests are located in `src/test/` directory
- Tests compile to `out/` directory before running
- Integration tests verify end-to-end XML normalization and diffing

## Important Implementation Details

### XML Parser Configuration
The `fast-xml-parser` is configured with:
- `preserveOrder: false` - Allows conversion to object representation where keys are tag names
- `ignoreAttributes: false` - Attributes are preserved with `@_` prefix
- `ignoreComments: true` - Comments are stripped for semantic comparison
- `trimValues` - Controlled by `preserveLeadingTrailingWhitespaceInText` option

### Sorting Behavior
All object keys are sorted alphabetically in `xmlProcessingService.ts:160-164`. This means:
- Sibling elements with different tag names are sorted
- Attributes are sorted
- The relative order of elements with the *same* tag name in an array is preserved (arrays map each element, but don't re-sort the array itself)

### Custom URI Scheme
The extension uses a custom URI scheme `smartXmlDiff:` to provide virtual documents to VS Code's diff view. The `XmlDiffContentProvider` stores normalized XML content in memory and provides it when VS Code requests the content for comparison.

## Package Metadata

- Publisher: `FrancescoAnzalone`
- Extension ID: `smart-xml-diff`
- Minimum VS Code version: `1.74.0`
- Language support: Activated for XML files (`onLanguage:xml`)
- Context menu: Available in XML editor context menu
