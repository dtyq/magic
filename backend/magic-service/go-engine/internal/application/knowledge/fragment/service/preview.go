package fragapp

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"maps"
	"strconv"
	"strings"
	"time"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	texthelper "magic/internal/application/knowledge/helper/text"
	thirdplatformsource "magic/internal/application/knowledge/shared/thirdplatformsource"
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/thirdplatform"
	"magic/internal/pkg/timeformat"
)

var (
	errPreviewWaitCanceled = errors.New("preview wait canceled")
	errPreviewResultType   = errors.New("unexpected preview result type")
)

func buildPreviewRequestKey(input *fragdto.PreviewFragmentInput) string {
	if input == nil || input.DocumentFile == nil {
		sum := sha256.Sum256([]byte("empty"))
		return hex.EncodeToString(sum[:])
	}
	var builder strings.Builder
	builder.WriteString(previewPlanFromInput(input, false).RequestKey)
	builder.WriteString("|strategy=")
	builder.WriteString(normalizePreviewStrategyConfigKey(input.StrategyConfig))
	sum := sha256.Sum256([]byte(builder.String()))
	return hex.EncodeToString(sum[:])
}

func previewPlanFromInput(input *fragdto.PreviewFragmentInput, hasThirdPlatformResolver bool) fragdomain.PreviewPlan {
	if input == nil {
		return fragdomain.ResolvePreviewPlan(nil, nil, hasThirdPlatformResolver)
	}
	return fragdomain.ResolvePreviewPlan(
		previewDomainFileFromDTO(input.DocumentFile),
		confighelper.FragmentConfigDTOToEntity(input.FragmentConfig),
		hasThirdPlatformResolver,
	)
}

func previewDomainFileFromDTO(file *docfilehelper.DocumentFileDTO) *fragdomain.File {
	domainFile := docfilehelper.ToDomainFile(file)
	if domainFile == nil || file == nil {
		return fragDocumentFileFromDomain(domainFile)
	}
	if key := strings.TrimSpace(file.Key); key != "" {
		domainFile.URL = key
	}
	return fragDocumentFileFromDomain(domainFile)
}

func normalizePreviewStrategyConfigKey(cfg *confighelper.StrategyConfigDTO) string {
	options := confighelper.StrategyConfigDTOToParseOptions(cfg)
	return fmt.Sprintf(
		"parsing_type=%d,image_extraction=%t,table_extraction=%t,image_ocr=%t",
		options.ParsingType,
		options.ImageExtraction,
		options.TableExtraction,
		options.ImageOCR,
	)
}

func (s *FragmentAppService) resolvePreviewContent(ctx context.Context, input *fragdto.PreviewFragmentInput) (*documentdomain.ParsedDocument, string, error) {
	plan := previewPlanFromInput(input, s != nil && s.thirdPlatformDocumentPort != nil)
	documentFile := plan.DocumentFile
	parseOptions := confighelper.StrategyConfigDTOToParseOptions(input.StrategyConfig)
	if plan.TryThirdPlatform {
		parsedDocument, resolvedDocumentFile, err := s.resolveThirdPlatformPreviewContent(ctx, input, documentFile, parseOptions)
		if err == nil {
			return parsedDocument, texthelper.NormalizeHierarchySourceFileType(resolvedDocumentFile.Extension), nil
		}
		if strings.TrimSpace(resolvedDocumentFile.URL) == "" {
			return nil, "", err
		}
		if s.logger != nil {
			s.logger.WarnContext(ctx, "Resolve third-platform preview failed, fallback to URL parsing", "error", err)
		}
		documentFile = resolvedDocumentFile
	}

	if !plan.AllowURLParse {
		return nil, "", shared.ErrDocumentFileEmpty
	}
	parsedDocument, err := s.parseService.ParseDocumentWithOptions(ctx, documentFile.URL, documentFile.Extension, parseOptions)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse document: %w", err)
	}
	documentdomain.ApplyPreferredParsedDocumentFileName(parsedDocument, documentFile.Name)
	return parsedDocument, texthelper.NormalizeHierarchySourceFileType(documentFile.Extension), nil
}

