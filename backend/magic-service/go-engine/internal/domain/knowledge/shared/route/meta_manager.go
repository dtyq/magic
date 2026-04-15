package sharedroute

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"magic/internal/domain/knowledge/shared"
)

var (
	// ErrCollectionMetaReaderNotConfigured 表示缺少集合元数据读取依赖。
	ErrCollectionMetaReaderNotConfigured = errors.New("collection meta reader is not configured")
	// ErrCollectionMetaWriterNotConfigured 表示缺少集合元数据写入依赖。
	ErrCollectionMetaWriterNotConfigured = errors.New("collection meta writer is not configured")
	// ErrCollectionMetaCollectionNameRequired 表示集合元数据缺少逻辑集合名。
	ErrCollectionMetaCollectionNameRequired = errors.New("collection meta collection name is required")
	// ErrCollectionMetaModelRequired 表示集合元数据缺少模型信息。
	ErrCollectionMetaModelRequired = errors.New("collection meta model is required")
	// ErrCollectionMetaVectorDimensionInvalid 表示集合元数据向量维度非法。
	ErrCollectionMetaVectorDimensionInvalid = errors.New("collection meta vector dimension must be positive")
	// ErrCollectionMetaSparseBackendInvalid 表示集合元数据 sparse backend 非法。
	ErrCollectionMetaSparseBackendInvalid = errors.New("collection meta sparse backend is invalid")
)

// CollectionMetaManager 负责读写共享 collection 元数据。
type CollectionMetaManager struct {
	reader CollectionMetaReader
	writer CollectionMetaWriter
}

// NewCollectionMetaManager 创建共享 collection 元数据协调器。
func NewCollectionMetaManager(reader CollectionMetaReader, writer CollectionMetaWriter) *CollectionMetaManager {
	return &CollectionMetaManager{
		reader: reader,
		writer: writer,
	}
}

// EnsureInitialized 仅在元数据缺失时补写共享 collection 元数据。
func (m *CollectionMetaManager) EnsureInitialized(ctx context.Context, meta CollectionMeta) error {
	if m == nil || m.reader == nil {
		return ErrCollectionMetaReaderNotConfigured
	}
	current, err := m.reader.GetCollectionMeta(ctx)
	if err != nil {
		return fmt.Errorf("read collection meta: %w", err)
	}
	if current.Exists {
		return nil
	}
	return m.Upsert(ctx, meta)
}

// Upsert 用最新状态覆盖共享 collection 元数据。
func (m *CollectionMetaManager) Upsert(ctx context.Context, meta CollectionMeta) error {
	if m == nil || m.writer == nil {
		return ErrCollectionMetaWriterNotConfigured
	}
	normalized, err := normalizeCollectionMeta(meta)
	if err != nil {
		return err
	}
	if err := m.writer.UpsertCollectionMeta(ctx, normalized); err != nil {
		return fmt.Errorf("upsert collection meta: %w", err)
	}
	return nil
}

func normalizeCollectionMeta(meta CollectionMeta) (CollectionMeta, error) {
	normalized := CollectionMeta{
		CollectionName:         strings.TrimSpace(meta.CollectionName),
		PhysicalCollectionName: strings.TrimSpace(meta.PhysicalCollectionName),
		Model:                  strings.TrimSpace(meta.Model),
		VectorDimension:        meta.VectorDimension,
		SparseBackend:          shared.NormalizeSparseBackend(meta.SparseBackend),
		Exists:                 true,
	}

	if normalized.CollectionName == "" {
		return CollectionMeta{}, ErrCollectionMetaCollectionNameRequired
	}
	if normalized.PhysicalCollectionName == "" {
		normalized.PhysicalCollectionName = normalized.CollectionName
	}
	if normalized.Model == "" {
		return CollectionMeta{}, ErrCollectionMetaModelRequired
	}
	if normalized.VectorDimension <= 0 {
		return CollectionMeta{}, ErrCollectionMetaVectorDimensionInvalid
	}
	if normalized.SparseBackend == "" {
		return CollectionMeta{}, ErrCollectionMetaSparseBackendInvalid
	}
	return normalized, nil
}
