// Package dto 定义知识库重建应用层的公开输入输出类型。
package dto

import (
	"time"

	domainrebuild "magic/internal/domain/knowledge/rebuild"
)

// RunMode 表示知识库重建的执行模式。
type RunMode string

const (
	// ModeAuto 让应用层根据当前状态自动选择重建策略。
	ModeAuto RunMode = "auto"
	// ModeInplace 表示在现有集合上原地重建。
	ModeInplace RunMode = "inplace"
	// ModeBlueGreen 表示使用蓝绿切换方式重建。
	ModeBlueGreen RunMode = "bluegreen"
)

// ScopeMode 表示重建目标的作用域级别。
type ScopeMode string

const (
	// ScopeModeAll 表示对全部知识库执行重建。
	ScopeModeAll ScopeMode = "all"
	// ScopeModeOrganization 表示按组织范围执行重建。
	ScopeModeOrganization ScopeMode = "organization"
	// ScopeModeKnowledgeBase 表示按知识库范围执行重建。
	ScopeModeKnowledgeBase ScopeMode = "knowledge_base"
	// ScopeModeDocument 表示按文档范围执行重建。
	ScopeModeDocument ScopeMode = "document"
)

// Scope 描述一次重建请求命中的业务范围。
type Scope struct {
	Mode              ScopeMode `json:"mode"`
	OrganizationCode  string    `json:"organization_code,omitempty"`
	KnowledgeBaseCode string    `json:"knowledge_base_code,omitempty"`
	DocumentCode      string    `json:"document_code,omitempty"`
	UserID            string    `json:"user_id,omitempty"`
}

// ScopeFromDomain 把领域层 scope 转为应用层 DTO。
func ScopeFromDomain(scope domainrebuild.Scope) Scope {
	return Scope{
		Mode:              ScopeMode(scope.Mode),
		OrganizationCode:  scope.OrganizationCode,
		KnowledgeBaseCode: scope.KnowledgeBaseCode,
		DocumentCode:      scope.DocumentCode,
		UserID:            scope.UserID,
	}
}

// ToDomain 把应用层 scope 转为领域层对象。
func (s Scope) ToDomain() domainrebuild.Scope {
	return domainrebuild.Scope{
		Mode:              domainrebuild.ScopeMode(s.Mode),
		OrganizationCode:  s.OrganizationCode,
		KnowledgeBaseCode: s.KnowledgeBaseCode,
		DocumentCode:      s.DocumentCode,
		UserID:            s.UserID,
	}
}

// RunOptions 描述一次重建执行所需的应用层输入。
type RunOptions struct {
	Scope             Scope
	Mode              RunMode
	TargetModel       string
	TargetDimension   int64
	Concurrency       int
	BatchSize         int
	Retry             int
	FailureReport     string
	ResumeRunID       string
	HeartbeatInterval time.Duration
}

// MigrationStats 描述一次重建中影响到的业务数据量。
type MigrationStats struct {
	KnowledgeBaseRows int64 `json:"knowledge_base_rows"`
	DocumentRows      int64 `json:"document_rows"`
}

// MigrationStatsFromDomain 把领域层统计信息转为应用层 DTO。
func MigrationStatsFromDomain(stats domainrebuild.MigrationStats) MigrationStats {
	return MigrationStats{
		KnowledgeBaseRows: stats.KnowledgeBaseRows,
		DocumentRows:      stats.DocumentRows,
	}
}

// FailureRecord 描述一次文档重建失败的对外返回结构。
type FailureRecord struct {
	ID                int64  `json:"id"`
	OrganizationCode  string `json:"organization_code"`
	KnowledgeBaseCode string `json:"knowledge_base_code"`
	DocumentCode      string `json:"document_code"`
	UserID            string `json:"user_id"`
	EmbeddingModel    string `json:"embedding_model"`
	TargetCollection  string `json:"target_collection,omitempty"`
	TargetModel       string `json:"target_model,omitempty"`
	Attempts          int    `json:"attempts"`
	Error             string `json:"error"`
}

// FailureRecordFromDomain 把领域层失败任务转换为应用层 DTO。
func FailureRecordFromDomain(task domainrebuild.DocumentTask, attempts int, err error) FailureRecord {
	message := ""
	if err != nil {
		message = err.Error()
	}
	return FailureRecord{
		ID:                task.ID,
		OrganizationCode:  task.OrganizationCode,
		KnowledgeBaseCode: task.KnowledgeBaseCode,
		DocumentCode:      task.DocumentCode,
		UserID:            task.UserID,
		EmbeddingModel:    task.EmbeddingModel,
		TargetCollection:  task.TargetCollection,
		TargetModel:       task.TargetModel,
		Attempts:          attempts,
		Error:             message,
	}
}

