package knowledgebase

import (
	"context"
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

// ErrInvalidSourceType 表示知识库来源类型非法。
var ErrInvalidSourceType = errors.New("invalid knowledge base source type")

// ErrInvalidKnowledgeBaseType 表示知识库产品线非法。
var ErrInvalidKnowledgeBaseType = errors.New("invalid knowledge base type")

// ErrExplicitFlowSourceTypeRequired 表示解绑数字员工时必须显式指定 flow 来源类型。
var ErrExplicitFlowSourceTypeRequired = errors.New("explicit flow source_type is required when unbinding digital employee knowledge base")

// ErrManualDocumentCreateNotAllowed 表示当前知识库不允许直接手工创建文档。
var ErrManualDocumentCreateNotAllowed = errors.New("manual document creation is not allowed for source-bound digital employee knowledge base")

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
	// 创建时由“agent_codes 为空”判定得到。
	KnowledgeBaseTypeFlowVector Type = "flow_vector"
	// KnowledgeBaseTypeDigitalEmployee 表示数字员工知识库。
	// 创建时由“agent_codes 非空”判定得到。
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
	// 该值在两个产品线下都合法，但只表示“本地”语义，不表示产品线。
	SourceTypeLocalFile SourceType = constants.KnowledgeBaseSourceTypeLegacyLocalFile
	// SourceTypeLegacyEnterpriseWiki 表示旧 flow 向量知识库的企业知识库来源。
	// 它与数字员工侧的 4 共享 enterprise 语义，但不是同一个协议值。
	SourceTypeLegacyEnterpriseWiki SourceType = constants.KnowledgeBaseSourceTypeLegacyEnterpriseWiki
	// SourceTypeCustomContent 表示数字员工知识库的自定义内容来源。
	SourceTypeCustomContent SourceType = constants.KnowledgeBaseSourceTypeDigitalEmployeeCustomContent
	// SourceTypeProject 表示数字员工知识库的项目文件来源。
	SourceTypeProject SourceType = constants.KnowledgeBaseSourceTypeDigitalEmployeeProject
	// SourceTypeEnterpriseWiki 表示数字员工知识库的企业知识库来源。
	// 它与 flow 侧的 1001 共享 enterprise 语义，但不是同一个协议值。
	SourceTypeEnterpriseWiki SourceType = constants.KnowledgeBaseSourceTypeDigitalEmployeeEnterpriseWiki
)

// Query 知识库查询条件。
type Query struct {
	OrganizationCode  string
	Name              string
	Type              *int
	KnowledgeBaseType *Type
	Enabled           *bool
	SyncStatus        *shared.SyncStatus
	Codes             []string
	BusinessIDs       []string
	Offset            int
	Limit             int
}

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
//
// 这里缓存的是“调用链已经确定好的运行时结果”，用于避免同一条主链后续再次自行推导逻辑名/物理名。
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
	case int(SourceTypeLocalFile), int(SourceTypeLegacyEnterpriseWiki):
		return true
	default:
		return false
	}
}

// IsDigitalEmployeeSourceType 判断是否属于数字员工知识库来源枚举。
func IsDigitalEmployeeSourceType(sourceType int) bool {
	switch sourceType {
	case int(SourceTypeLocalFile), int(SourceTypeCustomContent), int(SourceTypeProject), int(SourceTypeEnterpriseWiki):
		return true
	default:
		return false
	}
}

// ResolveSemanticSourceType 将 raw source_type 按“已确定的知识库产品线”解析为统一来源语义。
//
// 这里不会也不能根据 source_type 反推产品线；调用方必须先确定产品线，再解释 source_type。
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
		case int(SourceTypeEnterpriseWiki):
			return SemanticSourceTypeEnterprise, nil
		default:
			return "", fmt.Errorf("%w: %d", ErrInvalidSourceType, sourceType)
		}
	case KnowledgeBaseTypeFlowVector:
		switch sourceType {
		case int(SourceTypeLocalFile):
			return SemanticSourceTypeLocal, nil
		case int(SourceTypeLegacyEnterpriseWiki):
			return SemanticSourceTypeEnterprise, nil
		default:
			return "", fmt.Errorf("%w: %d", ErrInvalidSourceType, sourceType)
		}
	default:
		return "", fmt.Errorf("%w: %s", ErrInvalidKnowledgeBaseType, knowledgeBaseType)
	}
}

// NormalizeSourceType 按“已确定的知识库产品线”校验 raw source_type。
//
// 当 sourceType=nil 时，这里只返回 local 的兼容兜底值，适合历史存量或纯归一化场景；
// 创建/更新主链如果需要处理“缺失 source_type”，必须先判产品线，再走 NormalizeOrInferSourceType。
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
//
// 它处理的是历史落库值与当前知识库产品线之间的兼容，不表示运行时允许通过一次请求切换产品线。
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
		if value == int(SourceTypeLegacyEnterpriseWiki) {
			value = int(SourceTypeEnterpriseWiki)
		}
	case KnowledgeBaseTypeFlowVector:
		switch value {
		case int(SourceTypeEnterpriseWiki):
			value = int(SourceTypeLegacyEnterpriseWiki)
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

// Repository 知识库仓储接口。
type Repository interface {
	Save(ctx context.Context, kb *KnowledgeBase) error
	Update(ctx context.Context, kb *KnowledgeBase) error
	FindByID(ctx context.Context, id int64) (*KnowledgeBase, error)
	FindByCode(ctx context.Context, code string) (*KnowledgeBase, error)
	FindByCodeAndOrg(ctx context.Context, code, orgCode string) (*KnowledgeBase, error)
	List(ctx context.Context, query *Query) ([]*KnowledgeBase, int64, error)
	Delete(ctx context.Context, id int64) error
	UpdateSyncStatus(ctx context.Context, id int64, status shared.SyncStatus, message string) error
	UpdateProgress(ctx context.Context, id int64, expectedNum, completedNum int) error
}

// CollectionMeta 表示集合级路由元数据。
type CollectionMeta = sharedroute.CollectionMeta

// CollectionMetaReader 定义集合元信息读取能力。
type CollectionMetaReader = sharedroute.CollectionMetaReader

// CollectionMetaWriter 定义集合元信息写入能力。
type CollectionMetaWriter = sharedroute.CollectionMetaWriter
