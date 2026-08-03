# Change Log

## [Unreleased]

- Fix: text and attribute values are no longer converted to numbers, so values such as `1.10` vs `1.1`, `007`, `+44...` or `version="1.0"` are compared and shown exactly as written
- Fix: well-formed XML is no longer rejected as malformed when it contains `>` in text or attribute values, or `<`, `>` or entity-like text such as `&nbsp;` inside CDATA sections, comments or processing instructions
- Fix: XML with whitespace (optionally after a byte order mark) before the `<?xml ...?>` declaration, common when copying to the clipboard, is now accepted
- Fix: input that ends with text after a self-closing root element (e.g. `<a/>x`) is now reported as malformed instead of the text being silently dropped
- Removed the `smartXmlDiff.ignoreWhitespace` setting, which had no effect on the diff; a value left in your settings is ignored and can be deleted
- Fix: `smartXmlDiff.indentation` is limited to 0-16 spaces; larger values are clamped to 16 instead of producing very wide indentation or an error, and folder-level values are now honoured
- Docs: corrected the README (command name, where the command appears, attribute sorting, comments, supported entities, limits)

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
