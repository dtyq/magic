package fragapp_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"testing/synctest"
	"time"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	appservice "magic/internal/application/knowledge/fragment/service"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/thirdplatform"
	"magic/internal/pkg/tokenizer"
)

var (
	errPreviewTestUnexpectedGetLink = errors.New("unexpected get link")
	errPreviewTestFetchFailed       = errors.New("fetch failed")
)

type previewTestFetcher struct {
	fetchFn   func(context.Context, string) (io.ReadCloser, error)
	getLinkFn func(context.Context, string, string, time.Duration) (string, error)
}

type previewProjectFileAccessorStub struct {
	getLinkFn func(context.Context, int64, time.Duration) (string, error)
}

func (f *previewTestFetcher) Fetch(ctx context.Context, path string) (io.ReadCloser, error) {
	return f.fetchFn(ctx, path)
}

func (f *previewTestFetcher) GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error) {
	if f.getLinkFn == nil {
		return "", errPreviewTestUnexpectedGetLink
	}
	return f.getLinkFn(ctx, path, method, expire)
}

func (f *previewTestFetcher) Stat(context.Context, string) error {
	return nil
}

func (s *previewProjectFileAccessorStub) GetLink(ctx context.Context, projectFileID int64, expire time.Duration) (string, error) {
	if s == nil || s.getLinkFn == nil {
		return "", nil
	}
	return s.getLinkFn(ctx, projectFileID, expire)
}

type previewTestParser struct {
	mu                  sync.Mutex
	lastOptions         *documentdomain.ParseOptions
	parseDocumentResult *parseddocument.ParsedDocument
}

type previewSplitterStub struct{}

type previewCaptureSplitter struct {
	mu        sync.Mutex
	lastInput documentsplitter.ParsedDocumentChunkInput
}

type previewMetadataSplitter struct{}

func (p *previewTestParser) Parse(ctx context.Context, fileURL string, file io.Reader, fileType string) (string, error) {
	data, err := io.ReadAll(file)
	if err != nil {
		return "", fmt.Errorf("read preview parser input: %w", err)
	}
	return string(data), nil
}

func (p *previewTestParser) ParseDocument(ctx context.Context, fileURL string, file io.Reader, fileType string) (*parseddocument.ParsedDocument, error) {
	if p.parseDocumentResult != nil {
		return p.parseDocumentResult, nil
	}
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read preview parser input: %w", err)
	}
	return parseddocument.NewPlainTextParsedDocument(
		fileType,
		documentdomain.NormalizeDocumentContentForFileType(fileType, string(data)),
	), nil
}

func (p *previewTestParser) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, error) {
	cloned := options
	p.mu.Lock()
	p.lastOptions = &cloned
	p.mu.Unlock()
	return p.ParseDocument(ctx, fileURL, file, fileType)
}

func (p *previewTestParser) snapshotLastOptions() *documentdomain.ParseOptions {
	if p == nil {
		return nil
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	if p.lastOptions == nil {
		return nil
	}
	cloned := *p.lastOptions
	return &cloned
}

func (p *previewTestParser) Supports(fileType string) bool {
	return true
}

func (p *previewTestParser) NeedsResolvedURL() bool {
	return false
}

func (previewSplitterStub) SplitParsedDocumentToChunks(ctx context.Context, input documentsplitter.ParsedDocumentChunkInput) ([]documentsplitter.TokenChunk, string, error) {
	if input.Parsed == nil {
		return nil, "", nil
	}
	time.Sleep(20 * time.Millisecond)
	chunks := []documentsplitter.TokenChunk{
		{Content: "第一段", TokenCount: 3},
		{Content: "第二段", TokenCount: 3},
	}
	return chunks, "test_split_v1", nil
}

func (s *previewCaptureSplitter) SplitParsedDocumentToChunks(ctx context.Context, input documentsplitter.ParsedDocumentChunkInput) ([]documentsplitter.TokenChunk, string, error) {
	s.mu.Lock()
	s.lastInput = clonePreviewChunkInput(input)
	s.mu.Unlock()
	return []documentsplitter.TokenChunk{{Content: "第一段", TokenCount: 3}}, "test_split_capture", nil
}

func (previewMetadataSplitter) SplitParsedDocumentToChunks(context.Context, documentsplitter.ParsedDocumentChunkInput) ([]documentsplitter.TokenChunk, string, error) {
	return []documentsplitter.TokenChunk{
		{
			Content:      "第一段",
			TokenCount:   3,
			SectionTitle: "预览标题",
			Metadata: map[string]any{
				"tag": "preview",
				"ext": map[string]any{"hidden": "value"},
			},
		},
	}, "test_split_metadata", nil
}

func (s *previewCaptureSplitter) snapshotLastInput() documentsplitter.ParsedDocumentChunkInput {
	s.mu.Lock()
	defer s.mu.Unlock()
	return clonePreviewChunkInput(s.lastInput)
}

func newPreviewAppService(fetcher *previewTestFetcher) *appservice.FragmentAppService {
	parseSvc := documentdomain.NewParseServiceWithParsers(fetcher, logging.New(), &previewTestParser{})
	return appservice.NewFragmentAppService(nil, nil, nil, appservice.AppDeps{
		ParseService:          parseSvc,
		PreviewSplitter:       previewSplitterStub{},
		Tokenizer:             tokenizer.NewService(),
		DefaultEmbeddingModel: "text-embedding-3-small",
	}, logging.New())
}

func previewInput(chunkSize int) *fragdto.PreviewFragmentInput {
	return &fragdto.PreviewFragmentInput{
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Type:      "external",
			Name:      "demo.md",
			Key:       "DT001/demo.md",
			URL:       "DT001/demo.md",
			Extension: "md",
		},
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: 1,
			Normal: &confighelper.NormalFragmentConfigDTO{
				TextPreprocessRule: []int{},
				SegmentRule: &confighelper.SegmentRuleDTO{
					Separator:    "\\n\\n",
					ChunkSize:    chunkSize,
					ChunkOverlap: 50,
				},
			},
		},
	}
}

