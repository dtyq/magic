package splitter

import (
	"context"
	"fmt"
	"maps"
	"strconv"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/tokenizer"
)

const splitModeTableStructured = "table_structured"

type tabularFieldEntry struct {
	Header  string
	Value   string
	CellRef string
}

type parsedDocumentChunkInput struct {
	Parsed           *documentdomain.ParsedDocument
	SourceFileType   string
	RequestedMode    shared.FragmentMode
	FragmentConfig   *shared.FragmentConfig
	SegmentConfig    previewSegmentConfig
	Model            string
	TokenizerService *tokenizer.Service
	Logger           *logging.SugaredLogger
}

func splitParsedDocumentToChunks(ctx context.Context, input parsedDocumentChunkInput) ([]tokenChunk, string, error) {
	if input.Parsed == nil || input.Parsed.SourceType != documentdomain.ParsedDocumentSourceTabular || len(input.Parsed.Blocks) == 0 {
		content := ""
		if input.Parsed != nil {
			content = normalizeContent(input.Parsed.BestEffortText())
		}
		chunks, _, err := splitContentWithEffectiveModePipeline(ctx, autoSplitPipelineInput{
			Content:             content,
			SourceFileType:      input.SourceFileType,
			RequestedMode:       input.RequestedMode,
			FragmentConfig:      input.FragmentConfig,
			NormalSegmentConfig: input.SegmentConfig,
			Model:               input.Model,
			TokenizerService:    input.TokenizerService,
			Logger:              input.Logger,
		})
		return chunks, splitVersionGoTokenV2, err
	}

	chunks := splitTabularBlocks(input.Parsed.Blocks, input.SegmentConfig, input.Model, input.TokenizerService)
	return chunks, splitVersionGoTabularV3, nil
}

func splitTabularBlocks(
	blocks []documentdomain.ParsedBlock,
	segmentConfig previewSegmentConfig,
	model string,
	tokenizerService *tokenizer.Service,
) []tokenChunk {
	chunks := make([]tokenChunk, 0, len(blocks))
	limit := normalizeSegmentChunkSize(segmentConfig.ChunkSize)
	for _, block := range blocks {
		if block.Type == documentdomain.ParsedBlockTypeTableSummary && isExcelLikeTabularSource(metadataString(block.Metadata, documentdomain.ParsedMetaSourceFormat)) {
			continue
		}
		switch block.Type {
		case documentdomain.ParsedBlockTypeTableRow:
			rowChunks := splitTabularRowBlock(block, limit, model, tokenizerService)
			chunks = append(chunks, rowChunks...)
		default:
			chunks = append(chunks, buildGenericTabularChunk(block, model, tokenizerService))
		}
	}
	return chunks
}

func buildGenericTabularChunk(block documentdomain.ParsedBlock, model string, tokenizerService *tokenizer.Service) tokenChunk {
	metadata := cloneChunkMetadata(block.Metadata)
	content := strings.TrimSpace(block.Content)
	if content == "" {
		content = buildTabularSummaryContent(metadata)
	}
	return tokenChunk{
		Content:            content,
		TokenCount:         countTextTokens(content, model, tokenizerService),
		SectionPath:        buildTabularSectionPath(metadata),
		SectionLevel:       1,
		SectionTitle:       metadataString(metadata, documentdomain.ParsedMetaTableTitle),
		EffectiveSplitMode: splitModeTableStructured,
		Metadata:           metadata,
	}
}

