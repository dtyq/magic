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
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	fragmetadata "magic/internal/domain/knowledge/fragment/metadata"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/thirdplatform"
	"magic/internal/pkg/timeformat"
)

var (
	errPreviewWaitCanceled = errors.New("preview wait canceled")
	errPreviewResultType   = errors.New("unexpected preview result type")
)

func buildPreviewRequestKey(input *fragdto.PreviewFragmentInput) string {
	if input == nil {
		sum := sha256.Sum256([]byte("empty"))
		return hex.EncodeToString(sum[:])
	}
	var builder strings.Builder
	builder.WriteString(previewPlanFromInput(input, false).RequestKey)
	builder.WriteString("|document_code=")
	builder.WriteString(strings.TrimSpace(input.DocumentCode))
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
		resolveEffectivePreviewFragmentConfig(input),
		hasThirdPlatformResolver,
	)
}

func resolveEffectivePreviewFragmentConfig(input *fragdto.PreviewFragmentInput) *shared.FragmentConfig {
	if input == nil {
		return nil
	}
	if input.StrategyConfig == nil {
		// 当前产品约定：flow 向量知识库预览不会传 strategy_config，数字员工知识库预览会传。
		// 这里仅收口执行态分片模式，不改请求/回显里的 fragment_config。
		return shared.DefaultFragmentConfig()
	}
	return confighelper.FragmentConfigDTOToEntity(input.FragmentConfig)
}

func previewDomainFileFromDTO(file *docfilehelper.DocumentFileDTO) *fragmodel.DocumentFile {
	domainFile := docfilehelper.ToDomainFile(file)
	if domainFile == nil || file == nil {
		return fragDocumentFileFromDomain(domainFile)
	}
	if key := strings.TrimSpace(file.Key); key != "" {
		domainFile.URL = key
	}
	return fragDocumentFileFromDomain(domainFile)
}

func previewDomainFileFromEntity(file *docentity.File) *fragmodel.DocumentFile {
	domainFile := fragDocumentFileFromDomain(file)
	if domainFile == nil || file == nil {
		return domainFile
	}
	if strings.TrimSpace(domainFile.URL) == "" && strings.TrimSpace(file.FileKey) != "" {
		domainFile.URL = strings.TrimSpace(file.FileKey)
	}
	return domainFile
}

func previewRequestHasUsableSource(file *docfilehelper.DocumentFileDTO) bool {
	if file == nil {
		return false
	}
	if strings.TrimSpace(file.URL) != "" || strings.TrimSpace(file.Key) != "" {
		return true
	}
	if file.FileLink != nil && strings.TrimSpace(file.FileLink.URL) != "" {
		return true
	}
	if strings.TrimSpace(file.ThirdID) != "" || strings.TrimSpace(file.SourceType) != "" {
		return true
	}
	return file.ProjectFileID > 0
}

func normalizePreviewStrategyConfigKey(cfg *confighelper.StrategyConfigDTO) string {
	options := confighelper.StrategyConfigDTOToParseOptionsForKnowledgeBaseType(
		resolvePreviewKnowledgeBaseType(cfg),
		cfg,
	)
	return fmt.Sprintf(
		"parsing_type=%d,image_extraction=%t,table_extraction=%t,image_ocr=%t",
		options.ParsingType,
		options.ImageExtraction,
		options.TableExtraction,
		options.ImageOCR,
	)
}

func (s *FragmentAppService) resolvePreviewDocument(
	ctx context.Context,
	input *fragdto.PreviewFragmentInput,
) *docentity.KnowledgeBaseDocument {
	if s == nil || s.documentService == nil || input == nil {
		return nil
	}

	documentCode := strings.TrimSpace(input.DocumentCode)
	if documentCode == "" {
		return nil
	}

	document, err := s.documentService.Show(ctx, documentCode)
	if err != nil {
		if s.logger != nil {
			s.logger.KnowledgeWarnContext(ctx, "Resolve preview document by code failed, fallback to request source", "document_code", documentCode, "error", err)
		}
		return nil
	}
	if document == nil {
		return nil
	}
	if !document.BelongsToOrganization(input.OrganizationCode) {
		if s.logger != nil {
			s.logger.KnowledgeWarnContext(ctx, "Preview document organization mismatch, fallback to request source", "document_code", documentCode, "document_organization_code", document.OrganizationCode, "request_organization_code", input.OrganizationCode)
		}
		return nil
	}
	return document
}

func isProjectPreviewDocument(doc *docentity.KnowledgeBaseDocument) bool {
	if doc == nil {
		return false
	}
	if doc.ProjectFileID > 0 {
		return true
	}
	if doc.DocumentFile == nil {
		return false
	}
	if strings.EqualFold(documentdomain.NormalizeDocumentFileType(doc.DocumentFile.Type), "project_file") {
		return true
	}
	return strings.EqualFold(strings.TrimSpace(doc.DocumentFile.SourceType), "project")
}

