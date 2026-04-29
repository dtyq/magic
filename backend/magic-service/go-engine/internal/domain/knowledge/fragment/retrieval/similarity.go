package retrieval

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	"golang.org/x/sync/errgroup"

	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/logkey"
)

const (
	maxCandidateTopK               = 180
	similaritySearchMaxConcurrency = 4
	shortQueryMaxRuneCount         = 4
	defaultDenseCandidateThreshold = 0.10
)

type scoredResult struct {
	index           int
	hybridScore     float64
	denseScore      float64
	sparseScore     float64
	fusionScoreNorm float64
	channelPresence string
	finalScore      float64
	stableKey       string
}

type candidateAnalysisSnapshot struct {
	fieldTexts           []retrievalFieldText
	normalizedFieldTexts []string
	docTokens            []string
	docTokenSet          map[string]struct{}
	docTermFrequency     map[string]int
	tokenPositions       map[string][]int
	fieldTokenHits       map[string]map[string]struct{}
	sectionPathTokens    []string
}

type similaritySearchTrace struct {
	UsedQueries      []string
	RewrittenQuery   string
	AppliedFilter    FilterPlanTrace
	PipelineVersion  PipelineVersion
	DenseOnly        bool
	SparseBackend    string
	QueryType        string
	QueryProfile     similarityQueryProfile
	TokenPolicyDebug map[string]any
}

type similarityResultOptions struct {
	ResultScoreThreshold float64
	SearchOptions        *SimilaritySearchOptions
	Trace                similaritySearchTrace
}

// SimilarityRequest 相似度检索请求参数。
type SimilarityRequest struct {
	Query                   string
	EmbeddingQuery          string
	TopK                    int
	CandidateScoreThreshold float64
	ResultScoreThreshold    float64
	BusinessParams          *ctxmeta.BusinessParams
	Options                 *SimilaritySearchOptions
}

type similaritySearchContext struct {
	request                  SimilarityRequest
	vectorCollectionName     string
	termCollectionName       string
	model                    string
	sparseBackend            string
	queryProfile             similarityQueryProfile
	rewrite                  QueryRewriteResult
	filterPlan               FilterPlan
	hybrid                   hybridSearchConfig
	denseCandidateThreshold  float64
	sparseCandidateThreshold float64
	denseOnly                bool
}

type similaritySingleQueryInput struct {
	VectorCollectionName          string
	TermCollectionName            string
	Model                         string
	SparseBackend                 string
	QueryProfile                  similarityQueryProfile
	Hybrid                        hybridSearchConfig
	DenseCandidateScoreThreshold  float64
	SparseCandidateScoreThreshold float64
	Filter                        *shared.VectorFilter
	BusinessParams                *ctxmeta.BusinessParams
	DenseOnly                     bool
}

// Similarity 相似度搜索
func (s *Service) Similarity(
	ctx context.Context,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	req SimilarityRequest,
) ([]*fragmodel.SimilarityResult, error) {
	if err := s.ensureRuntimeReady(ctx); err != nil {
		return nil, fmt.Errorf("prepare retrieval runtime: %w", err)
	}
	kbSnapshot := sharedsnapshot.CloneKnowledgeBaseRuntimeSnapshot(kb)
	if kbSnapshot == nil {
		kbSnapshot = &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{}
	}
	sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kbSnapshot)
	candidateSearchStartedAt := time.Now()
	results, trace, err := s.searchSimilarityCandidates(ctx, kbSnapshot, req)
	if err != nil {
		return nil, err
	}
	s.logSimilarityStage(ctx, "Knowledge similarity candidate search completed", candidateSearchStartedAt, []any{
		"candidate_count", len(results),
		"top_k", req.TopK,
		"query_type", trace.QueryType,
	})
	scored := s.scoreSimilarityResults(ctx, trace.QueryProfile, results, *kbSnapshot, req.TopK, similarityResultOptions{
		ResultScoreThreshold: req.ResultScoreThreshold,
		SearchOptions:        req.Options,
		Trace:                trace,
	})
	return scored, nil
}

