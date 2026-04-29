// Package entity 定义知识库来源绑定子域的稳定模型。
package entity

import (
	"errors"
	"strings"
	"time"
)

const (
	// ProviderProject 表示项目文件来源。
	ProviderProject = "project"
	// ProviderTeamshare 表示团队空间第三方来源。
	ProviderTeamshare = "teamshare"
	// ProviderLocalUpload 表示本地上传来源。
	ProviderLocalUpload = "local_upload"

	// RootTypeProject 表示绑定根节点为项目。
	RootTypeProject = "project"
	// RootTypeKnowledgeBase 表示绑定根节点为第三方知识库。
	RootTypeKnowledgeBase = "knowledge_base"
	// RootTypeFolder 表示绑定根节点为文件夹。
	RootTypeFolder = "folder"
	// RootTypeUploadBatch 表示绑定根节点为上传批次。
	RootTypeUploadBatch = "upload_batch"
	// RootTypeFile 表示绑定根节点为文件。
	RootTypeFile = "file"

	// TargetTypeFolder 表示绑定目标是目录。
	TargetTypeFolder = "folder"
	// TargetTypeGroup 保留旧常量名，值与 folder 对齐以兼容旧调用点。
	TargetTypeGroup = TargetTypeFolder
	// TargetTypeFile 表示绑定目标是文件。
	TargetTypeFile = "file"

	// SyncModeManual 表示手动同步。
	SyncModeManual = "manual"
	// SyncModeRealtime 表示实时同步。
	SyncModeRealtime = "realtime"
)

var (
	// ErrInvalidProjectRootRef 表示 project 绑定的 root_ref 非法。
	ErrInvalidProjectRootRef = errors.New("invalid project root_ref")
	// ErrDuplicateBindingRoot 表示同一知识库请求中出现重复 binding root。
	ErrDuplicateBindingRoot = errors.New("duplicate source binding root")
	// ErrSemanticMismatch 表示来源类型与绑定 provider/root_type 不匹配。
	ErrSemanticMismatch = errors.New("source binding semantic mismatch")
	// ErrTargetTypeInvalid 表示绑定 target_type 非法。
	ErrTargetTypeInvalid = errors.New("source binding target type is invalid")
	// ErrSyncModeInvalid 表示绑定 sync_mode 非法。
	ErrSyncModeInvalid = errors.New("source binding sync mode is invalid")
	// ErrTargetsNotAllowed 表示当前来源类型不允许带来源绑定。
	ErrTargetsNotAllowed = errors.New("source bindings are not allowed for current source type")
)

// Semantic 表示 source binding 在当前知识库 source_type 下的语义边界。
type Semantic string

const (
	// SemanticLegacy 表示历史 local/custom content 语义。
	SemanticLegacy Semantic = "legacy"
	// SemanticProject 表示项目文件语义。
	SemanticProject Semantic = "project"
	// SemanticEnterprise 表示企业第三方知识库语义。
	SemanticEnterprise Semantic = "enterprise"
)

// Binding 表示知识库来源绑定。
type Binding struct {
	ID                int64
	OrganizationCode  string
	KnowledgeBaseCode string
	Provider          string
	RootType          string
	RootRef           string
	SyncMode          string
	SyncConfig        map[string]any
	Enabled           bool
	CreatedUID        string
	UpdatedUID        string
	CreatedAt         time.Time
	UpdatedAt         time.Time
	Targets           []BindingTarget
}

// BindingTarget 表示来源绑定下的具体目标。
type BindingTarget struct {
	ID         int64
	BindingID  int64
	TargetType string
	TargetRef  string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

// SourceItem 表示来源系统中的具体资源项。
type SourceItem struct {
	ID               int64
	OrganizationCode string
	Provider         string
	RootType         string
	RootRef          string
	GroupRef         string
	ItemType         string
	ItemRef          string
	DisplayName      string
	Extension        string
	ContentHash      string
	SnapshotMeta     map[string]any
	LastResolvedAt   *time.Time
	CreatedAt        time.Time
	UpdatedAt        time.Time
}

// BindingItem 表示绑定与来源资源项的物化关系。
type BindingItem struct {
	ID             int64
	BindingID      int64
	SourceItemID   int64
	ResolveReason  string
	LastResolvedAt *time.Time
	CreatedAt      time.Time
	UpdatedAt      time.Time
}

// ItemMaterialization 表示一次来源项物化结果。
type ItemMaterialization struct {
	Item          SourceItem
	ResolveReason string
}

// NormalizeProvider 统一 provider 格式。
func NormalizeProvider(provider string) string {
	return strings.ToLower(strings.TrimSpace(provider))
}

// NormalizeRootType 统一 root_type 格式。
func NormalizeRootType(rootType string) string {
	return strings.ToLower(strings.TrimSpace(rootType))
}

// NormalizeSyncMode 统一 sync_mode 格式并补齐默认值。
func NormalizeSyncMode(syncMode string) string {
	switch strings.ToLower(strings.TrimSpace(syncMode)) {
	case "":
		return SyncModeManual
	case SyncModeManual, SyncModeRealtime:
		return strings.ToLower(strings.TrimSpace(syncMode))
	default:
		return ""
	}
}

// NormalizeTargetType 统一 target_type 格式。
func NormalizeTargetType(targetType string) string {
	switch strings.ToLower(strings.TrimSpace(targetType)) {
	case "group", TargetTypeFolder:
		return TargetTypeFolder
	case TargetTypeFile:
		return TargetTypeFile
	default:
		return ""
	}
}

// NormalizeBinding 统一绑定字段格式并补齐默认值。
func NormalizeBinding(binding Binding) Binding {
	binding.OrganizationCode = strings.TrimSpace(binding.OrganizationCode)
	binding.KnowledgeBaseCode = strings.TrimSpace(binding.KnowledgeBaseCode)
	binding.Provider = NormalizeProvider(binding.Provider)
	binding.RootType = NormalizeRootType(binding.RootType)
	binding.RootRef = strings.TrimSpace(binding.RootRef)
	binding.SyncMode = NormalizeSyncMode(binding.SyncMode)
	for idx := range binding.Targets {
		rawTargetType := strings.TrimSpace(binding.Targets[idx].TargetType)
		targetType := NormalizeTargetType(binding.Targets[idx].TargetType)
		if targetType == "" && rawTargetType == "" && strings.TrimSpace(binding.Targets[idx].TargetRef) != "" {
			targetType = TargetTypeFile
		}
		if targetType == "" {
			targetType = strings.ToLower(rawTargetType)
		}
		binding.Targets[idx].TargetType = targetType
		binding.Targets[idx].TargetRef = strings.TrimSpace(binding.Targets[idx].TargetRef)
	}
	return binding
}
