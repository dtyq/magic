package dto

import (
	"encoding/json"
	"fmt"

	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	pkgjsoncompat "magic/internal/pkg/jsoncompat"
)

func decodeStrategyConfigCompat(raw json.RawMessage) (*confighelper.StrategyConfigDTO, error) {
	return decodeOptionalObjectCompat[confighelper.StrategyConfigDTO](raw, "strategy_config")
}

// UnmarshalJSON 兼容 strategy_config / fragment_config 传空数组、空对象、null、空字符串。
func (r *PreviewFragmentRequest) UnmarshalJSON(data []byte) error {
	var decoded struct {
		DataIsolation  DataIsolation                  `json:"data_isolation"`
		DocumentCode   string                         `json:"document_code"`
		DocumentFile   *docfilehelper.DocumentFileDTO `json:"document_file"`
		StrategyConfig json.RawMessage                `json:"strategy_config"`
		FragmentConfig json.RawMessage                `json:"fragment_config"`
		AcceptEncoding string                         `json:"accept_encoding"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return fmt.Errorf("unmarshal preview fragment request: %w", err)
	}

	strategyConfig, err := decodeStrategyConfigCompat(decoded.StrategyConfig)
	if err != nil {
		return err
	}
	fragmentConfig, err := decodeOptionalObjectCompat[confighelper.FragmentConfigDTO](decoded.FragmentConfig, "fragment_config")
	if err != nil {
		return err
	}

	*r = PreviewFragmentRequest{
		DataIsolation:  decoded.DataIsolation,
		DocumentCode:   decoded.DocumentCode,
		DocumentFile:   decoded.DocumentFile,
		StrategyConfig: strategyConfig,
		FragmentConfig: fragmentConfig,
		AcceptEncoding: decoded.AcceptEncoding,
	}
	return nil
}

// UnmarshalJSON 兼容文档相关对象配置的历史脏值传参。
func (r *CreateDocumentRequest) UnmarshalJSON(data []byte) error {
	var decoded struct {
		OrganizationCode  string                         `json:"organization_code"`
		UserID            string                         `json:"user_id"`
		KnowledgeBaseCode string                         `json:"knowledge_base_code"`
		KnowledgeCode     string                         `json:"knowledge_code"`
		Name              string                         `json:"name"`
		Description       string                         `json:"description"`
		DocType           json.RawMessage                `json:"doc_type"`
		Type              json.RawMessage                `json:"type"`
		DocMetadata       map[string]any                 `json:"doc_metadata"`
		Metadata          map[string]any                 `json:"metadata"`
		StrategyConfig    json.RawMessage                `json:"strategy_config"`
		DocumentFile      *docfilehelper.DocumentFileDTO `json:"document_file"`
		ThirdPlatformType string                         `json:"third_platform_type"`
		ThirdFileID       string                         `json:"third_file_id"`
		EmbeddingModel    string                         `json:"embedding_model"`
		Model             string                         `json:"model"`
		VectorDB          string                         `json:"vector_db"`
		RetrieveConfig    json.RawMessage                `json:"retrieve_config"`
		FragmentConfig    json.RawMessage                `json:"fragment_config"`
		EmbeddingConfig   json.RawMessage                `json:"embedding_config"`
		VectorDBConfig    json.RawMessage                `json:"vector_db_config"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return fmt.Errorf("unmarshal create document request: %w", err)
	}
	docType, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.DocType, "doc_type")
	if err != nil {
		return fmt.Errorf("decode doc_type: %w", err)
	}
	legacyType, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.Type, "type")
	if err != nil {
		return fmt.Errorf("decode type: %w", err)
	}

	strategyConfig, err := decodeStrategyConfigCompat(decoded.StrategyConfig)
	if err != nil {
		return err
	}
	retrieveConfig, err := decodeOptionalObjectCompat[confighelper.RetrieveConfigDTO](decoded.RetrieveConfig, "retrieve_config")
	if err != nil {
		return err
	}
	fragmentConfig, err := decodeOptionalObjectCompat[confighelper.FragmentConfigDTO](decoded.FragmentConfig, "fragment_config")
	if err != nil {
		return err
	}
	embeddingConfig, err := decodeOptionalObjectCompat[confighelper.EmbeddingConfig](decoded.EmbeddingConfig, "embedding_config")
	if err != nil {
		return err
	}
	vectorDBConfig, err := decodeOptionalObjectCompat[confighelper.VectorDBConfig](decoded.VectorDBConfig, "vector_db_config")
	if err != nil {
		return err
	}

	*r = CreateDocumentRequest{
		OrganizationCode:  decoded.OrganizationCode,
		UserID:            decoded.UserID,
		KnowledgeBaseCode: firstNonEmptyCompatString(decoded.KnowledgeBaseCode, decoded.KnowledgeCode),
		Name:              firstNonEmptyCompatString(decoded.Name, topLevelDocumentFileName(decoded.DocumentFile)),
		Description:       decoded.Description,
		DocType:           firstNonZeroInt(dereferenceInt(docType), dereferenceInt(legacyType)),
		DocMetadata:       firstNonNilMetadata(decoded.DocMetadata, decoded.Metadata),
		StrategyConfig:    strategyConfig,
		DocumentFile:      decoded.DocumentFile,
		ThirdPlatformType: firstNonEmptyCompatString(decoded.ThirdPlatformType, topLevelDocumentFileSourceType(decoded.DocumentFile)),
		ThirdFileID:       firstNonEmptyCompatString(decoded.ThirdFileID, topLevelDocumentFileThirdID(decoded.DocumentFile)),
		EmbeddingModel:    firstNonEmptyCompatString(decoded.EmbeddingModel, decoded.Model, embeddingModelFromConfig(embeddingConfig)),
		VectorDB:          decoded.VectorDB,
		RetrieveConfig:    retrieveConfig,
		FragmentConfig:    fragmentConfig,
		EmbeddingConfig:   embeddingConfig,
		VectorDBConfig:    vectorDBConfig,
	}
	return nil
}