func splitTabularRowBlock(
	block documentdomain.ParsedBlock,
	limit int,
	model string,
	tokenizerService *tokenizer.Service,
) []tokenChunk {
	metadata := cloneChunkMetadata(block.Metadata)
	fields := extractTabularFieldEntries(metadata[documentdomain.ParsedMetaFields])
	if len(fields) == 0 {
		return []tokenChunk{buildGenericTabularChunk(block, model, tokenizerService)}
	}

	prefix := buildTabularRowPrefix(metadata)
	fieldGroups := groupTabularFields(prefix, fields, limit, model, tokenizerService)
	chunks := make([]tokenChunk, 0, len(fieldGroups))
	for index, group := range fieldGroups {
		chunkMetadata := cloneChunkMetadata(metadata)
		chunkMetadata[documentdomain.ParsedMetaRowSubchunkIndex] = index
		chunkMetadata[documentdomain.ParsedMetaFields] = buildTabularFieldMetadata(group.fields)
		chunkMetadata[documentdomain.ParsedMetaHeaderPaths] = collectTabularFieldHeaders(group.fields)
		chunkMetadata[documentdomain.ParsedMetaCellRefs] = collectTabularFieldCellRefs(group.fields)

		content := prefix + buildTabularRowBody(group.fields)
		chunks = append(chunks, tokenChunk{
			Content:            strings.TrimSpace(content),
			TokenCount:         countTextTokens(content, model, tokenizerService),
			SectionPath:        buildTabularSectionPath(chunkMetadata),
			SectionLevel:       1,
			SectionTitle:       metadataString(chunkMetadata, documentdomain.ParsedMetaTableTitle),
			SectionChunkIndex:  index,
			EffectiveSplitMode: splitModeTableStructured,
			Metadata:           chunkMetadata,
		})
	}
	return chunks
}

type tabularFieldGroup struct {
	fields []tabularFieldEntry
	lines  []string
}

func groupTabularFields(
	prefix string,
	fields []tabularFieldEntry,
	limit int,
	model string,
	tokenizerService *tokenizer.Service,
) []tabularFieldGroup {
	if len(fields) == 0 {
		return nil
	}
	groups := make([]tabularFieldGroup, 0, len(fields))
	current := tabularFieldGroup{
		fields: make([]tabularFieldEntry, 0, len(fields)),
		lines:  make([]string, 0, len(fields)),
	}
	for _, field := range fields {
		candidateFields := append(append([]tabularFieldEntry(nil), current.fields...), field)
		candidateContent := prefix + buildTabularRowBody(candidateFields)
		if len(current.lines) > 0 && countTextTokens(candidateContent, model, tokenizerService) > limit {
			groups = append(groups, current)
			current = tabularFieldGroup{
				fields: make([]tabularFieldEntry, 0, len(fields)),
				lines:  make([]string, 0, len(fields)),
			}
		}
		current.fields = append(current.fields, field)
		current.lines = append(current.lines, formatTabularFieldLine(field))
	}
	if len(current.lines) > 0 {
		groups = append(groups, current)
	}
	return groups
}

func buildTabularRowPrefix(metadata map[string]any) string {
	if isExcelLikeTabularSource(metadataString(metadata, documentdomain.ParsedMetaSourceFormat)) {
		return buildExcelLikeTabularRowPrefix(metadata)
	}
	var builder strings.Builder
	if fileName := metadataString(metadata, documentdomain.ParsedMetaFileName); fileName != "" {
		_, _ = fmt.Fprintf(&builder, "文件名: %s\n", fileName)
	}
	_, _ = fmt.Fprintf(&builder, "来源格式: %s\n", metadataString(metadata, documentdomain.ParsedMetaSourceFormat))
	_, _ = fmt.Fprintf(&builder, "工作表: %s\n", metadataString(metadata, documentdomain.ParsedMetaSheetName))
	_, _ = fmt.Fprintf(&builder, "表格: %s\n", metadataString(metadata, documentdomain.ParsedMetaTableTitle))
	if rowIndex := metadataInt(metadata, documentdomain.ParsedMetaRowIndex); rowIndex > 0 {
		_, _ = fmt.Fprintf(&builder, "行号: %d\n", rowIndex)
	}
	if primaryKeys := metadataStringList(metadata, documentdomain.ParsedMetaPrimaryKeys); len(primaryKeys) > 0 {
		_, _ = fmt.Fprintf(&builder, "主键: %s\n", strings.Join(primaryKeys, "; "))
	}
	builder.WriteString("字段:\n")
	return builder.String()
}

func buildExcelLikeTabularRowPrefix(metadata map[string]any) string {
	var builder strings.Builder
	if fileName := metadataString(metadata, documentdomain.ParsedMetaFileName); fileName != "" {
		_, _ = fmt.Fprintf(&builder, "文件名: %s\n", fileName)
	}
	if sheetName := metadataString(metadata, documentdomain.ParsedMetaSheetName); sheetName != "" {
		_, _ = fmt.Fprintf(&builder, "工作表: %s\n", sheetName)
	}
	if tableTitle := metadataString(metadata, documentdomain.ParsedMetaTableTitle); tableTitle != "" {
		_, _ = fmt.Fprintf(&builder, "表格: %s\n", tableTitle)
	}
	if rowIndex := metadataInt(metadata, documentdomain.ParsedMetaRowIndex); rowIndex > 0 {
		_, _ = fmt.Fprintf(&builder, "行号: %d\n", rowIndex)
	}
	return builder.String()
}