func previewInputWithStrategyConfig(chunkSize int) *fragdto.PreviewFragmentInput {
	input := previewInput(chunkSize)
	input.StrategyConfig = &confighelper.StrategyConfigDTO{}
	return input
}

func clonePreviewChunkInput(input documentsplitter.ParsedDocumentChunkInput) documentsplitter.ParsedDocumentChunkInput {
	cloned := input
	cloned.FragmentConfig = shared.CloneFragmentConfig(input.FragmentConfig)
	cloned.SegmentConfig.TextPreprocessRule = append([]int(nil), input.SegmentConfig.TextPreprocessRule...)
	return cloned
}

func TestBuildPreviewRequestKeyForTest_NormalizesEquivalentDefaults(t *testing.T) {
	t.Parallel()

	withDefaults := previewInputWithStrategyConfig(0)
	withDefaults.FragmentConfig.Normal.SegmentRule.ChunkOverlap = 80
	withNilRule := previewInputWithStrategyConfig(1000)
	withNilRule.FragmentConfig.Normal.SegmentRule = nil

	keyWithDefaults := appservice.BuildPreviewRequestKeyForTest(withDefaults)
	keyWithNilRule := appservice.BuildPreviewRequestKeyForTest(withNilRule)
	if keyWithDefaults != keyWithNilRule {
		t.Fatalf("expected equivalent preview keys, got %s and %s", keyWithDefaults, keyWithNilRule)
	}
}

func TestFragmentAppServicePreview_DeduplicatesConcurrentIdenticalRequests(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var fetchCalls atomic.Int64
		fetchStarted := make(chan struct{})
		releaseFetch := make(chan struct{})
		svc := newPreviewAppService(&previewTestFetcher{
			fetchFn: func(context.Context, string) (io.ReadCloser, error) {
				fetchCalls.Add(1)
				select {
				case <-fetchStarted:
				default:
					close(fetchStarted)
				}
				<-releaseFetch
				return io.NopCloser(strings.NewReader("第一段\n\n第二段")), nil
			},
		})

		input := previewInput(500)
		results := make([][]*fragdto.FragmentDTO, 2)
		errs := make([]error, 2)
		var wg sync.WaitGroup
		wg.Add(2)
		for i := range 2 {
			go func(idx int) {
				defer wg.Done()
				results[idx], errs[idx] = svc.Preview(context.Background(), input)
			}(i)
		}

		<-fetchStarted
		close(releaseFetch)
		wg.Wait()

		for i, err := range errs {
			if err != nil {
				t.Fatalf("request %d returned error: %v", i, err)
			}
			if len(results[i]) == 0 {
				t.Fatalf("request %d returned empty result", i)
			}
		}
		if got := fetchCalls.Load(); got != 1 {
			t.Fatalf("expected 1 fetch call, got %d", got)
		}
	})
}

