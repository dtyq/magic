package retrieval

import (
	"context"
	"maps"
	"slices"
	"strings"

	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
)

const (
	defaultContextTopK    = 2
	contextNeighborWindow = 1
	contextTokenBudget    = 320
	contextDocumentLimit  = 4096
)

type fragmentContextSnapshot struct {
	ChunkType         string
	TableID           string
	RowIndex          int
	RowSubchunkIndex  int
	SectionPath       string
	SectionTitle      string
	TreeNodeID        string
	ParentNodeID      string
	SectionChunkIndex int
	ChunkIndex        int
}

type fragmentContextBatchReader interface {
	ListContextByDocuments(
		ctx context.Context,
		documentKeys []DocumentKey,
		limit int,
	) (map[DocumentKey][]*KnowledgeBaseFragment, error)
}

func buildFragmentContextSnapshot(metadata map[string]any) fragmentContextSnapshot {
	return fragmentContextSnapshot{
		ChunkType:         strings.TrimSpace(metadataStringValue(metadata, parseddocument.MetaChunkType)),
		TableID:           strings.TrimSpace(metadataStringValue(metadata, parseddocument.MetaTableID)),
		RowIndex:          metadataIntValue(metadata, parseddocument.MetaRowIndex),
		RowSubchunkIndex:  metadataIntValue(metadata, parseddocument.MetaRowSubchunkIndex),
		SectionPath:       strings.TrimSpace(metadataStringValue(metadata, "section_path")),
		SectionTitle:      strings.TrimSpace(metadataStringValue(metadata, "section_title")),
		TreeNodeID:        strings.TrimSpace(metadataStringValue(metadata, "tree_node_id")),
		ParentNodeID:      strings.TrimSpace(metadataStringValue(metadata, "parent_node_id")),
		SectionChunkIndex: metadataIntValue(metadata, "section_chunk_index"),
		ChunkIndex:        metadataIntValue(metadata, "chunk_index"),
	}
}

type fragmentContextLookup struct {
	FragmentID int64
	BusinessID string
}

func (lookup fragmentContextLookup) isEmpty() bool {
	return lookup.FragmentID <= 0 && strings.TrimSpace(lookup.BusinessID) == ""
}

func metadataIntValue(metadata map[string]any, key string) int {
	if len(metadata) == 0 {
		return 0
	}
	raw, ok := metadata[key]
	if !ok {
		if ext, ok := metadata["ext"].(map[string]any); ok {
			raw = ext[key]
		}
		if raw == nil {
			return 0
		}
	}
	switch value := raw.(type) {
	case int:
		return value
	case int32:
		return int(value)
	case int64:
		return int(value)
	case float64:
		return int(value)
	default:
		return 0
	}
}

func enrichSimilarityResultsWithContext(
	ctx context.Context,
	results []*SimilarityResult,
	repo KnowledgeBaseFragmentReader,
	analyzer retrievalAnalyzer,
) []*SimilarityResult {
	if len(results) == 0 || repo == nil {
		return results
	}

	docCache := loadContextFragmentsByDocument(ctx, results, repo)
	pointIDIndex := buildContextFragmentPointIndex(docCache)
	backfillSimilarityResultFragmentFieldsFromIndex(results, pointIDIndex)
	for _, result := range results {
		if result == nil {
			continue
		}
		documentKey := contextDocumentKeyFromResult(result)
		documentCode := strings.TrimSpace(result.DocumentCode)
		if documentKey.KnowledgeCode == "" || documentCode == "" {
			continue
		}
		fragments, ok := docCache[documentKey]
		if !ok {
			list, _, err := repo.ListByDocument(ctx, documentKey.KnowledgeCode, documentCode, 0, contextDocumentLimit)
			if err != nil {
				backfillSimilarityResultFragmentFieldsByLookup(ctx, result, repo, pointIDIndex)
				continue
			}
			fragments = list
			docCache[documentKey] = fragments
			indexContextFragmentPointIDs(pointIDIndex, fragments)
		}
		backfillSimilarityResultFragmentFieldsFromIndexForResult(result, pointIDIndex)
		backfillSimilarityResultFragmentFieldsByLookup(ctx, result, repo, pointIDIndex)
		result.Content, result.Metadata = assembleSimilarityContext(result, fragments, analyzer)
	}
	return results
}

