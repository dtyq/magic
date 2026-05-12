// Package qdrant 提供 Qdrant 向量数据库的仓储实现
package qdrant

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	shared "magic/internal/domain/knowledge/shared"
)

var (
	// ErrInvalidVectorSize 表示向量维度无效。
	ErrInvalidVectorSize = errors.New("invalid vector size")
	// ErrVectorDimensionMismatch 表示向量维度与预期不一致。
	ErrVectorDimensionMismatch = errors.New("vector dimension mismatch")
)

// VectorDBManagementRepository Qdrant 向量数据库管理仓储实现
type VectorDBManagementRepository struct {
	client *Client
}

// NewVectorDBManagementRepository 创建向量数据库管理仓储
func NewVectorDBManagementRepository(client *Client) *VectorDBManagementRepository {
	return &VectorDBManagementRepository{client: client}
}

// VectorDBDataRepository Qdrant 向量数据库数据仓储实现
type VectorDBDataRepository[T any] struct {
	client *Client
}

// NewVectorDBDataRepository 创建向量数据库数据仓储
func NewVectorDBDataRepository[T any](client *Client) *VectorDBDataRepository[T] {
	return &VectorDBDataRepository[T]{client: client}
}

// DefaultSparseBackend 返回当前 Qdrant 能力对应的默认 sparse backend。
func (r *VectorDBManagementRepository) DefaultSparseBackend() shared.SparseBackendSelection {
	if r == nil || r.client == nil {
		return shared.ResolveSparseBackendSelection(nil, "")
	}
	return r.client.DefaultSparseBackend()
}

// SelectSparseBackend 返回显式请求的有效 sparse backend。
func (r *VectorDBManagementRepository) SelectSparseBackend(requested string) shared.SparseBackendSelection {
	if r == nil || r.client == nil {
		return shared.ResolveSparseBackendSelection(nil, requested)
	}
	return r.client.SelectSparseBackend(requested)
}

// DefaultSparseBackend 返回当前 Qdrant 能力对应的默认 sparse backend。
func (r *VectorDBDataRepository[T]) DefaultSparseBackend() shared.SparseBackendSelection {
	if r == nil || r.client == nil {
		return shared.ResolveSparseBackendSelection(nil, "")
	}
	return r.client.DefaultSparseBackend()
}

// SelectSparseBackend 返回显式请求的有效 sparse backend。
func (r *VectorDBDataRepository[T]) SelectSparseBackend(requested string) shared.SparseBackendSelection {
	if r == nil || r.client == nil {
		return shared.ResolveSparseBackendSelection(nil, requested)
	}
	return r.client.SelectSparseBackend(requested)
}

// CreateCollection 创建集合
func (r *VectorDBManagementRepository) CreateCollection(ctx context.Context, name string, vectorSize int64) error {
	return r.client.CreateCollection(ctx, name, vectorSize)
}

// CollectionExists 检查集合是否存在
func (r *VectorDBManagementRepository) CollectionExists(ctx context.Context, name string) (bool, error) {
	return r.client.CollectionExists(ctx, name)
}

// GetCollectionInfo 获取集合信息
func (r *VectorDBManagementRepository) GetCollectionInfo(ctx context.Context, name string) (*fragmodel.VectorCollectionInfo, error) {
	return r.client.GetCollectionInfo(ctx, name)
}

// EnsurePayloadIndexes 确保集合具备指定 payload 索引。
func (r *VectorDBManagementRepository) EnsurePayloadIndexes(ctx context.Context, name string, specs []shared.PayloadIndexSpec) error {
	return r.client.EnsurePayloadIndexes(ctx, name, specs)
}

// GetAliasTarget 查询 alias 当前指向的物理集合。
func (r *VectorDBManagementRepository) GetAliasTarget(ctx context.Context, alias string) (string, bool, error) {
	return r.client.GetAliasTarget(ctx, alias)
}

// EnsureAlias 确保 alias 指向目标物理集合。
func (r *VectorDBManagementRepository) EnsureAlias(ctx context.Context, alias, target string) error {
	return r.client.EnsureAlias(ctx, alias, target)
}

// SwapAliasAtomically 原子切换 alias。
func (r *VectorDBManagementRepository) SwapAliasAtomically(ctx context.Context, alias, oldTarget, newTarget string) error {
	return r.client.SwapAliasAtomically(ctx, alias, oldTarget, newTarget)
}