func TestFragmentAppServicePreviewV2ReturnsHierarchyDocumentNodes(t *testing.T) {
	t.Parallel()

	svc := newPreviewAppServiceWithSplitter(&previewTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			content := "# 录音文本时间区间提取方案\n\n## 背景\n\n### 当前状态\n数据来源：前端将录音识别的文本实时写入文件\n\n#### 第四层标题\n第四层正文"
			return io.NopCloser(strings.NewReader(content)), nil
		},
	}, documentsplitter.NewPreviewSplitter())
	input := previewInput(500)
	input.FragmentConfig.Mode = 2
	input.FragmentConfig.Hierarchy = &confighelper.HierarchyFragmentConfigDTO{}

	page, err := svc.PreviewV2(context.Background(), input)
	if err != nil {
		t.Fatalf("preview v2: %v", err)
	}
	if page == nil || len(page.DocumentNodes) == 0 {
		t.Fatalf("expected document nodes, got %#v", page)
	}
	if page.DocumentNodes[0].Type != "title" || page.DocumentNodes[0].Text != "录音文本时间区间提取方案" {
		t.Fatalf("unexpected root node: %#v", page.DocumentNodes[0])
	}
	if !hasSectionTitleNode(page.DocumentNodes, "背景") ||
		!hasSectionTitleNode(page.DocumentNodes, "当前状态") ||
		!hasSectionTitleNode(page.DocumentNodes, "第四层标题") {
		t.Fatalf("expected hierarchy section nodes, got %#v", page.DocumentNodes)
	}
	if hasPreviewNodeContaining(page.DocumentNodes, "#### 第四层标题", "section-text") {
		t.Fatalf("expected hierarchy title to render as tree node, got %#v", page.DocumentNodes)
	}
	if !hasPreviewNodeContaining(page.DocumentNodes, "第四层正文", "section-text") {
		t.Fatalf("expected descendant text node, got %#v", page.DocumentNodes)
	}
	for _, item := range page.List {
		if item == nil || item.Metadata == nil {
			continue
		}
		if item.Metadata["effective_split_mode"] == "normal_fallback" {
			t.Fatalf("expected hierarchy preview not to fall back, got %#v", item.Metadata)
		}
		if level, ok := item.Metadata["section_level"].(int); ok && level > 3 {
			t.Fatalf("expected default hierarchy level <=3, got %#v", item.Metadata)
		}
	}
}

func TestFragmentAppServicePreviewSanitizesMetadata(t *testing.T) {
	t.Parallel()

	parseSvc := documentdomain.NewParseServiceWithParsers(
		&previewTestFetcher{
			fetchFn: func(context.Context, string) (io.ReadCloser, error) {
				return io.NopCloser(strings.NewReader("# 标题\n\n正文")), nil
			},
		},
		logging.New(),
		&previewTestParser{},
	)
	svc := appservice.NewFragmentAppService(nil, nil, nil, appservice.AppDeps{
		ParseService:          parseSvc,
		PreviewSplitter:       previewMetadataSplitter{},
		Tokenizer:             tokenizer.NewService(),
		DefaultEmbeddingModel: "text-embedding-3-small",
	}, logging.New())

	fragments, err := svc.Preview(context.Background(), previewInput(500))
	if err != nil {
		t.Fatalf("preview failed: %v", err)
	}
	if len(fragments) != 1 {
		t.Fatalf("unexpected preview fragments: %#v", fragments)
	}
	assertFragmentMetadataSanitized(t, fragments[0].Metadata)
	if fragments[0].Metadata["tag"] != "preview" {
		t.Fatalf("expected preview metadata to preserve semantic fields, got %#v", fragments[0].Metadata)
	}

	page, err := svc.PreviewV2(context.Background(), previewInput(500))
	if err != nil {
		t.Fatalf("previewV2 failed: %v", err)
	}
	if len(page.List) != 1 {
		t.Fatalf("unexpected previewV2 fragments: %#v", page)
	}
	assertFragmentMetadataSanitized(t, page.List[0].Metadata)
}

func TestFragmentAppServicePreviewV2AutoModeHandlesEscapedMarkdownContent(t *testing.T) {
	t.Parallel()

	parseSvc := documentdomain.NewParseServiceWithParsers(&previewTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader(
				"# 录音方案\\n\\n## 背景\\n目前录音文本会持续追加到文件。\\n\\n## 目标\\n希望保留结构信息。",
			)), nil
		},
	}, logging.New(), &previewTestParser{})
	svc := appservice.NewFragmentAppService(nil, nil, nil, appservice.AppDeps{
		ParseService:          parseSvc,
		PreviewSplitter:       documentsplitter.NewPreviewSplitter(),
		Tokenizer:             tokenizer.NewService(),
		DefaultEmbeddingModel: "text-embedding-3-small",
	}, logging.New())

	page, err := svc.PreviewV2(context.Background(), &fragdto.PreviewFragmentInput{
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Type:      "external",
			Name:      "策略验证-层级预览.md",
			Key:       "DT001/demo.md",
			URL:       "DT001/demo.md",
			Extension: "md",
		},
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: 2,
		},
	})
	if err != nil {
		t.Fatalf("preview v2: %v", err)
	}
	if page == nil || len(page.DocumentNodes) == 0 {
		t.Fatalf("expected hierarchy document nodes, got %#v", page)
	}
	if !hasSectionTitleNode(page.DocumentNodes, "背景") ||
		!hasSectionTitleNode(page.DocumentNodes, "目标") {
		t.Fatalf("expected escaped markdown to restore hierarchy nodes, got %#v", page.DocumentNodes)
	}
	if len(page.List) == 0 || page.List[0] == nil {
		t.Fatalf("expected preview chunks, got %#v", page)
	}
	if mode := page.List[0].Metadata["effective_split_mode"]; mode == "normal" || mode == "normal_fallback" {
		t.Fatalf("expected auto mode not to fall back after decoding escaped markdown, got %#v", page.List[0].Metadata)
	}
}