func buildTabularSummaryContent(metadata map[string]any) string {
	var builder strings.Builder
	if fileName := metadataString(metadata, documentdomain.ParsedMetaFileName); fileName != "" {
		_, _ = fmt.Fprintf(&builder, "文件名: %s\n", fileName)
	}
	if sourceFormat := metadataString(metadata, documentdomain.ParsedMetaSourceFormat); sourceFormat != "" {
		_, _ = fmt.Fprintf(&builder, "来源格式: %s\n", sourceFormat)
	}
	if sheetName := metadataString(metadata, documentdomain.ParsedMetaSheetName); sheetName != "" {
		_, _ = fmt.Fprintf(&builder, "工作表: %s\n", sheetName)
	}
	if tableTitle := metadataString(metadata, documentdomain.ParsedMetaTableTitle); tableTitle != "" {
		_, _ = fmt.Fprintf(&builder, "表格: %s\n", tableTitle)
	}
	builder.WriteString("类型: 表摘要\n")
	if rowCount := metadataInt(metadata, documentdomain.ParsedMetaTableRowCount); rowCount > 0 {
		_, _ = fmt.Fprintf(&builder, "总行数: %d\n", rowCount)
	}
	if primaryKeyHeaders := metadataStringList(metadata, documentdomain.ParsedMetaPrimaryKeyHeaders); len(primaryKeyHeaders) > 0 {
		_, _ = fmt.Fprintf(&builder, "主键列: %s\n", strings.Join(primaryKeyHeaders, ", "))
	}
	if headerPaths := metadataStringList(metadata, documentdomain.ParsedMetaHeaderPaths); len(headerPaths) > 0 {
		_, _ = fmt.Fprintf(&builder, "字段列表: %s\n", strings.Join(headerPaths, ", "))
	}
	return strings.TrimSpace(builder.String())
}

func buildTabularSectionPath(metadata map[string]any) string {
	sheetName := metadataString(metadata, documentdomain.ParsedMetaSheetName)
	tableTitle := metadataString(metadata, documentdomain.ParsedMetaTableTitle)
	switch {
	case sheetName != "" && tableTitle != "":
		return sheetName + " > " + tableTitle
	case tableTitle != "":
		return tableTitle
	default:
		return sheetName
	}
}

func formatTabularFieldLine(field tabularFieldEntry) string {
	return "- " + field.Header + ": " + field.Value
}

func buildTabularRowBody(fields []tabularFieldEntry) string {
	if len(fields) == 0 {
		return ""
	}
	var builder strings.Builder
	for _, field := range fields {
		header := strings.TrimSpace(field.Header)
		value := strings.TrimSpace(field.Value)
		if header == "" || value == "" {
			continue
		}
		if builder.Len() > 0 {
			builder.WriteString("\n")
		}
		if strings.Contains(value, "\n") {
			builder.WriteString(renderExcelLikeMultilineField(header, value))
			continue
		}
		builder.WriteString(header)
		builder.WriteString("：")
		builder.WriteString(value)
	}
	return builder.String()
}

func renderExcelLikeMultilineField(header, value string) string {
	lines := splitStructuredValueLines(value)
	if len(lines) == 0 {
		return header + "：\n" + value
	}
	var builder strings.Builder
	builder.WriteString(header)
	builder.WriteString("：\n")
	for index, line := range lines {
		if index > 0 {
			builder.WriteString("\n")
		}
		builder.WriteString("  - ")
		builder.WriteString(line)
	}
	return builder.String()
}

func splitStructuredValueLines(value string) []string {
	parts := strings.Split(strings.ReplaceAll(value, "\r\n", "\n"), "\n")
	lines := make([]string, 0, len(parts))
	for _, part := range parts {
		if trimmed := strings.TrimSpace(part); trimmed != "" {
			lines = append(lines, trimmed)
		}
	}
	return lines
}

