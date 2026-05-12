package retrieval

import (
	"slices"
	"strings"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
)

const (
	hybridFusionAlgorithmRelativeScore = "relative_score"
	defaultDenseWeight                 = 0.55
	defaultSparseWeight                = 0.45
	defaultDenseTopKScale              = 2
	defaultSparseTopKScale             = 3
	minDenseCandidateTopK              = 20
	minSparseCandidateTopK             = 30
)

type hybridSearchResult struct {
	result             *shared.VectorSearchResult[fragmodel.FragmentPayload]
	hybridScore        float64
	rrfScore           float64
	denseScore         float64
	sparseScore        float64
	denseScoreNorm     float64
	sparseScoreNorm    float64
	denseContribution  float64
	sparseContribution float64
	denseRank          int
	sparseRank         int
	fusionScoreNorm    float64
}

type hybridSearchConfig struct {
	DenseTopK            int
	SparseTopK           int
	DenseWeight          float64
	SparseWeight         float64
	EffectiveHybridAlpha float64
	LegacyWeightUpgraded bool
}

func fuseHybridResults(
	denseResults []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	sparseResults []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	config hybridSearchConfig,
) []*shared.VectorSearchResult[fragmodel.FragmentPayload] {
	fused := make(map[string]*hybridSearchResult, len(denseResults)+len(sparseResults))
	mergeHybridChannel(fused, denseResults, "dense")
	mergeHybridChannel(fused, sparseResults, "sparse")

	results := make([]*hybridSearchResult, 0, len(fused))
	for _, item := range fused {
		results = append(results, item)
	}
	applyRelativeScoreFusion(results, denseResults, sparseResults, config)
	for _, item := range results {
		finalizeHybridResult(item, config)
	}

	slices.SortFunc(results, func(a, b *hybridSearchResult) int {
		switch {
		case a.hybridScore > b.hybridScore:
			return -1
		case a.hybridScore < b.hybridScore:
			return 1
		case a.denseScore > b.denseScore:
			return -1
		case a.denseScore < b.denseScore:
			return 1
		case a.sparseScore > b.sparseScore:
			return -1
		case a.sparseScore < b.sparseScore:
			return 1
		default:
			return strings.Compare(hybridResultKey(a.result), hybridResultKey(b.result))
		}
	})

	fusedResults := make([]*shared.VectorSearchResult[fragmodel.FragmentPayload], 0, len(results))
	for _, item := range results {
		fusedResults = append(fusedResults, item.result)
	}
	return fusedResults
}

func mergeHybridChannel(
	fused map[string]*hybridSearchResult,
	results []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	channel string,
) {
	for rank, result := range results {
		if result == nil {
			continue
		}
		key := hybridResultKey(result)
		if key == "" {
			continue
		}
		entry, ok := fused[key]
		if !ok {
			entry = &hybridSearchResult{
				result:     cloneVectorSearchResult(result),
				denseRank:  -1,
				sparseRank: -1,
			}
			fused[key] = entry
		}
		updateHybridChannelScore(entry, channel, rank, result.Score)
		if entry.result.Score < result.Score {
			entry.result = cloneVectorSearchResult(result)
		}
	}
}

func updateHybridChannelScore(entry *hybridSearchResult, channel string, rank int, score float64) {
	switch channel {
	case "dense":
		entry.denseScore = max(entry.denseScore, score)
		entry.denseRank = minRank(entry.denseRank, rank)
	case "sparse":
		entry.sparseScore = max(entry.sparseScore, score)
		entry.sparseRank = minRank(entry.sparseRank, rank)
	}
}

func applyRelativeScoreFusion(
	results []*hybridSearchResult,
	denseResults []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	sparseResults []*shared.VectorSearchResult[fragmodel.FragmentPayload],
	config hybridSearchConfig,
) {
	denseMin, denseMax, denseHasResults, denseHasRange := relativeScoreBounds(denseResults)
	sparseMin, sparseMax, sparseHasResults, sparseHasRange := relativeScoreBounds(sparseResults)
	for _, item := range results {
		if item == nil {
			continue
		}
		if item.denseRank >= 0 && denseHasResults {
			item.denseScoreNorm = relativeScoreValue(item.denseScore, denseMin, denseMax, denseHasRange)
			item.denseContribution = item.denseScoreNorm * config.DenseWeight
		}
		if item.sparseRank >= 0 && sparseHasResults {
			item.sparseScoreNorm = relativeScoreValue(item.sparseScore, sparseMin, sparseMax, sparseHasRange)
			item.sparseContribution = item.sparseScoreNorm * config.SparseWeight
		}
		item.hybridScore = item.denseContribution + item.sparseContribution
		item.fusionScoreNorm = item.hybridScore
		item.rrfScore = 0
	}
}