func newPreviewAppServiceWithSplitter(fetcher *previewTestFetcher, previewSplitter documentsplitter.PreviewSplitter) *appservice.FragmentAppService {
	parseSvc := documentdomain.NewParseServiceWithParsers(fetcher, logging.New(), &previewTestParser{})
	return appservice.NewFragmentAppService(nil, nil, nil, appservice.AppDeps{
		ParseService:          parseSvc,
		PreviewSplitter:       previewSplitter,
		Tokenizer:             tokenizer.NewService(),
		DefaultEmbeddingModel: "text-embedding-3-small",
	}, logging.New())
}

func hasSectionTitleNode(nodes []fragdto.DocumentNodeDTO, text string) bool {
	for _, node := range nodes {
		if node.Text == text && node.Type == "section-title" {
			return true
		}
	}
	return false
}

func hasPreviewNodeContaining(nodes []fragdto.DocumentNodeDTO, text, nodeType string) bool {
	for _, node := range nodes {
		if strings.Contains(node.Text, text) && node.Type == nodeType {
			return true
		}
	}
	return false
}

func TestFragmentAppServicePreviewV2UsesBusinessFileNameForTabularChunks(t *testing.T) {
	t.Parallel()

	parser := &previewTestParser{
		parseDocumentResult: newPreviewTabularParsedDocument("1775908129904-0s6pzx-rag_.xlsx"),
	}
	parseSvc := documentdomain.NewParseServiceWithParsers(&previewTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("ignored")), nil
		},
	}, logging.New(), parser)
	svc := appservice.NewFragmentAppService(nil, nil, nil, appservice.AppDeps{
		ParseService:          parseSvc,
		PreviewSplitter:       documentsplitter.NewPreviewSplitter(),
		Tokenizer:             tokenizer.NewService(),
		DefaultEmbeddingModel: "text-embedding-3-small",
	}, logging.New())

	page, err := svc.PreviewV2(context.Background(), &fragdto.PreviewFragmentInput{
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Type:      "external",
			Name:      "rag 门店数据验证.xlsx",
			Key:       "TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/1775908129904-0s6pzx-rag_.xlsx",
			URL:       "TGosRaFhvb/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/1775908129904-0s6pzx-rag_.xlsx",
			Extension: "xlsx",
		},
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: 2,
		},
	})
	if err != nil {
		t.Fatalf("preview v2: %v", err)
	}
	if page == nil || len(page.List) == 0 {
		t.Fatalf("expected preview chunks, got %#v", page)
	}
	if got := page.List[0].Content; !strings.Contains(got, "文件名: rag 门店数据验证.xlsx") {
		t.Fatalf("expected business file name in preview chunk, got %q", got)
	}
	if got := page.List[0].Content; strings.Contains(got, "1775908129904-0s6pzx-rag_.xlsx") {
		t.Fatalf("expected random object key file name removed, got %q", got)
	}
	if got := page.List[0].Metadata[parseddocument.MetaFileName]; got != "rag 门店数据验证.xlsx" {
		t.Fatalf("expected preview metadata file_name updated, got %#v", page.List[0].Metadata)
	}
}

