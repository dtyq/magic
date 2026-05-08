package document

import (
	"strconv"
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/pkg/filetype"
)

const (
	docFileTypeExternal = "external"
)

// NormalizeDocumentFileType 统一文档文件类型。
func NormalizeDocumentFileType(v any) string {
	switch value := v.(type) {
	case string:
		normalized := strings.TrimSpace(strings.ToLower(value))
		switch normalized {
		case "1":
			return docFileTypeExternal
		case "2", "third-platform", "thirdplatform":
			return docFileTypeThirdParty
		default:
			return normalized
		}
	case float64:
		switch int64(value) {
		case 1:
			return docFileTypeExternal
		case 2:
			return docFileTypeThirdParty
		default:
			return strconv.FormatInt(int64(value), 10)
		}
	case int:
		return NormalizeDocumentFileType(int64(value))
	case int64:
		switch value {
		case 1:
			return docFileTypeExternal
		case 2:
			return docFileTypeThirdParty
		default:
			return strconv.FormatInt(value, 10)
		}
	default:
		return ""
	}
}

// FileFromPayload 将 document_file payload 转为领域文件。
func FileFromPayload(payload map[string]any) (*docentity.File, bool) {
	if len(payload) == 0 {
		return nil, false
	}
	file := &docentity.File{
		Type:            NormalizeDocumentFileType(payload["type"]),
		Name:            strings.TrimSpace(stringValue(payload["name"])),
		URL:             strings.TrimSpace(stringValue(payload["url"])),
		FileKey:         firstNonEmptyString(strings.TrimSpace(stringValue(payload["file_key"])), strings.TrimSpace(stringValue(payload["key"]))),
		Size:            toInt64(payload["size"]),
		Extension:       filetype.NormalizeExtension(firstNonEmptyString(stringValue(payload["extension"]), stringValue(payload["third_file_extension_name"]))),
		ThirdID:         firstNonEmptyString(strings.TrimSpace(stringValue(payload["third_id"])), strings.TrimSpace(stringValue(payload["third_file_id"]))),
		SourceType:      firstNonEmptyString(strings.TrimSpace(stringValue(payload["source_type"])), strings.TrimSpace(stringValue(payload["platform_type"]))),
		ThirdFileType:   firstNonEmptyString(strings.TrimSpace(stringValue(payload["third_file_type"])), strings.TrimSpace(stringValue(payload["teamshare_file_type"])), strings.TrimSpace(stringValue(payload["file_type"]))),
		KnowledgeBaseID: strings.TrimSpace(stringValue(payload["knowledge_base_id"])),
	}
	if file.Type == "" {
		if file.ThirdID != "" || file.SourceType != "" {
			file.Type = docFileTypeThirdParty
		} else {
			file.Type = docFileTypeExternal
		}
	}
	if file.Extension == "" {
		file.Extension = InferDocumentFileExtensionLight(file)
	}
	return file, true
}

// CloneDocumentFilePayload 深拷贝 document_file payload。
func CloneDocumentFilePayload(payload map[string]any) map[string]any {
	return cloneDocumentFilePayload(payload)
}

// InferDocumentFileExtensionLight 轻量推断文档扩展名。
func InferDocumentFileExtensionLight(file *docentity.File) string {
	if file == nil {
		return ""
	}
	if ext := filetype.NormalizeExtension(file.Extension); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(file.Name); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(file.URL); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(file.FileKey); ext != "" {
		return ext
	}
	return ""
}
