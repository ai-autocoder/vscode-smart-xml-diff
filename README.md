# Smart XML Diff VS Code Extension

## Table of Contents
- [Overview](#overview)
- [Key Features](#key-features)
- [Target Audience](#target-audience)
- [Supported XML Types](#supported-xml-types)
- [Installation](#installation)
  - [Marketplace](#install-from-marketplace)
  - [Manual](#manual-installation)
  - [Requirements](#requirements)
- [Usage](#usage)
  - [Step-by-Step Workflow](#step-by-step-workflow)
  - [Screenshots](#screenshots)
  - [Commands & Shortcuts](#commands--shortcuts)
  - [Best Practices](#best-practices)
- [Configuration](#configuration)
  - [Settings Reference](#settings-reference)
  - [Example Configurations](#example-configurations)
- [Troubleshooting](#troubleshooting)
- [Contributing](#contributing)
- [License](#license)
- [Version History](#version-history)
- [Support](#support)
- [Credits](#credits)

---

## Overview
Smart XML Diff enhances Visual Studio Code by providing a powerful, noise-free XML comparison workflow. It enables developers and XML specialists to compare selected XML fragments with clipboard content, highlighting only meaningful differences and ignoring irrelevant node order or formatting changes.

## Key Features
- **Context Menu Integration:** Compare selected XML with clipboard via right-click.
- **Smart Diff Algorithm:** Ignores node order, normalizes whitespace, and sorts attributes for accurate comparisons.
- **VS Code Diff View:** Leverages the native diff interface for a familiar experience.
- **Large File Support:** Handles files up to 10MB with progress indicators.
- **Error Handling:** Clear messages for malformed XML or clipboard issues.
- **Configurable:** Options for whitespace, attribute sorting, and more.

## Target Audience
- Software developers working with XML configs (Spring, .NET, build tools)
- Data engineers and analysts
- System integrators
- Technical writers and XML specialists

## Supported XML Types
- Any well-formed XML file or snippet
- UTF-8 encoded XML
- XML with namespaces, attributes, and mixed content

---

## Installation

### Install from Marketplace
1. Open VS Code and go to the Extensions view (`Ctrl+Shift+X`).
2. Search for `Smart XML Diff`.
3. Click **Install**.

### Manual Installation
1. Download the latest `.vsix` release from the [GitHub Releases](https://github.com/your-repo/xml-diff/releases) page.
2. In VS Code, press `Ctrl+Shift+P` and run `Extensions: Install from VSIX...`.
3. Select the downloaded file.

### Requirements
- **VS Code Version:** 1.74.0 or higher
- **Dependencies:** None (bundled with `fast-xml-parser`)

---

## Usage

### Step-by-Step Workflow
1. **Open an XML file** in VS Code.
2. **Select** the XML fragment you want to compare (or leave unselected to use the whole file).
3. **Copy** the XML to compare from another source to your clipboard.
4. **Right-click** in the editor and choose **Smart XML Diff: Compare with Clipboard**.
5. The extension will normalize both XMLs and open a diff view:
   - **Left:** Your selection (or file)
   - **Right:** Clipboard content
6. Review highlighted differences—only meaningful changes are shown.

### Screenshots
> _Add screenshots here showing the context menu, diff view, and normalization results._

### Commands & Shortcuts
- **Command Palette:** `Smart XML Diff: Compare with Clipboard`
- **Context Menu:** Right-click in XML editor
- _No default keyboard shortcut; assign one via VS Code Keyboard Shortcuts if desired._

### Best Practices
- Select only the relevant XML block for focused comparisons.
- Use the extension for config files, API payloads, or any XML where node order is not semantically significant.
- For large files, wait for the progress indicator to complete.

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

## Troubleshooting

### Known Limitations
- Only compares selection vs. clipboard (not two arbitrary files—planned for future).
- Node equivalence is based on tag name (key attributes planned for future).
- Large files (>10MB) are not supported.

### Common Error Messages
- **"Malformed XML in selection."**
  _Solution:_ Ensure your selection is valid XML.
- **"Malformed XML in clipboard."**
  _Solution:_ Copy only valid XML to the clipboard.
- **"File exceeds 10MB size limit."**
  _Solution:_ Reduce file size or selection.
- **"Failed to access clipboard."**
  _Solution:_ Check system clipboard permissions.

### Performance Tips
- For best results, compare only the relevant XML block.
- Close unused VS Code tabs to free memory for large comparisons.

### Compatibility
- No known conflicts with other XML extensions.

---

## Contributing
Contributions are welcome! Just send a pull request via GitHub.

## License
MIT License.

## Support
- [GitHub Issues](https://github.com/your-repo/xml-diff/issues)
- [VS Code Marketplace Q&A](https://marketplace.visualstudio.com/items?itemName=your-publisher.xml-diff)

## Credits
- Built with [fast-xml-parser](https://github.com/NaturalIntelligence/fast-xml-parser)
- Inspired by the needs of developers and XML professionals