func TestFragmentAppServicePreview_ThirdPlatformRawContentUsesGoParser(t *testing.T) {
	t.Parallel()

	var fetchCalls atomic.Int64
	parser := &previewTestParser{}
	parseSvc := documentdomain.NewParseServiceWithParsers(&previewTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			fetchCalls.Add(1)
			return io.NopCloser(strings.NewReader("should not fetch")), nil
		},
	}, logging.New(), parser)
	resolver := &fragmentThirdPlatformResolverStub{
		result: &thirdplatform.DocumentResolveResult{
			SourceKind: thirdplatform.DocumentSourceKindRawContent,
			RawContent: "第一段\n\n第二段",
			DocType:    int(docentity.DocumentInputKindText),
			DocumentFile: map[string]any{
				"type":          "third_platform",
				"name":          "resolved.md",
				"third_file_id": "FILE-1",
				"platform_type": "teamshare",
				"extension":     "md",
			},
		},
	}
	svc := appservice.NewFragmentAppService(nil, nil, nil, appservice.AppDeps{
		ParseService:              parseSvc,
		ThirdPlatformDocumentPort: resolver,
		PreviewSplitter:           previewSplitterStub{},
		Tokenizer:                 tokenizer.NewService(),
		DefaultEmbeddingModel:     "text-embedding-3-small",
	}, logging.New())

	fragments, err := svc.Preview(context.Background(), &fragdto.PreviewFragmentInput{
		OrganizationCode: "ORG1",
		UserID:           "U1",
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Type:       "third_platform",
			Name:       "demo.md",
			ThirdID:    "FILE-1",
			SourceType: "teamshare",
			Extension:  "md",
		},
		FragmentConfig: previewInput(500).FragmentConfig,
	})
	if err != nil {
		t.Fatalf("preview third-platform raw content: %v", err)
	}
	if len(fragments) == 0 {
		t.Fatalf("expected preview fragments, got %#v", fragments)
	}
	if fetchCalls.Load() != 0 {
		t.Fatalf("expected raw-content preview to skip fetch, got %d", fetchCalls.Load())
	}
	if resolver.lastInput == nil || resolver.lastInput.ThirdFileID != "FILE-1" {
		t.Fatalf("unexpected resolve input: %#v", resolver.lastInput)
	}
}

func newPreviewTabularParsedDocument(fileName string) *parseddocument.ParsedDocument {
	content := strings.Join([]string{
		"文件名: " + fileName,
		"工作表: 截图数据",
		"表格: 截图数据 表1",
		"行号: 2",
		"门店编码：V90901",
	}, "\n")
	return &parseddocument.ParsedDocument{
		SourceType: parseddocument.SourceTabular,
		PlainText:  content,
		Blocks: []parseddocument.ParsedBlock{
			{
				Type:    parseddocument.BlockTypeTableRow,
				Content: content,
				Metadata: map[string]any{
					parseddocument.MetaFileName:     fileName,
					parseddocument.MetaSourceFormat: "xlsx",
					parseddocument.MetaSheetName:    "截图数据",
					parseddocument.MetaTableTitle:   "截图数据 表1",
					parseddocument.MetaRowIndex:     2,
					parseddocument.MetaFields: []map[string]any{
						{
							"header":      "门店编码",
							"header_path": "门店编码",
							"value":       "V90901",
						},
					},
				},
			},
		},
		DocumentMeta: map[string]any{
			parseddocument.MetaSourceFormat: "xlsx",
			parseddocument.MetaFileName:     fileName,
		},
	}
}

func TestFragmentAppServicePreview_DifferentChunkConfigsDoNotShareResults(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var fetchCalls atomic.Int64
		svc := newPreviewAppService(&previewTestFetcher{
			fetchFn: func(context.Context, string) (io.ReadCloser, error) {
				fetchCalls.Add(1)
				return io.NopCloser(strings.NewReader("第一段\n\n第二段")), nil
			},
		})

		var wg sync.WaitGroup
		errs := make([]error, 2)
		inputs := []*fragdto.PreviewFragmentInput{
			previewInputWithStrategyConfig(500),
			previewInputWithStrategyConfig(600),
		}
		wg.Add(len(inputs))
		for i, input := range inputs {
			go func(idx int, in *fragdto.PreviewFragmentInput) {
				defer wg.Done()
				_, errs[idx] = svc.Preview(context.Background(), in)
			}(i, input)
		}
		wg.Wait()

		for _, err := range errs {
			if err != nil {
				t.Fatalf("Preview returned error: %v", err)
			}
		}
		if got := fetchCalls.Load(); got != 2 {
			t.Fatalf("expected 2 fetch calls, got %d", got)
		}
	})
}

func TestFragmentAppServicePreview_UsesTopLevelStrategyConfig(t *testing.T) {
	t.Parallel()

	parser := &previewTestParser{}
	parseSvc := documentdomain.NewParseServiceWithParsers(&previewTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("第一页图片说明\n\n第二页表格说明")), nil
		},
	}, logging.New(), parser)
	svc := appservice.NewFragmentAppService(nil, nil, nil, appservice.AppDeps{
		ParseService:          parseSvc,
		PreviewSplitter:       previewSplitterStub{},
		Tokenizer:             tokenizer.NewService(),
		DefaultEmbeddingModel: "text-embedding-3-small",
	}, logging.New())

	input := previewInput(500)
	input.StrategyConfig = &confighelper.StrategyConfigDTO{
		ParsingType:     documentdomain.ParsingTypeQuick,
		ImageExtraction: true,
		TableExtraction: true,
		ImageOCR:        true,
	}

	if _, err := svc.PreviewV2(context.Background(), input); err != nil {
		t.Fatalf("preview v2: %v", err)
	}
	lastOptions := parser.snapshotLastOptions()
	if lastOptions == nil {
		t.Fatal("expected preview parse options captured")
	}
	if lastOptions.ParsingType != documentdomain.ParsingTypeQuick {
		t.Fatalf("expected quick parsing type, got %#v", lastOptions)
	}
	if lastOptions.ImageExtraction || lastOptions.TableExtraction || lastOptions.ImageOCR {
		t.Fatalf("expected quick preview to disable extra extraction, got %#v", lastOptions)
	}
}