func (s *FragmentAppService) resolveThirdPlatformPreviewContent(
	ctx context.Context,
	input *fragdto.PreviewFragmentInput,
	documentFile *fragdomain.File,
	parseOptions documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, *fragdomain.File, error) {
	resolvedResult, err := s.thirdPlatformDocumentPort.Resolve(ctx, thirdplatform.DocumentResolveInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            input.UserID,
		KnowledgeBaseCode: "",
		ThirdPlatformType: documentFile.SourceType,
		ThirdFileID:       documentFile.ThirdID,
		DocumentFile:      fragdomain.BuildPreviewDocumentFilePayload(documentFile),
	})
	if err != nil {
		return nil, documentFile, fmt.Errorf("resolve third-platform document failed: %w", err)
	}
	if resolvedResult == nil {
		return nil, documentFile, shared.ErrDocumentFileEmpty
	}

	resolved := *documentFile
	fragdomain.ApplyResolvedPreviewDocumentFile(&resolved, resolvedResult.DocumentFile)
	parsedDocument, err := thirdplatformsource.ParseResolvedDocument(ctx, s.parseService, resolvedResult, parseOptions)
	if err != nil {
		return nil, &resolved, fmt.Errorf("parse third-platform preview source: %w", err)
	}
	documentdomain.ApplyPreferredParsedDocumentFileName(parsedDocument, resolved.Name)
	return parsedDocument, &resolved, nil
}

// Preview 解析并切片预览（不落库）
func (s *FragmentAppService) Preview(ctx context.Context, input *fragdto.PreviewFragmentInput) ([]*fragdto.FragmentDTO, error) {
	if input == nil || input.DocumentFile == nil {
		return nil, shared.ErrDocumentFileEmpty
	}

	key := buildPreviewRequestKey(input)
	resultCh := s.previewGroup.DoChan(key, func() (any, error) {
		return s.previewInternal(ctx, input)
	})

	select {
	case <-ctx.Done():
		return nil, errors.Join(errPreviewWaitCanceled, ctx.Err())
	case result := <-resultCh:
		if result.Shared && s.logger != nil {
			s.logger.InfoContext(ctx, "Preview request shared in-flight result", "preview_key_hash", key, "shared", true)
		}
		if result.Err != nil {
			return nil, result.Err
		}
		dtos, ok := result.Val.([]*fragdto.FragmentDTO)
		if !ok {
			return nil, fmt.Errorf("%w: %T", errPreviewResultType, result.Val)
		}
		return dtos, nil
	}
}

func (s *FragmentAppService) previewInternal(ctx context.Context, input *fragdto.PreviewFragmentInput) ([]*fragdto.FragmentDTO, error) {
	chunks, splitVersion, err := s.previewChunks(ctx, input)
	if err != nil {
		return nil, err
	}

	return buildPreviewFragmentDTOs(chunks, splitVersion), nil
}

// PreviewV2 预览文档切片并返回结构化预览节点。
func (s *FragmentAppService) PreviewV2(ctx context.Context, input *fragdto.PreviewFragmentInput) (*fragdto.FragmentPageResultDTO, error) {
	if input == nil || input.DocumentFile == nil {
		return nil, shared.ErrDocumentFileEmpty
	}

	chunks, splitVersion, err := s.previewChunks(ctx, input)
	if err != nil {
		return nil, err
	}

	result := buildPreviewPageResult(previewDocumentTitle(input), chunks, splitVersion, true)
	result.Page = 1
	return result, nil
}

