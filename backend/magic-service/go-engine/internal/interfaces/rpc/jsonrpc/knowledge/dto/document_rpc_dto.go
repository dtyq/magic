package dto

import (
	"encoding/json"
	"fmt"

	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

// CreateDocumentRequest 创建文档请求
type CreateDocumentRequest struct {
	OrganizationCode  string                          `json:"organization_code" validate:"required"`
	UserID            string                          `json:"user_id" validate:"required"`
	KnowledgeBaseCode string                          `json:"knowledge_base_code" validate:"required"`
	Name              string                          `json:"name" validate:"required"`
	Description       string                          `json:"description"`
	DocType           int                             `json:"doc_type"`
	DocMetadata       map[string]any                  `json:"doc_metadata"`
	StrategyConfig    *confighelper.StrategyConfigDTO `json:"strategy_config"`
	DocumentFile      *docfilehelper.DocumentFileDTO  `json:"document_file"`
	ThirdPlatformType string                          `json:"third_platform_type"`
	ThirdFileID       string                          `json:"third_file_id"`
	EmbeddingModel    string                          `json:"embedding_model"`
	VectorDB          string                          `json:"vector_db"`
	RetrieveConfig    *confighelper.RetrieveConfigDTO `json:"retrieve_config"`
	FragmentConfig    *confighelper.FragmentConfigDTO `json:"fragment_config"`
	EmbeddingConfig   *confighelper.EmbeddingConfig   `json:"embedding_config"`
	VectorDBConfig    *confighelper.VectorDBConfig    `json:"vector_db_config"`
}

// UpdateDocumentRequest 更新文档请求
type UpdateDocumentRequest struct {
	OrganizationCode  string                          `json:"organization_code" validate:"required"`
	UserID            string                          `json:"user_id" validate:"required"`
	Code              string                          `json:"code" validate:"required"`
	KnowledgeBaseCode string                          `json:"knowledge_base_code" validate:"required"`
	Name              string                          `json:"name"`
	Description       string                          `json:"description"`
	Enabled           *bool                           `json:"enabled"`
	DocType           *int                            `json:"doc_type"`
	DocMetadata       map[string]any                  `json:"doc_metadata"`
	StrategyConfig    *confighelper.StrategyConfigDTO `json:"strategy_config"`
	DocumentFile      *docfilehelper.DocumentFileDTO  `json:"document_file"`
	RetrieveConfig    *confighelper.RetrieveConfigDTO `json:"retrieve_config"`
	FragmentConfig    *confighelper.FragmentConfigDTO `json:"fragment_config"`
	WordCount         *int                            `json:"word_count"`
}

// ShowDocumentRequest 查询文档详情请求
type ShowDocumentRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	Code              string        `json:"code" validate:"required"`
	KnowledgeBaseCode string        `json:"knowledge_base_code" validate:"required"`
}

// GetOriginalFileLinkRequest 获取文档原始文件访问链接请求。
type GetOriginalFileLinkRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	Code              string        `json:"code" validate:"required"`
	KnowledgeBaseCode string        `json:"knowledge_base_code" validate:"required"`
}

// ListDocumentRequest 查询文档列表请求
type ListDocumentRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	OrganizationCode  string        `json:"organization_code" validate:"required"`
	KnowledgeBaseCode string        `json:"knowledge_base_code" validate:"required"`
	Name              string        `json:"name"`
	DocType           *int          `json:"doc_type"`
	Enabled           *bool         `json:"enabled"`
	SyncStatus        *int          `json:"sync_status"`
	Page              struct {
		Offset int `json:"offset" validate:"min=0"`
		Limit  int `json:"limit" validate:"min=1"`
	} `json:"page"`
}

// UnmarshalJSON 兼容 page/page_size 与 offset/limit 顶层分页入参及字符串标量。
func (r *ListDocumentRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "list document request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	organizationCode, err := decodeRequestStringValue(raw, "organization_code")
	if err != nil {
		return err
	}
	knowledgeBaseCode, err := decodeRequestStringValue(raw, "knowledge_base_code")
	if err != nil {
		return err
	}
	name, err := decodeRequestStringValue(raw, "name")
	if err != nil {
		return err
	}
	docType, _, err := decodeRequestInt(raw, "doc_type")
	if err != nil {
		return err
	}
	enabled, _, err := decodeRequestBoolPHPTruth(raw, "enabled")
	if err != nil {
		return err
	}
	syncStatus, _, err := decodeRequestInt(raw, "sync_status")
	if err != nil {
		return err
	}

	offset := 0
	limit := 0
	if pageField, ok := raw["page"]; ok && isJSONObjectPayload(pageField) && !pkgjsoncompat.IsEmptyObjectLikeJSON(pageField) {
		var page PageParams
		if err := json.Unmarshal(pageField, &page); err != nil {
			return fmt.Errorf("unmarshal page: %w", err)
		}
		offset = page.Offset
		limit = page.Limit
	} else {
		offset, limit, err = decodeRequestPageWindow(raw, 100)
		if err != nil {
			return err
		}
	}

	r.DataIsolation = dataIsolation
	r.OrganizationCode = organizationCode
	r.KnowledgeBaseCode = knowledgeBaseCode
	r.Name = name
	r.DocType = docType
	r.Enabled = enabled
	r.SyncStatus = syncStatus
	r.Page.Offset = offset
	r.Page.Limit = limit
	return nil
}