func TestFragmentAppServicePreview_DocumentCodeProjectFileUsesProjectFileAccessor(t *testing.T) {
	t.Parallel()

	var fetchedPath string
	var projectFileID int64
	parseSvc := documentdomain.NewParseServiceWithParsers(&previewTestFetcher{
		fetchFn: func(_ context.Context, path string) (io.ReadCloser, error) {
			fetchedPath = path
			return io.NopCloser(strings.NewReader("第一段\n\n第二段")), nil
		},
		getLinkFn: func(context.Context, string, string, time.Duration) (string, error) {
			return "", errPreviewTestUnexpectedGetLink
		},
	}, logging.New(), &previewTestParser{})
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		DocumentService: &fragmentAppDocumentReaderStub{
			showResult: &docentity.KnowledgeBaseDocument{
				Code:             "DOC-PROJECT-1",
				OrganizationCode: "ORG1",
				ProjectFileID:    42,
				DocumentFile: &docentity.File{
					Type:       "project_file",
					Name:       "门店数据.xml",
					Extension:  "xml",
					SourceType: "project",
				},
			},
		},
		ParseService: parseSvc,
		ProjectFileContentPort: &previewProjectFileAccessorStub{
			getLinkFn: func(_ context.Context, gotProjectFileID int64, _ time.Duration) (string, error) {
				projectFileID = gotProjectFileID
				return "https://example.com/project-file.xml?sign=1", nil
			},
		},
		PreviewSplitter:       previewSplitterStub{},
		DefaultEmbeddingModel: "text-embedding-3-small",
		Logger:                logging.New(),
	})

	page, err := svc.PreviewV2(context.Background(), &fragdto.PreviewFragmentInput{
		OrganizationCode: "ORG1",
		DocumentCode:     "DOC-PROJECT-1",
		FragmentConfig:   previewInput(500).FragmentConfig,
	})
	if err != nil {
		t.Fatalf("preview v2: %v", err)
	}
	if page == nil || len(page.List) == 0 {
		t.Fatalf("expected preview page, got %#v", page)
	}
	if projectFileID != 42 {
		t.Fatalf("expected project accessor called with project_file_id=42, got %d", projectFileID)
	}
	if fetchedPath != "https://example.com/project-file.xml?sign=1" {
		t.Fatalf("expected fetch to use signed project file link, got %q", fetchedPath)
	}
}

func TestFragmentAppServicePreview_DocumentCodeFallsBackToPersistedExternalDocumentFile(t *testing.T) {
	t.Parallel()

	var fetchedPath string
	parseSvc := documentdomain.NewParseServiceWithParsers(&previewTestFetcher{
		fetchFn: func(_ context.Context, path string) (io.ReadCloser, error) {
			fetchedPath = path
			return io.NopCloser(strings.NewReader("第一段\n\n第二段")), nil
		},
	}, logging.New(), &previewTestParser{})
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		DocumentService: &fragmentAppDocumentReaderStub{
			showResult: &docentity.KnowledgeBaseDocument{
				Code:             "DOC-EXT-1",
				OrganizationCode: "ORG1",
				DocumentFile: &docentity.File{
					Type:      "external",
					Name:      "demo.md",
					FileKey:   "DT001/persisted/demo.md",
					URL:       "",
					Extension: "md",
				},
			},
		},
		ParseService:          parseSvc,
		PreviewSplitter:       previewSplitterStub{},
		DefaultEmbeddingModel: "text-embedding-3-small",
		Logger:                logging.New(),
	})

	page, err := svc.PreviewV2(context.Background(), &fragdto.PreviewFragmentInput{
		OrganizationCode: "ORG1",
		DocumentCode:     "DOC-EXT-1",
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Name: "demo.md",
			Type: "external",
		},
		FragmentConfig: previewInput(500).FragmentConfig,
	})
	if err != nil {
		t.Fatalf("preview v2: %v", err)
	}
	if page == nil || len(page.List) == 0 {
		t.Fatalf("expected preview page, got %#v", page)
	}
	if fetchedPath != "DT001/persisted/demo.md" {
		t.Fatalf("expected fallback to persisted document_file, got %q", fetchedPath)
	}
}

