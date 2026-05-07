package entity

// DocType 表示 knowledge_base_documents.doc_type 的持久化精确文档类型。
//
// 注意：这里的 DocType 是解析、同步、过滤和向量化链路使用的文件/文档精确类型，
// 例如 Markdown、PDF、云文档，不是主 HTTP API 响应顶层 doc_type 的知识库来源类型。
type DocType int

const (
	// DocTypeUnknown 表示未知或尚未解析出的精确文档类型。
	DocTypeUnknown DocType = 0
	// DocTypeText 文本。
	DocTypeText DocType = 1
	// DocTypeMarkdown Markdown。
	DocTypeMarkdown DocType = 2
	// DocTypePDF PDF。
	DocTypePDF DocType = 3
	// DocTypeHTML HTML。
	DocTypeHTML DocType = 4
	// DocTypeXLSX XLSX。
	DocTypeXLSX DocType = 5
	// DocTypeXLS XLS。
	DocTypeXLS DocType = 6
	// DocTypeDOC DOC。
	DocTypeDOC DocType = 7
	// DocTypeDOCX DOCX。
	DocTypeDOCX DocType = 8
	// DocTypeCSV CSV。
	DocTypeCSV DocType = 9
	// DocTypeXML XML。
	DocTypeXML DocType = 10
	// DocTypeHTM HTM。
	DocTypeHTM DocType = 11
	// DocTypePPT PPT。
	DocTypePPT DocType = 12
	// DocTypeJSON JSON。
	DocTypeJSON DocType = 13
	// DocTypeCloudDocument 云文档。
	DocTypeCloudDocument DocType = 1001
	// DocTypeMultiTable 多表文档。
	DocTypeMultiTable DocType = 1002
)

// DefaultDocumentListDocTypeValues 返回默认放行全集对应的 uint32 值。
func DefaultDocumentListDocTypeValues() []uint32 {
	return []uint32{
		uint32(DocTypeUnknown),
		uint32(DocTypeText),
		uint32(DocTypeMarkdown),
		uint32(DocTypePDF),
		uint32(DocTypeHTML),
		uint32(DocTypeXLSX),
		uint32(DocTypeXLS),
		uint32(DocTypeDOC),
		uint32(DocTypeDOCX),
		uint32(DocTypeCSV),
		uint32(DocTypeXML),
		uint32(DocTypeHTM),
		uint32(DocTypePPT),
		uint32(DocTypeJSON),
		uint32(DocTypeCloudDocument),
		uint32(DocTypeMultiTable),
	}
}
