package retrieval

import (
	"context"
	"fmt"
	"maps"
	"slices"
	"strings"
	"unicode/utf8"

	"golang.org/x/sync/errgroup"

	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	"magic/internal/pkg/ctxmeta"
)

const (
	maxCandidateTopK               = 180
	similaritySearchMaxConcurrency = 4
	shortQueryMaxRuneCount         = 4
)

type scoredResult struct {
	index         int
	hybridScore   float64
	denseScore    float64
	sparseScore   float64
	rrfScore      float64
	hybridNorm    float64
	lexicalNorm   float64
	sparseNorm    float64
	sectionMatch  float64
	termCoverage  float64
	phraseMatch   float64
	proximity     float64
	titleMatch    float64
	fieldMatch    float64
	tabularHit    float64
	shortQuery    bool
	tieBreakScore float64
	finalScore    float64
}

type similarityScoreSignals struct {
	vectorScores   []float64
	sparseScores   []float64
	lexicalScores  []float64
	sectionMatches []float64
	termCoverage   []float64
	phraseMatches  []float64
	proximity      []float64
	titleMatches   []float64
	fieldMatches   []float64
	tabularHits    []float64
}

type candidateAnalysisSnapshot struct {
	fieldTexts        []retrievalFieldText
	docTokens         []string
	fieldTokenHits    map[string]map[string]struct{}
	sectionPathTokens []string
}