// UnmarshalJSON 兼容文档相关对象配置的历史脏值传参。
func (r *UpdateDocumentRequest) UnmarshalJSON(data []byte) error {
	var decoded struct {
		OrganizationCode  string                         `json:"organization_code"`
		UserID            string                         `json:"user_id"`
		Code              string                         `json:"code"`
		KnowledgeBaseCode string                         `json:"knowledge_base_code"`
		KnowledgeCode     string                         `json:"knowledge_code"`
		Name              string                         `json:"name"`
		Description       string                         `json:"description"`
		Enabled           json.RawMessage                `json:"enabled"`
		Status            json.RawMessage                `json:"status"`
		DocType           json.RawMessage                `json:"doc_type"`
		Type              json.RawMessage                `json:"type"`
		DocMetadata       map[string]any                 `json:"doc_metadata"`
		Metadata          map[string]any                 `json:"metadata"`
		StrategyConfig    json.RawMessage                `json:"strategy_config"`
		DocumentFile      *docfilehelper.DocumentFileDTO `json:"document_file"`
		RetrieveConfig    json.RawMessage                `json:"retrieve_config"`
		FragmentConfig    json.RawMessage                `json:"fragment_config"`
		WordCount         json.RawMessage                `json:"word_count"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return fmt.Errorf("unmarshal update document request: %w", err)
	}
	enabled, _, err := pkgjsoncompat.DecodeOptionalBoolPHPTruth(decoded.Enabled, "enabled")
	if err != nil {
		return fmt.Errorf("decode enabled: %w", err)
	}
	status, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.Status, "status")
	if err != nil {
		return fmt.Errorf("decode status: %w", err)
	}
	docType, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.DocType, "doc_type")
	if err != nil {
		return fmt.Errorf("decode doc_type: %w", err)
	}
	legacyType, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.Type, "type")
	if err != nil {
		return fmt.Errorf("decode type: %w", err)
	}
	wordCount, _, err := pkgjsoncompat.DecodeOptionalInt(decoded.WordCount, "word_count")
	if err != nil {
		return fmt.Errorf("decode word_count: %w", err)
	}

	strategyConfig, err := decodeStrategyConfigCompat(decoded.StrategyConfig)
	if err != nil {
		return err
	}
	retrieveConfig, err := decodeOptionalObjectCompat[confighelper.RetrieveConfigDTO](decoded.RetrieveConfig, "retrieve_config")
	if err != nil {
		return err
	}
	fragmentConfig, err := decodeOptionalObjectCompat[confighelper.FragmentConfigDTO](decoded.FragmentConfig, "fragment_config")
	if err != nil {
		return err
	}

	*r = UpdateDocumentRequest{
		OrganizationCode:  decoded.OrganizationCode,
		UserID:            decoded.UserID,
		Code:              decoded.Code,
		KnowledgeBaseCode: firstNonEmptyCompatString(decoded.KnowledgeBaseCode, decoded.KnowledgeCode),
		Name:              decoded.Name,
		Description:       decoded.Description,
		Enabled:           resolveEnabledCompat(enabled, status),
		DocType:           firstNonNilInt(docType, legacyType),
		DocMetadata:       firstNonNilMetadata(decoded.DocMetadata, decoded.Metadata),
		StrategyConfig:    strategyConfig,
		DocumentFile:      decoded.DocumentFile,
		RetrieveConfig:    retrieveConfig,
		FragmentConfig:    fragmentConfig,
		WordCount:         wordCount,
	}
	return nil
}

func firstNonEmptyCompatString(values ...string) string {
	for _, value := range values {
		if value != "" {
			return value
		}
	}
	return ""
}

func firstNonZeroInt(values ...int) int {
	for _, value := range values {
		if value != 0 {
			return value
		}
	}
	return 0
}

func firstNonNilInt(values ...*int) *int {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func firstNonNilMetadata(values ...map[string]any) map[string]any {
	for _, value := range values {
		if value != nil {
			return value
		}
	}
	return nil
}

func resolveEnabledCompat(enabled *bool, status *int) *bool {
	if enabled != nil {
		return enabled
	}
	if status == nil {
		return nil
	}
	value := *status != 0
	return &value
}

func topLevelDocumentFileThirdID(documentFile *docfilehelper.DocumentFileDTO) string {
	if documentFile == nil {
		return ""
	}
	return documentFile.ThirdID
}

func topLevelDocumentFileName(documentFile *docfilehelper.DocumentFileDTO) string {
	if documentFile == nil {
		return ""
	}
	return documentFile.Name
}

func topLevelDocumentFileSourceType(documentFile *docfilehelper.DocumentFileDTO) string {
	if documentFile == nil {
		return ""
	}
	return documentFile.SourceType
}

func embeddingModelFromConfig(cfg *confighelper.EmbeddingConfig) string {
	if cfg == nil {
		return ""
	}
	return cfg.ModelID
}
