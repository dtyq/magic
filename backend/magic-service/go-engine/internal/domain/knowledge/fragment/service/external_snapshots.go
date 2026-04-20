package fragdomain

import (
	"context"
	"maps"
	"reflect"
	"strconv"
	"strings"
	"time"

	"github.com/google/uuid"

	"magic/internal/constants"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/filetype"
	"magic/pkg/convert"
)

const (
	docFileTypeExternal   = "external"
	docFileTypeThirdParty = "third_platform"
)

// EmbeddingService 定义 fragment 领域依赖的 embedding 能力。
type EmbeddingService interface {
	GetEmbedding(ctx context.Context, text, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error)
	GetEmbeddings(ctx context.Context, texts []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error)
}

// KnowledgeBaseRuntimeSnapshot 复用共享知识库运行时快照。
type KnowledgeBaseRuntimeSnapshot = sharedsnapshot.KnowledgeBaseRuntimeSnapshot

// File 复用共享文档文件快照。
type File = sharedsnapshot.DocumentFile

type runtimeRouteSnapshot struct {
	VectorCollectionName string
	TermCollectionName   string
	Model                string
	SparseBackend        string
}

// KnowledgeBaseDocument 是 fragment 子域消费的文档快照。
type KnowledgeBaseDocument struct {
	OrganizationCode  string
	KnowledgeBaseCode string
	Name              string
	Code              string
	DocType           int
	DocMetadata       map[string]any
	DocumentFile      *File
	ThirdPlatformType string
	ThirdFileID       string
	SyncStatus        shared.SyncStatus
	EmbeddingModel    string
	VectorDB          string
	RetrieveConfig    *shared.RetrieveConfig
	FragmentConfig    *shared.FragmentConfig
	EmbeddingConfig   *shared.EmbeddingConfig
	WordCount         int
	CreatedUID        string
	UpdatedUID        string
	CreatedAt         time.Time
	UpdatedAt         time.Time
}

// PreviewSegmentConfig 表示 fragment 侧预览/切片配置。
type PreviewSegmentConfig struct {
	ChunkSize          int
	ChunkOverlap       int
	Separator          string
	TextPreprocessRule []int
}

// TokenChunk 表示本地切片结果。
type TokenChunk struct {
	Content            string
	TokenCount         int
	SectionPath        string
	SectionLevel       int
	SectionTitle       string
	TreeNodeID         string
	ParentNodeID       string
	SectionChunkIndex  int
	EffectiveSplitMode string
	HierarchyDetector  string
	Metadata           map[string]any
}

func snapshotKnowledgeBase(value any) KnowledgeBaseRuntimeSnapshot {
	var snapshot KnowledgeBaseRuntimeSnapshot
	root := indirectValue(reflect.ValueOf(value))
	if !root.IsValid() {
		return KnowledgeBaseRuntimeSnapshot{}
	}

	snapshot.Code = fieldString(root, "Code")
	snapshot.Name = fieldString(root, "Name")
	snapshot.OrganizationCode = fieldString(root, "OrganizationCode")
	snapshot.Model = fieldString(root, "Model")
	snapshot.VectorDB = fieldString(root, "VectorDB")
	snapshot.RetrieveConfig = fieldRetrieveConfig(root, "RetrieveConfig")
	snapshot.FragmentConfig = fieldFragmentConfig(root, "FragmentConfig")
	snapshot.EmbeddingConfig = fieldEmbeddingConfig(root, "EmbeddingConfig")
	sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(&snapshot)
	return snapshot
}