// DeleteAlias 删除 alias。
func (r *VectorDBManagementRepository) DeleteAlias(ctx context.Context, alias string) error {
	return r.client.DeleteAlias(ctx, alias)
}

// ListCollections 列出物理集合名称。
func (r *VectorDBManagementRepository) ListCollections(ctx context.Context) ([]string, error) {
	return r.client.ListCollections(ctx)
}

// DeleteCollection 删除集合
func (r *VectorDBManagementRepository) DeleteCollection(ctx context.Context, name string) error {
	return r.client.DeleteCollection(ctx, name)
}

// StorePoint 存储向量点
func (r *VectorDBDataRepository[T]) StorePoint(ctx context.Context, collection, pointID string, vector []float64, payload T) error {
	if err := r.ensureVectorDimension(ctx, collection, [][]float64{vector}); err != nil {
		return err
	}
	// 将 payload 转换为 map[string]any
	payloadMap, err := toMap(payload)
	if err != nil {
		return err
	}
	return r.client.StoreHybridPoint(ctx, collection, pointID, vector, nil, payloadMap)
}

// StoreHybridPoint 存储 dense+sparse 向量点。
func (r *VectorDBDataRepository[T]) StoreHybridPoint(ctx context.Context, collection, pointID string, denseVector []float64, sparseInput *fragmodel.SparseInput, payload T) error {
	if err := r.ensureVectorDimension(ctx, collection, [][]float64{denseVector}); err != nil {
		return err
	}
	payloadMap, err := toMap(payload)
	if err != nil {
		return err
	}
	return r.client.StoreHybridPoint(ctx, collection, pointID, denseVector, sparseInput, payloadMap)
}

// StorePoints 批量存储向量点
func (r *VectorDBDataRepository[T]) StorePoints(ctx context.Context, collection string, pointIDs []string, vectors [][]float64, payloads []T) error {
	if err := r.ensureVectorDimension(ctx, collection, vectors); err != nil {
		return err
	}
	payloadMaps := make([]map[string]any, len(payloads))
	for i, p := range payloads {
		m, err := toMap(p)
		if err != nil {
			return err
		}
		payloadMaps[i] = m
	}
	return r.client.StoreHybridPoints(ctx, collection, pointIDs, vectors, nil, payloadMaps)
}

// StoreHybridPoints 批量存储 dense+sparse 向量点。
func (r *VectorDBDataRepository[T]) StoreHybridPoints(ctx context.Context, collection string, pointIDs []string, denseVectors [][]float64, sparseInputs []*fragmodel.SparseInput, payloads []T) error {
	if err := r.ensureVectorDimension(ctx, collection, denseVectors); err != nil {
		return err
	}
	payloadMaps := make([]map[string]any, len(payloads))
	for i, p := range payloads {
		m, err := toMap(p)
		if err != nil {
			return err
		}
		payloadMaps[i] = m
	}
	return r.client.StoreHybridPoints(ctx, collection, pointIDs, denseVectors, sparseInputs, payloadMaps)
}

// SetPayloadByPointIDs 按 point_id 局部更新 payload。
func (r *VectorDBDataRepository[T]) SetPayloadByPointIDs(
	ctx context.Context,
	collection string,
	updates map[string]map[string]any,
) error {
	return r.client.SetPayloadByPointIDs(ctx, collection, updates)
}

// ListExistingPointIDs 批量查询已存在的点 ID。
func (r *VectorDBDataRepository[T]) ListExistingPointIDs(ctx context.Context, collection string, pointIDs []string) (map[string]struct{}, error) {
	return r.client.ListExistingPointIDs(ctx, collection, pointIDs)
}

// ListPointIDsByFilter 根据过滤条件批量枚举 point_id。
func (r *VectorDBDataRepository[T]) ListPointIDsByFilter(
	ctx context.Context,
	collection string,
	filter *fragmodel.VectorFilter,
	limit int,
) ([]string, error) {
	return r.client.ListPointIDsByFilter(ctx, collection, filter, limit)
}

// DeletePoint 删除向量点
func (r *VectorDBManagementRepository) DeletePoint(ctx context.Context, collection, pointID string) error {
	return r.client.DeletePoint(ctx, collection, pointID)
}

// DeletePoints 批量删除向量点。
func (r *VectorDBManagementRepository) DeletePoints(ctx context.Context, collection string, pointIDs []string) error {
	return r.client.DeletePoints(ctx, collection, pointIDs)
}

