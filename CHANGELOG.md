# Change Log

## [Unreleased]

- Fix: text and attribute values are no longer converted to numbers, so values such as `1.10` vs `1.1`, `007`, `+44...` or `version="1.0"` are compared and shown exactly as written
- Fix: well-formed XML is no longer rejected as malformed when it contains `>` in text or attribute values, or `<`, `>` or entity-like text such as `&nbsp;` inside CDATA sections, comments or processing instructions
- Fix: XML with whitespace (optionally after a byte order mark) before the `<?xml ...?>` declaration, common when copying to the clipboard, is now accepted
- Fix: input that ends with text after a self-closing root element (e.g. `<a/>x`) is now reported as malformed instead of the text being silently dropped
- Removed the `smartXmlDiff.ignoreWhitespace` setting, which had no effect on the diff; a value left in your settings is ignored and can be deleted
- Fix: `smartXmlDiff.indentation` is limited to 0-16 spaces; larger values are clamped to 16 instead of producing very wide indentation or an error, and folder-level values are now honoured
- Docs: corrected the README (command name, where the command appears, attribute sorting, comments, supported entities, limits)
- Fix: mixed content such as `<p>Hello <b>big</b> world</p>` is no longer rewritten: its text stays in place, with the spaces between words and elements, and its elements are not reordered, so moving text or elements around is shown as a difference
- Fix: whitespace between elements no longer shows up as a difference when `smartXmlDiff.preserveLeadingTrailingWhitespace` is on
- Fix: processing instructions keep their content (`<?target data?>` was shown as `<?target data="true"?>`), and the XML declaration keeps `version` first
- Fix: elements are sorted by character code, so the order no longer depends on VS Code's display language, and differently encoded names (such as `café` in NFC and NFD) always sort the same way; names starting with an uppercase letter now come before lowercase ones
- Fix: elements named `__proto__` are no longer shown as `#__proto__`, and attributes without a value (`<a disabled/>`, which isn't well-formed XML) are reported as malformed
- Deeper nesting is supported before the stack runs out

## [1.0.4]

- Update README
- Update dependencies

## [1.0.3]

- Add screenshots section to README

## [1.0.2]

- Remove unnecessary output channel display in clipboard comparison

## [1.0.1]

- removed unused configuration options and clean up XML processing logic
- Improved Readme documentation

## [1.0.0]

- Initial stable release

## [0.0.1]

- Initial development release