func (s *Service) searchSimilarityCandidates(
	ctx context.Context,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	req SimilarityRequest,
) ([]*shared.VectorSearchResult[fragmodel.FragmentPayload], similaritySearchTrace, error) {
	searchCtx := s.buildSimilaritySearchContext(ctx, kb, req)
	if len(searchCtx.rewrite.Used) == 0 {
		return nil, similaritySearchTrace{}, nil
	}

	trace := similaritySearchTrace{
		UsedQueries:     searchCtx.rewrite.Used,
		RewrittenQuery:  searchCtx.rewrite.Rewritten,
		PipelineVersion: RetrievalPipelineVersionV1,
		DenseOnly:       searchCtx.denseOnly,
		SparseBackend:   searchCtx.sparseBackend,
		QueryType:       searchCtx.queryProfile.QueryType,
		QueryProfile:    searchCtx.queryProfile,
		AppliedFilter: FilterPlanTrace{
			Hard: vectorFilterDebugView(searchCtx.filterPlan.Hard),
			Soft: vectorFilterDebugView(searchCtx.filterPlan.Soft),
		},
	}
	if req.Options != nil && req.Options.Debug {
		trace.TokenPolicyDebug = s.buildTokenPolicyDebug(searchCtx.queryProfile.RawQuery)
	}

	results, err := s.runEnhancedSimilaritySearch(ctx, searchCtx)
	if err != nil {
		return nil, similaritySearchTrace{}, err
	}
	return results, trace, nil
}

func (s *Service) buildSimilaritySearchContext(
	ctx context.Context,
	kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	req SimilarityRequest,
) similaritySearchContext {
	resolvedRoute := resolveRuntimeRoute(ctx, s.metaReader, s.sparseBackendSelector, s.logger, kb, s.defaultEmbeddingModel)
	kbSnapshot := sharedsnapshot.CloneKnowledgeBaseRuntimeSnapshot(kb)
	if kbSnapshot == nil {
		kbSnapshot = &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{}
	}
	sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(kbSnapshot)
	var explicitFilters *SimilarityFilters
	if req.Options != nil {
		explicitFilters = req.Options.Filters
	}
	analyzer := s.newRetrievalAnalyzer()
	profileQuery := resolveProfileQuery(req)
	queryProfile := buildSimilarityQueryProfile(profileQuery, resolveEmbeddingQuery(req), analyzer)
	return similaritySearchContext{
		request: req,
		// dense recall 与 sparse recall 都必须消费同一份运行时路由，避免 term namespace 和物理集合漂移。
		vectorCollectionName:     resolvedRoute.VectorCollectionName,
		termCollectionName:       resolvedRoute.TermCollectionName,
		model:                    resolvedRoute.Model,
		sparseBackend:            resolvedRoute.SparseBackend,
		queryProfile:             queryProfile,
		rewrite:                  buildQueryVariants(queryProfile.RawQuery),
		filterPlan:               mergeSimilarityHardFilter(buildFilterPlan(*kbSnapshot, explicitFilters, queryProfile.RawQuery), req.Options),
		hybrid:                   resolveHybridSearchConfig(req.TopK, *kbSnapshot),
		denseCandidateThreshold:  resolveDenseCandidateScoreThreshold(req.CandidateScoreThreshold),
		sparseCandidateThreshold: resolveSparseCandidateScoreThreshold(),
		denseOnly:                shouldUseDenseOnlySimilarityQuery(queryProfile.RawQuery, analyzer) || !supportsSparseBackend(resolvedRoute.SparseBackend),
	}
}

func mergeSimilarityHardFilter(plan FilterPlan, options *SimilaritySearchOptions) FilterPlan {
	if options == nil || options.HardFilter == nil {
		return plan
	}
	plan.Hard = mergeVectorFilters(plan.Hard, options.HardFilter)
	return plan
}

func (s *Service) runEnhancedSimilaritySearch(
	ctx context.Context,
	searchCtx similaritySearchContext,
) ([]*shared.VectorSearchResult[fragmodel.FragmentPayload], error) {
	primaryFilter := mergeVectorFilters(searchCtx.filterPlan.Hard, searchCtx.filterPlan.Soft)
	candidateCap := max(searchCtx.hybrid.DenseTopK, searchCtx.hybrid.SparseTopK)
	s.logCandidateSearchConfig(ctx, searchCtx, candidateCap)
	mergedResults := make(map[string]*shared.VectorSearchResult[fragmodel.FragmentPayload], candidateCap)

	passOne, err := s.searchSingleSimilarityQuery(ctx, similaritySingleQueryInput{
		VectorCollectionName:          searchCtx.vectorCollectionName,
		TermCollectionName:            searchCtx.termCollectionName,
		Model:                         searchCtx.model,
		SparseBackend:                 searchCtx.sparseBackend,
		QueryProfile:                  searchCtx.queryProfile,
		Hybrid:                        searchCtx.hybrid,
		DenseCandidateScoreThreshold:  searchCtx.denseCandidateThreshold,
		SparseCandidateScoreThreshold: searchCtx.sparseCandidateThreshold,
		Filter:                        primaryFilter,
		BusinessParams:                searchCtx.request.BusinessParams,
		DenseOnly:                     searchCtx.denseOnly,
	})
	if err != nil {
		return nil, err
	}
	mergeSimilarityResults(mergedResults, passOne)

	needMore := len(mergedResults) < max(searchCtx.request.TopK/2, 1)
	if needMore && searchCtx.filterPlan.Soft != nil {
		// 第二轮仅放宽 soft filter，不改变当前 query 是否需要 sparse 的判定。
		passTwo, searchErr := s.searchSingleSimilarityQuery(ctx, similaritySingleQueryInput{
			VectorCollectionName:          searchCtx.vectorCollectionName,
			TermCollectionName:            searchCtx.termCollectionName,
			Model:                         searchCtx.model,
			SparseBackend:                 searchCtx.sparseBackend,
			QueryProfile:                  searchCtx.queryProfile,
			Hybrid:                        searchCtx.hybrid,
			DenseCandidateScoreThreshold:  searchCtx.denseCandidateThreshold,
			SparseCandidateScoreThreshold: searchCtx.sparseCandidateThreshold,
			Filter:                        searchCtx.filterPlan.Hard,
			BusinessParams:                searchCtx.request.BusinessParams,
			DenseOnly:                     searchCtx.denseOnly,
		})
		if searchErr != nil {
			return nil, searchErr
		}
		mergeSimilarityResults(mergedResults, passTwo)
	}

	return collectSimilarityResults(mergedResults), nil
}