// DeletePointsByFilter 根据过滤条件删除向量点
func (r *VectorDBManagementRepository) DeletePointsByFilter(ctx context.Context, collection string, filter *fragmodel.VectorFilter) error {
	return r.client.DeletePointsByFilter(ctx, collection, filter)
}

// Search 相似度搜索
func (r *VectorDBDataRepository[T]) Search(ctx context.Context, collection string, vector []float64, topK int, scoreThreshold float64) ([]*fragmodel.VectorSearchResult[T], error) {
	results, err := r.client.SearchDenseWithFilter(ctx, fragmodel.DenseSearchRequest{
		Collection:     collection,
		VectorName:     fragmodel.DefaultDenseVectorName,
		Vector:         vector,
		TopK:           topK,
		ScoreThreshold: scoreThreshold,
	})
	if err != nil {
		return nil, err
	}

	return convertResults[T](results)
}

// SearchWithFilter 带过滤条件的相似度搜索
func (r *VectorDBDataRepository[T]) SearchWithFilter(ctx context.Context, collection string, vector []float64, topK int, scoreThreshold float64, filter *fragmodel.VectorFilter) ([]*fragmodel.VectorSearchResult[T], error) {
	results, err := r.client.SearchDenseWithFilter(ctx, fragmodel.DenseSearchRequest{
		Collection:     collection,
		VectorName:     fragmodel.DefaultDenseVectorName,
		Vector:         vector,
		TopK:           topK,
		ScoreThreshold: scoreThreshold,
		Filter:         filter,
	})
	if err != nil {
		return nil, err
	}

	return convertResults[T](results)
}

// SearchDenseWithFilter 使用命名 dense vector 执行检索。
func (r *VectorDBDataRepository[T]) SearchDenseWithFilter(ctx context.Context, request fragmodel.DenseSearchRequest) ([]*fragmodel.VectorSearchResult[T], error) {
	results, err := r.client.SearchDenseWithFilter(ctx, request)
	if err != nil {
		return nil, err
	}

	return convertResults[T](results)
}

// SearchSparseWithFilter 使用命名 sparse vector 执行检索。
func (r *VectorDBDataRepository[T]) SearchSparseWithFilter(ctx context.Context, request fragmodel.SparseSearchRequest) ([]*fragmodel.VectorSearchResult[T], error) {
	results, err := r.client.SearchSparseWithFilter(ctx, request)
	if err != nil {
		return nil, err
	}

	return convertResults[T](results)
}

func (r *VectorDBDataRepository[T]) ensureVectorDimension(ctx context.Context, collection string, vectors [][]float64) error {
	info, err := r.client.GetCollectionInfo(ctx, collection)
	if err != nil {
		return err
	}
	if info == nil || info.VectorSize <= 0 {
		return fmt.Errorf("collection %s: %w", collection, ErrInvalidVectorSize)
	}
	expected := info.VectorSize
	for i, vector := range vectors {
		if int64(len(vector)) != expected {
			detail := &fragmodel.VectorDimensionMismatchError{
				Collection: collection,
				Expected:   expected,
				Actual:     int64(len(vector)),
				Index:      i,
			}
			return errors.Join(ErrVectorDimensionMismatch, detail)
		}
	}
	return nil
}

func convertResults[T any](results []*SimilarityResult) ([]*fragmodel.VectorSearchResult[T], error) {
	repoResults := make([]*fragmodel.VectorSearchResult[T], len(results))
	for i, r := range results {
		var payload T
		if err := fromMap(r.Payload, &payload); err != nil {
			return nil, err
		}
		repoResults[i] = &fragmodel.VectorSearchResult[T]{
			ID:       r.ID,
			Score:    r.Score,
			Payload:  payload,
			Content:  r.Content,
			Metadata: r.Metadata,
		}
	}
	return repoResults, nil
}

func toMap(v any) (map[string]any, error) {
	b, err := json.Marshal(v)
	if err != nil {
		return nil, fmt.Errorf("marshal failed: %w", err)
	}
	var m map[string]any
	if err := json.Unmarshal(b, &m); err != nil {
		return nil, fmt.Errorf("unmarshal failed: %w", err)
	}
	return m, nil
}

func fromMap(m map[string]any, v any) error {
	b, err := json.Marshal(m)
	if err != nil {
		return fmt.Errorf("marshal failed: %w", err)
	}
	if err := json.Unmarshal(b, v); err != nil {
		return fmt.Errorf("unmarshal failed: %w", err)
	}
	return nil
}