func loadContextFragmentsByDocument(
	ctx context.Context,
	results []*SimilarityResult,
	repo KnowledgeBaseFragmentReader,
) map[DocumentKey][]*KnowledgeBaseFragment {
	documentKeys := collectContextDocumentKeys(results)
	docCache := make(map[DocumentKey][]*KnowledgeBaseFragment, len(documentKeys))
	if len(documentKeys) == 0 {
		return docCache
	}

	if batchRepo, ok := repo.(fragmentContextBatchReader); ok {
		grouped, err := batchRepo.ListContextByDocuments(ctx, documentKeys, contextDocumentLimit)
		if err == nil {
			maps.Copy(docCache, grouped)
		}
	}

	return docCache
}

func backfillSimilarityResultFragmentFieldsFromIndex(
	results []*SimilarityResult,
	pointIDIndex map[string]fragmentContextLookup,
) {
	if len(results) == 0 {
		return
	}

	for _, result := range results {
		backfillSimilarityResultFragmentFieldsFromIndexForResult(result, pointIDIndex)
	}
}

func collectContextDocumentKeys(results []*SimilarityResult) []DocumentKey {
	seen := make(map[DocumentKey]struct{}, min(len(results), defaultContextTopK))
	documentKeys := make([]DocumentKey, 0, len(results))
	for _, result := range results {
		if result == nil {
			continue
		}
		documentKey := contextDocumentKeyFromResult(result)
		if documentKey.KnowledgeCode == "" || documentKey.DocumentCode == "" {
			continue
		}
		if _, exists := seen[documentKey]; exists {
			continue
		}
		seen[documentKey] = struct{}{}
		documentKeys = append(documentKeys, documentKey)
	}
	return documentKeys
}

func buildContextFragmentPointIndex(docCache map[DocumentKey][]*KnowledgeBaseFragment) map[string]fragmentContextLookup {
	if len(docCache) == 0 {
		return map[string]fragmentContextLookup{}
	}
	index := make(map[string]fragmentContextLookup, len(docCache))
	for _, fragments := range docCache {
		indexContextFragmentPointIDs(index, fragments)
	}
	return index
}

func contextDocumentKeyFromResult(result *SimilarityResult) DocumentKey {
	if result == nil {
		return DocumentKey{}
	}
	return DocumentKey{
		KnowledgeCode: strings.TrimSpace(result.KnowledgeCode),
		DocumentCode:  strings.TrimSpace(result.DocumentCode),
	}
}

func indexContextFragmentPointIDs(index map[string]fragmentContextLookup, fragments []*KnowledgeBaseFragment) {
	if len(fragments) == 0 {
		return
	}
	for _, fragment := range fragments {
		if fragment == nil {
			continue
		}
		pointID := strings.TrimSpace(fragment.PointID)
		if pointID == "" {
			continue
		}
		lookup := buildFragmentContextLookup(fragment)
		if lookup.isEmpty() {
			continue
		}
		existing := index[pointID]
		if existing.FragmentID <= 0 && lookup.FragmentID > 0 {
			existing.FragmentID = lookup.FragmentID
		}
		if strings.TrimSpace(existing.BusinessID) == "" && strings.TrimSpace(lookup.BusinessID) != "" {
			existing.BusinessID = lookup.BusinessID
		}
		index[pointID] = existing
	}
}

func buildFragmentContextLookup(fragment *KnowledgeBaseFragment) fragmentContextLookup {
	if fragment == nil {
		return fragmentContextLookup{}
	}
	return fragmentContextLookup{
		FragmentID: fragment.ID,
		BusinessID: strings.TrimSpace(fragment.BusinessID),
	}
}

func backfillSimilarityResultFragmentFieldsFromIndexForResult(
	result *SimilarityResult,
	pointIDIndex map[string]fragmentContextLookup,
) {
	if result == nil || (result.FragmentID != 0 && strings.TrimSpace(result.BusinessID) != "") {
		return
	}
	pointID := strings.TrimSpace(metadataStringValue(result.Metadata, "point_id"))
	if pointID == "" {
		return
	}
	applySimilarityResultFragmentLookup(result, pointIDIndex[pointID])
}