func TestFragmentAppServicePreview_ProjectFileWithoutDocumentCodeStillFails(t *testing.T) {
	t.Parallel()

	svc := newPreviewAppService(&previewTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return nil, errPreviewTestFetchFailed
		},
	})

	_, err := svc.PreviewV2(context.Background(), &fragdto.PreviewFragmentInput{
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Type:             "project_file",
			Name:             "门店数据.xml",
			ProjectFileID:    42,
			RelativeFilePath: "workspace/门店数据.xml",
			SourceType:       "project",
			Extension:        "xml",
		},
		FragmentConfig: previewInput(500).FragmentConfig,
	})
	if err == nil {
		t.Fatal("expected project preview without document_code to fail")
	}
}

func TestFragmentAppServicePreview_NameOnlyExternalFileIsInvalid(t *testing.T) {
	t.Parallel()

	var fetchCalled atomic.Bool
	svc := newPreviewAppService(&previewTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			fetchCalled.Store(true)
			return nil, errPreviewTestFetchFailed
		},
	})

	_, err := svc.PreviewV2(context.Background(), &fragdto.PreviewFragmentInput{
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Type: "external",
			Name: "服务商、供应商、承包商资质审查标准",
		},
		FragmentConfig: previewInput(500).FragmentConfig,
	})
	if !errors.Is(err, shared.ErrDocumentFileEmpty) {
		t.Fatalf("expected ErrDocumentFileEmpty, got %v", err)
	}
	if fetchCalled.Load() {
		t.Fatal("expected name-only preview to fail before fetching")
	}
}

func TestFragmentAppServicePreview_ChunkCountChangesWithChunkConfig(t *testing.T) {
	t.Parallel()

	content := strings.Repeat("alpha beta gamma delta epsilon zeta eta theta iota kappa\n\n", 30)
	svc := newPreviewAppServiceWithSplitter(&previewTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader(content)), nil
		},
	}, documentsplitter.NewPreviewSplitter())

	smallChunks := previewInputWithStrategyConfig(120)
	smallChunks.FragmentConfig.Normal.SegmentRule.ChunkOverlap = 0
	largeChunks := previewInputWithStrategyConfig(400)
	largeChunks.FragmentConfig.Normal.SegmentRule.ChunkOverlap = 0

	smallPage, err := svc.PreviewV2(context.Background(), smallChunks)
	if err != nil {
		t.Fatalf("small chunk preview: %v", err)
	}
	largePage, err := svc.PreviewV2(context.Background(), largeChunks)
	if err != nil {
		t.Fatalf("large chunk preview: %v", err)
	}
	if smallPage == nil || largePage == nil {
		t.Fatalf("expected preview pages, small=%#v large=%#v", smallPage, largePage)
	}
	if len(smallPage.List) <= len(largePage.List) {
		t.Fatalf("expected smaller chunk_size to produce more chunks, small=%d large=%d", len(smallPage.List), len(largePage.List))
	}
}

func TestFragmentAppServicePreview_WithoutStrategyConfigForcesAutoMode(t *testing.T) {
	t.Parallel()

	tests := []struct {
		name      string
		configure func(*fragdto.PreviewFragmentInput)
	}{
		{
			name: "custom",
			configure: func(input *fragdto.PreviewFragmentInput) {
				input.FragmentConfig.Mode = 1
				input.FragmentConfig.Normal.SegmentRule.ChunkSize = 120
				input.FragmentConfig.Normal.SegmentRule.ChunkOverlap = 0
			},
		},
		{
			name: "hierarchy",
			configure: func(input *fragdto.PreviewFragmentInput) {
				input.FragmentConfig.Mode = 3
				input.FragmentConfig.Hierarchy = &confighelper.HierarchyFragmentConfigDTO{MaxLevel: 5}
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			t.Parallel()

			splitter := &previewCaptureSplitter{}
			svc := newPreviewAppServiceWithSplitter(&previewTestFetcher{
				fetchFn: func(context.Context, string) (io.ReadCloser, error) {
					return io.NopCloser(strings.NewReader("第一段\n\n第二段")), nil
				},
			}, splitter)

			input := previewInput(500)
			tt.configure(input)

			if _, err := svc.PreviewV2(context.Background(), input); err != nil {
				t.Fatalf("preview v2: %v", err)
			}

			got := splitter.snapshotLastInput()
			if got.RequestedMode != shared.FragmentModeAuto {
				t.Fatalf("expected auto requested mode, got %v", got.RequestedMode)
			}
			if got.FragmentConfig == nil || got.FragmentConfig.Mode != shared.FragmentModeAuto {
				t.Fatalf("expected auto fragment config, got %#v", got.FragmentConfig)
			}
			if got.SegmentConfig.ChunkSize != 1000 || got.SegmentConfig.ChunkOverlap != 80 || got.SegmentConfig.Separator != "\n\n" {
				t.Fatalf("expected default auto segment config, got %#v", got.SegmentConfig)
			}
		})
	}
}

