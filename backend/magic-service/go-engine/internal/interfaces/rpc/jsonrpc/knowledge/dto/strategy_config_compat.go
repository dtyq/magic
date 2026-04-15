package dto

import (
	"encoding/json"
	"fmt"

	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
)

func decodeStrategyConfigCompat(raw json.RawMessage) (*confighelper.StrategyConfigDTO, error) {
	return decodeOptionalObjectCompat[confighelper.StrategyConfigDTO](raw, "strategy_config")
}

// UnmarshalJSON 兼容 strategy_config / fragment_config 传空数组、空对象、null、空字符串。
func (r *PreviewFragmentRequest) UnmarshalJSON(data []byte) error {
	var decoded struct {
		DataIsolation  DataIsolation                  `json:"data_isolation"`
		DocumentFile   *docfilehelper.DocumentFileDTO `json:"document_file"`
		StrategyConfig json.RawMessage                `json:"strategy_config"`
		FragmentConfig json.RawMessage                `json:"fragment_config"`
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
		DocumentFile:   decoded.DocumentFile,
		StrategyConfig: strategyConfig,
		FragmentConfig: fragmentConfig,
	}
	return nil
}

// UnmarshalJSON 兼容文档相关对象配置的历史脏值传参。
func (r *CreateDocumentRequest) UnmarshalJSON(data []byte) error {
	var decoded struct {
		OrganizationCode  string                         `json:"organization_code"`
		UserID            string                         `json:"user_id"`
		KnowledgeBaseCode string                         `json:"knowledge_base_code"`
		Name              string                         `json:"name"`
		Description       string                         `json:"description"`
		DocType           int                            `json:"doc_type"`
		DocMetadata       map[string]any                 `json:"doc_metadata"`
		StrategyConfig    json.RawMessage                `json:"strategy_config"`
		DocumentFile      *docfilehelper.DocumentFileDTO `json:"document_file"`
		ThirdPlatformType string                         `json:"third_platform_type"`
		ThirdFileID       string                         `json:"third_file_id"`
		EmbeddingModel    string                         `json:"embedding_model"`
		VectorDB          string                         `json:"vector_db"`
		RetrieveConfig    json.RawMessage                `json:"retrieve_config"`
		FragmentConfig    json.RawMessage                `json:"fragment_config"`
		EmbeddingConfig   json.RawMessage                `json:"embedding_config"`
		VectorDBConfig    json.RawMessage                `json:"vector_db_config"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return fmt.Errorf("unmarshal create document request: %w", err)
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
		KnowledgeBaseCode: decoded.KnowledgeBaseCode,
		Name:              decoded.Name,
		Description:       decoded.Description,
		DocType:           decoded.DocType,
		DocMetadata:       decoded.DocMetadata,
		StrategyConfig:    strategyConfig,
		DocumentFile:      decoded.DocumentFile,
		ThirdPlatformType: decoded.ThirdPlatformType,
		ThirdFileID:       decoded.ThirdFileID,
		EmbeddingModel:    decoded.EmbeddingModel,
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
		Name              string                         `json:"name"`
		Description       string                         `json:"description"`
		Enabled           *bool                          `json:"enabled"`
		DocType           *int                           `json:"doc_type"`
		DocMetadata       map[string]any                 `json:"doc_metadata"`
		StrategyConfig    json.RawMessage                `json:"strategy_config"`
		DocumentFile      *docfilehelper.DocumentFileDTO `json:"document_file"`
		RetrieveConfig    json.RawMessage                `json:"retrieve_config"`
		FragmentConfig    json.RawMessage                `json:"fragment_config"`
		WordCount         *int                           `json:"word_count"`
	}
	if err := json.Unmarshal(data, &decoded); err != nil {
		return fmt.Errorf("unmarshal update document request: %w", err)
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
		KnowledgeBaseCode: decoded.KnowledgeBaseCode,
		Name:              decoded.Name,
		Description:       decoded.Description,
		Enabled:           decoded.Enabled,
		DocType:           decoded.DocType,
		DocMetadata:       decoded.DocMetadata,
		StrategyConfig:    strategyConfig,
		DocumentFile:      decoded.DocumentFile,
		RetrieveConfig:    retrieveConfig,
		FragmentConfig:    fragmentConfig,
		WordCount:         decoded.WordCount,
	}
	return nil
}
