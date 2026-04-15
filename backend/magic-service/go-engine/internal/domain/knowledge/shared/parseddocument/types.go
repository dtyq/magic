// Package parseddocument 提供跨子域复用的结构化文档语义定义。
package parseddocument

import "strings"

const (
	// SourceText 表示普通文本解析结果。
	SourceText = "text"
	// SourceTabular 表示结构化表格解析结果。
	SourceTabular = "tabular"
	// BlockTypeTableRow 表示表格行块。
	BlockTypeTableRow = "table_row"
	// BlockTypeTableSummary 表示表摘要块。
	BlockTypeTableSummary = "table_summary"
	// MetaSourceFormat 表示来源文件格式 metadata 键。
	MetaSourceFormat = "source_format"
	// MetaFileName 表示源文件名 metadata 键。
	MetaFileName = "file_name"
	// MetaChunkType 表示块类型 metadata 键。
	MetaChunkType = "chunk_type"
	// MetaSheetName 表示工作表名称 metadata 键。
	MetaSheetName = "sheet_name"
	// MetaSheetHidden 表示工作表是否隐藏 metadata 键。
	MetaSheetHidden = "sheet_hidden"
	// MetaTableID 表示表 ID metadata 键。
	MetaTableID = "table_id"
	// MetaTableTitle 表示表标题 metadata 键。
	MetaTableTitle = "table_title"
	// MetaRowIndex 表示行号 metadata 键。
	MetaRowIndex = "row_index"
	// MetaRowSubchunkIndex 表示行子块序号 metadata 键。
	MetaRowSubchunkIndex = "row_subchunk_index"
	// MetaPrimaryKeys 表示主键集合 metadata 键。
	MetaPrimaryKeys = "primary_keys"
	// MetaPrimaryKeyHeaders 表示主键列集合 metadata 键。
	MetaPrimaryKeyHeaders = "primary_key_headers"
	// MetaHeaderPaths 表示字段路径集合 metadata 键。
	MetaHeaderPaths = "header_paths"
	// MetaCellRefs 表示单元格坐标 metadata 键。
	MetaCellRefs = "cell_refs"
	// MetaHasFormula 表示是否包含公式 metadata 键。
	MetaHasFormula = "has_formula"
	// MetaTableRowCount 表示表总行数 metadata 键。
	MetaTableRowCount = "table_row_count"
	// MetaFields 表示字段列表 metadata 键。
	MetaFields = "fields"
	// MetaEmbeddedImageCount 表示文档内嵌图片总数 metadata 键。
	MetaEmbeddedImageCount = "embedded_image_count"
	// MetaEmbeddedImageOCRSuccessCount 表示文档内嵌图片 OCR 成功数 metadata 键。
	MetaEmbeddedImageOCRSuccessCount = "embedded_image_ocr_success_count"
	// MetaEmbeddedImageOCRFailedCount 表示文档内嵌图片 OCR 失败数 metadata 键。
	MetaEmbeddedImageOCRFailedCount = "embedded_image_ocr_failed_count"
	// MetaEmbeddedImageOCRSkippedCount 表示文档内嵌图片 OCR 跳过数 metadata 键。
	MetaEmbeddedImageOCRSkippedCount = "embedded_image_ocr_skipped_count"
	// MetaEmbeddedImageOCRLimitedCount 表示文档内嵌图片 OCR 因预算限制被跳过的数量 metadata 键。
	MetaEmbeddedImageOCRLimitedCount = "embedded_image_ocr_limited_count"
	// MetaEmbeddedImageOCRLimit 表示文档单文件 OCR 预算上限 metadata 键。
	MetaEmbeddedImageOCRLimit = "embedded_image_ocr_limit"
)

// ParsedDocument 表示解析后的统一文档结果。
type ParsedDocument struct {
	SourceType   string         `json:"source_type"`
	PlainText    string         `json:"plain_text"`
	Blocks       []ParsedBlock  `json:"blocks,omitempty"`
	DocumentMeta map[string]any `json:"document_meta,omitempty"`
}

// ParsedBlock 表示解析结果中的结构化块。
type ParsedBlock struct {
	Type     string         `json:"type"`
	Content  string         `json:"content"`
	Metadata map[string]any `json:"metadata,omitempty"`
}

// NewPlainTextParsedDocument 创建普通文本解析结果。
func NewPlainTextParsedDocument(fileType, content string) *ParsedDocument {
	return &ParsedDocument{
		SourceType: SourceText,
		PlainText:  content,
		DocumentMeta: map[string]any{
			MetaSourceFormat: strings.TrimSpace(fileType),
		},
	}
}

// BestEffortText 返回最适合回退展示/统计的文本。
func (d *ParsedDocument) BestEffortText() string {
	if d == nil {
		return ""
	}
	if trimmed := strings.TrimSpace(d.PlainText); trimmed != "" {
		return trimmed
	}
	if len(d.Blocks) == 0 {
		return ""
	}
	parts := make([]string, 0, len(d.Blocks))
	for _, block := range d.Blocks {
		if trimmed := strings.TrimSpace(block.Content); trimmed != "" {
			parts = append(parts, trimmed)
		}
	}
	return strings.Join(parts, "\n\n")
}