type similaritySearchTrace struct {
	UsedQueries     []string
	RewrittenQuery  string
	AppliedFilter   FilterPlanTrace
	PipelineVersion PipelineVersion
	DenseOnly       bool
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

type similarityQuerySearchInput struct {
	VectorCollectionName    string
	TermCollectionName      string
	Model                   string
	SparseBackend           string
	Queries                 []string
	EmbeddingQuery          string
	TopK                    int
	Hybrid                  hybridSearchConfig
	CandidateScoreThreshold float64
	Filter                  *VectorFilter
	BusinessParams          *ctxmeta.BusinessParams
	DenseOnly               bool
}

type similaritySearchContext struct {
	request              SimilarityRequest
	vectorCollectionName string
	termCollectionName   string
	model                string
	sparseBackend        string
	rewrite              QueryRewriteResult
	filterPlan           FilterPlan
	hybrid               hybridSearchConfig
	denseOnly            bool
}

type similaritySingleQueryInput struct {
	VectorCollectionName    string
	TermCollectionName      string
	Model                   string
	SparseBackend           string
	Query                   string
	EmbeddingQuery          string
	TopK                    int
	Hybrid                  hybridSearchConfig
	CandidateScoreThreshold float64
	Filter                  *VectorFilter
	BusinessParams          *ctxmeta.BusinessParams
	DenseOnly               bool
}

// Similarity 相似度搜索
func (s *Service) Similarity(
	ctx context.Context,
	kb any,
	req SimilarityRequest,
) ([]*SimilarityResult, error) {
	kbSnapshot := snapshotKnowledgeBase(kb)
	results, trace, err := s.searchSimilarityCandidates(ctx, kbSnapshot, req)
	if err != nil {
		return nil, err
	}
	scored := s.scoreSimilarityResults(ctx, req.Query, results, kbSnapshot, req.TopK, similarityResultOptions{
		ResultScoreThreshold: req.ResultScoreThreshold,
		SearchOptions:        req.Options,
		Trace:                trace,
	})
	return enrichSimilarityResultsWithContext(ctx, scored, s.repo, s.newRetrievalAnalyzer()), nil
}

func (s *Service) searchSimilarityCandidates(
	ctx context.Context,
	kb knowledgeBaseRuntimeSnapshot,
	req SimilarityRequest,
) ([]*VectorSearchResult[FragmentPayload], similaritySearchTrace, error) {
	searchCtx := s.buildSimilaritySearchContext(ctx, kb, req)
	if len(searchCtx.rewrite.Used) == 0 {
		return nil, similaritySearchTrace{}, nil
	}

	trace := similaritySearchTrace{
		UsedQueries:     searchCtx.rewrite.Used,
		RewrittenQuery:  searchCtx.rewrite.Rewritten,
		PipelineVersion: RetrievalPipelineVersionV1,
		DenseOnly:       searchCtx.denseOnly,
		AppliedFilter: FilterPlanTrace{
			Hard: vectorFilterDebugView(searchCtx.filterPlan.Hard),
			Soft: vectorFilterDebugView(searchCtx.filterPlan.Soft),
		},
	}

	if !isEnhancedRetrievalEnabled(kb) {
		results, err := s.runLegacySimilaritySearch(ctx, searchCtx)
		if err != nil {
			return nil, similaritySearchTrace{}, err
		}
		return results, trace, nil
	}

	results, err := s.runEnhancedSimilaritySearch(ctx, searchCtx)
	if err != nil {
		return nil, similaritySearchTrace{}, err
	}
	return results, trace, nil
}

func (s *Service) buildSimilaritySearchContext(
	ctx context.Context,
	kb knowledgeBaseRuntimeSnapshot,
	req SimilarityRequest,
) similaritySearchContext {
	resolvedRoute := resolveRuntimeRoute(ctx, s.metaReader, s.sparseBackendSelector, s.logger, kb, s.defaultEmbeddingModel)
	var explicitFilters *SimilarityFilters
	if req.Options != nil {
		explicitFilters = req.Options.Filters
	}
	analyzer := s.newRetrievalAnalyzer()
	return similaritySearchContext{
		request: req,
		// dense recall 与 sparse recall 都必须消费同一份运行时路由，避免 term namespace 和物理集合漂移。
		vectorCollectionName: resolvedRoute.VectorCollectionName,
		termCollectionName:   resolvedRoute.TermCollectionName,
		model:                resolvedRoute.Model,
		sparseBackend:        resolvedRoute.SparseBackend,
		rewrite:              buildQueryVariants(req.Query),
		filterPlan:           mergeSimilarityHardFilter(buildFilterPlan(kb, explicitFilters, req.Query), req.Options),
		hybrid:               resolveHybridSearchConfig(req.TopK, kb),
		denseOnly:            shouldUseDenseOnlySimilarityQuery(req.Query, analyzer) || !supportsSparseBackend(resolvedRoute.SparseBackend),
	}
}

func mergeSimilarityHardFilter(plan FilterPlan, options *SimilaritySearchOptions) FilterPlan {
	if options == nil || options.HardFilter == nil {
		return plan
	}
	plan.Hard = mergeVectorFilters(plan.Hard, options.HardFilter)
	return plan
}

func (s *Service) runLegacySimilaritySearch(
	ctx context.Context,
	searchCtx similaritySearchContext,
) ([]*VectorSearchResult[FragmentPayload], error) {
	results, err := s.searchWithQueries(ctx, similarityQuerySearchInput{
		VectorCollectionName:    searchCtx.vectorCollectionName,
		TermCollectionName:      searchCtx.termCollectionName,
		Model:                   searchCtx.model,
		SparseBackend:           searchCtx.sparseBackend,
		Queries:                 []string{searchCtx.rewrite.Used[0]},
		EmbeddingQuery:          resolveEmbeddingQuery(searchCtx.request),
		TopK:                    max(searchCtx.hybrid.DenseTopK, searchCtx.hybrid.SparseTopK),
		Hybrid:                  searchCtx.hybrid,
		CandidateScoreThreshold: searchCtx.request.CandidateScoreThreshold,
		Filter:                  searchCtx.filterPlan.Hard,
		BusinessParams:          searchCtx.request.BusinessParams,
		DenseOnly:               searchCtx.denseOnly,
	})
	if err != nil {
		return nil, err
	}
	collected := make(map[string]*VectorSearchResult[FragmentPayload], len(results))
	mergeSimilarityResults(collected, results)
	return collectSimilarityResults(collected), nil
}

func (s *Service) runEnhancedSimilaritySearch(
	ctx context.Context,
	searchCtx similaritySearchContext,
) ([]*VectorSearchResult[FragmentPayload], error) {
	primaryFilter := mergeVectorFilters(searchCtx.filterPlan.Hard, searchCtx.filterPlan.Soft)
	candidateCap := max(searchCtx.hybrid.DenseTopK, searchCtx.hybrid.SparseTopK)
	s.logCandidateSearchConfig(ctx, searchCtx, candidateCap)
	mergedResults := make(map[string]*VectorSearchResult[FragmentPayload], candidateCap)

	passOne, err := s.searchWithQueries(ctx, similarityQuerySearchInput{
		VectorCollectionName:    searchCtx.vectorCollectionName,
		TermCollectionName:      searchCtx.termCollectionName,
		Model:                   searchCtx.model,
		SparseBackend:           searchCtx.sparseBackend,
		Queries:                 searchCtx.rewrite.Used,
		EmbeddingQuery:          resolveEmbeddingQuery(searchCtx.request),
		TopK:                    candidateCap,
		Hybrid:                  searchCtx.hybrid,
		CandidateScoreThreshold: searchCtx.request.CandidateScoreThreshold,
		Filter:                  primaryFilter,
		BusinessParams:          searchCtx.request.BusinessParams,
		DenseOnly:               searchCtx.denseOnly,
	})
	if err != nil {
		return nil, err
	}
	mergeSimilarityResults(mergedResults, passOne)

	needMore := len(mergedResults) < max(searchCtx.request.TopK/2, 1)
	if needMore && searchCtx.filterPlan.Soft != nil {
		// 第二轮仅放宽 soft filter，不改变当前 query 是否需要 sparse 的判定。
		passTwo, searchErr := s.searchWithQueries(ctx, similarityQuerySearchInput{
			VectorCollectionName:    searchCtx.vectorCollectionName,
			TermCollectionName:      searchCtx.termCollectionName,
			Model:                   searchCtx.model,
			SparseBackend:           searchCtx.sparseBackend,
			Queries:                 searchCtx.rewrite.Used,
			EmbeddingQuery:          resolveEmbeddingQuery(searchCtx.request),
			TopK:                    candidateCap,
			Hybrid:                  searchCtx.hybrid,
			CandidateScoreThreshold: searchCtx.request.CandidateScoreThreshold,
			Filter:                  searchCtx.filterPlan.Hard,
			BusinessParams:          searchCtx.request.BusinessParams,
			DenseOnly:               searchCtx.denseOnly,
		})
		if searchErr != nil {
			return nil, searchErr
		}
		mergeSimilarityResults(mergedResults, passTwo)
	}

	return collectSimilarityResults(mergedResults), nil
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
		"candidate_threshold", searchCtx.request.CandidateScoreThreshold,
		"dense_top_k", searchCtx.hybrid.DenseTopK,
		"sparse_top_k", searchCtx.hybrid.SparseTopK,
		"candidate_cap", candidateCap,
		"dense_only", searchCtx.denseOnly,
	)
}