func (s *Service) logSimilarityStage(ctx context.Context, msg string, startedAt time.Time, fields []any) {
	if s == nil || s.logger == nil || startedAt.IsZero() {
		return
	}
	keyvals := make([]any, 0, len(fields)+2)
	keyvals = append(keyvals, logkey.DurationMS, logkey.DurationToMS(time.Since(startedAt)))
	keyvals = append(keyvals, fields...)
	s.logger.DebugContext(ctx, msg, keyvals...)
}

func (s *Service) logCandidateSearchConfig(
	ctx context.Context,
	searchCtx similaritySearchContext,
	candidateCap int,
) {
	if s == nil || s.logger == nil {
		return
	}
	s.logger.DebugContext(
		ctx,
		"Knowledge similarity candidate search",
		"vector_collection", searchCtx.vectorCollectionName,
		"term_collection", searchCtx.termCollectionName,
		"dense_candidate_threshold", searchCtx.denseCandidateThreshold,
		"sparse_candidate_threshold", searchCtx.sparseCandidateThreshold,
		"dense_top_k", searchCtx.hybrid.DenseTopK,
		"sparse_top_k", searchCtx.hybrid.SparseTopK,
		"candidate_cap", candidateCap,
		"dense_only", searchCtx.denseOnly,
		"query_type", searchCtx.queryProfile.QueryType,
		"hard_filter_keys", vectorFilterKeys(searchCtx.filterPlan.Hard),
		"soft_filter_keys", vectorFilterKeys(searchCtx.filterPlan.Soft),
		"primary_filter_keys", vectorFilterKeys(mergeVectorFilters(searchCtx.filterPlan.Hard, searchCtx.filterPlan.Soft)),
	)
}

func vectorFilterKeys(filter *shared.VectorFilter) []string {
	if filter == nil {
		return nil
	}
	keys := make([]string, 0, len(filter.Must)+len(filter.Should)+len(filter.MustNot))
	appendFilterKeys := func(filters []shared.FieldFilter) {
		for _, filter := range filters {
			key := strings.TrimSpace(filter.Key)
			if key == "" {
				continue
			}
			keys = append(keys, key)
		}
	}
	appendFilterKeys(filter.Must)
	appendFilterKeys(filter.Should)
	appendFilterKeys(filter.MustNot)
	return uniqueNonEmptyStrings(keys...)
}