// CleanupInput 描述一次重建残留清理请求。
type CleanupInput struct {
	OrganizationCode    string
	Apply               bool
	ForceDeleteNonEmpty bool
}

// CleanupCollectionAudit 描述一个候选集合的观测结果。
type CleanupCollectionAudit struct {
	Name   string `json:"name"`
	Points int64  `json:"points"`
}

// CleanupResult 描述一次重建残留清理的输出。
type CleanupResult struct {
	Apply                    bool                                `json:"apply"`
	ForceDeleteNonEmpty      bool                                `json:"force_delete_non_empty"`
	CandidatePattern         string                              `json:"candidate_pattern"`
	AliasName                string                              `json:"alias_name"`
	AliasTarget              string                              `json:"alias_target"`
	MetaPhysicalCollection   string                              `json:"meta_physical_collection"`
	CurrentRunID             string                              `json:"current_run_id"`
	DualWriteState           *domainrebuild.VectorDualWriteState `json:"dual_write_state,omitempty"`
	SafeToDeleteCollections  []CleanupCollectionAudit            `json:"safe_to_delete_collections"`
	KeptCollections          []CleanupCollectionAudit            `json:"kept_collections"`
	SkipReason               map[string]string                   `json:"skip_reason"`
	DeletedDualwriteState    bool                                `json:"deleted_dualwrite_state"`
	TotalCollections         int                                 `json:"total_collections"`
	CandidateCollectionCount int                                 `json:"candidate_collection_count"`
	SafeToDeleteCount        int                                 `json:"safe_to_delete_count"`
	KeptCount                int                                 `json:"kept_count"`
}

// RunResult 描述一次重建运行结束后的应用层输出。
type RunResult struct {
	RunID                            string          `json:"run_id"`
	RequestedMode                    RunMode         `json:"requested_mode"`
	SelectedMode                     RunMode         `json:"selected_mode"`
	RequestedScopeMode               ScopeMode       `json:"requested_scope_mode"`
	RequestedScopeOrg                string          `json:"requested_scope_org,omitempty"`
	ScopeMode                        ScopeMode       `json:"scope_mode"`
	ScopeOrg                         string          `json:"scope_org,omitempty"`
	ScopeEscalated                   bool            `json:"scope_escalated,omitempty"`
	ScopeEscalationReason            string          `json:"scope_escalation_reason,omitempty"`
	Bootstrap                        bool            `json:"bootstrap"`
	TargetModel                      string          `json:"target_model"`
	TargetSparseBackend              string          `json:"target_sparse_backend,omitempty"`
	TargetDimension                  int64           `json:"target_dimension"`
	ActiveModel                      string          `json:"active_model"`
	ActiveSparseBackend              string          `json:"active_sparse_backend,omitempty"`
	ActiveDimension                  int64           `json:"active_dimension"`
	ActiveCollection                 string          `json:"active_collection"`
	ActivePhysicalCollection         string          `json:"active_physical_collection,omitempty"`
	LegacyPhysicalCollectionDetected bool            `json:"legacy_physical_collection_detected,omitempty"`
	PhysicalNameNormalized           bool            `json:"physical_name_normalized,omitempty"`
	TargetPhysicalCollection         string          `json:"target_physical_collection,omitempty"`
	ShadowCollection                 string          `json:"shadow_collection,omitempty"`
	StandbyCollection                string          `json:"standby_collection,omitempty"`
	StandbyCollectionWarning         string          `json:"standby_collection_warning,omitempty"`
	PreviousCollection               string          `json:"previous_collection,omitempty"`
	DeletedPreviousCollection        bool            `json:"deleted_previous_collection"`
	DeletePreviousCollectionWarning  string          `json:"delete_previous_collection_warning,omitempty"`
	ResetStats                       MigrationStats  `json:"reset_stats"`
	ModelUpdateStats                 MigrationStats  `json:"model_update_stats"`
	TotalDocs                        int64           `json:"total_docs"`
	SuccessDocs                      int64           `json:"success_docs"`
	FailedDocs                       int64           `json:"failed_docs"`
	Failures                         []FailureRecord `json:"failures"`
	FailureReport                    string          `json:"failure_report,omitempty"`
	StartedAt                        time.Time       `json:"started_at"`
	FinishedAt                       time.Time       `json:"finished_at"`
}
