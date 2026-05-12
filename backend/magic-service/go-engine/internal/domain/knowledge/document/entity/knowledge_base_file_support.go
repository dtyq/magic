package entity

import (
	"slices"

	"magic/internal/pkg/filetype"
)

// SupportedKnowledgeBaseFileExtensions 返回知识库白名单扩展名。
func SupportedKnowledgeBaseFileExtensions() []string {
	return []string{
		"txt",
		"md",
		"html",
		"htm",
		"xml",
		"json",
		"csv",
		"xlsx",
		"xlsm",
		"docx",
		"pptx",
		"pdf",
		"jpg",
		"jpeg",
		"png",
		"bmp",
	}
}

// IsSupportedKnowledgeBaseFileExtension 判断知识库是否支持该扩展名。
func IsSupportedKnowledgeBaseFileExtension(extension string) bool {
	return slices.Contains(SupportedKnowledgeBaseFileExtensions(), filetype.NormalizeExtension(extension))
}
