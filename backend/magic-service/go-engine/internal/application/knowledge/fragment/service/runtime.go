package fragapp

import (
	"context"
	"fmt"
	"reflect"
	"strings"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	"magic/internal/constants"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

const (
	runtimeSimilarityDefaultTopK             = 10
	runtimeSimilarityCandidateScoreThreshold = 0.1
	runtimeDestroyBatchSize                  = 1000
	similarityBackfillDocumentLimit          = 4096
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

	kb, err := s.loadScopedKnowledgeBase(ctx, input.OrganizationCode, input.KnowledgeCode)
	if err != nil {
		return nil, err
	}
	s.applyResolvedRouteToKnowledgeBase(ctx, kb)

	fragment, err := s.runtimeCreateFragment(ctx, kb, input)
	if err != nil {
		return nil, err
	}
	if err := s.fragmentService.SyncFragment(ctx, kb, fragment, input.BusinessParams); err != nil {
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
	kb *knowledgebasedomain.KnowledgeBase,
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
		lifecycle, err := s.buildManualWriteLifecycle(ctx, kb, createInput)
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

	doc, _, err := s.documentService.EnsureDefaultDocument(ctx, knowledgeBaseSnapshotFromEntity(kb))
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
	kb *knowledgebasedomain.KnowledgeBase,
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
	results, err := s.fragmentService.Similarity(ctx, kb, fragretrieval.SimilarityRequest{
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
	return s.similarityResultsToDTOs(ctx, kb, results)
}

func (s *FragmentAppService) similarityResultsToDTOs(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	results []*fragmodel.SimilarityResult,
) ([]*fragdto.SimilarityResultDTO, error) {
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
			Metadata:          result.Metadata,
			KnowledgeBaseCode: result.KnowledgeCode,
			KnowledgeCode:     result.KnowledgeCode,
			DocumentCode:      result.DocumentCode,
			DocumentName:      documentName,
			DocumentType:      documentType,
			DocType:           documentType,
			BusinessID:        result.BusinessID,
		}
	}
	if err := s.backfillSimilarityFragmentFields(ctx, kb, dtos); err != nil {
		return nil, err
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
	kb *knowledgebasedomain.KnowledgeBase,
	results []*fragdto.SimilarityResultDTO,
) error {
	targets := collectSimilarityBackfillTargets(results)
	if len(targets) == 0 {
		return nil
	}

	if err := s.backfillSimilarityFragmentFieldsByDocuments(ctx, targets); err != nil && s.logger != nil {
		s.logger.WarnContext(ctx, "Backfill similarity fragments by documents failed", "error", err)
	}
	if err := s.backfillSimilarityFragmentFieldsByPointIDs(ctx, targets); err != nil {
		return err
	}
	s.syncSimilarityBackfillMetadata(targets)
	s.repairSimilarityPayloadFields(ctx, kb, targets)
	return nil
}

type similarityBackfillTarget struct {
	result                *fragdto.SimilarityResultDTO
	pointID               string
	needResultID          bool
	needResultBusinessID  bool
	needPayloadFragmentID bool
	needPayloadBusinessID bool
}

func (target *similarityBackfillTarget) needsResultBackfill() bool {
	if target == nil {
		return false
	}
	return target.needResultID || target.needResultBusinessID
}

func (target *similarityBackfillTarget) needsPayloadRepair() bool {
	if target == nil {
		return false
	}
	return target.needPayloadFragmentID || target.needPayloadBusinessID
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
			result:                result,
			pointID:               pointID,
			needResultID:          result.ID == 0,
			needResultBusinessID:  strings.TrimSpace(result.BusinessID) == "",
			needPayloadFragmentID: similarityFragmentID(result.Metadata) == 0,
			needPayloadBusinessID: similarityBusinessID(result.Metadata) == "",
		}
		if !target.needsResultBackfill() && !target.needsPayloadRepair() {
			continue
		}
		targets = append(targets, target)
	}
	return targets
}

func (s *FragmentAppService) backfillSimilarityFragmentFieldsByDocuments(
	ctx context.Context,
	targets []*similarityBackfillTarget,
) error {
	documentKeys := make([]fragmodel.DocumentKey, 0, len(targets))
	for _, target := range targets {
		if target == nil || !target.needsResultBackfill() || target.result == nil {
			continue
		}
		documentKey := fragmodel.DocumentKey{
			KnowledgeCode: strings.TrimSpace(target.result.KnowledgeCode),
			DocumentCode:  strings.TrimSpace(target.result.DocumentCode),
		}
		if documentKey.KnowledgeCode == "" || documentKey.DocumentCode == "" {
			continue
		}
		documentKeys = append(documentKeys, documentKey)
	}
	documentKeys = uniqueDocumentKeys(documentKeys)
	if len(documentKeys) == 0 {
		return nil
	}

	grouped, err := s.fragmentService.ListContextByDocuments(ctx, documentKeys, similarityBackfillDocumentLimit)
	if err != nil {
		return fmt.Errorf("list similarity context fragments by documents: %w", err)
	}

	fragmentByPointID := make(map[string]*fragmodel.KnowledgeBaseFragment, len(grouped))
	for _, fragments := range grouped {
		for _, fragment := range fragments {
			if fragment == nil {
				continue
			}
			pointID := strings.TrimSpace(fragment.PointID)
			if pointID == "" {
				continue
			}
			if _, exists := fragmentByPointID[pointID]; exists {
				continue
			}
			fragmentByPointID[pointID] = fragment
		}
	}

	for _, target := range targets {
		if target == nil || !target.needsResultBackfill() {
			continue
		}
		s.applySimilarityBackfillFragment(target, fragmentByPointID[target.pointID])
	}
	return nil
}

func (s *FragmentAppService) backfillSimilarityFragmentFieldsByPointIDs(
	ctx context.Context,
	targets []*similarityBackfillTarget,
) error {
	pointIDs := make([]string, 0, len(targets))
	for _, target := range targets {
		if target == nil || !target.needsResultBackfill() || target.pointID == "" {
			continue
		}
		pointIDs = append(pointIDs, target.pointID)
	}
	pointIDs = uniqueStrings(pointIDs)
	if len(pointIDs) == 0 {
		return nil
	}

	fragments, err := s.fragmentService.FindByPointIDs(ctx, pointIDs)
	if err != nil {
		return fmt.Errorf("find similarity fragments by point ids: %w", err)
	}
	fragmentMap := make(map[string]*fragmodel.KnowledgeBaseFragment, len(fragments))
	for _, fragment := range fragments {
		if fragment == nil || strings.TrimSpace(fragment.PointID) == "" {
			continue
		}
		if _, exists := fragmentMap[fragment.PointID]; exists {
			continue
		}
		fragmentMap[fragment.PointID] = fragment
	}

	for _, target := range targets {
		if target == nil || !target.needsResultBackfill() {
			continue
		}
		s.applySimilarityBackfillFragment(target, fragmentMap[target.pointID])
	}
	return nil
}

func (s *FragmentAppService) applySimilarityBackfillFragment(
	target *similarityBackfillTarget,
	fragment *fragmodel.KnowledgeBaseFragment,
) {
	if target == nil || target.result == nil || fragment == nil {
		return
	}
	if target.needResultID && target.result.ID == 0 && fragment.ID > 0 {
		target.result.ID = fragment.ID
	}
	if target.needResultBusinessID && strings.TrimSpace(target.result.BusinessID) == "" {
		target.result.BusinessID = strings.TrimSpace(fragment.BusinessID)
	}
	target.needResultID = target.result.ID == 0
	target.needResultBusinessID = strings.TrimSpace(target.result.BusinessID) == ""
}

func (s *FragmentAppService) syncSimilarityBackfillMetadata(targets []*similarityBackfillTarget) {
	for _, target := range targets {
		if target == nil || target.result == nil {
			continue
		}
		if target.result.Metadata == nil {
			target.result.Metadata = map[string]any{}
		}
		if target.result.ID > 0 {
			target.result.Metadata["fragment_id"] = target.result.ID
		}
		if businessID := strings.TrimSpace(target.result.BusinessID); businessID != "" {
			target.result.Metadata["business_id"] = businessID
		}
	}
}

func (s *FragmentAppService) repairSimilarityPayloadFields(
	ctx context.Context,
	kb *knowledgebasedomain.KnowledgeBase,
	targets []*similarityBackfillTarget,
) {
	if kb == nil || s == nil || s.kbService == nil {
		return
	}
	collectionName := strings.TrimSpace(s.kbService.ResolveRuntimeRoute(ctx, kb).VectorCollectionName)
	if collectionName == "" {
		return
	}

	updates := buildSimilarityPayloadRepairUpdates(targets)
	if len(updates) == 0 {
		return
	}

	if err := s.fragmentService.SetPayloadByPointIDs(ctx, collectionName, updates); err != nil && s.logger != nil {
		s.logger.WarnContext(
			ctx,
			"Repair similarity payload fields failed",
			"knowledge_code", kb.Code,
			"collection_name", collectionName,
			"point_count", len(updates),
			"error", err,
		)
	}
}

func buildSimilarityPayloadRepairUpdates(targets []*similarityBackfillTarget) map[string]map[string]any {
	updates := make(map[string]map[string]any, len(targets))
	for _, target := range targets {
		pointID, payload, ok := buildSimilarityPayloadRepairUpdate(target)
		if !ok {
			continue
		}
		updates[pointID] = payload
	}
	return updates
}

func buildSimilarityPayloadRepairUpdate(target *similarityBackfillTarget) (string, map[string]any, bool) {
	if target == nil || !target.needsPayloadRepair() || target.result == nil || target.pointID == "" {
		return "", nil, false
	}

	fragmentID := target.result.ID
	businessID := strings.TrimSpace(target.result.BusinessID)
	if target.needPayloadFragmentID && fragmentID == 0 {
		return "", nil, false
	}
	if target.needPayloadBusinessID && businessID == "" {
		return "", nil, false
	}

	payload := make(map[string]any, 2)
	if target.needPayloadFragmentID && fragmentID > 0 {
		payload["fragment_id"] = fragmentID
	}
	if target.needPayloadBusinessID && businessID != "" {
		payload["business_id"] = businessID
	}
	if len(payload) == 0 {
		return "", nil, false
	}
	return target.pointID, payload, true
}

func resolveRuntimeSimilarityConfig(
	input *fragdto.RuntimeSimilarityInput,
	firstKB *knowledgebasedomain.KnowledgeBase,
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

func buildRuntimeKnowledgeBaseFilter(kb *knowledgebasedomain.KnowledgeBase) *fragmodel.VectorFilter {
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
	rawValue := reflect.ValueOf(value)
	if !rawValue.IsValid() {
		return nil, false
	}
	if rawValue.Kind() != reflect.Slice && rawValue.Kind() != reflect.Array {
		return nil, false
	}
	items := make([]any, 0, rawValue.Len())
	for i := range rawValue.Len() {
		items = append(items, rawValue.Index(i).Interface())
	}
	return items, true
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
	rawValue := reflect.ValueOf(value)
	if !rawValue.IsValid() {
		return 0, false
	}
	switch rawValue.Kind() {
	case reflect.Int, reflect.Int8, reflect.Int16, reflect.Int32, reflect.Int64:
		return float64(rawValue.Int()), true
	case reflect.Uint, reflect.Uint8, reflect.Uint16, reflect.Uint32, reflect.Uint64:
		return float64(rawValue.Uint()), true
	case reflect.Float32, reflect.Float64:
		return rawValue.Float(), true
	default:
		return 0, false
	}
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

func uniqueDocumentKeys(documentKeys []fragmodel.DocumentKey) []fragmodel.DocumentKey {
	seen := make(map[fragmodel.DocumentKey]struct{}, len(documentKeys))
	result := make([]fragmodel.DocumentKey, 0, len(documentKeys))
	for _, documentKey := range documentKeys {
		normalizedKey := fragmodel.DocumentKey{
			KnowledgeCode: strings.TrimSpace(documentKey.KnowledgeCode),
			DocumentCode:  strings.TrimSpace(documentKey.DocumentCode),
		}
		if normalizedKey.KnowledgeCode == "" || normalizedKey.DocumentCode == "" {
			continue
		}
		if _, ok := seen[normalizedKey]; ok {
			continue
		}
		seen[normalizedKey] = struct{}{}
		result = append(result, normalizedKey)
	}
	return result
}

func knowledgeBaseSnapshotFromEntity(kb *knowledgebasedomain.KnowledgeBase) *sharedsnapshot.KnowledgeBaseRuntimeSnapshot {
	if kb == nil {
		return nil
	}
	return sharedsnapshot.NormalizeKnowledgeBaseSnapshotConfigs(&sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:             kb.Code,
		Name:             kb.Name,
		OrganizationCode: kb.OrganizationCode,
		Model:            kb.Model,
		VectorDB:         kb.VectorDB,
		CreatedUID:       kb.CreatedUID,
		UpdatedUID:       kb.UpdatedUID,
		RetrieveConfig:   kb.RetrieveConfig,
		FragmentConfig:   kb.FragmentConfig,
		EmbeddingConfig:  kb.EmbeddingConfig,
		ResolvedRoute:    kb.ResolvedRoute,
	})
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
