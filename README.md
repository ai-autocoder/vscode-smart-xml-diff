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
Smart XML Diff enhances Visual Studio Code by providing a powerful XML comparison workflow specifically designed for situations where the **order of sibling XML nodes (nodes under the same parent) is not semantically important**. It enables developers and XML specialists to compare selected XML fragments with clipboard content. The extension intelligently reorders sibling nodes and normalizes formatting to highlight only meaningful differences in structure and content, significantly reducing noise from positional changes.

## Key Features
- **Context Menu Integration:** Easily compare selected XML text with clipboard content via a right-click context menu action.
- **Smart Diff Algorithm:**
    - **Reorders Sibling Nodes:** Automatically rearranges child nodes under the same parent to match their counterparts in the other document, based on tag name. This is the core feature for ignoring insignificant order differences.
    - **Normalizes Whitespace:** Standardizes indentation and spacing within text content according to configuration.
- **VS Code Diff View:** Leverages VS Code's native diff interface for a familiar and powerful comparison experience.

## When to Use This Extension
This extension is **most effective** and **intended for use** when comparing XML documents where:
- The order of elements that are direct children of the same parent node **does not affect the meaning or validity** of the XML. For example, a list of `<property>` elements where their sequence doesn't matter.
- You want to quickly find differences in element presence, attribute values, or text content, without being distracted by nodes simply being in a different position under their shared parent.

**If the order of sibling nodes is crucial for your XML's semantics (e.g., a sequence of `<step>` elements in a process), this tool will reorder them and may obscure or misrepresent order-dependent changes. In such cases, a standard text diff tool might be more appropriate for those specific sections.**

---

## Usage

### Step-by-Step Workflow
1.  **Open an XML file** in VS Code or have an XML snippet ready.
2.  **Select** the XML fragment in your editor that you wish to use as the first source for comparison.
3.  **Copy** the other XML content (the second source) to your system clipboard.
4.  **Right-click** on your selected text in the editor.
5.  From the context menu, choose **Compare XML with Clipboard**.
6.  The extension will:
    *   Parse the selected XML and the clipboard XML.
    *   Normalize both XML structures. This includes reordering sibling nodes (children of the same parent) to match each other if they have the same tag name, and applying whitespace normalization rules.
    *   Open VS Code's standard diff view, showing the normalized version of your selection on the left and the normalized version of the clipboard content on the right.
7.  Review the highlighted differences. These differences should primarily represent changes in content, attributes, or the presence/absence of nodes, rather than just changes in sibling node order.

### Screenshots
 TODO

### Commands & Shortcuts
-   **Context Menu Command:** `Compare XML with Clipboard` (visible when text is selected in an editor).
-   **Command Palette:** Search for `Smart XML Diff: Compare XML with Clipboard` (this command will also require a selection to be active).
-   **Keyboard Shortcut:** No default keyboard shortcut is assigned. Users can assign a custom shortcut via VS Code's "Keyboard Shortcuts" settings (`File > Preferences > Keyboard Shortcuts`) by searching for the command name.

### Best Practices
-   **Understand When to Use:** This tool is powerful when sibling node order is irrelevant. If node order *is* critical, use this tool cautiously or supplement with a standard text diff.
-   **Select Precisely:** For focused comparisons, select only the relevant XML block. This can also improve performance with very large documents.
-   **Valid XML:** Ensure both your selection and clipboard content are well-formed XML to avoid parsing errors.
-   **Large Files:** For files approaching or exceeding a few megabytes, be patient as normalization can take time. The extension aims to provide progress indication for longer operations.

---

## Configuration

### Settings Reference
All settings can be found in VS Code's settings under `Smart XML Diff`:

| Setting                                      | Default | Description                                                                                 |
|-----------------------------------------------|---------|---------------------------------------------------------------------------------------------|
| `smartXmlDiff.ignoreWhitespace`               | `true`  | Ignore insignificant whitespace between elements and normalize whitespace in text nodes.      |
| `smartXmlDiff.preserveLeadingTrailingWhitespace` | `false` | Preserve leading/trailing whitespace in text nodes.                                          |
| `smartXmlDiff.normalizeWhitespaceInTextNodes` | `true`  | Collapse multiple spaces/tabs/newlines in text nodes to a single space.                      |
| `smartXmlDiff.indentation`                    | _(TBD)_ | Indentation style for normalized XML (future).                                               |
| `smartXmlDiff.sortAttributes`                 | _(TBD)_ | Sort attributes alphabetically (future).                                                     |
| `smartXmlDiff.keyAttributes`                  | _(TBD)_ | User-defined key attributes for node equivalence (future).                                   |

### Example Configurations
```json
{
  "smartXmlDiff.ignoreWhitespace": true,
  "smartXmlDiff.preserveLeadingTrailingWhitespace": false,
  "smartXmlDiff.normalizeWhitespaceInTextNodes": true
}
```

---

## Contributing
Contributions are welcome! Just send a pull request via GitHub.

## License
MIT License.

## Support
- [GitHub Issues](https://github.com/your-repo/xml-diff/issues)
- [VS Code Marketplace Q&A](https://marketplace.visualstudio.com/items?itemName=your-publisher.xml-diff)
