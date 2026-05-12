// Package entity 定义知识库领域的稳定模型与基础语义。
package entity

import (
	"encoding/json"
	"errors"
	"fmt"
	"maps"
	"strings"
	"time"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

var (
	// ErrInvalidSourceType 表示知识库来源类型非法。
	ErrInvalidSourceType = errors.New("invalid knowledge base source type")
	// ErrInvalidKnowledgeBaseType 表示知识库产品线非法。
	ErrInvalidKnowledgeBaseType = errors.New("invalid knowledge base type")
	// ErrExplicitFlowSourceTypeRequired 表示解绑数字员工时必须显式指定 flow 来源类型。
	ErrExplicitFlowSourceTypeRequired = errors.New("explicit flow source_type is required when unbinding digital employee knowledge base")
	// ErrManualDocumentCreateNotAllowed 表示当前知识库不允许直接手工创建文档。
	ErrManualDocumentCreateNotAllowed = errors.New("manual document creation is not allowed for source-bound digital employee knowledge base")
)

// SourceType 表示知识库来源类型。
type SourceType int

// Type 表示知识库产品线。
type Type string

// BindingType 表示知识库绑定对象类型。
type BindingType string

// SemanticSourceType 表示跨产品线统一后的来源语义。
type SemanticSourceType string

const (
	// KnowledgeBaseTypeFlowVector 表示旧 flow 向量知识库。
	KnowledgeBaseTypeFlowVector Type = "flow_vector"
	// KnowledgeBaseTypeDigitalEmployee 表示数字员工知识库。
	KnowledgeBaseTypeDigitalEmployee Type = "digital_employee"
)

const (
	// BindingTypeSuperMagicAgent 表示当前绑定到数字员工。
	BindingTypeSuperMagicAgent BindingType = "super_magic_agent"
)

const (
	// SemanticSourceTypeLocal 表示本地文件。
	SemanticSourceTypeLocal SemanticSourceType = "local"
	// SemanticSourceTypeCustomContent 表示自定义内容。
	SemanticSourceTypeCustomContent SemanticSourceType = "custom"
	// SemanticSourceTypeProject 表示项目文件。
	SemanticSourceTypeProject SemanticSourceType = "project"
	// SemanticSourceTypeEnterprise 表示企业知识库。
	SemanticSourceTypeEnterprise SemanticSourceType = "enterprise"
)

const (
	// SourceTypeLocalFile 表示本地文件来源。
	SourceTypeLocalFile SourceType = constants.KnowledgeBaseSourceTypeLegacyLocalFile
	// SourceTypeLegacyEnterpriseWiki 表示旧 flow 向量知识库的企业知识库来源。
	SourceTypeLegacyEnterpriseWiki SourceType = constants.KnowledgeBaseSourceTypeLegacyEnterpriseWiki
	// SourceTypeCustomContent 表示数字员工知识库的自定义内容来源。
	SourceTypeCustomContent SourceType = constants.KnowledgeBaseSourceTypeDigitalEmployeeCustomContent
	// SourceTypeProject 表示数字员工知识库的项目文件来源。
	SourceTypeProject SourceType = constants.KnowledgeBaseSourceTypeDigitalEmployeeProject
	// SourceTypeEnterpriseWiki 表示数字员工知识库的企业知识库来源。
	SourceTypeEnterpriseWiki SourceType = constants.KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki
)

// KnowledgeBase 知识库实体。
type KnowledgeBase struct {
	ID                int64                      `json:"id"`
	Code              string                     `json:"code"`
	Version           int                        `json:"version"`
	Name              string                     `json:"name"`
	Description       string                     `json:"description"`
	Type              int                        `json:"type"`
	Enabled           bool                       `json:"enabled"`
	BusinessID        string                     `json:"business_id"`
	SyncStatus        shared.SyncStatus          `json:"sync_status"`
	SyncStatusMessage string                     `json:"sync_status_message"`
	Model             string                     `json:"model"`
	VectorDB          string                     `json:"vector_db"`
	OrganizationCode  string                     `json:"organization_code"`
	CreatedUID        string                     `json:"created_uid"`
	UpdatedUID        string                     `json:"updated_uid"`
	ExpectedNum       int                        `json:"expected_num"`
	CompletedNum      int                        `json:"completed_num"`
	RetrieveConfig    *shared.RetrieveConfig     `json:"retrieve_config"`
	FragmentConfig    *shared.FragmentConfig     `json:"fragment_config"`
	EmbeddingConfig   *shared.EmbeddingConfig    `json:"embedding_config"`
	WordCount         int                        `json:"word_count"`
	Icon              string                     `json:"icon"`
	SourceType        *int                       `json:"source_type"`
	KnowledgeBaseType Type                       `json:"knowledge_base_type"`
	ResolvedRoute     *sharedroute.ResolvedRoute `json:"-"`
	CreatedAt         time.Time                  `json:"created_at"`
	UpdatedAt         time.Time                  `json:"updated_at"`
	DeletedAt         *time.Time                 `json:"deleted_at"`
}

// UpdatePatch 描述知识库允许更新的领域字段。
type UpdatePatch struct {
	Name              *string
	Description       *string
	Enabled           *bool
	Icon              *string
	SourceType        *int
	KnowledgeBaseType *Type
	RetrieveConfig    *shared.RetrieveConfig
	FragmentConfig    *shared.FragmentConfig
	EmbeddingConfig   *shared.EmbeddingConfig
	UpdatedUID        string
}

// CollectionName 返回知识库默认集合名。
func (kb *KnowledgeBase) CollectionName() string {
	return constants.KnowledgeBaseCollectionName
}

// DefaultDocumentCode 返回知识库默认文档编码。
func (kb *KnowledgeBase) DefaultDocumentCode() string {
	if kb == nil {
		return ""
	}
	return kb.Code + "-DEFAULT-DOC"
}

// ApplyResolvedRoute 缓存本次运行时解析出的完整路由。
func (kb *KnowledgeBase) ApplyResolvedRoute(route sharedroute.ResolvedRoute) {
	if kb == nil {
		return
	}
	routeCopy := route
	kb.ResolvedRoute = &routeCopy
	kb.Model = route.Model
	if kb.EmbeddingConfig == nil {
		kb.EmbeddingConfig = &shared.EmbeddingConfig{}
	}
	kb.EmbeddingConfig = cloneEmbeddingConfigWithModel(kb.EmbeddingConfig, route.Model)
}

// ApplyUpdate 应用知识库领域更新。
func (kb *KnowledgeBase) ApplyUpdate(patch UpdatePatch) {
	if kb == nil {
		return
	}
	if patch.Name != nil && *patch.Name != "" {
		kb.Name = *patch.Name
	}
	if patch.Description != nil && *patch.Description != "" {
		kb.Description = *patch.Description
	}
	if patch.Enabled != nil {
		kb.Enabled = *patch.Enabled
	}
	if patch.Icon != nil && *patch.Icon != "" {
		kb.Icon = *patch.Icon
	}
	if patch.SourceType != nil {
		kb.SourceType = cloneSourceType(patch.SourceType)
	}
	if patch.KnowledgeBaseType != nil {
		kb.KnowledgeBaseType = NormalizeKnowledgeBaseTypeOrDefault(*patch.KnowledgeBaseType)
	}
	if patch.RetrieveConfig != nil {
		kb.RetrieveConfig = patch.RetrieveConfig
	}
	if patch.FragmentConfig != nil {
		kb.FragmentConfig = patch.FragmentConfig
	}
	if patch.EmbeddingConfig != nil {
		kb.EmbeddingConfig = patch.EmbeddingConfig
	}
	if patch.UpdatedUID != "" {
		kb.UpdatedUID = patch.UpdatedUID
	}
}

// SetProgress 更新知识库进度。
func (kb *KnowledgeBase) SetProgress(expectedNum, completedNum int, updatedUID string) {
	if kb == nil {
		return
	}
	kb.ExpectedNum = expectedNum
	kb.CompletedNum = completedNum
	kb.UpdatedUID = updatedUID
}

// IsVectorizationCompleted 返回知识库向量化是否已完成。
//
// Teamshare 可管理列表需要把空知识库（0/0）视为已完成，
// 因为此时不存在待处理文档，进度已经处于终态。
func (kb *KnowledgeBase) IsVectorizationCompleted() bool {
	if kb == nil {
		return false
	}
	return kb.ExpectedNum == kb.CompletedNum
}

const (
	// VectorSize3Small 是 text-embedding-3-small 的默认向量维度。
	VectorSize3Small int64 = 1536
	// VectorSize3Large 是 text-embedding-3-large 的默认向量维度。
	VectorSize3Large int64 = 3072
	// VectorSizeDMeta 是 dmeta-embedding 的默认向量维度。
	VectorSizeDMeta int64 = 1024
	// VectorSizeDefault 是未知模型的兜底向量维度。
	VectorSizeDefault int64 = 1024
)

// GetVectorSize 根据当前模型推导向量维度。
func (kb *KnowledgeBase) GetVectorSize() int64 {
	switch kb.Model {
	case "text-embedding-3-small":
		return VectorSize3Small
	case "text-embedding-3-large":
		return VectorSize3Large
	case "dmeta-embedding":
		return VectorSizeDMeta
	default:
		return VectorSizeDefault
	}
}

func cloneEmbeddingConfigWithModel(cfg *shared.EmbeddingConfig, model string) *shared.EmbeddingConfig {
	if cfg == nil {
		cfg = &shared.EmbeddingConfig{}
	}
	cloned := &shared.EmbeddingConfig{
		ModelID: model,
	}
	if len(cfg.Extra) > 0 {
		cloned.Extra = make(map[string]json.RawMessage, len(cfg.Extra))
		maps.Copy(cloned.Extra, cfg.Extra)
	}
	return cloned
}

func cloneSourceType(sourceType *int) *int {
	if sourceType == nil {
		return nil
	}
	cloned := *sourceType
	return &cloned
}

// NormalizeKnowledgeBaseConfigs 将空知识库配置归一化为领域默认值。
func NormalizeKnowledgeBaseConfigs(kb *KnowledgeBase) *KnowledgeBase {
	if kb == nil {
		return nil
	}
	if kb.RetrieveConfig == nil {
		kb.RetrieveConfig = shared.DefaultRetrieveConfig()
	}
	if kb.FragmentConfig == nil {
		kb.FragmentConfig = shared.DefaultFragmentConfig()
	}
	return kb
}

// NormalizeBindID 统一清洗绑定对象 ID。
func NormalizeBindID(bindID string) string {
	return strings.TrimSpace(bindID)
}

// IsValidSourceType 判断知识库来源类型是否有效。
func IsValidSourceType(sourceType int) bool {
	return constants.IsValidKnowledgeBaseSourceType(sourceType)
}

// IsValidKnowledgeBaseType 判断知识库产品线是否有效。
func IsValidKnowledgeBaseType(knowledgeBaseType Type) bool {
	switch knowledgeBaseType {
	case KnowledgeBaseTypeFlowVector, KnowledgeBaseTypeDigitalEmployee:
		return true
	default:
		return false
	}
}

// NormalizeKnowledgeBaseType 统一校验知识库产品线。
func NormalizeKnowledgeBaseType(knowledgeBaseType Type) (Type, error) {
	if !IsValidKnowledgeBaseType(knowledgeBaseType) {
		return "", fmt.Errorf("%w: %s", ErrInvalidKnowledgeBaseType, knowledgeBaseType)
	}
	return knowledgeBaseType, nil
}

// NormalizeKnowledgeBaseTypeOrDefault 在空值时回退到默认产品线。
func NormalizeKnowledgeBaseTypeOrDefault(knowledgeBaseType Type) Type {
	trimmed := Type(strings.TrimSpace(string(knowledgeBaseType)))
	if trimmed == "" {
		return KnowledgeBaseTypeFlowVector
	}
	normalized, err := NormalizeKnowledgeBaseType(trimmed)
	if err != nil {
		return KnowledgeBaseTypeFlowVector
	}
	return normalized
}

// IsFlowVectorSourceType 判断是否属于 flow 向量知识库来源枚举。
func IsFlowVectorSourceType(sourceType int) bool {
	switch sourceType {
	case int(SourceTypeLocalFile), int(SourceTypeLegacyEnterpriseWiki), int(SourceTypeEnterpriseWiki):
		return true
	default:
		return false
	}
}

// IsDigitalEmployeeSourceType 判断是否属于数字员工知识库来源枚举。
func IsDigitalEmployeeSourceType(sourceType int) bool {
	switch sourceType {
	case int(SourceTypeLocalFile), int(SourceTypeCustomContent), int(SourceTypeProject), int(SourceTypeLegacyEnterpriseWiki), int(SourceTypeEnterpriseWiki):
		return true
	default:
		return false
	}
}

// ResolveSemanticSourceType 将 raw source_type 按“已确定的知识库产品线”解析为统一来源语义。
func ResolveSemanticSourceType(knowledgeBaseType Type, sourceType int) (SemanticSourceType, error) {
	normalizedType, err := NormalizeKnowledgeBaseType(knowledgeBaseType)
	if err != nil {
		return "", err
	}

	switch normalizedType {
	case KnowledgeBaseTypeDigitalEmployee:
		switch sourceType {
		case int(SourceTypeLocalFile):
			return SemanticSourceTypeLocal, nil
		case int(SourceTypeCustomContent):
			return SemanticSourceTypeCustomContent, nil
		case int(SourceTypeProject):
			return SemanticSourceTypeProject, nil
		case int(SourceTypeLegacyEnterpriseWiki), int(SourceTypeEnterpriseWiki):
			return SemanticSourceTypeEnterprise, nil
		default:
			return "", fmt.Errorf("%w: %d", ErrInvalidSourceType, sourceType)
		}
	case KnowledgeBaseTypeFlowVector:
		switch sourceType {
		case int(SourceTypeLocalFile):
			return SemanticSourceTypeLocal, nil
		case int(SourceTypeLegacyEnterpriseWiki), int(SourceTypeEnterpriseWiki):
			return SemanticSourceTypeEnterprise, nil
		default:
			return "", fmt.Errorf("%w: %d", ErrInvalidSourceType, sourceType)
		}
	default:
		return "", fmt.Errorf("%w: %s", ErrInvalidKnowledgeBaseType, knowledgeBaseType)
	}
}

// NormalizeSourceType 按“已确定的知识库产品线”校验 raw source_type。
func NormalizeSourceType(knowledgeBaseType Type, sourceType *int) (*int, error) {
	normalizedType, err := NormalizeKnowledgeBaseType(knowledgeBaseType)
	if err != nil {
		return nil, err
	}

	if sourceType == nil {
		defaultSourceType := defaultSourceType()
		return &defaultSourceType, nil
	}

	normalized := *sourceType
	if !IsValidSourceTypeForKnowledgeBaseType(normalizedType, normalized) {
		return nil, fmt.Errorf("%w: knowledge_base_type=%s source_type=%d", ErrInvalidSourceType, normalizedType, normalized)
	}
	return &normalized, nil
}

// NormalizeExistingSourceTypeForKnowledgeBaseType 对存量 knowledge_base.source_type 做最小兼容映射。
func NormalizeExistingSourceTypeForKnowledgeBaseType(
	knowledgeBaseType Type,
	sourceType *int,
) (*int, error) {
	normalizedType, err := NormalizeKnowledgeBaseType(knowledgeBaseType)
	if err != nil {
		return nil, err
	}
	if sourceType == nil {
		defaultSourceType := defaultSourceType()
		return &defaultSourceType, nil
	}
	value := *sourceType
	switch normalizedType {
	case KnowledgeBaseTypeDigitalEmployee:
		// digital_employee 兼容保留原始 raw 值，不做归一改写。
	case KnowledgeBaseTypeFlowVector:
		switch value {
		case int(SourceTypeCustomContent), int(SourceTypeProject):
			return nil, fmt.Errorf("%w: current_source_type=%d", ErrExplicitFlowSourceTypeRequired, value)
		}
	}
	return NormalizeSourceType(normalizedType, &value)
}

// IsValidSourceTypeForKnowledgeBaseType 判断来源类型与产品线组合是否合法。
func IsValidSourceTypeForKnowledgeBaseType(knowledgeBaseType Type, sourceType int) bool {
	switch knowledgeBaseType {
	case KnowledgeBaseTypeDigitalEmployee:
		return IsDigitalEmployeeSourceType(sourceType)
	case KnowledgeBaseTypeFlowVector:
		return IsFlowVectorSourceType(sourceType)
	default:
		return false
	}
}

// ValidateManualDocumentCreateAllowed 校验知识库是否允许直接手工创建文档。
func ValidateManualDocumentCreateAllowed(knowledgeBaseType Type, sourceType *int) error {
	normalizedType, err := NormalizeKnowledgeBaseType(knowledgeBaseType)
	if err != nil {
		return err
	}
	if normalizedType != KnowledgeBaseTypeDigitalEmployee || sourceType == nil {
		return nil
	}

	semanticSourceType, err := ResolveSemanticSourceType(normalizedType, *sourceType)
	if err != nil {
		return err
	}
	switch semanticSourceType {
	case SemanticSourceTypeProject, SemanticSourceTypeEnterprise:
		return ErrManualDocumentCreateNotAllowed
	default:
		return nil
	}
}

func defaultSourceType() int {
	return int(SourceTypeLocalFile)
}