func (s *Service) searchSingleSimilarityQuery(
	ctx context.Context,
	input similaritySingleQueryInput,
) ([]*shared.VectorSearchResult[fragmodel.FragmentPayload], error) {
	var denseResults []*shared.VectorSearchResult[fragmodel.FragmentPayload]
	var sparseResults []*shared.VectorSearchResult[fragmodel.FragmentPayload]

	group, groupCtx := errgroup.WithContext(ctx)
	group.Go(func() error {
		queryVector, err := s.embeddingSvc.GetEmbedding(groupCtx, input.QueryProfile.DenseQuery, input.Model, input.BusinessParams)
		if err != nil {
			return fmt.Errorf("failed to compute query embedding: %w", err)
		}
		denseResults, err = s.vectorDataRepo.SearchDenseWithFilter(groupCtx, shared.DenseSearchRequest{
			Collection:     input.VectorCollectionName,
			VectorName:     DefaultDenseVectorName,
			Vector:         queryVector,
			TopK:           input.Hybrid.DenseTopK,
			ScoreThreshold: input.DenseCandidateScoreThreshold,
			Filter:         input.Filter,
		})
		if err != nil {
			return fmt.Errorf("failed to dense search with filter: %w", err)
		}
		return nil
	})
	if !input.DenseOnly {
		group.Go(func() error {
			sparseRequest, ok := s.buildSparseSearchRequest(groupCtx, input)
			if !ok {
				return nil
			}
			var err error
			sparseResults, err = s.vectorDataRepo.SearchSparseWithFilter(groupCtx, sparseRequest)
			if err != nil {
				return fmt.Errorf("failed to sparse search with filter: %w", err)
			}
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, fmt.Errorf("search similarity query: %w", err)
	}

	partial := fuseHybridResults(denseResults, sparseResults, input.Hybrid)
	normalizeSimilaritySearchResults(partial)
	return partial, nil
}

func resolveEmbeddingQuery(req SimilarityRequest) string {
	if trimmed := strings.TrimSpace(req.EmbeddingQuery); trimmed != "" {
		return trimmed
	}
	return req.Query
}

func resolveProfileQuery(req SimilarityRequest) string {
	return resolveEmbeddingQuery(req)
}

func (s *Service) buildSparseSearchRequest(ctx context.Context, input similaritySingleQueryInput) (shared.SparseSearchRequest, bool) {
	switch NormalizeSparseBackend(input.SparseBackend) {
	case SparseBackendQdrantBM25ZHV1:
		document := DefaultSparseDocumentForText(input.QueryProfile.SparseQueryText)
		if document == nil {
			return shared.SparseSearchRequest{}, false
		}
		return shared.SparseSearchRequest{
			Collection:     input.TermCollectionName,
			VectorName:     DefaultSparseVectorName,
			Document:       document,
			TopK:           input.Hybrid.SparseTopK,
			ScoreThreshold: input.SparseCandidateScoreThreshold,
			Filter:         input.Filter,
		}, true
	case SparseBackendClientBM25QdrantIDFV1:
		vector := buildSparseVectorFromQueryProfile(input.QueryProfile, s.newRetrievalAnalyzer())
		if vector == nil {
			return shared.SparseSearchRequest{}, false
		}
		return shared.SparseSearchRequest{
			Collection:     input.TermCollectionName,
			VectorName:     DefaultSparseVectorName,
			Vector:         vector,
			TopK:           input.Hybrid.SparseTopK,
			ScoreThreshold: input.SparseCandidateScoreThreshold,
			Filter:         input.Filter,
		}, true
	default:
		if s != nil && s.logger != nil {
			s.logger.KnowledgeWarnContext(
				ctx,
				"Unknown sparse backend, fallback to dense-only",
				"collection", input.TermCollectionName,
				"sparse_backend", input.SparseBackend,
			)
		}
		return shared.SparseSearchRequest{}, false
	}
}

func supportsSparseBackend(sparseBackend string) bool {
	return IsSupportedSparseBackend(sparseBackend)
}

func shouldUseDenseOnlySimilarityQuery(query string, analyzer retrievalAnalyzer) bool {
	normalized := normalizeRetrievalText(query)
	if normalized == "" {
		return false
	}
	if utf8.RuneCountInString(normalized) <= 1 {
		return true
	}
	uniqueTokens := uniqueNonEmptyStrings(analyzer.tokenTerms(normalized)...)
	return len(uniqueTokens) == 1 && utf8.RuneCountInString(uniqueTokens[0]) == 1
}

func mergeSimilarityResults(
	destination map[string]*shared.VectorSearchResult[fragmodel.FragmentPayload],
	results []*shared.VectorSearchResult[fragmodel.FragmentPayload],
) {
	for _, result := range results {
		if result == nil {
			continue
		}
		key := strings.TrimSpace(result.ID)
		if key == "" {
			contentHash := strings.TrimSpace(result.Payload.ContentHash)
			if contentHash == "" {
				contentHash = metadataStringValue(result.Payload.Metadata, "content_hash")
			}
			key = strings.TrimSpace(result.Payload.DocumentCode) + "::" + contentHash
		}
		if key == "::" {
			continue
		}
		existing, exists := destination[key]
		if !exists || existing.Score < result.Score {
			destination[key] = result
		}
	}
}

func collectSimilarityResults(results map[string]*shared.VectorSearchResult[fragmodel.FragmentPayload]) []*shared.VectorSearchResult[fragmodel.FragmentPayload] {
	merged := make([]*shared.VectorSearchResult[fragmodel.FragmentPayload], 0, len(results))
	for _, result := range results {
		merged = append(merged, result)
	}
	slices.SortStableFunc(merged, func(a, b *shared.VectorSearchResult[fragmodel.FragmentPayload]) int {
		switch {
		case a.Score > b.Score:
			return -1
		case a.Score < b.Score:
			return 1
		default:
			return 0
		}
	})
	return merged
}

func normalizeSimilaritySearchResults(results []*shared.VectorSearchResult[fragmodel.FragmentPayload]) {
	for _, result := range results {
		if result == nil {
			continue
		}
		fallbackFlags := fragmetadata.ApplyPayloadMetadataContract(&result.Payload)
		normalizedMetadata := cloneMetadata(result.Payload.Metadata)
		if len(result.Metadata) > 0 {
			maps.Copy(normalizedMetadata, result.Metadata)
		}
		result.Metadata = normalizedMetadata
		delete(result.Metadata, "metadata_contract_version")
		if len(fallbackFlags) > 0 {
			result.Metadata[MetadataFallbackFlagsKey] = fallbackFlags
		}
	}
}

func (s *Service) scoreSimilarityResults(
	ctx context.Context,
	queryProfile similarityQueryProfile,
	results []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	kb sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
	topK int,
	resultOptions similarityResultOptions,
) []*fragmodel.SimilarityResult {
	if len(results) == 0 {
		return nil
	}
	rankingStartedAt := time.Now()

	queryType := queryProfile.QueryType
	if queryType == "" {
		queryType = resultOptions.Trace.QueryType
	}
	if queryType == "" {
		queryType = classifySimilarityQueryType(resolveRankingQuery(queryProfile), s.newRetrievalAnalyzer())
	}
	scored := buildHybridScoredResults(results)
	preFilterCount := len(scored)
	if topK <= 0 {
		topK = 10
	}

	sortSimilarityScores(scored, kb)
	scored = applySectionPathDiversity(scored, results, topK, defaultSectionPathResultLimit)

	appliedThreshold := resultOptions.ResultScoreThreshold
	scored, appliedThreshold = applyResultScoreThresholdWithFallback(scored, topK, appliedThreshold)
	if len(scored) > topK {
		scored = scored[:topK]
	}
	if s != nil && s.logger != nil {
		fields := []any{
			logkey.DurationMS, logkey.DurationToMS(time.Since(rankingStartedAt)),
			"result_threshold", resultOptions.ResultScoreThreshold,
			"applied_result_threshold", appliedThreshold,
			"candidate_count", len(results),
			"before_filter_count", preFilterCount,
			"result_count", len(scored),
			"filtered_count", preFilterCount - len(scored),
			"top_k", topK,
			"query_type", queryType,
		}
		if len(scored) > 0 {
			fields = append(fields,
				"top_ranking_score", scored[0].finalScore,
			)
		}
		s.logger.DebugContext(ctx, "Knowledge similarity ranking completed", fields...)
	}

	return buildSimilarityResults(queryProfile, scored, results, resultOptions.SearchOptions, resultOptions.Trace)
}

func buildHybridScoredResults(results []*shared.VectorSearchResult[fragmodel.FragmentPayload]) []scoredResult {
	scored := make([]scoredResult, len(results))
	for i, result := range results {
		hybridScore, hasHybridScore := metadataFloat64ValueWithPresence(result.Metadata, "hybrid_score")
		if !hasHybridScore {
			hybridScore = result.Score
		}
		denseScore, hasDenseScore := metadataFloat64ValueWithPresence(result.Metadata, "dense_score")
		if !hasDenseScore && !hasHybridScore {
			denseScore = result.Score
		}
		sparseScore := metadataFloat64Value(result.Metadata, "sparse_score")
		fusionScoreNorm, hasFusionScoreNorm := metadataFloat64ValueWithPresence(result.Metadata, "fusion_score_norm")
		if !hasFusionScoreNorm {
			fusionScoreNorm = hybridScore
		}
		scored[i] = scoredResult{
			index:           i,
			hybridScore:     hybridScore,
			denseScore:      denseScore,
			sparseScore:     sparseScore,
			fusionScoreNorm: fusionScoreNorm,
			channelPresence: metadataStringValue(result.Metadata, "channel_presence"),
			stableKey:       hybridResultKey(result),
			finalScore:      hybridScore,
		}
	}
	return scored
}

func buildSimilarityResults(
	queryProfile similarityQueryProfile,
	scored []scoredResult,
	results []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	options *SimilaritySearchOptions,
	trace similaritySearchTrace,
) []*fragmodel.SimilarityResult {
	output := make([]*fragmodel.SimilarityResult, len(scored))
	for i, scoredItem := range scored {
		result := results[scoredItem.index]
		metadata := buildSimilarityMetadata(queryProfile, result, scoredItem, options, trace)
		output[i] = &fragmodel.SimilarityResult{
			FragmentID:    result.Payload.FragmentID,
			Content:       result.Content,
			Score:         scoredItem.finalScore,
			Metadata:      metadata,
			KnowledgeCode: result.Payload.KnowledgeCode,
			DocumentCode:  result.Payload.DocumentCode,
			DocumentName:  result.Payload.DocumentName,
			DocumentType:  result.Payload.DocumentType,
			BusinessID:    result.Payload.BusinessID,
		}
	}
	return output
}

func buildSimilarityMetadata(
	queryProfile similarityQueryProfile,
	result *shared.VectorSearchResult[fragmodel.FragmentPayload],
	scoredItem scoredResult,
	options *SimilaritySearchOptions,
	trace similaritySearchTrace,
) map[string]any {
	metadata := map[string]any{}
	if result != nil {
		metadata = result.Metadata
	}
	cloned := cloneMetadata(metadata)
	if result != nil {
		cloned["point_id"] = result.ID
		cloned["section_path"] = result.Payload.SectionPath
		cloned["section_title"] = result.Payload.SectionTitle
		cloned["document_code"] = result.Payload.DocumentCode
		cloned["document_name"] = result.Payload.DocumentName
		cloned["document_type"] = result.Payload.DocumentType
		cloned["business_id"] = result.Payload.BusinessID
		if result.Payload.FragmentID > 0 {
			cloned["fragment_id"] = result.Payload.FragmentID
		}
		cloned["chunk_index"] = result.Payload.ChunkIndex
	}
	cloned["retrieval_ranking"] = buildRetrievalRanking(
		cloned,
		queryProfile,
		scoredItem,
		trace,
		options != nil && options.Debug,
	)
	cleanupSimilarityRankingMetadata(cloned)
	delete(cloned, "metadata_contract_version")
	if options == nil || !options.Debug {
		return cloned
	}
	cloned["applied_filters"] = trace.AppliedFilter
	cloned["query_rewrite"] = map[string]any{
		"original_query":  strings.TrimSpace(queryProfile.RawQuery),
		"rewritten_query": trace.RewrittenQuery,
		"used_queries":    trace.UsedQueries,
	}
	if len(trace.TokenPolicyDebug) > 0 {
		cloned["token_policy_debug"] = trace.TokenPolicyDebug
	}
	return cloned
}

func buildRetrievalRanking(
	metadata map[string]any,
	queryProfile similarityQueryProfile,
	scoredItem scoredResult,
	trace similaritySearchTrace,
	debug bool,
) Ranking {
	_ = debug
	bm25QueryProfile := queryProfile
	if strings.TrimSpace(bm25QueryProfile.RawQuery) == "" && strings.TrimSpace(trace.QueryProfile.RawQuery) != "" {
		bm25QueryProfile = trace.QueryProfile
	}
	ranking := Ranking{
		PipelineVersion:      resolveRetrievalPipelineVersion(trace),
		FusionAlgorithm:      metadataStringValue(metadata, "fusion_algorithm"),
		HybridAlpha:          metadataFloat64Value(metadata, "hybrid_alpha"),
		ChannelPresence:      scoredItem.channelPresence,
		LegacyWeightUpgraded: metadataBoolValue(metadata, "legacy_weight_upgraded"),
		FusionScore:          scoredItem.hybridScore,
		FusionScoreNorm:      scoredItem.fusionScoreNorm,
		RRFScore:             metadataFloat64Value(metadata, "rrf_score"),
		Dense:                buildRetrievalChannelScore(metadata, "dense"),
		Sparse:               buildRetrievalChannelScore(metadata, "sparse"),
		BM25Query:            buildBM25QueryObservation(bm25QueryProfile, trace.SparseBackend, newRetrievalAnalyzer()),
	}
	return ranking
}

func resolveRetrievalPipelineVersion(trace similaritySearchTrace) string {
	if trace.PipelineVersion != "" {
		return string(trace.PipelineVersion)
	}
	return string(RetrievalPipelineVersionV1)
}

func buildRetrievalChannelScore(metadata map[string]any, channel string) *ChannelScore {
	scoreKey := channel + "_score"
	rankKey := channel + "_rank"
	score := metadataFloat64Value(metadata, scoreKey)
	rank := metadataIntValue(metadata, rankKey)
	if rank == 0 && score == 0 {
		return nil
	}
	channelScore := &ChannelScore{Score: score}
	if rank > 0 {
		channelScore.Rank = &rank
	}
	return channelScore
}

func cleanupSimilarityRankingMetadata(metadata map[string]any) {
	for _, key := range []string{
		"fusion_algorithm",
		"hybrid_alpha",
		"hybrid_score",
		"fusion_score_norm",
		"rrf_score",
		"dense_rank",
		"dense_score",
		"dense_score_norm",
		"dense_contribution",
		"sparse_rank",
		"sparse_score",
		"sparse_score_norm",
		"sparse_contribution",
		"channel_presence",
		"legacy_weight_upgraded",
		"query_type",
		"rerank_score",
		"support_score",
		"score_breakdown",
		"retrieval_pipeline_version",
		"pipeline_version",
	} {
		delete(metadata, key)
	}
}

func resolveRankingQuery(profile similarityQueryProfile) string {
	switch {
	case strings.TrimSpace(profile.NormalizedRawQuery) != "":
		return profile.NormalizedRawQuery
	case strings.TrimSpace(profile.RawQuery) != "":
		return normalizeDenseSimilarityQuery(profile.RawQuery)
	default:
		return normalizeDenseSimilarityQuery(profile.DenseQuery)
	}
}

func sortSimilarityScores(scored []scoredResult, _ sharedsnapshot.KnowledgeBaseRuntimeSnapshot) {
	slices.SortStableFunc(scored, func(a, b scoredResult) int {
		switch {
		case a.finalScore > b.finalScore:
			return -1
		case a.finalScore < b.finalScore:
			return 1
		case a.denseScore > b.denseScore:
			return -1
		case a.denseScore < b.denseScore:
			return 1
		case a.sparseScore > b.sparseScore:
			return -1
		case a.sparseScore < b.sparseScore:
			return 1
		case a.stableKey < b.stableKey:
			return -1
		case a.stableKey > b.stableKey:
			return 1
		default:
			return 0
		}
	})
}

func applySectionPathDiversity(
	scored []scoredResult,
	results []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	topK int,
	sectionPathLimit int,
) []scoredResult {
	if len(scored) == 0 || sectionPathLimit <= 0 {
		return scored
	}
	if topK <= 0 {
		topK = 10
	}

	kept := make([]scoredResult, 0, len(scored))
	deferred := make([]scoredResult, 0, len(scored))
	counter := make(map[string]int, len(scored))
	for _, item := range scored {
		if shouldSkipSectionPathDiversity(results[item.index].Payload.Metadata) {
			kept = append(kept, item)
			continue
		}
		path := strings.TrimSpace(results[item.index].Payload.SectionPath)
		if path == "" {
			kept = append(kept, item)
			continue
		}
		if counter[path] >= sectionPathLimit {
			deferred = append(deferred, item)
			continue
		}
		counter[path]++
		kept = append(kept, item)
	}

	if len(kept) >= topK || len(deferred) == 0 {
		return kept
	}
	for _, item := range deferred {
		if len(kept) >= topK {
			break
		}
		kept = append(kept, item)
	}
	return kept
}

func applyResultScoreThreshold(scored []scoredResult, threshold float64) []scoredResult {
	if len(scored) == 0 || threshold <= 0 {
		return scored
	}

	filtered := scored[:0]
	for _, item := range scored {
		if item.finalScore < threshold {
			continue
		}
		filtered = append(filtered, item)
	}
	return filtered
}

func applyResultScoreThresholdWithFallback(
	scored []scoredResult,
	_ int,
	threshold float64,
) ([]scoredResult, float64) {
	if len(scored) == 0 || threshold <= 0 {
		return scored, threshold
	}
	return applyResultScoreThreshold(scored, threshold), threshold
}

func resolveDenseCandidateScoreThreshold(candidateScoreThreshold float64) float64 {
	if candidateScoreThreshold > 0 {
		return candidateScoreThreshold
	}
	return defaultDenseCandidateThreshold
}

func resolveSparseCandidateScoreThreshold() float64 {
	return 0
}

func resolveHybridSearchConfig(topK int, kb sharedsnapshot.KnowledgeBaseRuntimeSnapshot) hybridSearchConfig {
	if topK <= 0 {
		topK = 10
	}

	config := hybridSearchConfig{
		DenseTopK:    min(max(topK*defaultDenseTopKScale, minDenseCandidateTopK), maxCandidateTopK),
		SparseTopK:   min(max(topK*defaultSparseTopKScale, minSparseCandidateTopK), maxCandidateTopK),
		DenseWeight:  defaultDenseWeight,
		SparseWeight: defaultSparseWeight,
	}

	if kb.RetrieveConfig == nil {
		config.EffectiveHybridAlpha = config.DenseWeight
		return config
	}
	if multiplier := kb.RetrieveConfig.HybridTopKMultiplier; multiplier > 0 {
		candidateTopK := min(max(topK*multiplier, topK), maxCandidateTopK)
		config.DenseTopK = candidateTopK
		config.SparseTopK = candidateTopK
	}
	config.EffectiveHybridAlpha = config.DenseWeight
	return config
}

func computeSectionPathMatchScore(query string, queryTokens []string, sectionPath string, analyzer retrievalAnalyzer) float64 {
	trimmedPath := strings.TrimSpace(sectionPath)
	if trimmedPath == "" || len(queryTokens) == 0 {
		return 0
	}
	normalizedQuery := strings.ToLower(strings.TrimSpace(query))
	normalizedPath := strings.ToLower(trimmedPath)
	if normalizedQuery != "" && strings.Contains(normalizedPath, normalizedQuery) {
		return 1
	}
	pathTokens := analyzer.tokenTerms(trimmedPath)
	return computeSectionPathMatchScoreWithTokens(query, queryTokens, sectionPath, pathTokens)
}

func computeSectionPathMatchScoreWithTokens(query string, queryTokens []string, sectionPath string, sectionPathTokens []string) float64 {
	trimmedPath := strings.TrimSpace(sectionPath)
	if trimmedPath == "" || len(queryTokens) == 0 {
		return 0
	}
	normalizedQuery := strings.ToLower(strings.TrimSpace(query))
	normalizedPath := strings.ToLower(trimmedPath)
	if normalizedQuery != "" && strings.Contains(normalizedPath, normalizedQuery) {
		return 1
	}
	pathTokens := sectionPathTokens
	return computeTermCoverageScore(queryTokens, pathTokens)
}

func computeTermCoverageScore(queryTokens, docTokens []string) float64 {
	if len(docTokens) == 0 {
		return 0
	}
	docTokenSet := make(map[string]struct{}, len(docTokens))
	for _, token := range docTokens {
		if token == "" {
			continue
		}
		docTokenSet[token] = struct{}{}
	}
	return computeTermCoverageScoreFromTokenSet(queryTokens, docTokenSet)
}

func computeTermCoverageScoreFromTokenSet(queryTokens []string, docTokenSet map[string]struct{}) float64 {
	if len(queryTokens) == 0 || len(docTokenSet) == 0 {
		return 0
	}

	matched := 0
	for _, queryToken := range queryTokens {
		if queryToken == "" {
			continue
		}
		if _, ok := docTokenSet[queryToken]; ok {
			matched++
		}
	}
	return float64(matched) / float64(len(queryTokens))
}

func computeExactPhraseMatchScore(query string, result *shared.VectorSearchResult[fragmodel.FragmentPayload]) float64 {
	return computeExactPhraseMatchScoreFromFieldTexts(query, resultSparseFieldTexts(result))
}

func computeExactPhraseMatchScoreFromFieldTexts(query string, fieldTexts []retrievalFieldText) float64 {
	normalizedQuery := normalizeQueryForExactPhraseMatch(query)
	if normalizedQuery == "" {
		return 0
	}

	for _, fieldText := range fieldTexts {
		if strings.Contains(normalizeFieldTextForExactPhraseMatch(fieldText.Text), normalizedQuery) {
			return 1
		}
	}
	return 0
}

func normalizeQueryForExactPhraseMatch(query string) string {
	return normalizeFieldTextForExactPhraseMatch(query)
}

func normalizeFieldTextForExactPhraseMatch(text string) string {
	return normalizeRetrievalText(strings.ToLower(strings.TrimSpace(text)))
}

func metadataFloat64Value(metadata map[string]any, key string) float64 {
	value, _ := metadataFloat64ValueWithPresence(metadata, key)
	return value
}

func metadataFloat64ValueWithPresence(metadata map[string]any, key string) (float64, bool) {
	if len(metadata) == 0 {
		return 0, false
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return 0, false
	}
	switch typed := value.(type) {
	case float64:
		return typed, true
	case float32:
		return float64(typed), true
	case int:
		return float64(typed), true
	case int32:
		return float64(typed), true
	case int64:
		return float64(typed), true
	default:
		return 0, false
	}
}

func metadataIntValue(metadata map[string]any, key string) int {
	if len(metadata) == 0 {
		return 0
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return 0
	}
	switch typed := value.(type) {
	case int:
		return typed
	case int32:
		return int(typed)
	case int64:
		return int(typed)
	case float32:
		return int(typed)
	case float64:
		return int(typed)
	default:
		return 0
	}
}

func metadataBoolValue(metadata map[string]any, key string) bool {
	if len(metadata) == 0 {
		return false
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return false
	}
	typed, ok := value.(bool)
	return ok && typed
}