func applySimilarityResultFragmentLookup(result *SimilarityResult, lookup fragmentContextLookup) {
	if result == nil || lookup.isEmpty() {
		return
	}
	if result.FragmentID == 0 && lookup.FragmentID > 0 {
		result.FragmentID = lookup.FragmentID
	}
	if strings.TrimSpace(result.BusinessID) == "" && strings.TrimSpace(lookup.BusinessID) != "" {
		result.BusinessID = lookup.BusinessID
	}
}

func backfillSimilarityResultFragmentFieldsByLookup(
	ctx context.Context,
	result *SimilarityResult,
	repo KnowledgeBaseFragmentReader,
	pointIDIndex map[string]fragmentContextLookup,
) {
	if result == nil || repo == nil || (result.FragmentID != 0 && strings.TrimSpace(result.BusinessID) != "") {
		return
	}
	pointID := strings.TrimSpace(metadataStringValue(result.Metadata, "point_id"))
	if pointID == "" {
		return
	}
	documentKey := contextDocumentKeyFromResult(result)
	if documentKey.KnowledgeCode == "" || documentKey.DocumentCode == "" {
		return
	}
	fragment, err := repo.FindByPointID(ctx, documentKey.KnowledgeCode, documentKey.DocumentCode, pointID)
	if err != nil || fragment == nil {
		return
	}
	lookup := buildFragmentContextLookup(fragment)
	if lookup.isEmpty() {
		return
	}
	pointIDIndex[pointID] = lookup
	applySimilarityResultFragmentLookup(result, lookup)
}

func assembleSimilarityContext(
	result *SimilarityResult,
	fragments []*KnowledgeBaseFragment,
	analyzer retrievalAnalyzer,
) (string, map[string]any) {
	if result == nil {
		return "", nil
	}
	metadata := cloneMetadata(result.Metadata)
	snapshot := buildFragmentContextSnapshot(metadata)
	metadata["hit_chunk"] = result.Content

	if snapshot.SectionPath != "" {
		metadata["context_section_path"] = snapshot.SectionPath
	}

	if snapshot.SectionPath == "" || len(fragments) == 0 {
		return result.Content, metadata
	}
	if snapshot.ChunkType == parseddocument.BlockTypeTableRow {
		return assembleTabularRowContext(result, metadata, fragments, snapshot)
	}
	if snapshot.ChunkType == parseddocument.BlockTypeTableSummary {
		return result.Content, metadata
	}

	neighbors := collectNeighborChunks(result.DocumentCode, snapshot, fragments)
	if len(neighbors) == 0 {
		return result.Content, metadata
	}

	parentHeadings := splitParentHeadings(snapshot.SectionPath, snapshot.SectionTitle)
	contextChunks := make([]string, 0, 1+len(neighbors))
	contextChunks = append(contextChunks, result.Content)
	for _, chunk := range neighbors {
		if strings.TrimSpace(chunk) == "" || chunk == result.Content {
			continue
		}
		contextChunks = append(contextChunks, chunk)
	}
	contextChunks = trimChunksByTokenBudgetWithAnalyzer(contextChunks, contextTokenBudget, analyzer)
	metadata["parent_headings"] = parentHeadings
	metadata["neighbor_chunks"] = contextChunks[1:]
	metadata["section_path"] = snapshot.SectionPath
	if snapshot.SectionTitle != "" {
		metadata["section_title"] = snapshot.SectionTitle
	}

	return strings.Join(contextChunks, "\n\n"), metadata
}

func assembleTabularRowContext(
	result *SimilarityResult,
	metadata map[string]any,
	fragments []*KnowledgeBaseFragment,
	snapshot fragmentContextSnapshot,
) (string, map[string]any) {
	rowChunks := collectTabularRowChunks(result.DocumentCode, snapshot, fragments)
	if len(rowChunks) == 0 {
		return result.Content, metadata
	}
	metadata["row_context_chunks"] = rowChunks
	return strings.Join(rowChunks, "\n\n"), metadata
}

