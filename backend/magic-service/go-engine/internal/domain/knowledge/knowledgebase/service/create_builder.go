package knowledgebase

import (
	"fmt"
	"strings"

	"github.com/google/uuid"

	"magic/internal/domain/knowledge/shared"
)

const (
	defaultVectorDB = "odin_qdrant"
	codePrefix      = "KNOWLEDGE"
	codePart1Length = 14
	codePart2Length = 8
	codePart2Start  = codePart1Length
	codePart2End    = codePart2Start + codePart2Length
)

// CreateInput 描述知识库创建时的领域输入。
type CreateInput struct {
	Code              string
	Name              string
	Description       string
	Type              int
	KnowledgeBaseType Type
	Model             string
	VectorDB          string
	BusinessID        string
	OrganizationCode  string
	UserID            string
	Icon              string
	SourceType        *int
	RetrieveConfig    *shared.RetrieveConfig
	FragmentConfig    *shared.FragmentConfig
	EmbeddingConfig   *shared.EmbeddingConfig
}

// UpdateInput 描述知识库更新时的领域输入。
type UpdateInput struct {
	Name              string
	Description       string
	Enabled           *bool
	Icon              string
	SourceType        *int
	KnowledgeBaseType *Type
	RetrieveConfig    *shared.RetrieveConfig
	FragmentConfig    *shared.FragmentConfig
	EmbeddingConfig   *shared.EmbeddingConfig
	UpdatedUID        string
}

// BuildKnowledgeBaseForCreate 根据领域输入构造知识库实体。
func BuildKnowledgeBaseForCreate(input *CreateInput) *KnowledgeBase {
	if input == nil {
		return nil
	}

	return NormalizeKnowledgeBaseConfigs(&KnowledgeBase{
		Code:              EnsureKnowledgeBaseCode(input.Code),
		Name:              strings.TrimSpace(input.Name),
		Description:       strings.TrimSpace(input.Description),
		Type:              input.Type,
		KnowledgeBaseType: NormalizeKnowledgeBaseTypeOrDefault(input.KnowledgeBaseType),
		Enabled:           true,
		BusinessID:        strings.TrimSpace(input.BusinessID),
		SyncStatus:        shared.SyncStatusPending,
		Model:             strings.TrimSpace(input.Model),
		VectorDB:          NormalizeVectorDB(input.VectorDB),
		OrganizationCode:  strings.TrimSpace(input.OrganizationCode),
		CreatedUID:        strings.TrimSpace(input.UserID),
		UpdatedUID:        strings.TrimSpace(input.UserID),
		Icon:              strings.TrimSpace(input.Icon),
		SourceType:        cloneSourceType(input.SourceType),
		RetrieveConfig:    shared.CloneRetrieveConfig(input.RetrieveConfig),
		FragmentConfig:    shared.CloneFragmentConfig(input.FragmentConfig),
		EmbeddingConfig:   cloneEmbeddingConfigWithModel(input.EmbeddingConfig, strings.TrimSpace(input.Model)),
	})
}

// BuildKnowledgeBaseUpdatePatch 根据领域输入构造知识库更新补丁。
func BuildKnowledgeBaseUpdatePatch(input *UpdateInput) UpdatePatch {
	if input == nil {
		return UpdatePatch{}
	}

	return UpdatePatch{
		Name:              optionalNonEmptyString(input.Name),
		Description:       optionalNonEmptyString(input.Description),
		Enabled:           input.Enabled,
		Icon:              optionalNonEmptyString(input.Icon),
		SourceType:        cloneSourceType(input.SourceType),
		KnowledgeBaseType: cloneKnowledgeBaseType(input.KnowledgeBaseType),
		RetrieveConfig:    shared.CloneRetrieveConfig(input.RetrieveConfig),
		FragmentConfig:    shared.CloneFragmentConfig(input.FragmentConfig),
		EmbeddingConfig:   input.EmbeddingConfig,
		UpdatedUID:        strings.TrimSpace(input.UpdatedUID),
	}
}

// NormalizeVectorDB 统一知识库向量库默认值。
func NormalizeVectorDB(vectorDB string) string {
	trimmed := strings.TrimSpace(vectorDB)
	if trimmed == "" {
		return defaultVectorDB
	}
	return trimmed
}

// EnsureKnowledgeBaseCode 统一知识库编码默认值。
func EnsureKnowledgeBaseCode(code string) string {
	trimmed := strings.TrimSpace(code)
	if trimmed != "" {
		return trimmed
	}
	return generateKnowledgeBaseCode()
}

func generateKnowledgeBaseCode() string {
	uuidValue := strings.ReplaceAll(uuid.NewString(), "-", "")
	return fmt.Sprintf(
		"%s-%s-%s",
		codePrefix,
		uuidValue[:codePart1Length],
		uuidValue[codePart2Start:codePart2End],
	)
}

func optionalNonEmptyString(value string) *string {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func cloneSourceType(sourceType *int) *int {
	if sourceType == nil {
		return nil
	}
	cloned := *sourceType
	return &cloned
}

func cloneKnowledgeBaseType(knowledgeBaseType *Type) *Type {
	if knowledgeBaseType == nil {
		return nil
	}
	cloned := NormalizeKnowledgeBaseTypeOrDefault(*knowledgeBaseType)
	return &cloned
}
