package document

import parseddocument "magic/internal/domain/knowledge/shared/parseddocument"

const (
	// ParsedDocumentSourceText 表示普通文本解析结果。
	ParsedDocumentSourceText = parseddocument.SourceText
	// ParsedDocumentSourceTabular 表示结构化表格解析结果。
	ParsedDocumentSourceTabular = parseddocument.SourceTabular
	// ParsedBlockTypeTableRow 表示表格行块。
	ParsedBlockTypeTableRow = parseddocument.BlockTypeTableRow
	// ParsedBlockTypeTableSummary 表示表摘要块。
	ParsedBlockTypeTableSummary = parseddocument.BlockTypeTableSummary
	// ParsedMetaSourceFormat 表示来源文件格式 metadata 键。
	ParsedMetaSourceFormat = parseddocument.MetaSourceFormat
	// ParsedMetaFileName 表示源文件名 metadata 键。
	ParsedMetaFileName = parseddocument.MetaFileName
	// ParsedMetaChunkType 表示块类型 metadata 键。
	ParsedMetaChunkType = parseddocument.MetaChunkType
	// ParsedMetaSheetName 表示工作表名称 metadata 键。
	ParsedMetaSheetName = parseddocument.MetaSheetName
	// ParsedMetaSheetHidden 表示工作表是否隐藏 metadata 键。
	ParsedMetaSheetHidden = parseddocument.MetaSheetHidden
	// ParsedMetaTableID 表示表 ID metadata 键。
	ParsedMetaTableID = parseddocument.MetaTableID
	// ParsedMetaTableTitle 表示表标题 metadata 键。
	ParsedMetaTableTitle = parseddocument.MetaTableTitle
	// ParsedMetaRowIndex 表示行号 metadata 键。
	ParsedMetaRowIndex = parseddocument.MetaRowIndex
	// ParsedMetaRowSubchunkIndex 表示行子块序号 metadata 键。
	ParsedMetaRowSubchunkIndex = parseddocument.MetaRowSubchunkIndex
	// ParsedMetaPrimaryKeys 表示主键集合 metadata 键。
	ParsedMetaPrimaryKeys = parseddocument.MetaPrimaryKeys
	// ParsedMetaPrimaryKeyHeaders 表示主键列集合 metadata 键。
	ParsedMetaPrimaryKeyHeaders = parseddocument.MetaPrimaryKeyHeaders
	// ParsedMetaHeaderPaths 表示字段路径集合 metadata 键。
	ParsedMetaHeaderPaths = parseddocument.MetaHeaderPaths
	// ParsedMetaCellRefs 表示单元格坐标 metadata 键。
	ParsedMetaCellRefs = parseddocument.MetaCellRefs
	// ParsedMetaHasFormula 表示是否包含公式 metadata 键。
	ParsedMetaHasFormula = parseddocument.MetaHasFormula
	// ParsedMetaTableRowCount 表示表总行数 metadata 键。
	ParsedMetaTableRowCount = parseddocument.MetaTableRowCount
	// ParsedMetaFields 表示字段列表 metadata 键。
	ParsedMetaFields = parseddocument.MetaFields
	// ParsedMetaEmbeddedImageCount 表示文档内嵌图片总数 metadata 键。
	ParsedMetaEmbeddedImageCount = parseddocument.MetaEmbeddedImageCount
	// ParsedMetaEmbeddedImageOCRSuccessCount 表示文档内嵌图片 OCR 成功数 metadata 键。
	ParsedMetaEmbeddedImageOCRSuccessCount = parseddocument.MetaEmbeddedImageOCRSuccessCount
	// ParsedMetaEmbeddedImageOCRFailedCount 表示文档内嵌图片 OCR 失败数 metadata 键。
	ParsedMetaEmbeddedImageOCRFailedCount = parseddocument.MetaEmbeddedImageOCRFailedCount
	// ParsedMetaEmbeddedImageOCRSkippedCount 表示文档内嵌图片 OCR 跳过数 metadata 键。
	ParsedMetaEmbeddedImageOCRSkippedCount = parseddocument.MetaEmbeddedImageOCRSkippedCount
	// ParsedMetaEmbeddedImageOCRLimitedCount 表示文档内嵌图片 OCR 因预算限制被跳过的数量 metadata 键。
	ParsedMetaEmbeddedImageOCRLimitedCount = parseddocument.MetaEmbeddedImageOCRLimitedCount
	// ParsedMetaEmbeddedImageOCRLimit 表示单文件图片 OCR 预算上限 metadata 键。
	ParsedMetaEmbeddedImageOCRLimit = parseddocument.MetaEmbeddedImageOCRLimit
)

// ParsedDocument 表示解析后的统一文档结果。
type ParsedDocument = parseddocument.ParsedDocument

// ParsedBlock 表示解析结果中的结构化块。
type ParsedBlock = parseddocument.ParsedBlock

// NewPlainTextParsedDocument 创建普通文本解析结果。
func NewPlainTextParsedDocument(fileType, content string) *ParsedDocument {
	return parseddocument.NewPlainTextParsedDocument(fileType, content)
}
