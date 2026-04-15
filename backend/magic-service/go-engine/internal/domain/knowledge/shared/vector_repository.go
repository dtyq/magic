package shared

import (
	"context"
	"fmt"
	"strings"
)

const (
	// SparseBackendSelectionReasonExplicitRequested 表示显式指定的 backend 可直接使用。
	SparseBackendSelectionReasonExplicitRequested = "explicit_requested"
	// SparseBackendSelectionReasonCapabilityDefault 表示按当前 Qdrant 能力选择默认 backend。
	SparseBackendSelectionReasonCapabilityDefault = "capability_default"
	// SparseBackendSelectionReasonLegacyDefault 表示缺少能力选择器时沿用历史默认 backend。
	SparseBackendSelectionReasonLegacyDefault = "legacy_default"
	// SparseBackendSelectionReasonQueryPointsUnsupported 表示 Points.Query 不可用，降级为客户端 sparse backend。
	SparseBackendSelectionReasonQueryPointsUnsupported = "query_points_unsupported"
	// SparseBackendSelectionReasonQueryPointsProbeNotReady 表示能力探测未就绪，暂不允许使用依赖 Points.Query 的 backend。
	SparseBackendSelectionReasonQueryPointsProbeNotReady = "query_points_probe_not_ready"
)

// VectorDBCollectionRepository 定义集合管理能力。
type VectorDBCollectionRepository interface {
	CreateCollection(ctx context.Context, name string, vectorSize int64) error
	CollectionExists(ctx context.Context, name string) (bool, error)
	GetCollectionInfo(ctx context.Context, name string) (*VectorCollectionInfo, error)
	ListCollections(ctx context.Context) ([]string, error)
	DeleteCollection(ctx context.Context, name string) error
}

// VectorDBAliasRepository 定义 alias 管理能力。
type VectorDBAliasRepository interface {
	GetAliasTarget(ctx context.Context, alias string) (string, bool, error)
	EnsureAlias(ctx context.Context, alias, target string) error
	SwapAliasAtomically(ctx context.Context, alias, oldTarget, newTarget string) error
	DeleteAlias(ctx context.Context, alias string) error
}

// VectorDBPointDeletionRepository 定义点删除能力。
type VectorDBPointDeletionRepository interface {
	DeletePoint(ctx context.Context, collection, pointID string) error
	DeletePoints(ctx context.Context, collection string, pointIDs []string) error
	DeletePointsByFilter(ctx context.Context, collection string, filter *VectorFilter) error
}

// VectorDBManagementRepository 向量数据库管理接口。
type VectorDBManagementRepository interface {
	VectorDBCollectionRepository
	VectorDBAliasRepository
	VectorDBPointDeletionRepository
}

// VectorDBDataRepository 向量数据库数据接口。
type VectorDBDataRepository[T any] interface {
	StorePoint(ctx context.Context, collection, pointID string, vector []float64, payload T) error
	StoreHybridPoint(ctx context.Context, collection, pointID string, denseVector []float64, sparseInput *SparseInput, payload T) error
	StorePoints(ctx context.Context, collection string, pointIDs []string, vectors [][]float64, payloads []T) error
	StoreHybridPoints(ctx context.Context, collection string, pointIDs []string, denseVectors [][]float64, sparseInputs []*SparseInput, payloads []T) error
	SetPayloadByPointIDs(ctx context.Context, collection string, updates map[string]map[string]any) error
	ListExistingPointIDs(ctx context.Context, collection string, pointIDs []string) (map[string]struct{}, error)
	Search(ctx context.Context, collection string, vector []float64, topK int, scoreThreshold float64) ([]*VectorSearchResult[T], error)
	SearchWithFilter(ctx context.Context, collection string, vector []float64, topK int, scoreThreshold float64, filter *VectorFilter) ([]*VectorSearchResult[T], error)
	SearchDenseWithFilter(ctx context.Context, request DenseSearchRequest) ([]*VectorSearchResult[T], error)
	SearchSparseWithFilter(ctx context.Context, request SparseSearchRequest) ([]*VectorSearchResult[T], error)
}

// SparseBackendSelection 描述一次 sparse backend 选择结果。
type SparseBackendSelection struct {
	Requested      string `json:"requested,omitempty"`
	Effective      string `json:"effective,omitempty"`
	Reason         string `json:"reason,omitempty"`
	Version        string `json:"version,omitempty"`
	ProbeStatus    string `json:"probe_status,omitempty"`
	QuerySupported bool   `json:"query_supported"`
}

// FallbackApplied 表示本次选择对显式指定的 backend 做了降级或替换。
func (s SparseBackendSelection) FallbackApplied() bool {
	return s.Requested != "" && s.Effective != "" && s.Requested != s.Effective
}

// SparseBackendSelector 根据底层向量库能力选择有效 sparse backend。
type SparseBackendSelector interface {
	DefaultSparseBackend() SparseBackendSelection
	SelectSparseBackend(requested string) SparseBackendSelection
}

// VectorDimensionMismatchError 表示写入向量维度与集合配置不一致。
type VectorDimensionMismatchError struct {
	Collection string
	Expected   int64
	Actual     int64
	Index      int
}

func (e *VectorDimensionMismatchError) Error() string {
	return fmt.Sprintf("vector dimension mismatch in collection %s: expected %d, got %d (index %d)", e.Collection, e.Expected, e.Actual, e.Index)
}

// ActualDimension 返回实际写入的向量维度，供上层进行自动恢复判断。
func (e *VectorDimensionMismatchError) ActualDimension() int64 {
	if e == nil {
		return 0
	}
	return e.Actual
}

// NormalizeSparseBackend 归一化 sparse backend 标识。
func NormalizeSparseBackend(backend string) string {
	switch strings.TrimSpace(backend) {
	case SparseBackendClientBM25QdrantIDFV1:
		return SparseBackendClientBM25QdrantIDFV1
	case SparseBackendQdrantBM25ZHV1:
		return SparseBackendQdrantBM25ZHV1
	default:
		return ""
	}
}

// IsSupportedSparseBackend 判断 sparse backend 是否受支持。
func IsSupportedSparseBackend(backend string) bool {
	return NormalizeSparseBackend(backend) != ""
}

// ResolveSparseBackendSelection 统一处理显式配置与能力选择器的组合逻辑。
func ResolveSparseBackendSelection(selector SparseBackendSelector, requested string) SparseBackendSelection {
	normalized := NormalizeSparseBackend(requested)
	if normalized != "" {
		if selector == nil {
			return SparseBackendSelection{
				Requested: normalized,
				Effective: normalized,
				Reason:    SparseBackendSelectionReasonExplicitRequested,
			}
		}
		return selector.SelectSparseBackend(normalized)
	}
	if selector != nil {
		return selector.DefaultSparseBackend()
	}
	return SparseBackendSelection{
		Effective: SparseBackendQdrantBM25ZHV1,
		Reason:    SparseBackendSelectionReasonLegacyDefault,
	}
}
