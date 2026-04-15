package retrieval

const (
	// RetrievalPipelineVersionV1 标记检索管线版本。
	RetrievalPipelineVersionV1 PipelineVersion = "v1"

	lexicalScoreWeight        float64 = 0.06
	sparseScoreWeight         float64 = 0.04
	sectionPathScoreWeight    float64 = 0.04
	termCoverageScoreWeight   float64 = 0.08
	phraseScoreWeight         float64 = 0.10
	proximityScoreWeight      float64 = 0.03
	fieldMatchScoreWeight     float64 = 0.07
	titleMatchScoreWeight     float64 = 0.06
	tabularFieldScoreWeight   float64 = 0.02
	rerankPhraseBoost         float64 = 0.05
	rerankProximityBoost      float64 = 0.03
	rerankFieldBoost          float64 = 0.03
	rerankTitleBoost          float64 = 0.03
	minResultSupportScore     float64 = 0.2
	minShortQuerySupportScore float64 = 0.25
)

// SimilaritySearchOptions 相似度搜索增强参数。
type SimilaritySearchOptions struct {
	Filters    *SimilarityFilters
	HardFilter *VectorFilter
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
	Hard *VectorFilter
	Soft *VectorFilter
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
	LexicalNorm          float64 `json:"lexical_norm"`
	SparseNorm           float64 `json:"sparse_norm"`
	SectionPathMatch     float64 `json:"section_path_match"`
	TermCoverage         float64 `json:"term_coverage"`
	PhraseMatch          float64 `json:"phrase_match"`
	Proximity            float64 `json:"proximity"`
	TitleMatch           float64 `json:"title_match"`
	FieldMatch           float64 `json:"field_match"`
	TabularHit           float64 `json:"tabular_hit"`
	SupportScore         float64 `json:"support_score"`
	SecondaryRankScore   float64 `json:"secondary_rank_score"`
	DenseScore           float64 `json:"dense_score"`
	SparseScore          float64 `json:"sparse_score"`
	RRFScore             float64 `json:"rrf_score"`
	DenseCutoffThreshold float64 `json:"dense_cutoff_threshold"`
	DenseCutoffApplied   bool    `json:"dense_cutoff_applied"`
	RankingScore         float64 `json:"ranking_score"`
}
