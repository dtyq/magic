// Package docfile 提供文档文件 DTO 与兼容解析能力。
package docfile

import (
	"encoding/json"
	"fmt"
	"strings"

	texthelper "magic/internal/application/knowledge/helper/text"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/filetype"
)

// DocumentFileDTO 文档文件 DTO。
//
// 这是跨接口传输用的宽松载体，不承诺上游已经完成类型归一化。
// 例如 fragments/preview 会接收前端原样透传的 project_file，
// Go 侧再根据 URL / key / source_type 决定后续解析链路；
// 上游（尤其 PHP facade / DTO）应尽量只透传，不要提前解释业务语义。
type DocumentFileDTO struct {
	Type            string               `json:"type"`
	Name            string               `json:"name"`
	URL             string               `json:"url"`
	Size            int64                `json:"size"`
	Extension       string               `json:"extension"`
	ThirdID         string               `json:"third_id"`
	SourceType      string               `json:"source_type"`
	KnowledgeBaseID string               `json:"knowledge_base_id,omitempty"`
	Key             string               `json:"key,omitempty"`
	FileLink        *DocumentFileLinkDTO `json:"file_link,omitempty"`
}

// DocumentFileLinkDTO 文档文件链接 DTO。
type DocumentFileLinkDTO struct {
	URL string `json:"url"`
}

// UnmarshalJSON 兼容 PHP 历史字段：type 数字、key/file_link.url 回填、第三方别名字段。
func (d *DocumentFileDTO) UnmarshalJSON(data []byte) error {
	raw := map[string]any{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return fmt.Errorf("unmarshal document file: %w", err)
	}

	d.Type = NormalizeDocumentFileType(raw["type"])
	d.Name = texthelper.StringValue(raw["name"])
	d.Key = texthelper.FirstNonEmptyString(
		texthelper.StringValue(raw["key"]),
		texthelper.StringValue(raw["file_key"]),
	)
	d.URL = texthelper.FirstNonEmptyString(
		strings.TrimSpace(texthelper.StringValue(raw["url"])),
		strings.TrimSpace(extractFileLinkURL(raw["file_link"])),
		strings.TrimSpace(d.Key),
	)
	d.Size = toInt64(raw["size"])
	d.Extension = filetype.NormalizeExtension(texthelper.FirstNonEmptyString(
		texthelper.StringValue(raw["extension"]),
		texthelper.StringValue(raw["third_file_extension_name"]),
	))
	d.ThirdID = texthelper.FirstNonEmptyString(
		strings.TrimSpace(texthelper.StringValue(raw["third_id"])),
		strings.TrimSpace(texthelper.StringValue(raw["third_file_id"])),
	)
	d.SourceType = texthelper.FirstNonEmptyString(
		strings.TrimSpace(texthelper.StringValue(raw["source_type"])),
		strings.TrimSpace(texthelper.StringValue(raw["platform_type"])),
	)
	d.KnowledgeBaseID = strings.TrimSpace(texthelper.StringValue(raw["knowledge_base_id"]))
	if d.Type == "" {
		if d.ThirdID != "" || d.SourceType != "" {
			d.Type = docFileTypeThirdParty
		} else {
			d.Type = docFileTypeExternal
		}
	}
	if d.FileLink == nil {
		fileLinkURL := strings.TrimSpace(extractFileLinkURL(raw["file_link"]))
		if fileLinkURL != "" {
			d.FileLink = &DocumentFileLinkDTO{URL: fileLinkURL}
		}
	}
	return nil
}

// CloneDocumentFileDTO 深拷贝文档文件 DTO。
func CloneDocumentFileDTO(documentFile *DocumentFileDTO) *DocumentFileDTO {
	if documentFile == nil {
		return nil
	}

	cloned := *documentFile
	if documentFile.FileLink != nil {
		fileLink := *documentFile.FileLink
		cloned.FileLink = &fileLink
	}
	return &cloned
}

// ToDomainFile 将应用层文档文件 DTO 转成领域文件对象。
func ToDomainFile(documentFile *DocumentFileDTO) *documentdomain.File {
	if documentFile == nil {
		return nil
	}
	fileLinkURL := ""
	if documentFile.FileLink != nil {
		fileLinkURL = strings.TrimSpace(documentFile.FileLink.URL)
	}
	fileURL := texthelper.FirstNonEmptyString(
		strings.TrimSpace(documentFile.URL),
		fileLinkURL,
		strings.TrimSpace(documentFile.Key),
	)
	return &documentdomain.File{
		Type:            NormalizeDocumentFileType(documentFile.Type),
		Name:            documentFile.Name,
		URL:             fileURL,
		FileKey:         strings.TrimSpace(documentFile.Key),
		Size:            documentFile.Size,
		Extension:       documentFile.Extension,
		ThirdID:         documentFile.ThirdID,
		SourceType:      documentFile.SourceType,
		KnowledgeBaseID: documentFile.KnowledgeBaseID,
	}
}

func extractFileLinkURL(v any) string {
	if v == nil {
		return ""
	}
	fileLink, ok := v.(map[string]any)
	if !ok {
		return ""
	}
	return texthelper.StringValue(fileLink["url"])
}

func toInt64(v any) int64 {
	switch value := v.(type) {
	case int64:
		return value
	case int:
		return int64(value)
	case float64:
		return int64(value)
	default:
		return 0
	}
}

const (
	docFileTypeExternal   = "external"
	docFileTypeThirdParty = "third_platform"
)

// NormalizeDocumentFileType 统一文档文件类型。
func NormalizeDocumentFileType(v any) string {
	return documentdomain.NormalizeDocumentFileType(v)
}