func collectTabularRowChunks(
	documentCode string,
	snapshot fragmentContextSnapshot,
	fragments []*KnowledgeBaseFragment,
) []string {
	type candidate struct {
		subchunk int
		content  string
	}
	candidates := make([]candidate, 0, len(fragments))
	for _, fragment := range fragments {
		if fragment == nil || fragment.DocumentCode != documentCode {
			continue
		}
		metadata := fragment.Metadata
		if strings.TrimSpace(metadataStringValue(metadata, parseddocument.MetaChunkType)) != parseddocument.BlockTypeTableRow {
			continue
		}
		if strings.TrimSpace(metadataStringValue(metadata, parseddocument.MetaTableID)) != snapshot.TableID {
			continue
		}
		if metadataIntValue(metadata, parseddocument.MetaRowIndex) != snapshot.RowIndex {
			continue
		}
		candidates = append(candidates, candidate{
			subchunk: metadataIntValue(metadata, parseddocument.MetaRowSubchunkIndex),
			content:  fragment.Content,
		})
	}
	if len(candidates) == 0 {
		return nil
	}
	slices.SortFunc(candidates, func(a, b candidate) int {
		switch {
		case a.subchunk < b.subchunk:
			return -1
		case a.subchunk > b.subchunk:
			return 1
		default:
			return strings.Compare(a.content, b.content)
		}
	})
	result := make([]string, 0, len(candidates))
	for _, candidate := range candidates {
		if strings.TrimSpace(candidate.content) == "" {
			continue
		}
		if len(result) > 0 && result[len(result)-1] == candidate.content {
			continue
		}
		result = append(result, candidate.content)
	}
	return result
}

func collectNeighborChunks(documentCode string, snapshot fragmentContextSnapshot, fragments []*KnowledgeBaseFragment) []string {
	if snapshot.SectionPath == "" {
		return nil
	}
	type candidate struct {
		index   int
		content string
	}
	candidates := make([]candidate, 0, len(fragments))
	currentIndex := snapshot.SectionChunkIndex
	if currentIndex == 0 {
		currentIndex = snapshot.ChunkIndex
	}
	for _, fragment := range fragments {
		if fragment == nil || fragment.DocumentCode != documentCode {
			continue
		}
		sectionPath, _ := resolveSectionPath(fragment.SectionPath, fragment.Metadata)
		if strings.TrimSpace(sectionPath) != snapshot.SectionPath {
			continue
		}
		index := metadataIntValue(fragment.Metadata, "section_chunk_index")
		if index == 0 {
			index = fragment.ChunkIndex
		}
		candidates = append(candidates, candidate{index: index, content: fragment.Content})
	}
	if len(candidates) == 0 {
		return nil
	}
	slices.SortFunc(candidates, func(a, b candidate) int {
		switch {
		case a.index < b.index:
			return -1
		case a.index > b.index:
			return 1
		default:
			return strings.Compare(a.content, b.content)
		}
	})

	result := make([]string, 0, contextNeighborWindow*2)
	for _, item := range candidates {
		if item.index == currentIndex {
			continue
		}
		if absInt(item.index-currentIndex) > contextNeighborWindow {
			continue
		}
		result = append(result, item.content)
	}
	return result
}

func splitParentHeadings(sectionPath, sectionTitle string) []string {
	parts := strings.Split(sectionPath, ">")
	headings := make([]string, 0, len(parts))
	for _, part := range parts {
		trimmed := strings.TrimSpace(part)
		if trimmed == "" {
			continue
		}
		if sectionTitle != "" && trimmed == sectionTitle {
			continue
		}
		headings = append(headings, trimmed)
	}
	return headings
}

func trimChunksByTokenBudgetWithAnalyzer(chunks []string, budget int, analyzer retrievalAnalyzer) []string {
	if len(chunks) == 0 || budget <= 0 {
		return chunks
	}
	total := 0
	result := make([]string, 0, len(chunks))
	for _, chunk := range chunks {
		tokenCount := len(analyzer.tokenTerms(chunk))
		if tokenCount == 0 {
			continue
		}
		if len(result) > 0 && total+tokenCount > budget {
			break
		}
		total += tokenCount
		result = append(result, chunk)
	}
	return result
}

func absInt(value int) int {
	if value < 0 {
		return -value
	}
	return value
}
