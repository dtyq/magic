package model

import (
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/filetype"
)

// KnowledgeBaseRuntimeSnapshot 复用共享知识库运行时快照。
type KnowledgeBaseRuntimeSnapshot = sharedsnapshot.KnowledgeBaseRuntimeSnapshot

// DocumentFile 复用共享文档文件快照。
type DocumentFile = sharedsnapshot.DocumentFile

// KnowledgeBaseDocument 表示 fragment 子域消费的稳定文档投影。
type KnowledgeBaseDocument struct {
	sharedsnapshot.KnowledgeDocumentSnapshot
	DocumentFile      *DocumentFile
	ThirdPlatformType string
	ThirdFileID       string
	SyncStatus        shared.SyncStatus
	EmbeddingModel    string
	VectorDB          string
	RetrieveConfig    *shared.RetrieveConfig
	EmbeddingConfig   *shared.EmbeddingConfig
	WordCount         int
	CreatedUID        string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

const (
	docFileTypeExternal   = "external"
	docFileTypeThirdParty = "third_platform"
)

// RuntimeRouteSnapshot 表示片段服务解析出的知识库路由快照。
type RuntimeRouteSnapshot struct {
	VectorCollectionName string
	TermCollectionName   string
	Model                string
	SparseBackend        string
}

// SnapshotKnowledgeBase 将知识库快照收敛为 fragment 使用的稳定副本。
func SnapshotKnowledgeBase(value *KnowledgeBaseRuntimeSnapshot) KnowledgeBaseRuntimeSnapshot {
	cloned := sharedsnapshot.CloneKnowledgeBaseRuntimeSnapshot(value)
	if cloned == nil {
		return KnowledgeBaseRuntimeSnapshot{}
	}
	sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(cloned)
	return *cloned
}

// SnapshotDocument 将文档快照收敛为 fragment 使用的稳定投影。
func SnapshotDocument(value *KnowledgeBaseDocument) *KnowledgeBaseDocument {
	if value == nil {
		return nil
	}

	docSnapshot := sharedsnapshot.CloneKnowledgeDocumentSnapshot(&value.KnowledgeDocumentSnapshot)
	if docSnapshot == nil {
		return nil
	}

	return &KnowledgeBaseDocument{
		KnowledgeDocumentSnapshot: *docSnapshot,
		DocumentFile:              snapshotDocumentFile(value.DocumentFile),
		ThirdPlatformType:         strings.TrimSpace(value.ThirdPlatformType),
		ThirdFileID:               strings.TrimSpace(value.ThirdFileID),
		SyncStatus:                value.SyncStatus,
		EmbeddingModel:            strings.TrimSpace(value.EmbeddingModel),
		VectorDB:                  strings.TrimSpace(value.VectorDB),
		RetrieveConfig:            shared.CloneRetrieveConfig(value.RetrieveConfig),
		EmbeddingConfig:           shared.CloneEmbeddingConfig(value.EmbeddingConfig),
		WordCount:                 value.WordCount,
		CreatedUID:                strings.TrimSpace(value.CreatedUID),
		CreatedAt:                 value.CreatedAt,
		UpdatedAt:                 value.UpdatedAt,
	}
}

func snapshotDocumentFile(value *DocumentFile) *DocumentFile {
	file := sharedsnapshot.CloneDocumentFile(value)
	if file == nil {
		return nil
	}
	file.Type = normalizeDocumentFileType(file.Type)
	file.Name = strings.TrimSpace(file.Name)
	file.URL = strings.TrimSpace(file.URL)
	file.FileKey = strings.TrimSpace(file.FileKey)
	file.Extension = filetype.NormalizeExtension(strings.TrimSpace(file.Extension))
	file.ThirdID = strings.TrimSpace(file.ThirdID)
	file.SourceType = strings.TrimSpace(file.SourceType)
	file.KnowledgeBaseID = strings.TrimSpace(file.KnowledgeBaseID)
	return file
}

// NewDocument 创建 fragment 领域内的知识库文档快照。
func NewDocument(
	knowledgeBaseCode string,
	name string,
	code string,
	docType int,
	createdUID string,
	organizationCode string,
) *KnowledgeBaseDocument {
	if code == "" {
		code = uuid.New().String()
	}
	now := time.Now()
	return &KnowledgeBaseDocument{
		KnowledgeDocumentSnapshot: sharedsnapshot.KnowledgeDocumentSnapshot{
			OrganizationCode:  strings.TrimSpace(organizationCode),
			KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
			Name:              strings.TrimSpace(name),
			Code:              code,
			DocType:           docType,
			DocMetadata:       map[string]any{},
			UpdatedUID:        strings.TrimSpace(createdUID),
		},
		SyncStatus: shared.SyncStatusPending,
		CreatedUID: strings.TrimSpace(createdUID),
		CreatedAt:  now,
		UpdatedAt:  now,
	}
}

// SnapshotRuntimeRoute 提取知识库运行时路由快照。
func SnapshotRuntimeRoute(kb *KnowledgeBaseRuntimeSnapshot) RuntimeRouteSnapshot {
	snapshot := SnapshotKnowledgeBase(kb)
	if snapshot.ResolvedRoute == nil {
		return RuntimeRouteSnapshot{}
	}
	return RuntimeRouteSnapshot{
		VectorCollectionName: strings.TrimSpace(snapshot.ResolvedRoute.VectorCollectionName),
		TermCollectionName:   strings.TrimSpace(snapshot.ResolvedRoute.TermCollectionName),
		Model:                strings.TrimSpace(snapshot.ResolvedRoute.Model),
		SparseBackend:        shared.NormalizeSparseBackend(snapshot.ResolvedRoute.SparseBackend),
	}
}

// ResolveKnowledgeBaseEmbeddingModel 解析知识库实际使用的 embedding model。
func ResolveKnowledgeBaseEmbeddingModel(kb *KnowledgeBaseRuntimeSnapshot) string {
	if route := SnapshotRuntimeRoute(kb); route.Model != "" {
		return route.Model
	}
	snapshot := SnapshotKnowledgeBase(kb)
	if snapshot.EmbeddingConfig != nil {
		if model := strings.TrimSpace(snapshot.EmbeddingConfig.ModelID); model != "" {
			return model
		}
	}
	return strings.TrimSpace(snapshot.Model)
}

// ResolveRuntimeRoute 归一化 fragment 运行时路由。
func ResolveRuntimeRoute(kb *KnowledgeBaseRuntimeSnapshot, defaultEmbeddingModel string) RuntimeRouteSnapshot {
	kbSnapshot := SnapshotKnowledgeBase(kb)
	route := SnapshotRuntimeRoute(kb)
	collection := constants.KnowledgeBaseCollectionName
	if route.VectorCollectionName == "" {
		route.VectorCollectionName = collection
	}
	if route.TermCollectionName == "" {
		route.TermCollectionName = route.VectorCollectionName
	}
	if route.Model == "" {
		route.Model = firstNonEmptyString(
			ResolveKnowledgeBaseEmbeddingModel(kb),
			strings.TrimSpace(defaultEmbeddingModel),
		)
	}
	if route.SparseBackend == "" && kbSnapshot.EmbeddingConfig != nil {
		route.SparseBackend = shared.NormalizeSparseBackend(route.SparseBackend)
	}
	return route
}

func normalizeDocumentFileType(v any) string {
	switch value := v.(type) {
	case string:
		normalized := strings.TrimSpace(strings.ToLower(value))
		switch normalized {
		case "1":
			return docFileTypeExternal
		case "2", "third-platform", "thirdplatform":
			return docFileTypeThirdParty
		default:
			return normalized
		}
	case float64:
		return normalizeDocumentFileType(int64(value))
	case int:
		return normalizeDocumentFileType(int64(value))
	case int64:
		switch value {
		case 1:
			return docFileTypeExternal
		case 2:
			return docFileTypeThirdParty
		default:
			return strconv.FormatInt(value, 10)
		}
	default:
		return ""
	}
}

// InferDocumentFileExtensionLight 尝试从文件快照中轻量推断扩展名。
func InferDocumentFileExtensionLight(file *DocumentFile) string {
	if file == nil {
		return ""
	}
	if ext := filetype.NormalizeExtension(file.Extension); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(strings.TrimSpace(file.Name)); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(strings.TrimSpace(file.URL)); ext != "" {
		return ext
	}
	return ""
}

func firstNonEmptyString(values ...string) string {
	for _, value := range values {
		if trimmed := strings.TrimSpace(value); trimmed != "" {
			return trimmed
		}
	}
	return ""
}
