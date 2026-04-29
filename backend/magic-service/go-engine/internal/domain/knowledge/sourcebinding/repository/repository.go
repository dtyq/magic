// Package repository 定义来源绑定子域的稳定仓储契约。
package repository

import (
	"context"

	sourcebindingentity "magic/internal/domain/knowledge/sourcebinding/entity"
)

// SourceCallbackEligibilityKind 表示来源变更回调资格缓存的来源类型。
type SourceCallbackEligibilityKind string

const (
	// SourceCallbackEligibilityProjectFile 表示项目文件变更回调。
	SourceCallbackEligibilityProjectFile SourceCallbackEligibilityKind = "project_file"
	// SourceCallbackEligibilityThirdFile 表示第三方文件变更回调。
	SourceCallbackEligibilityThirdFile SourceCallbackEligibilityKind = "third_file"
)

// SourceCallbackEligibilityCacheKey 描述来源变更回调资格缓存键的业务维度。
type SourceCallbackEligibilityCacheKey struct {
	Kind              SourceCallbackEligibilityKind
	OrganizationCode  string
	ProjectID         int64
	ProjectFileID     int64
	ThirdPlatformType string
	ThirdFileID       string
}

// SourceCallbackEligibilityDecision 描述一次来源变更回调是否允许投 MQ。
type SourceCallbackEligibilityDecision struct {
	Eligible  bool   `json:"eligible"`
	Reason    string `json:"reason"`
	CheckedAt int64  `json:"checked_at"`
}

// SourceCallbackEligibilityCache 定义来源变更回调资格缓存。
type SourceCallbackEligibilityCache interface {
	Get(ctx context.Context, key SourceCallbackEligibilityCacheKey) (SourceCallbackEligibilityDecision, bool, error)
	Set(ctx context.Context, key SourceCallbackEligibilityCacheKey, decision SourceCallbackEligibilityDecision) error
	InvalidateOrganization(ctx context.Context, organizationCode string) error
}

// SourceBindingCandidateCache 定义来源回调热路径的候选数据缓存。
type SourceBindingCandidateCache interface {
	GetProjectBindings(ctx context.Context, organizationCode string, projectID int64) ([]sourcebindingentity.Binding, bool, error)
	SetProjectBindings(ctx context.Context, organizationCode string, projectID int64, bindings []sourcebindingentity.Binding) error
	GetTeamshareBindings(ctx context.Context, organizationCode, platform, knowledgeBaseID string) ([]sourcebindingentity.Binding, bool, error)
	SetTeamshareBindings(ctx context.Context, organizationCode, platform, knowledgeBaseID string, bindings []sourcebindingentity.Binding) error
	GetKnowledgeBaseEnabled(ctx context.Context, organizationCode string, knowledgeBaseCodes []string) (map[string]bool, []string, error)
	SetKnowledgeBaseEnabled(ctx context.Context, organizationCode string, states map[string]bool) error
}

// SourceCallbackSingleflightKey 描述同一来源文件回调的收敛锁维度。
type SourceCallbackSingleflightKey struct {
	Provider         string
	OrganizationCode string
	FileID           string
}

// SourceCallbackSingleflight 定义来源文件回调的短锁能力。
type SourceCallbackSingleflight interface {
	AcquireSourceCallbackLock(ctx context.Context, key SourceCallbackSingleflightKey) (string, bool, error)
	ReleaseSourceCallbackLock(ctx context.Context, key SourceCallbackSingleflightKey, token string) error
}

// ProjectFileBindingEligibilityReader 定义项目文件绑定资格读取能力。
type ProjectFileBindingEligibilityReader interface {
	HasRealtimeProjectBindingForFile(ctx context.Context, organizationCode string, projectID, projectFileID int64) (bool, error)
}

// TeamshareRealtimeBindingReader 定义 Teamshare 当前知识库实时绑定候选读取能力。
type TeamshareRealtimeBindingReader interface {
	ListRealtimeTeamshareBindingsByKnowledgeBase(
		ctx context.Context,
		organizationCode string,
		platform string,
		knowledgeBaseID string,
	) ([]sourcebindingentity.Binding, error)
}

// ApplyKnowledgeBaseBinding 表示一次知识库 binding 增量落库对象。
type ApplyKnowledgeBaseBinding struct {
	Binding sourcebindingentity.Binding
	Items   []sourcebindingentity.BindingItem
}

// ApplyKnowledgeBaseBindingsInput 表示知识库 binding 增量落库输入。
type ApplyKnowledgeBaseBindingsInput struct {
	KnowledgeBaseCode string
	DeleteBindingIDs  []int64
	UpsertBindings    []ApplyKnowledgeBaseBinding
}

// Repository 定义来源绑定的持久化端口。
type Repository interface {
	ReplaceBindings(ctx context.Context, knowledgeBaseCode string, bindings []sourcebindingentity.Binding) ([]sourcebindingentity.Binding, error)
	SaveBindings(ctx context.Context, knowledgeBaseCode string, bindings []sourcebindingentity.Binding) ([]sourcebindingentity.Binding, error)
	ApplyKnowledgeBaseBindings(
		ctx context.Context,
		input ApplyKnowledgeBaseBindingsInput,
	) ([]sourcebindingentity.Binding, error)
	ListBindingsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]sourcebindingentity.Binding, error)
	ListBindingsByKnowledgeBases(ctx context.Context, knowledgeBaseCodes []string) (map[string][]sourcebindingentity.Binding, error)
	ListRealtimeProjectBindingsByProject(ctx context.Context, organizationCode string, projectID int64) ([]sourcebindingentity.Binding, error)
	UpsertSourceItem(ctx context.Context, item sourcebindingentity.SourceItem) (*sourcebindingentity.SourceItem, error)
	UpsertSourceItems(ctx context.Context, items []sourcebindingentity.SourceItem) ([]*sourcebindingentity.SourceItem, error)
	ReplaceBindingItems(ctx context.Context, bindingID int64, items []sourcebindingentity.BindingItem) error
	ListBindingItemsByKnowledgeBase(ctx context.Context, knowledgeBaseCode string) ([]sourcebindingentity.BindingItem, error)
}