func buildTabularFieldMetadata(fields []tabularFieldEntry) []map[string]any {
	output := make([]map[string]any, 0, len(fields))
	for _, field := range fields {
		item := map[string]any{
			"header":      field.Header,
			"header_path": field.Header,
			"value":       field.Value,
		}
		if field.CellRef != "" {
			item["cell_ref"] = field.CellRef
		}
		output = append(output, item)
	}
	return output
}

func collectTabularFieldHeaders(fields []tabularFieldEntry) []string {
	headers := make([]string, 0, len(fields))
	for _, field := range fields {
		headers = append(headers, field.Header)
	}
	return headers
}

func collectTabularFieldCellRefs(fields []tabularFieldEntry) map[string]string {
	cellRefs := make(map[string]string, len(fields))
	for _, field := range fields {
		if field.CellRef == "" {
			continue
		}
		cellRefs[field.Header] = field.CellRef
	}
	return cellRefs
}

func extractTabularFieldEntries(raw any) []tabularFieldEntry {
	items, ok := raw.([]map[string]any)
	if ok {
		return tabularFieldEntriesFromMaps(items)
	}
	genericItems, ok := raw.([]any)
	if !ok {
		return nil
	}
	output := make([]tabularFieldEntry, 0, len(genericItems))
	for _, item := range genericItems {
		fieldMap, mapOK := item.(map[string]any)
		if !mapOK {
			continue
		}
		entry := tabularFieldEntry{
			Header:  strings.TrimSpace(firstNonEmptyString(metadataString(fieldMap, "header_path"), metadataString(fieldMap, "header"))),
			Value:   strings.TrimSpace(metadataString(fieldMap, "value")),
			CellRef: strings.TrimSpace(metadataString(fieldMap, "cell_ref")),
		}
		if entry.Header == "" || entry.Value == "" {
			continue
		}
		output = append(output, entry)
	}
	return output
}

func tabularFieldEntriesFromMaps(items []map[string]any) []tabularFieldEntry {
	output := make([]tabularFieldEntry, 0, len(items))
	for _, item := range items {
		entry := tabularFieldEntry{
			Header:  strings.TrimSpace(firstNonEmptyString(metadataString(item, "header_path"), metadataString(item, "header"))),
			Value:   strings.TrimSpace(metadataString(item, "value")),
			CellRef: strings.TrimSpace(metadataString(item, "cell_ref")),
		}
		if entry.Header == "" || entry.Value == "" {
			continue
		}
		output = append(output, entry)
	}
	return output
}

func countTextTokens(text, model string, tokenizerService *tokenizer.Service) int {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return 0
	}
	if tokenizerService == nil {
		return len([]rune(trimmed))
	}
	encoder, err := tokenizerService.EncoderForModel(model)
	if err != nil || encoder == nil {
		return len([]rune(trimmed))
	}
	return encoder.CountTokens(trimmed)
}

func cloneChunkMetadata(metadata map[string]any) map[string]any {
	if len(metadata) == 0 {
		return map[string]any{}
	}
	return maps.Clone(metadata)
}

func metadataString(metadata map[string]any, key string) string {
	if len(metadata) == 0 {
		return ""
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return ""
	}
	switch typed := value.(type) {
	case string:
		return strings.TrimSpace(typed)
	default:
		return strings.TrimSpace(fmt.Sprint(typed))
	}
}

func metadataInt(metadata map[string]any, key string) int {
	if len(metadata) == 0 {
		return 0
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return 0
	}
	switch typed := value.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case float64:
		return int(typed)
	case string:
		parsed, _ := strconv.Atoi(strings.TrimSpace(typed))
		return parsed
	default:
		return 0
	}
}

func metadataStringList(metadata map[string]any, key string) []string {
	if len(metadata) == 0 {
		return nil
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return nil
	}
	switch typed := value.(type) {
	case []string:
		return append([]string(nil), typed...)
	case []any:
		output := make([]string, 0, len(typed))
		for _, item := range typed {
			if trimmed := strings.TrimSpace(fmt.Sprint(item)); trimmed != "" {
				output = append(output, trimmed)
			}
		}
		return output
	default:
		return nil
	}
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func isExcelLikeTabularSource(sourceFormat string) bool {
	switch strings.ToLower(strings.TrimSpace(sourceFormat)) {
	case "xlsx", "xlsm", "xls":
		return true
	default:
		return false
	}
}