// GetDocumentsByThirdFileIdRequest 按第三方文件查询文档请求。
type GetDocumentsByThirdFileIdRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	KnowledgeBaseCode string        `json:"knowledge_base_code" validate:"required"`
	ThirdPlatformType string        `json:"third_platform_type" validate:"required"`
	ThirdFileID       string        `json:"third_file_id" validate:"required"`
}

// DestroyDocumentRequest 删除文档请求
type DestroyDocumentRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	Code              string        `json:"code" validate:"required"`
	KnowledgeBaseCode string        `json:"knowledge_base_code" validate:"required"`
}

// SyncDocumentRequest 同步文档请求
type SyncDocumentRequest struct {
	DataIsolation     DataIsolation  `json:"data_isolation"`
	KnowledgeBaseCode string         `json:"knowledge_base_code" validate:"required"`
	Code              string         `json:"code" validate:"required"`
	Mode              string         `json:"mode"`
	Async             bool           `json:"async"`
	RevectorizeSource string         `json:"revectorize_source"`
	BusinessParams    BusinessParams `json:"business_params"`
}

// UnmarshalJSON 兼容 async 传字符串，语义保持 PHP 布尔解析。
func (r *SyncDocumentRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "sync document request")
	if err != nil {
		return err
	}

	var dataIsolation DataIsolation
	if field, ok := raw["data_isolation"]; ok {
		if err := json.Unmarshal(field, &dataIsolation); err != nil {
			return fmt.Errorf("unmarshal data_isolation: %w", err)
		}
	}
	knowledgeBaseCode, err := decodeRequestStringValue(raw, "knowledge_base_code")
	if err != nil {
		return err
	}
	code, err := decodeRequestStringValue(raw, "code")
	if err != nil {
		return err
	}
	mode, err := decodeRequestStringValue(raw, "mode")
	if err != nil {
		return err
	}
	revectorizeSource, err := decodeRequestStringValue(raw, "revectorize_source")
	if err != nil {
		return err
	}
	async, _, err := decodeRequestBoolPHPTruth(raw, "async")
	if err != nil {
		return err
	}
	var businessParams BusinessParams
	if field, ok := raw["business_params"]; ok && !pkgjsoncompat.IsEmptyObjectLikeJSON(field) {
		if err := json.Unmarshal(field, &businessParams); err != nil {
			return fmt.Errorf("unmarshal business_params: %w", err)
		}
	}

	*r = SyncDocumentRequest{
		DataIsolation:     dataIsolation,
		KnowledgeBaseCode: knowledgeBaseCode,
		Code:              code,
		Mode:              mode,
		Async:             dereferenceBool(async),
		RevectorizeSource: revectorizeSource,
		BusinessParams:    businessParams,
	}
	return nil
}

// ReVectorizedByThirdFileIdRequest 按第三方文件触发重向量化请求
type ReVectorizedByThirdFileIdRequest struct {
	DataIsolation     DataIsolation `json:"data_isolation"`
	ThirdPlatformType string        `json:"third_platform_type" validate:"required"`
	ThirdFileID       string        `json:"third_file_id" validate:"required"`
	ThirdKnowledgeID  string        `json:"third_knowledge_id"`
}

// NotifyProjectFileChangeRequest 按项目文件触发重同步请求。
type NotifyProjectFileChangeRequest struct {
	ProjectFileID    int64  `json:"project_file_id" validate:"gt=0"`
	OrganizationCode string `json:"organization_code,omitempty"`
	ProjectID        int64  `json:"project_id,omitempty"`
	Status           string `json:"status,omitempty"`
}

// UnmarshalJSON 兼容 project_file_id 传字符串。
func (r *NotifyProjectFileChangeRequest) UnmarshalJSON(data []byte) error {
	raw, err := unmarshalRequestObject(data, "notify project file change request")
	if err != nil {
		return err
	}

	projectFileID, err := decodeRequestIDInt64Value(raw, "project_file_id")
	if err != nil {
		return err
	}
	organizationCode, err := decodeRequestStringValue(raw, "organization_code")
	if err != nil {
		return err
	}
	projectID, err := decodeRequestIDInt64Value(raw, "project_id")
	if err != nil {
		return err
	}
	status, err := decodeRequestStringValue(raw, "status")
	if err != nil {
		return err
	}

	*r = NotifyProjectFileChangeRequest{
		ProjectFileID:    projectFileID,
		OrganizationCode: organizationCode,
		ProjectID:        projectID,
		Status:           status,
	}
	return nil
}

// CountByKnowledgeBaseCodesRequest 按知识库批量统计文档数量请求
type CountByKnowledgeBaseCodesRequest struct {
	DataIsolation      DataIsolation `json:"data_isolation"`
	KnowledgeBaseCodes []string      `json:"knowledge_base_codes"`
}

// OriginalFileLinkResponse 获取文档原始文件访问链接响应。
type OriginalFileLinkResponse struct {
	Available bool   `json:"available"`
	URL       string `json:"url"`
	Name      string `json:"name"`
	Key       string `json:"key"`
	Type      string `json:"type"`
}