func snapshotDocument(value any) *KnowledgeBaseDocument {
	root := indirectValue(reflect.ValueOf(value))
	if !root.IsValid() {
		return nil
	}
	return &KnowledgeBaseDocument{
		OrganizationCode:  fieldString(root, "OrganizationCode"),
		KnowledgeBaseCode: fieldString(root, "KnowledgeBaseCode"),
		Name:              fieldString(root, "Name"),
		Code:              fieldString(root, "Code"),
		DocType:           fieldInt(root, "DocType"),
		DocMetadata:       cloneMap(fieldMap(root, "DocMetadata")),
		DocumentFile:      snapshotDocumentFile(fieldValue(root, "DocumentFile").Interface()),
		ThirdPlatformType: fieldString(root, "ThirdPlatformType"),
		ThirdFileID:       fieldString(root, "ThirdFileID"),
		SyncStatus:        shared.SyncStatus(fieldInt(root, "SyncStatus")),
		EmbeddingModel:    fieldString(root, "EmbeddingModel"),
		VectorDB:          fieldString(root, "VectorDB"),
		RetrieveConfig:    fieldRetrieveConfig(root, "RetrieveConfig"),
		FragmentConfig:    fieldFragmentConfig(root, "FragmentConfig"),
		EmbeddingConfig:   fieldEmbeddingConfig(root, "EmbeddingConfig"),
		WordCount:         fieldInt(root, "WordCount"),
		CreatedUID:        fieldString(root, "CreatedUID"),
		UpdatedUID:        fieldString(root, "UpdatedUID"),
		CreatedAt:         fieldTime(root, "CreatedAt"),
		UpdatedAt:         fieldTime(root, "UpdatedAt"),
	}
}

func snapshotDocumentFile(value any) *File {
	root := indirectValue(reflect.ValueOf(value))
	if !root.IsValid() {
		return nil
	}
	return &File{
		Type:            normalizeDocumentFileType(fieldAny(root, "Type")),
		Name:            strings.TrimSpace(fieldString(root, "Name")),
		URL:             strings.TrimSpace(fieldString(root, "URL")),
		FileKey:         strings.TrimSpace(fieldString(root, "FileKey")),
		Size:            fieldInt64(root, "Size"),
		Extension:       filetype.NormalizeExtension(strings.TrimSpace(fieldString(root, "Extension"))),
		ThirdID:         strings.TrimSpace(fieldString(root, "ThirdID")),
		SourceType:      strings.TrimSpace(fieldString(root, "SourceType")),
		KnowledgeBaseID: strings.TrimSpace(fieldString(root, "KnowledgeBaseID")),
	}
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
		OrganizationCode:  strings.TrimSpace(organizationCode),
		KnowledgeBaseCode: strings.TrimSpace(knowledgeBaseCode),
		Name:              strings.TrimSpace(name),
		Code:              code,
		DocType:           docType,
		SyncStatus:        shared.SyncStatusPending,
		CreatedUID:        strings.TrimSpace(createdUID),
		UpdatedUID:        strings.TrimSpace(createdUID),
		CreatedAt:         now,
		UpdatedAt:         now,
		DocMetadata:       map[string]any{},
	}
}

func resolveKnowledgeBaseEmbeddingModel(kb any) string {
	if route := snapshotRuntimeRoute(kb); route.Model != "" {
		return route.Model
	}
	snapshot := snapshotKnowledgeBase(kb)
	if snapshot.EmbeddingConfig != nil {
		if model := strings.TrimSpace(snapshot.EmbeddingConfig.ModelID); model != "" {
			return model
		}
	}
	return strings.TrimSpace(snapshot.Model)
}

func snapshotRuntimeRoute(kb any) runtimeRouteSnapshot {
	root := indirectValue(reflect.ValueOf(kb))
	if !root.IsValid() {
		return runtimeRouteSnapshot{}
	}
	routeValue := fieldValue(root, "ResolvedRoute")
	route := indirectValue(routeValue)
	if !route.IsValid() {
		return runtimeRouteSnapshot{}
	}
	return runtimeRouteSnapshot{
		VectorCollectionName: fieldString(route, "VectorCollectionName"),
		TermCollectionName:   fieldString(route, "TermCollectionName"),
		Model:                fieldString(route, "Model"),
		SparseBackend:        shared.NormalizeSparseBackend(fieldString(route, "SparseBackend")),
	}
}

