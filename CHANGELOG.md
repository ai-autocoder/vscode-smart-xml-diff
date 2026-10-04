# Change Log

## [1.0.5]

- Text and attribute values are compared exactly as written (no number conversion)
- Fewer false "malformed XML" errors, e.g. for `>` in values, markup-like text in CDATA or comments, or whitespace before the XML declaration
- Mixed content (text with inline elements) keeps its order and spacing
- Element sorting no longer depends on VS Code's display language
- Processing instructions and the XML declaration are kept as written
- Removed the unused `smartXmlDiff.ignoreWhitespace` setting; `smartXmlDiff.indentation` is limited to 0-16
- The 10 MB limit applies to the compared XML, including the clipboard
- Closed diff tabs release their memory; restored tabs explain that the comparison expired
- Clearer clipboard errors, and the non-XML warning no longer delays the diff
- README corrections

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
