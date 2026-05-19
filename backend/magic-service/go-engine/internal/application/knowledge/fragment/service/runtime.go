package fragapp

import (
	"context"
	"fmt"
	"strings"
	"time"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	"magic/internal/constants"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/logkey"
)

const (
	runtimeSimilarityDefaultTopK             = 10
	runtimeSimilarityCandidateScoreThreshold = 0.1
	runtimeDestroyBatchSize                  = 1000
)

type runtimeSliceValueKind int

const (
	runtimeSliceValueUnknown runtimeSliceValueKind = iota
	runtimeSliceValueString
	runtimeSliceValueNumber
)

// RuntimeCreate 为 flow/teamshare runtime 创建片段并同步写入向量库。
func (s *FragmentAppService) RuntimeCreate(
	ctx context.Context,
	input *fragdto.RuntimeCreateFragmentInput,
) (*fragdto.FragmentDTO, error) {
	if input == nil {
		return nil, shared.ErrFragmentDocumentCodeRequired
	}
	if err := s.authorizeKnowledgeBaseAction(ctx, input.OrganizationCode, input.UserID, input.KnowledgeCode, "edit"); err != nil {
		return nil, err
	}

	kb, err := s.loadScopedKnowledgeBase(ctx, input.OrganizationCode, input.KnowledgeCode)
	if err != nil {
		return nil, err
	}
	s.applyResolvedRouteToKnowledgeBase(ctx, kb)
	kbSnapshot := knowledgeBaseSnapshotFromDomain(kb)

	fragment, err := s.runtimeCreateFragment(ctx, kb, input)
	if err != nil {
		return nil, err
	}
	if err := s.fragmentService.SyncFragment(ctx, kbSnapshot, fragment, input.BusinessParams); err != nil {
		return nil, fmt.Errorf("sync runtime fragment: %w", err)
	}
	return s.entityToDTO(fragment), nil
}

// RuntimeSimilarity 为 flow/teamshare runtime 执行多知识库相似度搜索。
func (s *FragmentAppService) RuntimeSimilarity(
	ctx context.Context,
	input *fragdto.RuntimeSimilarityInput,
) ([]*fragdto.SimilarityResultDTO, error) {
	if input == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}
	knowledgeCodes := uniqueRuntimeKnowledgeCodes(input.KnowledgeCodes)
	if len(knowledgeCodes) == 0 {
		return nil, shared.ErrKnowledgeBaseNotFound
	}

	knowledgeBases, err := s.loadScopedKnowledgeBases(ctx, input.OrganizationCode, knowledgeCodes)
	if err != nil {
		return nil, err
	}
	for _, kb := range knowledgeBases {
		if !kb.Enabled {
			return nil, shared.ErrKnowledgeBaseDisabled
		}
		s.applyResolvedRouteToKnowledgeBase(ctx, kb)
	}

	topK, scoreThreshold := resolveRuntimeSimilarityConfig(input, knowledgeBases[0])
	metadataFilter := buildRuntimeMetadataFilter(input.MetadataFilter)

	results := make([]*fragdto.SimilarityResultDTO, 0, len(knowledgeBases)*topK)
	for _, kb := range knowledgeBases {
		partial, err := s.runtimeSimilarityByKnowledgeBase(ctx, kb, input, topK, scoreThreshold, metadataFilter)
		if err != nil {
			return nil, err
		}
		results = append(results, partial...)
	}
	return results, nil
}

// RuntimeDestroyByBusinessID 为 flow/teamshare runtime 按 business_id 删除片段。
func (s *FragmentAppService) RuntimeDestroyByBusinessID(
	ctx context.Context,
	input *fragdto.RuntimeDestroyByBusinessIDInput,
) error {
	if input == nil {
		return shared.ErrFragmentNotFound
	}
	if err := s.authorizeKnowledgeBaseAction(ctx, input.OrganizationCode, "", input.KnowledgeCode, "delete"); err != nil {
		return err
	}

	kb, err := s.loadScopedKnowledgeBase(ctx, input.OrganizationCode, input.KnowledgeCode)
	if err != nil {
		return err
	}
	fragments, err := s.listFragmentsByBusinessID(ctx, kb.Code, input.BusinessID)
	if err != nil {
		return err
	}
	if len(fragments) == 0 {
		return shared.ErrFragmentNotFound
	}
	route := s.kbService.ResolveRuntimeRoute(ctx, kb)
	if err := s.fragmentService.DestroyBatch(ctx, fragments, route.VectorCollectionName); err != nil {
		return fmt.Errorf("destroy fragments by business id: %w", err)
	}
	return nil
}