func (s *Service) searchWithQueries(
	ctx context.Context,
	input similarityQuerySearchInput,
) ([]*VectorSearchResult[FragmentPayload], error) {
	if len(input.Queries) == 0 {
		return nil, nil
	}

	partials := make([][]*VectorSearchResult[FragmentPayload], len(input.Queries))
	group, groupCtx := errgroup.WithContext(ctx)
	group.SetLimit(similaritySearchMaxConcurrency)
	for idx, query := range input.Queries {
		group.Go(func() error {
			partial, err := s.searchSingleSimilarityQuery(groupCtx, similaritySingleQueryInput{
				VectorCollectionName:    input.VectorCollectionName,
				TermCollectionName:      input.TermCollectionName,
				Model:                   input.Model,
				SparseBackend:           input.SparseBackend,
				Query:                   query,
				EmbeddingQuery:          input.EmbeddingQuery,
				TopK:                    input.TopK,
				Hybrid:                  input.Hybrid,
				CandidateScoreThreshold: input.CandidateScoreThreshold,
				Filter:                  input.Filter,
				BusinessParams:          input.BusinessParams,
				DenseOnly:               input.DenseOnly,
			})
			if err != nil {
				return err
			}
			partials[idx] = partial
			return nil
		})
	}
	if err := group.Wait(); err != nil {
		return nil, fmt.Errorf("search similarity queries: %w", err)
	}

	results := make([]*VectorSearchResult[FragmentPayload], 0, len(input.Queries)*input.TopK)
	for _, partial := range partials {
		results = append(results, partial...)
	}
	return results, nil
}

