package retrieval

import (
	"slices"
	"strings"
)

const (
	rrfK                   = 60.0
	hybridFusionAlgorithm  = "relative_score"
	defaultDenseWeight     = 0.55
	defaultSparseWeight    = 0.45
	defaultDenseTopKScale  = 8
	defaultSparseTopKScale = 12
)

type hybridSearchResult struct {
	result             *VectorSearchResult[FragmentPayload]
	hybridScore        float64
	rrfScore           float64
	denseScore         float64
	sparseScore        float64
	denseRank          int
	sparseRank         int
	denseNorm          float64
	sparseNorm         float64
	denseCutoffApplied bool
}

type hybridSearchConfig struct {
	DenseTopK            int
	SparseTopK           int
	DenseWeight          float64
	SparseWeight         float64
	DenseCutoffThreshold float64
	EffectiveHybridAlpha float64
}

func fuseHybridResults(
	denseResults []*VectorSearchResult[FragmentPayload],
	sparseResults []*VectorSearchResult[FragmentPayload],
	config hybridSearchConfig,
) []*VectorSearchResult[FragmentPayload] {
	sparseResults, denseCutoffApplied := applyDenseCutoffToSparseResults(denseResults, sparseResults, config.DenseCutoffThreshold)

	fused := make(map[string]*hybridSearchResult, len(denseResults)+len(sparseResults))
	mergeHybridChannel(fused, denseResults, "dense", config.DenseWeight, denseCutoffApplied)
	mergeHybridChannel(fused, sparseResults, "sparse", config.SparseWeight, denseCutoffApplied)

	applyRelativeScoreFusion(fused, denseResults, "dense", config.DenseWeight)
	applyRelativeScoreFusion(fused, sparseResults, "sparse", config.SparseWeight)

	results := make([]*hybridSearchResult, 0, len(fused))
	for _, item := range fused {
		finalizeHybridResult(item, config)
		results = append(results, item)
	}

	slices.SortFunc(results, func(a, b *hybridSearchResult) int {
		switch {
		case a.hybridScore > b.hybridScore:
			return -1
		case a.hybridScore < b.hybridScore:
			return 1
		case a.rrfScore > b.rrfScore:
			return -1
		case a.rrfScore < b.rrfScore:
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

	fusedResults := make([]*VectorSearchResult[FragmentPayload], 0, len(results))
	for _, item := range results {
		fusedResults = append(fusedResults, item.result)
	}
	return fusedResults
}

func mergeHybridChannel(
	fused map[string]*hybridSearchResult,
	results []*VectorSearchResult[FragmentPayload],
	channel string,
	weight float64,
	denseCutoffApplied bool,
) {
	if weight <= 0 {
		return
	}
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
				result:             cloneVectorSearchResult(result),
				denseRank:          -1,
				sparseRank:         -1,
				denseCutoffApplied: denseCutoffApplied,
			}
			fused[key] = entry
		}
		entry.rrfScore += weight / (rrfK + float64(rank) + 1.0)
		updateHybridChannelScore(entry, channel, rank, result.Score)
		if entry.result.Score < result.Score {
			entry.result = cloneVectorSearchResult(result)
		}
	}
}

func applyRelativeScoreFusion(
	fused map[string]*hybridSearchResult,
	results []*VectorSearchResult[FragmentPayload],
	channel string,
	weight float64,
) {
	if weight <= 0 || len(results) == 0 {
		return
	}

	minScore := results[0].Score
	maxScore := results[0].Score
	for _, result := range results[1:] {
		if result == nil {
			continue
		}
		minScore = min(minScore, result.Score)
		maxScore = max(maxScore, result.Score)
	}

	for _, result := range results {
		if result == nil {
			continue
		}
		key := hybridResultKey(result)
		if key == "" {
			continue
		}
		entry, ok := fused[key]
		if !ok {
			continue
		}

		score := weight
		if maxScore != minScore {
			score *= (result.Score - minScore) / (maxScore - minScore)
		}
		entry.hybridScore += score
		switch channel {
		case "dense":
			entry.denseNorm = score
		case "sparse":
			entry.sparseNorm = score
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

func finalizeHybridResult(item *hybridSearchResult, config hybridSearchConfig) {
	if item == nil || item.result == nil {
		return
	}
	if item.result.Metadata == nil {
		item.result.Metadata = map[string]any{}
	}
	item.result.Metadata["fusion_algorithm"] = hybridFusionAlgorithm
	item.result.Metadata["hybrid_score"] = item.hybridScore
	item.result.Metadata["hybrid_alpha"] = config.EffectiveHybridAlpha
	item.result.Metadata["rrf_score"] = item.rrfScore
	item.result.Metadata["dense_score"] = item.denseScore
	item.result.Metadata["sparse_score"] = item.sparseScore
	item.result.Metadata["dense_norm_score"] = item.denseNorm
	item.result.Metadata["sparse_norm_score"] = item.sparseNorm
	item.result.Metadata["dense_cutoff_threshold"] = config.DenseCutoffThreshold
	item.result.Metadata["dense_cutoff_applied"] = item.denseCutoffApplied
	if item.denseRank >= 0 {
		item.result.Metadata["dense_rank"] = item.denseRank + 1
	}
	if item.sparseRank >= 0 {
		item.result.Metadata["sparse_rank"] = item.sparseRank + 1
	}
	item.result.Score = item.hybridScore
}

func applyDenseCutoffToSparseResults(
	denseResults []*VectorSearchResult[FragmentPayload],
	sparseResults []*VectorSearchResult[FragmentPayload],
	threshold float64,
) ([]*VectorSearchResult[FragmentPayload], bool) {
	if threshold <= 0 || len(denseResults) == 0 || len(sparseResults) == 0 {
		return sparseResults, false
	}

	allowed := make(map[string]struct{}, len(denseResults))
	for _, result := range denseResults {
		key := hybridResultKey(result)
		if key == "" {
			continue
		}
		allowed[key] = struct{}{}
	}
	if len(allowed) == 0 {
		return sparseResults, false
	}

	filtered := make([]*VectorSearchResult[FragmentPayload], 0, len(sparseResults))
	for _, result := range sparseResults {
		key := hybridResultKey(result)
		if key == "" {
			continue
		}
		if _, ok := allowed[key]; ok {
			filtered = append(filtered, result)
		}
	}
	return filtered, true
}

func hybridResultKey(result *VectorSearchResult[FragmentPayload]) string {
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

func cloneVectorSearchResult(result *VectorSearchResult[FragmentPayload]) *VectorSearchResult[FragmentPayload] {
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