func (s *FragmentAppService) resolveProjectFilePreviewContent(
	ctx context.Context,
	doc *docentity.KnowledgeBaseDocument,
	parseOptions documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, string, error) {
	link, err := documentdomain.ResolveProjectFileContentLink(ctx, s.projectFileContentPort, doc.ProjectFileID, 10*time.Minute)
	if err != nil {
		return nil, "", fmt.Errorf("resolve project file preview source: %w", err)
	}
	if link == "" {
		return nil, "", shared.ErrDocumentFileEmpty
	}

	fileName := ""
	fileExtension := ""
	if doc != nil && doc.DocumentFile != nil {
		fileName = strings.TrimSpace(doc.DocumentFile.Name)
		fileExtension = strings.TrimSpace(doc.DocumentFile.Extension)
	}

	parsedDocument, err := s.parseService.ParseDocumentWithOptions(ctx, link, fileExtension, parseOptions)
	if err != nil {
		return nil, "", fmt.Errorf("failed to parse document: %w", err)
	}
	documentdomain.ApplyPreferredParsedDocumentFileName(parsedDocument, fileName)
	return parsedDocument, texthelper.NormalizeHierarchySourceFileType(fileExtension), nil
}

func (s *FragmentAppService) resolvePreviewContent(ctx context.Context, input *fragdto.PreviewFragmentInput) (*parseddocument.ParsedDocument, string, error) {
	parseOptions := confighelper.StrategyConfigDTOToParseOptionsForKnowledgeBaseType(
		resolvePreviewKnowledgeBaseType(input.StrategyConfig),
		input.StrategyConfig,
	)
	resolvedDocument := s.resolvePreviewDocument(ctx, input)
	if isProjectPreviewDocument(resolvedDocument) {
		return s.resolveProjectFilePreviewContent(ctx, resolvedDocument, parseOptions)
	}

	plan := previewPlanFromInput(input, s != nil && s.thirdPlatformDocumentPort != nil)
	documentFile := plan.DocumentFile
	if resolvedDocument != nil && !previewRequestHasUsableSource(input.DocumentFile) {
		documentFile = previewDomainFileFromEntity(resolvedDocument.DocumentFile)
		plan = fragdomain.ResolvePreviewPlan(
			documentFile,
			resolveEffectivePreviewFragmentConfig(input),
			s != nil && s.thirdPlatformDocumentPort != nil,
		)
	}
	if plan.TryThirdPlatform {
		parsedDocument, resolvedDocumentFile, err := s.resolveThirdPlatformPreviewContent(ctx, input, documentFile, parseOptions)
		if err == nil {
			return parsedDocument, texthelper.NormalizeHierarchySourceFileType(resolvedDocumentFile.Extension), nil
		}
		if strings.TrimSpace(resolvedDocumentFile.URL) == "" {
			return nil, "", err
		}
		if s.logger != nil {
			s.logger.KnowledgeWarnContext(ctx, "Resolve third-platform preview failed, fallback to URL parsing", "error", err)
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

func resolvePreviewKnowledgeBaseType(cfg *confighelper.StrategyConfigDTO) string {
	if cfg == nil {
		return "flow_vector"
	}
	return "digital_employee"
}

func (s *FragmentAppService) resolveThirdPlatformPreviewContent(
	ctx context.Context,
	input *fragdto.PreviewFragmentInput,
	documentFile *fragmodel.DocumentFile,
	parseOptions documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, *fragmodel.DocumentFile, error) {
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
	if input == nil || (input.DocumentFile == nil && strings.TrimSpace(input.DocumentCode) == "") {
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
	if input == nil || (input.DocumentFile == nil && strings.TrimSpace(input.DocumentCode) == "") {
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
		meta := fragmetadata.BuildFragmentSemanticMetadata(nil, fragmetadata.FragmentSemanticMetadataDefaults{
			ChunkIndex:           i,
			ContentHash:          texthelper.HashText(chunk.Content),
			SplitVersion:         splitVersion,
			RetrievalTextVersion: fragretrieval.RetrievalTextVersionV1,
			SectionPath:          chunk.SectionPath,
			SectionTitle:         chunk.SectionTitle,
			SectionLevel:         chunk.SectionLevel,
			CreatedAtTS:          createdAtUnix,
		}, extraMetadata)
		sanitizedMetadata := sanitizeFragmentResponseMetadata(meta)
		dtos = append(dtos, &fragdto.FragmentDTO{
			ID:            0,
			KnowledgeCode: "",
			DocumentCode:  "",
			Content:       fragmetadata.BuildFragmentDisplayContent(chunk.Content, sanitizedMetadata, chunk.SectionPath, chunk.SectionTitle),
			Metadata:      sanitizedMetadata,
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
	if input == nil {
		return ""
	}
	if input.DocumentFile != nil {
		if title := strings.TrimSpace(input.DocumentFile.Name); title != "" {
			return title
		}
	}
	return strings.TrimSpace(input.DocumentCode)
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
		Metadata:          sanitizeFragmentResponseMetadata(e.Metadata),
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
