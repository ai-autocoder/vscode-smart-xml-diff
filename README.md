# Smart XML Diff VS Code Extension

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [When to Use This Extension](#when-to-use-this-extension)
- [Usage](#usage)
  - [Step-by-Step Workflow](#step-by-step-workflow)
  - [Screenshots](#screenshots)
  - [Commands & Shortcuts](#commands--shortcuts)
  - [Best Practices](#best-practices)
- [Configuration](#configuration)
  - [Settings Reference](#settings-reference)
  - [Example Configurations](#example-configurations)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## Overview

Smart XML Diff enhances Visual Studio Code by providing a powerful XML comparison workflow. It's specifically designed for situations where the **alphabetical order of sibling XML nodes with _different_ tag names (nodes under the same parent) is not semantically important**, while the relative order of sibling nodes with the _same_ tag name is preserved. It enables developers and XML specialists to compare selected XML fragments with clipboard content. The extension intelligently sorts distinct sibling nodes, normalizes formatting, and standardizes whitespace to highlight only meaningful differences in structure and content, significantly reducing noise from positional changes of distinct sibling types.

## Key Features

- **Context Menu Integration:** Easily compare selected XML text with clipboard content via a right-click context menu action.
- **Smart Diff Algorithm:**
  - **Sorts Sibling Nodes (by distinct tag name):** Automatically sorts sibling elements with _different_ tag names alphabetically under their common parent. The relative order of sibling elements that share the _same_ tag name (e.g., a list of `<item>` elements) is preserved from the input. This helps ignore insignificant order differences between distinct types of child elements.
  - **Normalizes Whitespace:** Standardizes indentation and spacing within text content according to configuration.
  - **Sorts Attributes:** Optionally sorts element attributes alphabetically by name.
- **VS Code Diff View:** Leverages VS Code's native diff interface for a familiar and powerful comparison experience.

## When to Use This Extension

This extension is **most effective** and **intended for use** when comparing XML documents where:

- The alphabetical order of sibling elements with _different tag names_ under the same parent node **does not affect the meaning or validity** of the XML. For example, if `<config><timeout/><retries/></config>` is semantically equivalent to `<config><retries/><timeout/></config>`.
- For sequences of elements with the _same tag name_ (e.g., a list of `<property>` elements), their relative order _is_ often important, and this extension **preserves** that relative order.
- You want to quickly find differences in element presence, attribute values, or text content, without being distracted by distinct sibling nodes simply being in a different (but semantically equivalent) order.

**Important Considerations:**

- If the order of sibling nodes _with different tag names_ is crucial for your XML's semantics (e.g., a `<header>` must appear before a `<body>` under the same parent), this tool will sort them alphabetically (e.g., `<body>` then `<header>`) and may obscure or misrepresent such order-dependent changes.
- For sequences of sibling elements _with the same tag name_ (e.g., multiple `<step>` elements in a process), their relative order is maintained from the input, so order-dependent changes within such sequences will still be visible.
- If the absolute order of _all_ sibling types is critical, a standard text diff tool might be more appropriate for those specific sections.

---

## Usage

### Step-by-Step Workflow

1.  **Open an XML file** in VS Code or have an XML snippet ready.
2.  **Select** the XML fragment in your editor that you wish to use as the first source for comparison. If no text is selected, the entire document content will be used.
3.  **Copy** the other XML content (the second source) to your system clipboard.
4.  **Right-click** on your selected text in the editor (or anywhere in the editor if no text is selected).
5.  From the context menu, choose **Compare XML with Clipboard**.
6.  The extension will:
    - Parse the selected XML (or full document) and the clipboard XML.
    - Normalize both XML structures. This includes sorting sibling nodes with different tag names alphabetically, preserving the relative order of same-tagged sibling elements, optionally sorting attributes, and applying whitespace normalization rules.
    - Open VS Code's standard diff view, showing the normalized version of your selection/document on the left and the normalized version of the clipboard content on the right.
7.  Review the highlighted differences. These differences should primarily represent changes in content, attributes, or the presence/absence of nodes, rather than just changes in the order of distinct sibling node types.

### Screenshots

TODO

### Commands & Shortcuts

- **Context Menu Command:** `Compare XML with Clipboard` (visible when an editor is active; uses selection or whole document).
- **Command Palette:** Search for `Smart XML Diff: Compare XML with Clipboard` (this command will also require an active editor and use selection or whole document).
- **Keyboard Shortcut:** No default keyboard shortcut is assigned. Users can assign a custom shortcut via VS Code's "Keyboard Shortcuts" settings (`File > Preferences > Keyboard Shortcuts`) by searching for the command name.

### Best Practices

- **Understand Sorting Behavior:** Be aware that sibling elements with _different_ tag names are sorted alphabetically. The relative order of sibling elements with the _same_ tag name is preserved. This is key to interpreting the diff correctly.
- **Select Precisely:** For focused comparisons on parts of a large document, select only the relevant XML block. This can also improve performance.
- **Valid XML:** Ensure both your selection/document and clipboard content are well-formed XML to avoid parsing errors.
- **Large Files:** For files approaching the 10MB limit, be patient as normalization can take time. The extension aims to provide progress indication for longer operations.

---

## Configuration

### Settings Reference

All settings can be found in VS Code's settings under `Smart XML Diff`:

| Setting                                          | Default | Description                                                                                                |
| ------------------------------------------------ | ------- | ---------------------------------------------------------------------------------------------------------- |
| `smartXmlDiff.ignoreWhitespace`                  | `true`  | Ignore insignificant whitespace between elements and normalize whitespace in text nodes.                   |
| `smartXmlDiff.preserveLeadingTrailingWhitespace` | `false` | Preserve leading/trailing whitespace in text nodes.                                                        |
| `smartXmlDiff.normalizeWhitespaceInTextNodes`    | `true`  | Collapse multiple spaces/tabs/newlines in text nodes to a single space.                                    |
| `smartXmlDiff.indentation`                       | `2`     | Number of spaces to use for indentation in the normalized XML. Defaults to 2 spaces if not set or invalid. |

### Example Configurations

```json
{
  "smartXmlDiff.ignoreWhitespace": true,
  "smartXmlDiff.preserveLeadingTrailingWhitespace": false,
  "smartXmlDiff.normalizeWhitespaceInTextNodes": true,
  "smartXmlDiff.indentation": 2
}
```

---

## Contributing

Contributions are welcome! Just send a pull request via GitHub.

## License

MIT License.
