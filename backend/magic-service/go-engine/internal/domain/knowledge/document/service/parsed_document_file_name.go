package document

import "strings"

const parsedDocumentFileNameLabel = "文件名: "

// ApplyPreferredParsedDocumentFileName 用业务文件名覆盖解析结果中的展示文件名。
//
// 解析器在表格文档里会从 URL / object key 推导 file_name，这对带随机 key 的上传文件不稳定。
// 这里在应用层拿到稳定的业务文件名后，将其统一回填到 ParsedDocument，保证 preview / sync 文本一致。
func ApplyPreferredParsedDocumentFileName(parsed *ParsedDocument, fileName string) {
	trimmedFileName := strings.TrimSpace(fileName)
	if parsed == nil || trimmedFileName == "" {
		return
	}

	if parsed.DocumentMeta == nil {
		parsed.DocumentMeta = make(map[string]any, 1)
	}
	parsed.DocumentMeta[ParsedMetaFileName] = trimmedFileName

	if len(parsed.Blocks) == 0 {
		return
	}

	for index := range parsed.Blocks {
		block := &parsed.Blocks[index]
		if block.Metadata == nil {
			block.Metadata = make(map[string]any, 1)
		}
		block.Metadata[ParsedMetaFileName] = trimmedFileName
		if shouldRewriteParsedBlockFileName(*block) {
			block.Content = rewriteParsedBlockFileName(block.Content, trimmedFileName)
		}
	}

	if parsed.SourceType == ParsedDocumentSourceTabular {
		parsed.PlainText = rebuildParsedDocumentPlainText(parsed.Blocks)
	}
}

func shouldRewriteParsedBlockFileName(block ParsedBlock) bool {
	switch block.Type {
	case ParsedBlockTypeTableRow, ParsedBlockTypeTableSummary:
		return true
	default:
		return false
	}
}

func rewriteParsedBlockFileName(content, fileName string) string {
	normalized := strings.TrimSpace(strings.ReplaceAll(content, "\r\n", "\n"))
	if normalized == "" {
		return content
	}

	lines := strings.Split(normalized, "\n")
	firstLine := strings.TrimSpace(lines[0])
	if strings.HasPrefix(firstLine, parsedDocumentFileNameLabel) {
		lines[0] = parsedDocumentFileNameLabel + fileName
		return strings.Join(lines, "\n")
	}

	return parsedDocumentFileNameLabel + fileName + "\n" + normalized
}

func rebuildParsedDocumentPlainText(blocks []ParsedBlock) string {
	parts := make([]string, 0, len(blocks))
	for _, block := range blocks {
		if trimmed := strings.TrimSpace(block.Content); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return strings.Join(parts, "\n\n")
}
