// Package docfile 提供文档文件 DTO 与兼容解析能力。
package docfile

import (
	"encoding/json"
	"fmt"
	"strings"

	texthelper "magic/internal/application/knowledge/helper/text"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/filetype"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

// DocumentFileDTO 文档文件 DTO。
//
// 这是跨接口传输用的宽松载体，不承诺上游已经完成类型归一化。
// 例如 fragments/preview 会接收前端原样透传的 project_file，
// Go 侧再根据 URL / key / source_type 决定后续解析链路；
// 上游（尤其 PHP facade / DTO）应尽量只透传，不要提前解释业务语义。
type DocumentFileDTO struct {
	Type             string               `json:"type"`
	Name             string               `json:"name"`
	URL              string               `json:"url"`
	Size             int64                `json:"size"`
	Extension        string               `json:"extension"`
	ThirdID          string               `json:"third_id"`
	SourceType       string               `json:"source_type"`
	ThirdFileType    string               `json:"third_file_type,omitempty"`
	ProjectFileID    int64                `json:"project_file_id,omitempty"`
	RelativeFilePath string               `json:"relative_file_path,omitempty"`
	KnowledgeBaseID  string               `json:"knowledge_base_id,omitempty"`
	Key              string               `json:"key,omitempty"`
	FileLink         *DocumentFileLinkDTO `json:"file_link,omitempty"`
}

// DocumentFileLinkDTO 文档文件链接 DTO。
type DocumentFileLinkDTO struct {
	URL string `json:"url"`
}

// UnmarshalJSON 兼容 PHP 历史字段：type 数字、key/file_link.url 回填、第三方别名字段。
func (d *DocumentFileDTO) UnmarshalJSON(data []byte) error {
	rawFields := map[string]json.RawMessage{}
	if err := json.Unmarshal(data, &rawFields); err != nil {
		return fmt.Errorf("unmarshal document file raw fields: %w", err)
	}

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
	size, err := decodeInt64Field(rawFields, "size")
	if err != nil {
		return err
	}
	d.Size = size
	d.Extension = filetype.NormalizeExtension(texthelper.FirstNonEmptyString(
		texthelper.StringValue(raw["extension"]),
		texthelper.StringValue(raw["third_file_extension_name"]),
	))
	thirdID, err := decodeIDStringField(rawFields, "third_id")
	if err != nil {
		return err
	}
	thirdFileID, err := decodeIDStringField(rawFields, "third_file_id")
	if err != nil {
		return err
	}
	d.ThirdID = texthelper.FirstNonEmptyString(strings.TrimSpace(thirdID), strings.TrimSpace(thirdFileID))
	d.SourceType = texthelper.FirstNonEmptyString(
		strings.TrimSpace(texthelper.StringValue(raw["source_type"])),
		strings.TrimSpace(texthelper.StringValue(raw["platform_type"])),
	)
	d.ThirdFileType = texthelper.FirstNonEmptyString(
		strings.TrimSpace(texthelper.StringValue(raw["third_file_type"])),
		strings.TrimSpace(texthelper.StringValue(raw["teamshare_file_type"])),
		strings.TrimSpace(texthelper.StringValue(raw["file_type"])),
	)
	projectFileID, err := decodeInt64Field(rawFields, "project_file_id")
	if err != nil {
		return err
	}
	d.ProjectFileID = projectFileID
	d.RelativeFilePath = strings.TrimSpace(texthelper.StringValue(raw["relative_file_path"]))
	knowledgeBaseID, err := decodeIDStringField(rawFields, "knowledge_base_id")
	if err != nil {
		return err
	}
	d.KnowledgeBaseID = strings.TrimSpace(knowledgeBaseID)
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
func ToDomainFile(documentFile *DocumentFileDTO) *docentity.File {
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
	return &docentity.File{
		Type:            NormalizeDocumentFileType(documentFile.Type),
		Name:            documentFile.Name,
		URL:             fileURL,
		FileKey:         strings.TrimSpace(documentFile.Key),
		Size:            documentFile.Size,
		Extension:       documentFile.Extension,
		ThirdID:         documentFile.ThirdID,
		SourceType:      documentFile.SourceType,
		ThirdFileType:   documentFile.ThirdFileType,
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

func decodeInt64Field(raw map[string]json.RawMessage, key string) (int64, error) {
	field, ok := raw[key]
	if !ok {
		return 0, nil
	}
	value, _, err := pkgjsoncompat.DecodeOptionalInt64(field, "document_file."+key)
	if err != nil {
		return 0, fmt.Errorf("decode document_file.%s: %w", key, err)
	}
	if value == nil {
		return 0, nil
	}
	return *value, nil
}

func decodeIDStringField(raw map[string]json.RawMessage, key string) (string, error) {
	field, ok := raw[key]
	if !ok {
		return "", nil
	}
	value, _, err := pkgjsoncompat.DecodeOptionalIDString(field, "document_file."+key)
	if err != nil {
		return "", fmt.Errorf("decode document_file.%s: %w", key, err)
	}
	return value, nil
}

const (
	docFileTypeExternal   = "external"
	docFileTypeThirdParty = "third_platform"
)

// NormalizeDocumentFileType 统一文档文件类型。
func NormalizeDocumentFileType(v any) string {
	return documentdomain.NormalizeDocumentFileType(v)
}