// RuntimeDestroyByMetadataFilter 为 flow/teamshare runtime 按 metadata filter 删除片段。
func (s *FragmentAppService) RuntimeDestroyByMetadataFilter(
	ctx context.Context,
	input *fragdto.RuntimeDestroyByMetadataFilterInput,
) error {
	if input == nil {
		return shared.ErrFragmentMetadataFilterRequired
	}
	if err := s.authorizeKnowledgeBaseAction(ctx, input.OrganizationCode, "", input.KnowledgeCode, "delete"); err != nil {
		return err
	}

	metadataFilter := buildRuntimeMetadataFilter(input.MetadataFilter)
	if metadataFilter == nil {
		return shared.ErrFragmentMetadataFilterRequired
	}

	kb, err := s.loadScopedKnowledgeBase(ctx, input.OrganizationCode, input.KnowledgeCode)
	if err != nil {
		return err
	}
	route := s.kbService.ResolveRuntimeRoute(ctx, kb)
	filter := mergeRuntimeVectorFilters(buildRuntimeKnowledgeBaseFilter(kb), metadataFilter)

	for {
		pointIDs, err := s.fragmentService.ListPointIDsByFilter(ctx, route.VectorCollectionName, filter, runtimeDestroyBatchSize)
		if err != nil {
			return fmt.Errorf("list point ids by metadata filter: %w", err)
		}
		pointIDs = uniqueStrings(pointIDs)
		if len(pointIDs) == 0 {
			return nil
		}

		fragments, err := s.fragmentService.FindByPointIDs(ctx, pointIDs)
		if err != nil {
			return fmt.Errorf("find fragments by point ids: %w", err)
		}
		fragments = appendMissingPointFragments(fragments, pointIDs)
		if err := s.fragmentService.DestroyBatch(ctx, fragments, route.VectorCollectionName); err != nil {
			return fmt.Errorf("destroy fragments by metadata filter: %w", err)
		}
	}
}

func (s *FragmentAppService) runtimeCreateFragment(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	input *fragdto.RuntimeCreateFragmentInput,
) (*fragmodel.KnowledgeBaseFragment, error) {
	resolvedKnowledgeCode := strings.TrimSpace(input.KnowledgeCode)
	if kb != nil && strings.TrimSpace(kb.Code) != "" {
		resolvedKnowledgeCode = strings.TrimSpace(kb.Code)
	}
	resolvedOrganizationCode := strings.TrimSpace(input.OrganizationCode)
	if kb != nil && strings.TrimSpace(kb.OrganizationCode) != "" {
		resolvedOrganizationCode = strings.TrimSpace(kb.OrganizationCode)
	}

	createInput := &fragdto.CreateFragmentInput{
		OrganizationCode: resolvedOrganizationCode,
		UserID:           input.UserID,
		KnowledgeCode:    resolvedKnowledgeCode,
		DocumentCode:     input.DocumentCode,
		BusinessID:       input.BusinessID,
		Content:          input.Content,
		Metadata:         input.Metadata,
	}

	if strings.TrimSpace(input.DocumentCode) != "" || fragdomain.ResolveLegacyThirdPlatformFileID(input.Metadata) != "" {
		lifecycle, err := s.buildManualWriteLifecycle(ctx, knowledgeBaseSnapshotFromDomain(kb), createInput)
		if err != nil {
			return nil, err
		}
		if s.manualFragmentCoordinator == nil {
			return nil, ErrFragmentManualCoordinatorRequired
		}
		resolvedDoc, err := s.manualFragmentCoordinator.EnsureDocumentAndSaveFragment(
			ctx,
			domainDocumentFromFrag(lifecycle.Document),
			lifecycle.Fragment,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to create runtime fragment: %w", err)
		}
		lifecycle.Fragment.DocumentCode = resolvedDoc.Code
		lifecycle.Fragment.DocumentName = resolvedDoc.Name
		lifecycle.Fragment.DocumentType = resolvedDoc.DocType
		lifecycle.Fragment.OrganizationCode = resolvedDoc.OrganizationCode
		return lifecycle.Fragment, nil
	}

	if err := s.healKnowledgeBaseUIDsBeforeDefaultDocument(ctx, kb); err != nil {
		return nil, err
	}
	doc, _, err := s.documentService.EnsureDefaultDocument(ctx, knowledgeBaseSnapshotFromDomain(kb))
	if err != nil {
		return nil, fmt.Errorf("ensure default document: %w", err)
	}
	fragment := fragdomain.BuildManualFragment(fragDocumentFromDomain(doc), fragdomain.ManualFragmentInput{
		KnowledgeCode:    resolvedKnowledgeCode,
		DocumentCode:     doc.Code,
		Content:          input.Content,
		Metadata:         input.Metadata,
		BusinessID:       input.BusinessID,
		UserID:           input.UserID,
		OrganizationCode: resolvedOrganizationCode,
	})
	if err := s.fragmentService.Save(ctx, fragment); err != nil {
		return nil, fmt.Errorf("save runtime fragment: %w", err)
	}
	return fragment, nil
}