func TestFragmentAppServicePreview_EmptyStrategyConfigKeepsRequestedFragmentMode(t *testing.T) {
	t.Parallel()

	splitter := &previewCaptureSplitter{}
	svc := newPreviewAppServiceWithSplitter(&previewTestFetcher{
		fetchFn: func(context.Context, string) (io.ReadCloser, error) {
			return io.NopCloser(strings.NewReader("第一段\n\n第二段")), nil
		},
	}, splitter)

	input := previewInputWithStrategyConfig(500)
	input.FragmentConfig.Mode = 3
	input.FragmentConfig.Hierarchy = &confighelper.HierarchyFragmentConfigDTO{MaxLevel: 4}

	if _, err := svc.PreviewV2(context.Background(), input); err != nil {
		t.Fatalf("preview v2: %v", err)
	}

	got := splitter.snapshotLastInput()
	if got.RequestedMode != shared.FragmentModeHierarchy {
		t.Fatalf("expected hierarchy requested mode, got %v", got.RequestedMode)
	}
	if got.FragmentConfig == nil || got.FragmentConfig.Mode != shared.FragmentModeHierarchy {
		t.Fatalf("expected hierarchy fragment config, got %#v", got.FragmentConfig)
	}
}

func TestFragmentAppServicePreview_FollowerTimeoutDoesNotCancelLeader(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var fetchCalls atomic.Int64
		fetchStarted := make(chan struct{})
		releaseFetch := make(chan struct{})
		leaderDone := make(chan error, 1)
		svc := newPreviewAppService(&previewTestFetcher{
			fetchFn: func(context.Context, string) (io.ReadCloser, error) {
				fetchCalls.Add(1)
				select {
				case <-fetchStarted:
				default:
					close(fetchStarted)
				}
				<-releaseFetch
				return io.NopCloser(strings.NewReader("第一段\n\n第二段")), nil
			},
		})

		go func() {
			_, err := svc.Preview(context.Background(), previewInput(500))
			leaderDone <- err
		}()

		<-fetchStarted
		followerCtx, cancel := context.WithTimeout(context.Background(), 20*time.Millisecond)
		defer cancel()
		_, err := svc.Preview(followerCtx, previewInput(500))
		if !errors.Is(err, context.DeadlineExceeded) {
			t.Fatalf("expected context deadline exceeded, got %v", err)
		}

		close(releaseFetch)
		if err := <-leaderDone; err != nil {
			t.Fatalf("leader returned error: %v", err)
		}
		if got := fetchCalls.Load(); got != 1 {
			t.Fatalf("expected leader to be executed once, got %d fetch calls", got)
		}
	})
}

func TestFragmentAppServicePreview_SharesLeaderErrorWithFollowers(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		var fetchCalls atomic.Int64
		fetchStarted := make(chan struct{})
		releaseFetch := make(chan struct{})
		followerStarted := make(chan struct{})
		leaderDone := make(chan error, 1)
		svc := newPreviewAppService(&previewTestFetcher{
			fetchFn: func(context.Context, string) (io.ReadCloser, error) {
				fetchCalls.Add(1)
				select {
				case <-fetchStarted:
				default:
					close(fetchStarted)
				}
				<-releaseFetch
				return nil, errPreviewTestFetchFailed
			},
		})

		go func() {
			_, err := svc.Preview(context.Background(), previewInput(500))
			leaderDone <- err
		}()
		<-fetchStarted

		var followerErr error
		var wg sync.WaitGroup
		wg.Go(func() {
			close(followerStarted)
			_, followerErr = svc.Preview(context.Background(), previewInput(500))
		})
		<-followerStarted
		time.Sleep(20 * time.Millisecond)
		if got := fetchCalls.Load(); got != 1 {
			t.Fatalf("expected follower to share in-flight request before release, got %d fetch calls", got)
		}

		close(releaseFetch)
		wg.Wait()

		leaderErr := <-leaderDone
		for idx, err := range []error{leaderErr, followerErr} {
			if !errors.Is(err, errPreviewTestFetchFailed) {
				t.Fatalf("request %d expected %v, got %v", idx, errPreviewTestFetchFailed, err)
			}
		}
		if got := fetchCalls.Load(); got != 1 {
			t.Fatalf("expected 1 fetch call, got %d", got)
		}
	})
}
