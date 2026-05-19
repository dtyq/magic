package document

import (
	"errors"
	"fmt"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/pkg/filetype"
	"magic/internal/pkg/projectfile"
)

// ErrUnsupportedKnowledgeBaseFileType 表示知识库当前不支持该文件类型。
var ErrUnsupportedKnowledgeBaseFileType = errors.New("unsupported knowledge base file type")

// ShouldMaterializeProjectResolvedFile 判断项目文件解析结果是否应继续物化为知识库文档。
func ShouldMaterializeProjectResolvedFile(resolved *projectfile.ResolveResult) bool {
	if resolved == nil {
		return false
	}
	if resolved.IsDirectory {
		return false
	}
	if projectfile.IsDeletedResolveStatus(resolved.Status) {
		return false
	}
	if projectfile.IsUnsupportedResolveStatus(resolved.Status) {
		return false
	}
	return true
}

// SupportedKnowledgeBaseFileExtensions 返回知识库白名单扩展名。
func SupportedKnowledgeBaseFileExtensions() []string {
	return docentity.SupportedKnowledgeBaseFileExtensions()
}

// ResolveKnowledgeBaseDocumentFileExtension 解析知识库文档文件的标准扩展名。
func ResolveKnowledgeBaseDocumentFileExtension(file *docentity.File, fallback string) string {
	return filetype.NormalizeExtension(ResolveDocumentFileExtension(file, fallback))
}

// ResolveKnowledgeBaseProjectFileExtension 解析项目文件的标准扩展名。
func ResolveKnowledgeBaseProjectFileExtension(name, extension string) string {
	return filetype.NormalizeExtension(projectfile.NormalizeExtension(name, extension))
}

// IsSupportedKnowledgeBaseFileExtension 判断知识库是否支持该扩展名。
func IsSupportedKnowledgeBaseFileExtension(extension string) bool {
	return docentity.IsSupportedKnowledgeBaseFileExtension(extension)
}

// IsSupportedKnowledgeBaseDocumentFile 判断知识库是否支持当前 document_file。
func IsSupportedKnowledgeBaseDocumentFile(file *docentity.File) bool {
	if file == nil {
		return false
	}
	return IsSupportedKnowledgeBaseFileExtension(ResolveKnowledgeBaseDocumentFileExtension(file, ""))
}

// ValidateKnowledgeBaseDocumentFileSupport 校验当前 document_file 是否可被知识库链路处理。
func ValidateKnowledgeBaseDocumentFileSupport(file *docentity.File) error {
	if IsSupportedKnowledgeBaseDocumentFile(file) {
		return nil
	}
	return fmt.Errorf(
		"%w: extension=%s",
		ErrUnsupportedKnowledgeBaseFileType,
		ResolveKnowledgeBaseDocumentFileExtension(file, ""),
	)
}

// NormalizeKnowledgeBaseProjectFileMeta 规整项目文件元数据的扩展名与支持状态。
func NormalizeKnowledgeBaseProjectFileMeta(meta *projectfile.Meta) *projectfile.Meta {
	if meta == nil {
		return nil
	}
	cloned := *meta
	cloned.FileExtension = ResolveKnowledgeBaseProjectFileExtension(cloned.FileName, cloned.FileExtension)
	if cloned.IsDirectory || projectfile.IsDeletedResolveStatus(cloned.Status) {
		return &cloned
	}
	if cloned.FileExtension != "" && !IsSupportedKnowledgeBaseFileExtension(cloned.FileExtension) {
		cloned.Status = projectfile.ResolveStatusUnsupported
	}
	return &cloned
}
