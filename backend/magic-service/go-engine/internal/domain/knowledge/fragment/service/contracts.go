package fragdomain

import (
	"context"

	"magic/internal/pkg/ctxmeta"
)

// EmbeddingService 定义 fragment 领域依赖的 embedding 能力。
type EmbeddingService interface {
	GetEmbedding(ctx context.Context, text, model string, businessParams *ctxmeta.BusinessParams) ([]float64, error)
	GetEmbeddings(ctx context.Context, texts []string, model string, businessParams *ctxmeta.BusinessParams) ([][]float64, error)
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