func (s *Service) searchSingleSimilarityQuery(
	ctx context.Context,
	input similaritySingleQueryInput,
) ([]*VectorSearchResult[FragmentPayload], error) {
	var denseResults []*VectorSearchResult[FragmentPayload]
	var sparseResults []*VectorSearchResult[FragmentPayload]

	group, groupCtx := errgroup.WithContext(ctx)
	group.Go(func() error {
		queryVector, err := s.embeddingSvc.GetEmbedding(groupCtx, resolveEmbeddingQueryFromInput(input), input.Model, input.BusinessParams)
		if err != nil {
			return fmt.Errorf("failed to compute query embedding: %w", err)
		}
		denseResults, err = s.vectorDataRepo.SearchDenseWithFilter(groupCtx, DenseSearchRequest{
			Collection:     input.VectorCollectionName,
			VectorName:     DefaultDenseVectorName,
			Vector:         queryVector,
			TopK:           input.Hybrid.DenseTopK,
			ScoreThreshold: input.CandidateScoreThreshold,
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

	hybridConfig := input.Hybrid
	hybridConfig.DenseCutoffThreshold = input.CandidateScoreThreshold
	partial := fuseHybridResults(denseResults, sparseResults, hybridConfig)
	normalizeSimilaritySearchResults(partial)
	return partial, nil
}

func resolveEmbeddingQuery(req SimilarityRequest) string {
	if trimmed := strings.TrimSpace(req.EmbeddingQuery); trimmed != "" {
		return trimmed
	}
	return req.Query
}

func resolveEmbeddingQueryFromInput(input similaritySingleQueryInput) string {
	if trimmed := strings.TrimSpace(input.EmbeddingQuery); trimmed != "" {
		return trimmed
	}
	return input.Query
}

func (s *Service) buildSparseSearchRequest(ctx context.Context, input similaritySingleQueryInput) (SparseSearchRequest, bool) {
	switch NormalizeSparseBackend(input.SparseBackend) {
	case SparseBackendQdrantBM25ZHV1:
		document := DefaultSparseDocumentForText(normalizeWhitespace(input.Query))
		if document == nil {
			return SparseSearchRequest{}, false
		}
		return SparseSearchRequest{
			Collection:     input.TermCollectionName,
			VectorName:     DefaultSparseVectorName,
			Document:       document,
			TopK:           input.Hybrid.SparseTopK,
			ScoreThreshold: input.CandidateScoreThreshold,
			Filter:         input.Filter,
		}, true
	case SparseBackendClientBM25QdrantIDFV1:
		vector := buildSparseVectorFromQueryWithAnalyzer(input.Query, s.newRetrievalAnalyzer())
		if vector == nil {
			return SparseSearchRequest{}, false
		}
		return SparseSearchRequest{
			Collection:     input.TermCollectionName,
			VectorName:     DefaultSparseVectorName,
			Vector:         vector,
			TopK:           input.Hybrid.SparseTopK,
			ScoreThreshold: input.CandidateScoreThreshold,
			Filter:         input.Filter,
		}, true
	default:
		if s != nil && s.logger != nil {
			s.logger.WarnContext(
				ctx,
				"Unknown sparse backend, fallback to dense-only",
				"collection", input.TermCollectionName,
				"sparse_backend", input.SparseBackend,
			)
		}
		return SparseSearchRequest{}, false
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
	destination map[string]*VectorSearchResult[FragmentPayload],
	results []*VectorSearchResult[FragmentPayload],
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

func collectSimilarityResults(results map[string]*VectorSearchResult[FragmentPayload]) []*VectorSearchResult[FragmentPayload] {
	merged := make([]*VectorSearchResult[FragmentPayload], 0, len(results))
	for _, result := range results {
		merged = append(merged, result)
	}
	slices.SortStableFunc(merged, func(a, b *VectorSearchResult[FragmentPayload]) int {
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

func normalizeSimilaritySearchResults(results []*VectorSearchResult[FragmentPayload]) {
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
		if len(fallbackFlags) > 0 {
			result.Metadata[MetadataFallbackFlagsKey] = fallbackFlags
		}
		if contractVersion, ok := result.Metadata[MetadataContractVersionKey].(string); ok && contractVersion != "" {
			continue
		}
		result.Metadata[MetadataContractVersionKey] = FragmentSemanticMetadataContractVersionV1
	}
}

func (s *Service) scoreSimilarityResults(
	ctx context.Context,
	query string,
	results []*VectorSearchResult[FragmentPayload],
	kb knowledgeBaseRuntimeSnapshot,
	topK int,
	resultOptions similarityResultOptions,
) []*SimilarityResult {
	if len(results) == 0 {
		return nil
	}

	analyzer := s.newRetrievalAnalyzer()
	queryTokens := analyzer.tokenTerms(query)
	queryUniqueTokens := uniqueNonEmptyStrings(queryTokens...)
	analysisSnapshots := buildCandidateAnalysisSnapshots(results, analyzer)
	signals := collectSimilarityScoreSignals(query, queryTokens, queryUniqueTokens, results, analysisSnapshots)
	scored := buildScoredResults(query, results, kb, signals, isShortSupportQuery(query, queryUniqueTokens))
	preFilterCount := len(scored)
	if topK <= 0 {
		topK = 10
	}

	sortSimilarityScores(scored, kb)
	scored = applySectionPathDiversity(scored, results, topK, defaultSectionPathResultLimit)

	appliedThreshold := resultOptions.ResultScoreThreshold
	scored, appliedThreshold = applyResultScoreThresholdWithFallback(scored, topK, appliedThreshold)
	if s != nil && s.logger != nil {
		fields := []any{
			"result_threshold", resultOptions.ResultScoreThreshold,
			"applied_result_threshold", appliedThreshold,
			"before_filter_count", preFilterCount,
			"after_filter_count", len(scored),
			"filtered_count", preFilterCount - len(scored),
		}
		if len(scored) > 0 {
			fields = append(fields,
				"top_tie_break_score", scored[0].tieBreakScore,
				"top_ranking_score", scored[0].finalScore,
			)
		}
		s.logger.DebugContext(ctx, "Knowledge similarity rerank completed", fields...)
	}
	sortSimilarityScores(scored, kb)
	if len(scored) > topK {
		scored = scored[:topK]
	}

	return buildSimilarityResults(query, scored, results, resultOptions.SearchOptions, resultOptions.Trace)
}

func collectSimilarityScoreSignals(
	query string,
	queryTokens []string,
	queryUniqueTokens []string,
	results []*VectorSearchResult[FragmentPayload],
	analysisSnapshots []candidateAnalysisSnapshot,
) similarityScoreSignals {
	signals := similarityScoreSignals{
		vectorScores:   make([]float64, len(results)),
		sparseScores:   make([]float64, len(results)),
		lexicalScores:  computeLexicalScores(queryTokens, analysisSnapshots),
		sectionMatches: make([]float64, len(results)),
		termCoverage:   make([]float64, len(results)),
		phraseMatches:  make([]float64, len(results)),
		proximity:      make([]float64, len(results)),
		titleMatches:   make([]float64, len(results)),
		fieldMatches:   make([]float64, len(results)),
		tabularHits:    make([]float64, len(results)),
	}

	for i, result := range results {
		snapshot := analysisSnapshots[i]
		signals.vectorScores[i] = result.Score
		signals.sparseScores[i] = metadataFloat64Value(result.Metadata, "sparse_score")
		fieldHits := snapshot.fieldTokenHits
		signals.titleMatches[i] = computeFieldMatchScore(queryUniqueTokens, fieldHits[retrievalFieldTitle])
		pathMatches := computeFieldMatchScore(queryUniqueTokens, fieldHits[retrievalFieldPath])
		documentNameMatches := computeFieldMatchScore(queryUniqueTokens, fieldHits[retrievalFieldDocumentName])
		tabularTitleMatches := computeFieldMatchScore(queryUniqueTokens, fieldHits[retrievalFieldTableTitle])
		tableKeyMatches := computeFieldMatchScore(queryUniqueTokens, fieldHits[retrievalFieldTableKey])
		headerMatches := computeFieldMatchScore(queryUniqueTokens, fieldHits[retrievalFieldHeader])

		signals.sectionMatches[i] = max(
			computeSectionPathMatchScoreWithTokens(query, queryTokens, result.Payload.SectionPath, snapshot.sectionPathTokens),
			pathMatches,
		)
		docTokens := snapshot.docTokens
		signals.termCoverage[i] = computeTermCoverageScore(queryTokens, docTokens)
		signals.phraseMatches[i] = computeExactPhraseMatchScoreFromFieldTexts(query, snapshot.fieldTexts)
		signals.proximity[i] = computeTermProximityScore(queryTokens, docTokens)
		signals.fieldMatches[i] = max(signals.titleMatches[i], max(pathMatches, documentNameMatches))
		signals.tabularHits[i] = max(tabularTitleMatches, max(tableKeyMatches, headerMatches))
	}

	return signals
}

func buildScoredResults(
	query string,
	results []*VectorSearchResult[FragmentPayload],
	kb knowledgeBaseRuntimeSnapshot,
	signals similarityScoreSignals,
	shortQuery bool,
) []scoredResult {
	sparseNorm := normalizeScoreValues(signals.sparseScores)
	lexicalNorm := normalizeScoreValues(signals.lexicalScores)
	rerankEnabled := kb.RetrieveConfig != nil && kb.RetrieveConfig.RerankEnabled
	scored := make([]scoredResult, len(results))
	for i := range results {
		hybridScore := clampSimilarityScore(signals.vectorScores[i])
		denseScore := metadataFloat64Value(results[i].Metadata, "dense_score")
		sparseScore := metadataFloat64Value(results[i].Metadata, "sparse_score")
		rrfScore := metadataFloat64Value(results[i].Metadata, "rrf_score")
		scored[i] = scoredResult{
			index:        i,
			hybridScore:  hybridScore,
			denseScore:   denseScore,
			sparseScore:  sparseScore,
			rrfScore:     rrfScore,
			hybridNorm:   hybridScore,
			lexicalNorm:  lexicalNorm[i],
			sparseNorm:   sparseNorm[i],
			sectionMatch: signals.sectionMatches[i],
			termCoverage: signals.termCoverage[i],
			phraseMatch:  signals.phraseMatches[i],
			proximity:    signals.proximity[i],
			titleMatch:   signals.titleMatches[i],
			fieldMatch:   signals.fieldMatches[i],
			tabularHit:   signals.tabularHits[i],
			shortQuery:   shortQuery,
		}
		scored[i].tieBreakScore = computeTieBreakScore(scored[i]) + tabularChunkQueryBoost(query, results[i].Payload.Metadata)
		scored[i].finalScore = hybridScore
		if rerankEnabled {
			scored[i].tieBreakScore += rerankPhraseBoost*signals.phraseMatches[i] +
				rerankProximityBoost*signals.proximity[i] +
				rerankFieldBoost*signals.fieldMatches[i] +
				rerankTitleBoost*signals.titleMatches[i]
		}
	}
	return scored
}

func buildSimilarityResults(
	query string,
	scored []scoredResult,
	results []*VectorSearchResult[FragmentPayload],
	options *SimilaritySearchOptions,
	trace similaritySearchTrace,
) []*SimilarityResult {
	output := make([]*SimilarityResult, len(scored))
	for i, scoredItem := range scored {
		result := results[scoredItem.index]
		metadata := buildSimilarityMetadata(query, result, scoredItem, options, trace)
		output[i] = &SimilarityResult{
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
	query string,
	result *VectorSearchResult[FragmentPayload],
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
	cloned["hybrid_score"] = scoredItem.hybridScore
	cloned["retrieval_pipeline_version"] = string(trace.PipelineVersion)
	if options == nil || !options.Debug {
		return cloned
	}
	cloned["score_breakdown"] = ScoreBreakdown{
		FusionAlgorithm:      metadataStringValue(cloned, "fusion_algorithm"),
		HybridAlpha:          metadataFloat64Value(cloned, "hybrid_alpha"),
		HybridScore:          metadataFloat64Value(cloned, "hybrid_score"),
		HybridNorm:           scoredItem.hybridNorm,
		LexicalNorm:          scoredItem.lexicalNorm,
		SparseNorm:           scoredItem.sparseNorm,
		SectionPathMatch:     scoredItem.sectionMatch,
		TermCoverage:         scoredItem.termCoverage,
		PhraseMatch:          scoredItem.phraseMatch,
		Proximity:            scoredItem.proximity,
		TitleMatch:           scoredItem.titleMatch,
		FieldMatch:           scoredItem.fieldMatch,
		TabularHit:           scoredItem.tabularHit,
		SupportScore:         computeSupportScore(scoredItem),
		SecondaryRankScore:   scoredItem.tieBreakScore,
		DenseScore:           metadataFloat64Value(cloned, "dense_score"),
		SparseScore:          metadataFloat64Value(cloned, "sparse_score"),
		RRFScore:             metadataFloat64Value(cloned, "rrf_score"),
		DenseCutoffThreshold: metadataFloat64Value(cloned, "dense_cutoff_threshold"),
		DenseCutoffApplied:   metadataBoolValue(cloned, "dense_cutoff_applied"),
		RankingScore:         scoredItem.finalScore,
	}
	cloned["applied_filters"] = trace.AppliedFilter
	cloned["query_rewrite"] = map[string]any{
		"original_query":  strings.TrimSpace(query),
		"rewritten_query": trace.RewrittenQuery,
		"used_queries":    trace.UsedQueries,
	}
	cloned["pipeline_version"] = string(trace.PipelineVersion)
	return cloned
}

func sortSimilarityScores(scored []scoredResult, _ knowledgeBaseRuntimeSnapshot) {
	slices.SortStableFunc(scored, func(a, b scoredResult) int {
		switch {
		case a.finalScore > b.finalScore:
			return -1
		case a.finalScore < b.finalScore:
			return 1
		case a.tieBreakScore > b.tieBreakScore:
			return -1
		case a.tieBreakScore < b.tieBreakScore:
			return 1
		case a.fieldMatch > b.fieldMatch:
			return -1
		case a.fieldMatch < b.fieldMatch:
			return 1
		case a.denseScore > b.denseScore:
			return -1
		case a.denseScore < b.denseScore:
			return 1
		case a.rrfScore > b.rrfScore:
			return -1
		case a.rrfScore < b.rrfScore:
			return 1
		default:
			return 0
		}
	})
}

func applySectionPathDiversity(
	scored []scoredResult,
	results []*VectorSearchResult[FragmentPayload],
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
		if computeSupportScore(item) < requiredResultSupportScore(item) {
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

func computeTieBreakScore(item scoredResult) float64 {
	return computeSupportScore(item) + lexicalScoreWeight*item.lexicalNorm +
		sparseScoreWeight*item.sparseNorm +
		sectionPathScoreWeight*item.sectionMatch +
		termCoverageScoreWeight*item.termCoverage +
		phraseScoreWeight*item.phraseMatch +
		proximityScoreWeight*item.proximity +
		fieldMatchScoreWeight*item.fieldMatch +
		titleMatchScoreWeight*item.titleMatch +
		tabularFieldScoreWeight*item.tabularHit
}

func computeSupportScore(item scoredResult) float64 {
	return max(
		clampSimilarityScore(item.denseScore),
		max(
			item.phraseMatch,
			max(item.fieldMatch, max(item.titleMatch, item.termCoverage)),
		),
	)
}

func requiredResultSupportScore(item scoredResult) float64 {
	if item.shortQuery {
		return minShortQuerySupportScore
	}
	return minResultSupportScore
}

func isShortSupportQuery(query string, queryTokens []string) bool {
	normalized := normalizeRetrievalText(query)
	if normalized == "" {
		return false
	}
	if utf8.RuneCountInString(normalized) <= shortQueryMaxRuneCount {
		return true
	}
	return len(queryTokens) <= 1
}

func clampSimilarityScore(score float64) float64 {
	switch {
	case score < 0:
		return 0
	case score > 1:
		return 1
	default:
		return score
	}
}

func resolveHybridSearchConfig(topK int, kb knowledgeBaseRuntimeSnapshot) hybridSearchConfig {
	if topK <= 0 {
		topK = 10
	}

	config := hybridSearchConfig{
		DenseTopK:    min(max(topK*defaultDenseTopKScale, topK), maxCandidateTopK),
		SparseTopK:   min(max(topK*defaultSparseTopKScale, topK), maxCandidateTopK),
		DenseWeight:  defaultDenseWeight,
		SparseWeight: defaultSparseWeight,
	}

	if kb.RetrieveConfig == nil {
		return config
	}
	if multiplier := kb.RetrieveConfig.HybridTopKMultiplier; multiplier > 0 {
		candidateTopK := min(max(topK*multiplier, topK), maxCandidateTopK)
		config.DenseTopK = candidateTopK
		config.SparseTopK = candidateTopK
	}
	if alpha := kb.RetrieveConfig.HybridAlpha; alpha > 0 && alpha < 1 {
		config.DenseWeight = alpha
		config.SparseWeight = 1 - alpha
		config.EffectiveHybridAlpha = alpha
	} else if kb.RetrieveConfig.Weights != nil {
		if setting := kb.RetrieveConfig.Weights.VectorSetting; setting != nil {
			config.DenseWeight = setting.VectorWeight
		}
		if setting := kb.RetrieveConfig.Weights.KeywordSetting; setting != nil {
			config.SparseWeight = setting.KeywordWeight
		}
	}
	totalWeight := config.DenseWeight + config.SparseWeight
	if totalWeight > 0 {
		config.DenseWeight /= totalWeight
		config.SparseWeight /= totalWeight
	}
	config.EffectiveHybridAlpha = config.DenseWeight
	return config
}

func computeLexicalScores(
	queryTokens []string,
	analysisSnapshots []candidateAnalysisSnapshot,
) []float64 {
	scores := make([]float64, len(analysisSnapshots))
	if len(queryTokens) == 0 || len(analysisSnapshots) == 0 {
		return scores
	}

	docTokens := make([]map[string]int, len(analysisSnapshots))
	docLengths := make([]int, len(analysisSnapshots))
	df := make(map[string]int)
	for i, snapshot := range analysisSnapshots {
		tokens := snapshot.docTokens
		docLengths[i] = len(tokens)
		tf := make(map[string]int, len(tokens))
		for _, token := range tokens {
			if tf[token] == 0 {
				df[token]++
			}
			tf[token]++
		}
		docTokens[i] = tf
	}

	nDocs := float64(len(analysisSnapshots))
	for i, tf := range docTokens {
		if docLengths[i] == 0 {
			continue
		}
		score := 0.0
		for _, queryToken := range queryTokens {
			count := tf[queryToken]
			if count == 0 {
				continue
			}
			dfCount := float64(df[queryToken])
			idf := 1 + (nDocs+1)/(dfCount+1)
			tfNorm := float64(count) / float64(docLengths[i])
			score += idf * tfNorm
		}
		scores[i] = score
	}
	return scores
}

func normalizeScoreValues(values []float64) []float64 {
	normalized := make([]float64, len(values))
	if len(values) == 0 {
		return normalized
	}
	minValue := values[0]
	maxValue := values[0]
	for _, value := range values[1:] {
		if value < minValue {
			minValue = value
		}
		if value > maxValue {
			maxValue = value
		}
	}
	if minValue == maxValue {
		return normalized
	}
	for i, value := range values {
		normalized[i] = (value - minValue) / (maxValue - minValue)
	}
	return normalized
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
	if len(queryTokens) == 0 || len(docTokens) == 0 {
		return 0
	}

	matched := 0
	for _, queryToken := range queryTokens {
		if queryToken == "" {
			continue
		}
		if slices.Contains(docTokens, queryToken) {
			matched++
		}
	}
	return float64(matched) / float64(len(queryTokens))
}

func computeFieldMatchScore(queryTokens []string, fieldTokens map[string]struct{}) float64 {
	if len(queryTokens) == 0 || len(fieldTokens) == 0 {
		return 0
	}
	matched := 0
	for _, token := range queryTokens {
		if _, ok := fieldTokens[token]; ok {
			matched++
		}
	}
	if matched == 0 {
		return 0
	}
	return float64(matched) / float64(len(queryTokens))
}

func computeExactPhraseMatchScore(query string, result *VectorSearchResult[FragmentPayload]) float64 {
	return computeExactPhraseMatchScoreFromFieldTexts(query, resultSparseFieldTexts(result))
}

func computeExactPhraseMatchScoreFromFieldTexts(query string, fieldTexts []retrievalFieldText) float64 {
	normalizedQuery := normalizeRetrievalText(strings.ToLower(strings.TrimSpace(query)))
	if normalizedQuery == "" {
		return 0
	}

	for _, fieldText := range fieldTexts {
		target := normalizeRetrievalText(strings.ToLower(strings.TrimSpace(fieldText.Text)))
		if target == "" {
			continue
		}
		if strings.Contains(target, normalizedQuery) {
			return 1
		}
	}
	return 0
}

func computeTermProximityScore(queryTokens, docTokens []string) float64 {
	queryTerms := uniqueNonEmptyStrings(queryTokens...)
	if len(queryTerms) < 2 || len(docTokens) == 0 {
		return 0
	}

	positions := make(map[string][]int, len(queryTerms))
	for index, token := range docTokens {
		positions[token] = append(positions[token], index)
	}

	bestWindow := len(docTokens) + len(queryTerms)
	foundPairs := 0
	for i := range len(queryTerms) - 1 {
		leftPositions := positions[queryTerms[i]]
		rightPositions := positions[queryTerms[i+1]]
		if len(leftPositions) == 0 || len(rightPositions) == 0 {
			continue
		}
		foundPairs++
		bestWindow = min(bestWindow, closestTokenDistance(leftPositions, rightPositions))
	}
	if foundPairs == 0 {
		return 0
	}
	return 1 / float64(max(bestWindow, 1))
}

func closestTokenDistance(leftPositions, rightPositions []int) int {
	best := int(^uint(0) >> 1)
	for _, left := range leftPositions {
		for _, right := range rightPositions {
			best = min(best, abs(left-right))
		}
	}
	return best
}

func abs(value int) int {
	if value < 0 {
		return -value
	}
	return value
}

func metadataFloat64Value(metadata map[string]any, key string) float64 {
	if len(metadata) == 0 {
		return 0
	}
	value, ok := metadata[key]
	if !ok || value == nil {
		return 0
	}
	switch typed := value.(type) {
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int32:
		return float64(typed)
	case int64:
		return float64(typed)
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