func (s *FragmentAppService) runtimeSimilarityByKnowledgeBase(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	input *fragdto.RuntimeSimilarityInput,
	topK int,
	scoreThreshold float64,
	metadataFilter *fragmodel.VectorFilter,
) ([]*fragdto.SimilarityResultDTO, error) {
	if kb == nil {
		return nil, shared.ErrKnowledgeBaseNotFound
	}

	options := &fragretrieval.SimilaritySearchOptions{
		HardFilter: metadataFilter,
		Debug:      input.Debug,
	}
	results, err := s.fragmentService.Similarity(ctx, knowledgeBaseSnapshotFromDomain(kb), fragretrieval.SimilarityRequest{
		Query:                   input.Query,
		EmbeddingQuery:          resolveRuntimeEmbeddingQuery(input),
		TopK:                    topK,
		CandidateScoreThreshold: runtimeSimilarityCandidateScoreThreshold,
		ResultScoreThreshold:    scoreThreshold,
		BusinessParams:          input.BusinessParams,
		Options:                 options,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to search runtime similarity: %w", err)
	}
	return s.similarityResultsToDTOs(ctx, kb, results, input.Debug)
}

func (s *FragmentAppService) similarityResultsToDTOs(
	ctx context.Context,
	kb *kbentity.KnowledgeBase,
	results []*fragmodel.SimilarityResult,
	debug bool,
) ([]*fragdto.SimilarityResultDTO, error) {
	assemblyStartedAt := time.Now()
	dtos := make([]*fragdto.SimilarityResultDTO, len(results))
	for i, result := range results {
		documentName := result.DocumentName
		documentType := result.DocumentType
		if documentName == "" || documentType == 0 {
			doc, err := s.documentService.ShowByCodeAndKnowledgeBase(ctx, result.DocumentCode, result.KnowledgeCode)
			if err == nil && doc != nil {
				documentName = doc.Name
				documentType = doc.DocType
			}
		}
		displayContent, wordCount := buildSimilarityDisplayContent(result.Content, result.Metadata)
		dtos[i] = &fragdto.SimilarityResultDTO{
			ID:                result.FragmentID,
			Content:           displayContent,
			Score:             result.Score,
			WordCount:         wordCount,
			Metadata:          fragmetadata.CloneMetadata(result.Metadata),
			KnowledgeBaseCode: result.KnowledgeCode,
			KnowledgeCode:     result.KnowledgeCode,
			DocumentCode:      result.DocumentCode,
			DocumentName:      documentName,
			DocumentType:      documentType,
			DocType:           documentType,
			BusinessID:        result.BusinessID,
		}
		withSimilarityKnowledgeBaseContext(dtos[i], kb)
	}
	if err := s.backfillSimilarityFragmentFields(ctx, dtos); err != nil {
		return nil, err
	}
	for _, dto := range dtos {
		if dto == nil {
			continue
		}
		if dto.Metadata == nil {
			dto.Metadata = map[string]any{}
		}
		if dto.WordCount > 0 {
			dto.Metadata["word_count"] = dto.WordCount
		}
		dto.Metadata = sanitizeSimilarityResponseMetadata(dto.Metadata, debug)
	}
	if s != nil && s.logger != nil {
		s.logger.DebugContext(
			ctx,
			"Knowledge similarity dto assembly completed",
			logkey.DurationMS, logkey.DurationToMS(time.Since(assemblyStartedAt)),
			"result_count", len(dtos),
		)
	}
	return dtos, nil
}

func (s *FragmentAppService) listFragmentsByBusinessID(
	ctx context.Context,
	knowledgeCode string,
	businessID string,
) ([]*fragmodel.KnowledgeBaseFragment, error) {
	fragments := make([]*fragmodel.KnowledgeBaseFragment, 0, runtimeDestroyBatchSize)
	for offset := 0; ; offset += runtimeDestroyBatchSize {
		batch, total, err := s.fragmentService.List(ctx, &fragmodel.Query{
			KnowledgeCode: strings.TrimSpace(knowledgeCode),
			BusinessID:    strings.TrimSpace(businessID),
			Offset:        offset,
			Limit:         runtimeDestroyBatchSize,
		})
		if err != nil {
			return nil, fmt.Errorf("list fragments by business id: %w", err)
		}
		if len(batch) == 0 {
			return fragments, nil
		}
		fragments = append(fragments, batch...)
		if total > 0 && int64(len(fragments)) >= total {
			return fragments, nil
		}
		if len(batch) < runtimeDestroyBatchSize {
			return fragments, nil
		}
	}
}

func (s *FragmentAppService) backfillSimilarityFragmentFields(
	ctx context.Context,
	results []*fragdto.SimilarityResultDTO,
) error {
	syncSimilarityResultMetadata(results)

	targets := collectSimilarityBackfillTargets(results)
	if len(targets) == 0 {
		return nil
	}

	fragmentMap, err := s.findSimilarityBackfillFragmentsByPointIDs(ctx, targets)
	if err != nil {
		return err
	}

	for _, target := range targets {
		if target == nil {
			continue
		}
		fragment := fragmentMap[target.pointID]
		if fragment == nil {
			continue
		}
		s.applySimilarityBackfillFragment(target, fragment)
	}
	s.syncSimilarityBackfillMetadata(targets)
	return nil
}

type similarityBackfillTarget struct {
	result                   *fragdto.SimilarityResultDTO
	pointID                  string
	missingResultID          bool
	missingResultBusinessID  bool
	missingPayloadFragmentID bool
	missingPayloadBusinessID bool
}

func collectSimilarityBackfillTargets(results []*fragdto.SimilarityResultDTO) []*similarityBackfillTarget {
	targets := make([]*similarityBackfillTarget, 0, len(results))
	for _, result := range results {
		if result == nil {
			continue
		}
		pointID := similarityPointID(result.Metadata)
		if pointID == "" {
			continue
		}
		target := &similarityBackfillTarget{
			result:                   result,
			pointID:                  pointID,
			missingResultID:          result.ID == 0,
			missingResultBusinessID:  strings.TrimSpace(result.BusinessID) == "",
			missingPayloadFragmentID: similarityFragmentID(result.Metadata) == 0,
			missingPayloadBusinessID: similarityBusinessID(result.Metadata) == "",
		}
		if !target.needsBackfill() {
			continue
		}
		targets = append(targets, target)
	}
	return targets
}

func (target *similarityBackfillTarget) needsBackfill() bool {
	if target == nil {
		return false
	}
	return target.missingResultID ||
		target.missingResultBusinessID ||
		target.missingPayloadFragmentID ||
		target.missingPayloadBusinessID
}

func syncSimilarityResultMetadata(results []*fragdto.SimilarityResultDTO) {
	for _, result := range results {
		syncSimilarityResultMetadataItem(result)
	}
}

func syncSimilarityResultMetadataItem(result *fragdto.SimilarityResultDTO) {
	if result == nil {
		return
	}
	if result.Metadata == nil {
		result.Metadata = map[string]any{}
	}
	if result.ID > 0 {
		result.Metadata["fragment_id"] = result.ID
	}
	if businessID := strings.TrimSpace(result.BusinessID); businessID != "" {
		result.Metadata["business_id"] = businessID
	}
}

func (s *FragmentAppService) findSimilarityBackfillFragmentsByPointIDs(
	ctx context.Context,
	targets []*similarityBackfillTarget,
) (map[string]*fragmodel.KnowledgeBaseFragment, error) {
	pointIDs := make([]string, 0, len(targets))
	for _, target := range targets {
		if target == nil || target.pointID == "" {
			continue
		}
		pointIDs = append(pointIDs, target.pointID)
	}
	pointIDs = uniqueStrings(pointIDs)
	if len(pointIDs) == 0 {
		return map[string]*fragmodel.KnowledgeBaseFragment{}, nil
	}

	fragments, err := s.fragmentService.FindByPointIDs(ctx, pointIDs)
	if err != nil {
		return nil, fmt.Errorf("find similarity fragments by point ids: %w", err)
	}
	fragmentMap := make(map[string]*fragmodel.KnowledgeBaseFragment, len(fragments))
	for _, fragment := range fragments {
		if fragment == nil {
			continue
		}
		pointID := strings.TrimSpace(fragment.PointID)
		if pointID == "" {
			continue
		}
		if _, exists := fragmentMap[pointID]; exists {
			continue
		}
		fragmentMap[pointID] = fragment
	}
	return fragmentMap, nil
}

func (s *FragmentAppService) applySimilarityBackfillFragment(
	target *similarityBackfillTarget,
	fragment *fragmodel.KnowledgeBaseFragment,
) {
	if target == nil || target.result == nil || fragment == nil {
		return
	}
	if target.missingResultID && target.result.ID == 0 && fragment.ID > 0 {
		target.result.ID = fragment.ID
	}
	if target.missingResultBusinessID && strings.TrimSpace(target.result.BusinessID) == "" {
		target.result.BusinessID = strings.TrimSpace(fragment.BusinessID)
	}
	target.missingResultID = target.result.ID == 0
	target.missingResultBusinessID = strings.TrimSpace(target.result.BusinessID) == ""
}

func (s *FragmentAppService) syncSimilarityBackfillMetadata(targets []*similarityBackfillTarget) {
	for _, target := range targets {
		syncSimilarityResultMetadataItem(target.result)
	}
}

func resolveRuntimeSimilarityConfig(
	input *fragdto.RuntimeSimilarityInput,
	firstKB *kbentity.KnowledgeBase,
) (int, float64) {
	topK := input.TopK
	if topK <= 0 {
		topK = runtimeSimilarityDefaultTopK
		if firstKB != nil && firstKB.RetrieveConfig != nil && firstKB.RetrieveConfig.TopK > 0 {
			topK = firstKB.RetrieveConfig.TopK
		}
	}

	scoreThreshold, scoreThresholdExplicit := runtimeSimilarityScoreThreshold(input)
	if !scoreThresholdExplicit && firstKB != nil && firstKB.RetrieveConfig != nil &&
		firstKB.RetrieveConfig.ScoreThresholdEnabled && firstKB.RetrieveConfig.ScoreThreshold > 0 {
		scoreThreshold = firstKB.RetrieveConfig.ScoreThreshold
	}
	return topK, scoreThreshold
}

func runtimeSimilarityScoreThreshold(input *fragdto.RuntimeSimilarityInput) (float64, bool) {
	if input == nil || input.ScoreThreshold == nil {
		return 0, false
	}
	return *input.ScoreThreshold, true
}

func resolveRuntimeEmbeddingQuery(input *fragdto.RuntimeSimilarityInput) string {
	if input == nil {
		return ""
	}
	if trimmed := strings.TrimSpace(input.Question); trimmed != "" {
		return trimmed
	}
	return strings.TrimSpace(input.Query)
}

func buildRuntimeKnowledgeBaseFilter(kb *kbentity.KnowledgeBase) *fragmodel.VectorFilter {
	if kb == nil {
		return nil
	}
	knowledgeCode := strings.TrimSpace(kb.Code)
	filter := &fragmodel.VectorFilter{
		Must: []fragmodel.FieldFilter{{
			Key: constants.KnowledgeCodeField,
			Match: fragmodel.Match{
				EqString: &knowledgeCode,
			},
		}},
	}
	if orgCode := strings.TrimSpace(kb.OrganizationCode); orgCode != "" {
		filter.Must = append(filter.Must, fragmodel.FieldFilter{
			Key: constants.OrganizationCodeField,
			Match: fragmodel.Match{
				EqString: &orgCode,
			},
		})
	}
	return filter
}

func buildRuntimeMetadataFilter(raw map[string]any) *fragmodel.VectorFilter {
	if len(raw) == 0 {
		return nil
	}
	must := make([]fragmodel.FieldFilter, 0, len(raw))
	for key, value := range raw {
		filter, ok := buildRuntimeMetadataFieldFilter(strings.TrimSpace(key), value)
		if !ok {
			continue
		}
		must = append(must, filter)
	}
	if len(must) == 0 {
		return nil
	}
	return &fragmodel.VectorFilter{Must: must}
}

func buildRuntimeMetadataFieldFilter(key string, value any) (fragmodel.FieldFilter, bool) {
	if key == "" {
		return fragmodel.FieldFilter{}, false
	}
	if match, ok := runtimeScalarMatch(value); ok {
		return fragmodel.FieldFilter{Key: key, Match: match}, true
	}

	values, ok := runtimeSliceValues(value)
	if !ok || len(values) == 0 {
		return fragmodel.FieldFilter{}, false
	}
	match, ok := runtimeSliceMatch(values)
	if !ok {
		return fragmodel.FieldFilter{}, false
	}
	return fragmodel.FieldFilter{Key: key, Match: match}, true
}

func runtimeScalarMatch(value any) (fragmodel.Match, bool) {
	if textValue, ok := value.(string); ok {
		return fragmodel.Match{EqString: &textValue}, true
	}
	if boolValue, ok := value.(bool); ok {
		return fragmodel.Match{EqBool: &boolValue}, true
	}
	if numberValue, ok := runtimeNumericValue(value); ok {
		return fragmodel.Match{EqFloat: &numberValue}, true
	}
	return fragmodel.Match{}, false
}

func runtimeSliceValues(value any) ([]any, bool) {
	switch values := value.(type) {
	case []any:
		return append([]any(nil), values...), true
	case []string:
		return scalarSliceToAny(values), true
	case []float64:
		return scalarSliceToAny(values), true
	case []float32:
		return scalarSliceToAny(values), true
	case []int:
		return scalarSliceToAny(values), true
	case []int8:
		return scalarSliceToAny(values), true
	case []int16:
		return scalarSliceToAny(values), true
	case []int32:
		return scalarSliceToAny(values), true
	case []int64:
		return scalarSliceToAny(values), true
	case []uint:
		return scalarSliceToAny(values), true
	case []uint8:
		return scalarSliceToAny(values), true
	case []uint16:
		return scalarSliceToAny(values), true
	case []uint32:
		return scalarSliceToAny(values), true
	case []uint64:
		return scalarSliceToAny(values), true
	default:
		return nil, false
	}
}

func runtimeSliceMatch(values []any) (fragmodel.Match, bool) {
	valueKind := runtimeSliceValueUnknown
	stringValues := make([]string, 0, len(values))
	floatValues := make([]float64, 0, len(values))
	for _, value := range values {
		itemKind, textValue, numberValue, ok := classifyRuntimeSliceValue(value)
		if !ok {
			return fragmodel.Match{}, false
		}
		switch {
		case valueKind == runtimeSliceValueUnknown:
			valueKind = itemKind
		case valueKind != itemKind:
			return fragmodel.Match{}, false
		}
		switch itemKind {
		case runtimeSliceValueUnknown:
			return fragmodel.Match{}, false
		case runtimeSliceValueString:
			stringValues = append(stringValues, textValue)
		case runtimeSliceValueNumber:
			floatValues = append(floatValues, numberValue)
		default:
			return fragmodel.Match{}, false
		}
	}
	switch valueKind {
	case runtimeSliceValueString:
		return fragmodel.Match{InStrings: uniqueStrings(stringValues)}, true
	case runtimeSliceValueNumber:
		return fragmodel.Match{InFloats: uniqueFloat64s(floatValues)}, true
	case runtimeSliceValueUnknown:
		return fragmodel.Match{}, false
	default:
		return fragmodel.Match{}, false
	}
}

func classifyRuntimeSliceValue(value any) (runtimeSliceValueKind, string, float64, bool) {
	if textValue, ok := value.(string); ok {
		return runtimeSliceValueString, textValue, 0, true
	}
	if _, ok := value.(bool); ok {
		return runtimeSliceValueUnknown, "", 0, false
	}
	if numberValue, ok := runtimeNumericValue(value); ok {
		return runtimeSliceValueNumber, "", numberValue, true
	}
	return runtimeSliceValueUnknown, "", 0, false
}

func runtimeNumericValue(value any) (float64, bool) {
	switch typed := value.(type) {
	case int:
		return float64(typed), true
	case int8:
		return float64(typed), true
	case int16:
		return float64(typed), true
	case int32:
		return float64(typed), true
	case int64:
		return float64(typed), true
	case uint:
		return float64(typed), true
	case uint8:
		return float64(typed), true
	case uint16:
		return float64(typed), true
	case uint32:
		return float64(typed), true
	case uint64:
		return float64(typed), true
	case float32:
		return float64(typed), true
	case float64:
		return typed, true
	default:
		return 0, false
	}
}

func scalarSliceToAny[T any](values []T) []any {
	items := make([]any, len(values))
	for i := range values {
		items[i] = values[i]
	}
	return items
}

func mergeRuntimeVectorFilters(filters ...*fragmodel.VectorFilter) *fragmodel.VectorFilter {
	merged := &fragmodel.VectorFilter{}
	for _, filter := range filters {
		if filter == nil {
			continue
		}
		merged.Must = append(merged.Must, filter.Must...)
		merged.Should = append(merged.Should, filter.Should...)
		merged.MustNot = append(merged.MustNot, filter.MustNot...)
	}
	if len(merged.Must) == 0 && len(merged.Should) == 0 && len(merged.MustNot) == 0 {
		return nil
	}
	return merged
}

func appendMissingPointFragments(
	fragments []*fragmodel.KnowledgeBaseFragment,
	pointIDs []string,
) []*fragmodel.KnowledgeBaseFragment {
	existing := make(map[string]struct{}, len(fragments))
	for _, fragment := range fragments {
		if fragment == nil || strings.TrimSpace(fragment.PointID) == "" {
			continue
		}
		existing[fragment.PointID] = struct{}{}
	}
	for _, pointID := range pointIDs {
		if _, ok := existing[pointID]; ok {
			continue
		}
		fragments = append(fragments, &fragmodel.KnowledgeBaseFragment{PointID: pointID})
	}
	return fragments
}

func similarityPointID(metadata map[string]any) string {
	if len(metadata) == 0 {
		return ""
	}
	value, ok := metadata["point_id"]
	if !ok {
		return ""
	}
	pointID, _ := value.(string)
	return strings.TrimSpace(pointID)
}

func similarityFragmentID(metadata map[string]any) int64 {
	if len(metadata) == 0 {
		return 0
	}
	switch value := metadata["fragment_id"].(type) {
	case int:
		return int64(value)
	case int32:
		return int64(value)
	case int64:
		return value
	case float64:
		return int64(value)
	default:
		return 0
	}
}

func similarityBusinessID(metadata map[string]any) string {
	if len(metadata) == 0 {
		return ""
	}
	value, _ := metadata["business_id"].(string)
	return strings.TrimSpace(value)
}

func uniqueRuntimeKnowledgeCodes(codes []string) []string {
	result := make([]string, 0, len(codes))
	seen := make(map[string]struct{}, len(codes))
	for _, code := range codes {
		trimmed := strings.TrimSpace(code)
		if trimmed == "" {
			continue
		}
		if _, ok := seen[trimmed]; ok {
			continue
		}
		seen[trimmed] = struct{}{}
		result = append(result, trimmed)
	}
	return result
}

func uniqueStrings(values []string) []string {
	if len(values) == 0 {
		return nil
	}
	result := make([]string, 0, len(values))
	seen := make(map[string]struct{}, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

func uniqueFloat64s(values []float64) []float64 {
	if len(values) == 0 {
		return nil
	}
	result := make([]float64, 0, len(values))
	seen := make(map[float64]struct{}, len(values))
	for _, value := range values {
		if _, ok := seen[value]; ok {
			continue
		}
		seen[value] = struct{}{}
		result = append(result, value)
	}
	return result
}

var _ fragmentAppDocumentReader = (*documentdomain.DomainService)(nil)
