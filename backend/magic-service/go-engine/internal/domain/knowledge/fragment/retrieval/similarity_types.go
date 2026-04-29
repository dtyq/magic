package retrieval

import "magic/internal/domain/knowledge/shared"

const (
	// RetrievalPipelineVersionV1 标记检索管线版本。
	RetrievalPipelineVersionV1 PipelineVersion = "v1"
)

// SimilaritySearchOptions 相似度搜索增强参数。
type SimilaritySearchOptions struct {
	Filters    *SimilarityFilters
	HardFilter *shared.VectorFilter
	Debug      bool
}

// PipelineVersion 表示检索管线版本号。
type PipelineVersion string

// SimilarityFilters 元数据过滤条件（可选）。
type SimilarityFilters struct {
	DocumentCodes []string
	DocumentTypes []int
	SectionPaths  []string
	SectionTitles []string
	SectionLevels []int
	Tags          []string
	TimeRange     *SimilarityTimeRange
}

// SimilarityTimeRange 时间范围过滤（Unix 秒）。
type SimilarityTimeRange struct {
	StartUnix int64
	EndUnix   int64
}

// QueryRewriteResult 查询改写结果。
type QueryRewriteResult struct {
	Original  string
	Rewritten string
	Used      []string
}

// FilterPlan 过滤计划（用于双阶段检索与调试）。
type FilterPlan struct {
	Hard *shared.VectorFilter
	Soft *shared.VectorFilter
}

// FilterPlanTrace 调试输出使用的过滤计划。
type FilterPlanTrace struct {
	Hard map[string]any `json:"hard"`
	Soft map[string]any `json:"soft,omitempty"`
}

// ScoreBreakdown 结果分项打分。
type ScoreBreakdown struct {
	FusionAlgorithm      string  `json:"fusion_algorithm"`
	HybridAlpha          float64 `json:"hybrid_alpha"`
	HybridScore          float64 `json:"hybrid_score"`
	HybridNorm           float64 `json:"hybrid_norm"`
	FusionScoreNorm      float64 `json:"fusion_score_norm"`
	DenseScoreNorm       float64 `json:"dense_score_norm"`
	LexicalNorm          float64 `json:"lexical_norm"`
	SparseNorm           float64 `json:"sparse_norm"`
	DenseContribution    float64 `json:"dense_contribution"`
	SparseContribution   float64 `json:"sparse_contribution"`
	SectionPathMatch     float64 `json:"section_path_match"`
	TermCoverage         float64 `json:"term_coverage"`
	PhraseMatch          float64 `json:"phrase_match"`
	Proximity            float64 `json:"proximity"`
	TitleMatch           float64 `json:"title_match"`
	FieldMatch           float64 `json:"field_match"`
	TabularHit           float64 `json:"tabular_hit"`
	SupportScore         float64 `json:"support_score"`
	SecondaryRankScore   float64 `json:"secondary_rank_score"`
	RerankScore          float64 `json:"rerank_score"`
	DenseScore           float64 `json:"dense_score"`
	SparseScore          float64 `json:"sparse_score"`
	RRFScore             float64 `json:"rrf_score"`
	RankingScore         float64 `json:"ranking_score"`
	QueryType            string  `json:"query_type"`
	ChannelPresence      string  `json:"channel_presence"`
	LegacyWeightUpgraded bool    `json:"legacy_weight_upgraded"`
}

// ChannelScore 表示某一召回通道的排序位次与原始通道分数。
type ChannelScore struct {
	Rank  *int    `json:"rank,omitempty"`
	Score float64 `json:"score"`
}

// BM25Query 表示 sparse/BM25 query 观察信息。
type BM25Query struct {
	Backend         string   `json:"backend"`
	RawQuery        string   `json:"raw_query"`
	QueryType       string   `json:"query_type"`
	SparseQueryText string   `json:"sparse_query_text"`
	CleanedTerms    []string `json:"cleaned_terms"`
	AlphaNumTerms   []string `json:"alpha_num_terms"`
	KeywordTerms    []string `json:"keyword_terms"`
	Terms           []string `json:"terms"`
}

// RankingDebug 表示调试场景下的排序细项。
type RankingDebug struct {
	QueryType      string         `json:"query_type"`
	RerankScore    float64        `json:"rerank_score"`
	SupportScore   float64        `json:"support_score"`
	ScoreBreakdown ScoreBreakdown `json:"score_breakdown"`
}

// Ranking 表示对外暴露的检索排序信息。
type Ranking struct {
	PipelineVersion      string        `json:"pipeline_version"`
	FusionAlgorithm      string        `json:"fusion_algorithm"`
	HybridAlpha          float64       `json:"hybrid_alpha"`
	ChannelPresence      string        `json:"channel_presence"`
	LegacyWeightUpgraded bool          `json:"legacy_weight_upgraded"`
	FusionScore          float64       `json:"fusion_score"`
	FusionScoreNorm      float64       `json:"fusion_score_norm"`
	RRFScore             float64       `json:"rrf_score"`
	Dense                *ChannelScore `json:"dense,omitempty"`
	Sparse               *ChannelScore `json:"sparse,omitempty"`
	BM25Query            BM25Query     `json:"bm25_query"`
	Debug                *RankingDebug `json:"debug,omitempty"`
}