func resolveFragmentRuntimeRoute(kb any, defaultEmbeddingModel string) runtimeRouteSnapshot {
	kbSnapshot := snapshotKnowledgeBase(kb)
	route := snapshotRuntimeRoute(kb)
	collection := constants.KnowledgeBaseCollectionName
	if route.VectorCollectionName == "" {
		route.VectorCollectionName = collection
	}
	if route.TermCollectionName == "" {
		route.TermCollectionName = route.VectorCollectionName
	}
	if route.Model == "" {
		route.Model = firstNonEmptyString(
			resolveKnowledgeBaseEmbeddingModel(kb),
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
func InferDocumentFileExtensionLight(file *File) string {
	if file == nil {
		return ""
	}
	if ext := filetype.NormalizeExtension(file.Extension); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(file.Name); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(file.URL); ext != "" {
		return ext
	}
	if ext := filetype.ExtractExtension(file.FileKey); ext != "" {
		return ext
	}
	return ""
}

func cloneMap(input map[string]any) map[string]any {
	if len(input) == 0 {
		return map[string]any{}
	}
	output := make(map[string]any, len(input))
	maps.Copy(output, input)
	return output
}

func indirectValue(value reflect.Value) reflect.Value {
	for value.IsValid() && value.Kind() == reflect.Pointer {
		if value.IsNil() {
			return reflect.Value{}
		}
		value = value.Elem()
	}
	return value
}

func fieldValue(root reflect.Value, name string) reflect.Value {
	if !root.IsValid() || root.Kind() != reflect.Struct {
		return reflect.Value{}
	}
	return root.FieldByName(name)
}

func fieldAny(root reflect.Value, name string) any {
	value := fieldValue(root, name)
	if !value.IsValid() || !value.CanInterface() {
		return nil
	}
	return value.Interface()
}

func fieldString(root reflect.Value, name string) string {
	value := fieldValue(root, name)
	if !value.IsValid() || value.Kind() != reflect.String {
		return ""
	}
	return value.String()
}

func fieldInt(root reflect.Value, name string) int {
	value := fieldValue(root, name)
	if !value.IsValid() {
		return 0
	}
	switch value.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return int(value.Int())
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return clampUintToInt(value.Uint())
	default:
		return 0
	}
}

func fieldInt64(root reflect.Value, name string) int64 {
	value := fieldValue(root, name)
	if !value.IsValid() {
		return 0
	}
	switch value.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return value.Int()
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return clampUintToInt64(value.Uint())
	default:
		return 0
	}
}

func fieldTime(root reflect.Value, name string) time.Time {
	value := fieldValue(root, name)
	if !value.IsValid() || !value.CanInterface() {
		return time.Time{}
	}
	if result, ok := value.Interface().(time.Time); ok {
		return result
	}
	return time.Time{}
}

func fieldMap(root reflect.Value, name string) map[string]any {
	value := fieldValue(root, name)
	if !value.IsValid() || !value.CanInterface() {
		return nil
	}
	if result, ok := value.Interface().(map[string]any); ok {
		return result
	}
	return nil
}

func fieldRetrieveConfig(root reflect.Value, name string) *shared.RetrieveConfig {
	value := fieldValue(root, name)
	if !value.IsValid() || !value.CanInterface() {
		return nil
	}
	result, ok := value.Interface().(*shared.RetrieveConfig)
	if !ok {
		return nil
	}
	return result
}

func fieldFragmentConfig(root reflect.Value, name string) *shared.FragmentConfig {
	value := fieldValue(root, name)
	if !value.IsValid() || !value.CanInterface() {
		return nil
	}
	result, ok := value.Interface().(*shared.FragmentConfig)
	if !ok {
		return nil
	}
	return result
}

func fieldEmbeddingConfig(root reflect.Value, name string) *shared.EmbeddingConfig {
	value := fieldValue(root, name)
	if !value.IsValid() || !value.CanInterface() {
		return nil
	}
	result, ok := value.Interface().(*shared.EmbeddingConfig)
	if !ok {
		return nil
	}
	return result
}

func clampUintToInt(value uint64) int {
	converted, err := convert.SafeUint64ToInt(value, "value")
	if err != nil {
		return int(^uint(0) >> 1)
	}
	return converted
}

func clampUintToInt64(value uint64) int64 {
	const maxInt64 = int64(^uint64(0) >> 1)
	if value > uint64(maxInt64) {
		return maxInt64
	}
	return int64(value)
}