func relativeScoreBounds(results []*shared.VectorSearchResult[fragmodel.FragmentPayload]) (
	minScore float64,
	maxScore float64,
	hasResults bool,
	hasRange bool,
) {
	for _, result := range results {
		if result == nil {
			continue
		}
		if !hasResults {
			minScore = result.Score
			maxScore = result.Score
			hasResults = true
			continue
		}
		minScore = min(minScore, result.Score)
		maxScore = max(maxScore, result.Score)
	}
	if !hasResults {
		return 0, 0, false, false
	}
	return minScore, maxScore, true, maxScore != minScore
}

func relativeScoreValue(score, minScore, maxScore float64, hasRange bool) float64 {
	if !hasRange {
		return 1
	}
	return (score - minScore) / (maxScore - minScore)
}

func finalizeHybridResult(item *hybridSearchResult, config hybridSearchConfig) {
	if item == nil || item.result == nil {
		return
	}
	if item.result.Metadata == nil {
		item.result.Metadata = map[string]any{}
	}
	item.result.Metadata["fusion_algorithm"] = hybridFusionAlgorithmRelativeScore
	item.result.Metadata["hybrid_score"] = item.hybridScore
	item.result.Metadata["hybrid_alpha"] = config.EffectiveHybridAlpha
	item.result.Metadata["rrf_score"] = item.rrfScore
	item.result.Metadata["dense_score"] = item.denseScore
	item.result.Metadata["sparse_score"] = item.sparseScore
	item.result.Metadata["dense_score_norm"] = item.denseScoreNorm
	item.result.Metadata["sparse_score_norm"] = item.sparseScoreNorm
	item.result.Metadata["dense_contribution"] = item.denseContribution
	item.result.Metadata["sparse_contribution"] = item.sparseContribution
	item.result.Metadata["fusion_score_norm"] = item.fusionScoreNorm
	item.result.Metadata["channel_presence"] = hybridChannelPresence(item)
	item.result.Metadata["legacy_weight_upgraded"] = config.LegacyWeightUpgraded
	if item.denseRank >= 0 {
		item.result.Metadata["dense_rank"] = item.denseRank + 1
	}
	if item.sparseRank >= 0 {
		item.result.Metadata["sparse_rank"] = item.sparseRank + 1
	}
	item.result.Score = item.hybridScore
}

func hybridChannelPresence(item *hybridSearchResult) string {
	switch {
	case item == nil:
		return ""
	case item.denseRank >= 0 && item.sparseRank >= 0:
		return "hybrid"
	case item.denseRank >= 0:
		return "dense_only"
	case item.sparseRank >= 0:
		return "sparse_only"
	default:
		return ""
	}
}

func hybridResultKey(result *shared.VectorSearchResult[fragmodel.FragmentPayload]) string {
	if result == nil {
		return ""
	}
	if key := strings.TrimSpace(result.ID); key != "" {
		return key
	}
	if pointID := strings.TrimSpace(result.Payload.ContentHash); pointID != "" {
		return strings.TrimSpace(result.Payload.DocumentCode) + "::" + pointID
	}
	return strings.TrimSpace(result.Payload.DocumentCode) + "::" + strings.TrimSpace(result.Content)
}

func cloneVectorSearchResult(result *shared.VectorSearchResult[fragmodel.FragmentPayload]) *shared.VectorSearchResult[fragmodel.FragmentPayload] {
	if result == nil {
		return nil
	}
	cloned := *result
	cloned.Payload = result.Payload
	cloned.Metadata = cloneMetadata(result.Metadata)
	return &cloned
}

func minRank(current, candidate int) int {
	if current < 0 {
		return candidate
	}
	return min(current, candidate)
}