func (s *FragmentAppService) previewChunks(ctx context.Context, input *fragdto.PreviewFragmentInput) ([]documentsplitter.TokenChunk, string, error) {
	parsedDocument, sourceFileType, err := s.resolvePreviewContent(ctx, input)
	if err != nil {
		return nil, "", err
	}

	plan := previewPlanFromInput(input, s != nil && s.thirdPlatformDocumentPort != nil)
	chunks, splitVersion, err := s.previewSplitter.SplitParsedDocumentToChunks(ctx, documentsplitter.ParsedDocumentChunkInput{
		Parsed:           parsedDocument,
		SourceFileType:   sourceFileType,
		RequestedMode:    plan.RequestedMode,
		FragmentConfig:   plan.FragmentConfig,
		SegmentConfig:    previewSegmentConfigToSplitter(plan.SegmentConfig),
		Model:            s.defaultEmbeddingModel,
		TokenizerService: s.tokenizer,
		Logger:           s.logger,
	})
	if err != nil {
		return nil, "", fmt.Errorf("failed to split preview fragments: %w", err)
	}
	return chunks, splitVersion, nil
}

func buildPreviewFragmentDTOs(chunks []documentsplitter.TokenChunk, splitVersion string) []*fragdto.FragmentDTO {
	dtos := make([]*fragdto.FragmentDTO, 0, len(chunks))
	createdAtUnix := time.Now().Unix()
	for i, chunk := range chunks {
		extraMetadata := map[string]any{
			"token_count":          chunk.TokenCount,
			"tree_node_id":         chunk.TreeNodeID,
			"parent_node_id":       chunk.ParentNodeID,
			"section_chunk_index":  chunk.SectionChunkIndex,
			"effective_split_mode": chunk.EffectiveSplitMode,
			"hierarchy_detector":   chunk.HierarchyDetector,
		}
		if len(chunk.Metadata) > 0 {
			maps.Copy(extraMetadata, chunk.Metadata)
		}
		meta := fragmetadata.BuildFragmentSemanticMetadataV1(nil, fragmetadata.FragmentSemanticMetadataDefaults{
			ChunkIndex:           i,
			ContentHash:          texthelper.HashText(chunk.Content),
			SplitVersion:         splitVersion,
			RetrievalTextVersion: fragretrieval.RetrievalTextVersionV1,
			SectionPath:          chunk.SectionPath,
			SectionTitle:         chunk.SectionTitle,
			SectionLevel:         chunk.SectionLevel,
			CreatedAtTS:          createdAtUnix,
		}, extraMetadata)
		dtos = append(dtos, &fragdto.FragmentDTO{
			ID:            0,
			KnowledgeCode: "",
			DocumentCode:  "",
			Content:       fragmetadata.BuildFragmentDisplayContent(chunk.Content, meta, chunk.SectionPath, chunk.SectionTitle),
			Metadata:      meta,
			WordCount:     len([]rune(chunk.Content)),
		})
	}

	return dtos
}

func buildPreviewPageResult(documentTitle string, chunks []documentsplitter.TokenChunk, splitVersion string, includeNodes bool) *fragdto.FragmentPageResultDTO {
	list := make([]*fragdto.FragmentListItemDTO, 0, len(chunks))
	sources := make([]fragdomain.DocumentNodeSource, 0, len(chunks))
	dtos := buildPreviewFragmentDTOs(chunks, splitVersion)
	for index, dto := range dtos {
		list = append(list, buildListItemFromFragmentDTO(dto))
		chunk := chunks[index]
		sources = append(sources, fragdomain.DocumentNodeSource{
			Content:           strings.TrimSpace(chunk.Content),
			SectionPath:       chunk.SectionPath,
			SectionTitle:      chunk.SectionTitle,
			SectionLevel:      chunk.SectionLevel,
			ChunkIndex:        index,
			HasChunkIndex:     true,
			TreeNodeID:        chunk.TreeNodeID,
			ParentNodeID:      chunk.ParentNodeID,
			SectionChunkIndex: chunk.SectionChunkIndex,
			HasSectionChunk:   true,
		})
	}

	result := &fragdto.FragmentPageResultDTO{
		Page:  1,
		Total: int64(len(list)),
		List:  list,
	}
	if includeNodes {
		result.DocumentNodes = buildDocumentNodeDTOs(documentTitle, sources)
	}
	return result
}

func previewDocumentTitle(input *fragdto.PreviewFragmentInput) string {
	if input == nil || input.DocumentFile == nil {
		return ""
	}
	return strings.TrimSpace(input.DocumentFile.Name)
}

func metadataStringValue(metadata map[string]any, key string) string {
	if len(metadata) == 0 {
		return ""
	}
	value, ok := metadata[key].(string)
	if !ok {
		return ""
	}
	return strings.TrimSpace(value)
}

func metadataIntLookup(metadata map[string]any, key string) (int, bool) {
	if len(metadata) == 0 {
		return 0, false
	}
	switch value := metadata[key].(type) {
	case int:
		return value, true
	case int32:
		return int(value), true
	case int64:
		return int(value), true
	case float64:
		return int(value), true
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(value))
		if err == nil {
			return parsed, true
		}
	}
	return 0, false
}

func buildSimilaritySearchOptions(input *fragdto.SimilarityInput) *fragretrieval.SimilaritySearchOptions {
	if input == nil {
		return nil
	}

	var filters *fragretrieval.SimilarityFilters
	if input.Filters != nil {
		filters = &fragretrieval.SimilarityFilters{
			DocumentCodes: append([]string{}, input.Filters.DocumentCodes...),
			DocumentTypes: append([]int{}, input.Filters.DocumentTypes...),
			SectionPaths:  append([]string{}, input.Filters.SectionPaths...),
			SectionLevels: append([]int{}, input.Filters.SectionLevels...),
			Tags:          append([]string{}, input.Filters.Tags...),
		}
		if input.Filters.TimeRange != nil {
			filters.TimeRange = &fragretrieval.SimilarityTimeRange{
				StartUnix: input.Filters.TimeRange.StartUnix,
				EndUnix:   input.Filters.TimeRange.EndUnix,
			}
		}
	}

	if filters == nil && !input.Debug {
		return nil
	}
	return &fragretrieval.SimilaritySearchOptions{
		Filters: filters,
		Debug:   input.Debug,
	}
}

// EntityToDTO 将片段实体映射为查询 DTO。
func EntityToDTO(e *fragmodel.KnowledgeBaseFragment) *fragdto.FragmentDTO {
	if e == nil {
		return nil
	}

	return &fragdto.FragmentDTO{
		ID:                e.ID,
		OrganizationCode:  e.OrganizationCode,
		KnowledgeCode:     e.KnowledgeCode,
		Creator:           e.CreatedUID,
		Modifier:          e.UpdatedUID,
		DocumentCode:      e.DocumentCode,
		BusinessID:        e.BusinessID,
		CreatedUID:        e.CreatedUID,
		UpdatedUID:        e.UpdatedUID,
		DocumentName:      e.DocumentName,
		DocumentType:      e.DocumentType,
		Content:           fragmetadata.BuildFragmentDisplayContent(e.Content, e.Metadata, e.SectionPath, e.SectionTitle),
		Metadata:          e.Metadata,
		SyncStatus:        int(e.SyncStatus),
		SyncStatusMessage: e.SyncStatusMessage,
		PointID:           e.PointID,
		WordCount:         e.WordCount,
		CreatedAt:         timeformat.FormatAPIDatetime(e.CreatedAt),
		UpdatedAt:         timeformat.FormatAPIDatetime(e.UpdatedAt),
	}
}

// BuildSimilarityDisplayContent 构造相似度展示文案并返回字数。
func BuildSimilarityDisplayContent(content string, metadata map[string]any) (string, int) {
	displayContent := fragmetadata.BuildFragmentDisplayContent(content, metadata, "", "")
	return displayContent, len([]rune(displayContent))
}
