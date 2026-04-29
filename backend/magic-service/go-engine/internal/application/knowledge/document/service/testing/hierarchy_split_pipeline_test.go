package docapp_test

import (
	"context"
	"slices"
	"strings"
	"testing"
	"unicode/utf8"

	service "magic/internal/application/knowledge/document/service"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/tokenizer"
)

const (
	expectedNormalMode                   = "normal"
	expectedHierarchyAutoMode            = "hierarchy_auto"
	expectedHierarchyDetectorMarkdownAST = "markdown_ast"
	expectedHierarchyDetectorDocxStyle   = "docx_style"
	expectedHierarchyDetectorRegex       = "regex_fallback"
)

func TestSplitContentWithEffectiveMode_Mode1CustomDoesNotAutoHierarchy(t *testing.T) {
	t.Skip("covered by TestSplitContentWithEffectiveModeSharedTokenizerCases/Mode1CustomDoesNotAutoHierarchy")
}

func TestSplitContentWithEffectiveMode_Mode2NoHierarchyFallsBackToNormal(t *testing.T) {
	t.Skip("covered by TestSplitContentWithEffectiveModeSharedTokenizerCases/Mode2NoHierarchyFallsBackToNormal")
}

func TestSplitContentWithEffectiveMode_HierarchyMaxLevel(t *testing.T) {
	t.Skip("covered by TestSplitContentWithEffectiveModeSharedTokenizerCases/HierarchyMaxLevel")
}

func TestSplitContentWithEffectiveModeSharedTokenizerCases(t *testing.T) {
	t.Parallel()
	tokenizerSvc := newSharedTokenizerForTest(t)

	for _, tc := range sharedTokenizerHierarchyCases() {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			tc.assert(t, tokenizerSvc)
		})
	}
}

type sharedTokenizerHierarchyCase struct {
	name   string
	assert func(*testing.T, *tokenizer.Service)
}

func sharedTokenizerHierarchyCases() []sharedTokenizerHierarchyCase {
	return []sharedTokenizerHierarchyCase{
		{"Mode1CustomDoesNotAutoHierarchy", assertHierarchyMode1CustomDoesNotAutoHierarchy},
		{"Mode2NoHierarchyFallsBackToNormal", assertHierarchyMode2NoHierarchyFallsBackToNormal},
		{"HierarchyMaxLevel", assertHierarchyMaxLevel},
		{"HierarchyDefaultMaxLevelIsThree", assertHierarchyDefaultMaxLevelIsThree},
		{"Mode2AutoHierarchy", assertHierarchyMode2AutoHierarchy},
		{"MarkdownMagicCompressibleContentTags", assertMarkdownMagicCompressibleContentTags},
		{"Mode3NoHierarchyFallbackToNormal", assertHierarchyMode3FallbackToNormal},
		{"HierarchyMaxLevelKeepsDescendantContentOnParent", assertHierarchyKeepsDescendantContentOnParent},
		{"MarkdownASTDetector", assertHierarchyMarkdownASTDetector},
		{"MarkdownFallbackRegexDetector", assertHierarchyMarkdownFallbackRegexDetector},
		{"DocxStyleDetector", assertHierarchyDocxStyleDetector},
		{"SkipHeadingOnlyChunks", assertHierarchySkipsHeadingOnlyChunks},
		{"OutlineOnlyHierarchyKeepsLeafChunks", assertHierarchyOutlineOnlyKeepsLeafChunks},
		{"MarkdownParserKeepsListItemsForHierarchyPreview", assertMarkdownParserKeepsListItemsForHierarchyPreview},
		{"HierarchyChunksCapAtOneKTokensAndReuseHeading", assertHierarchyChunksCapAtOneKTokensAndReuseHeading},
		{"HierarchyOverflowPreservesChineseUTF8Boundaries", assertHierarchyOverflowPreservesChineseUTF8Boundaries},
	}
}

func assertHierarchyMode1CustomDoesNotAutoHierarchy(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "# 第一章 总则\n内容A\n## 1.1 范围\n内容B"
	cfg := service.PreviewSegmentConfigForTest{
		ChunkSize:          256,
		ChunkOverlap:       32,
		Separator:          "\n\n",
		TextPreprocessRule: []int{},
	}

	chunks, effectiveMode, _, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:       content,
			RequestedMode: shared.FragmentModeCustom,
			SegmentConfig: cfg,
			Model:         "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedNormalMode {
		t.Fatalf("expected normal, got %q", effectiveMode)
	}
	if len(chunks) == 0 {
		t.Fatal("expected chunks")
	}
	for _, chunk := range chunks {
		if chunk.EffectiveSplitMode != expectedNormalMode {
			t.Fatalf("expected chunk effective mode normal, got %q", chunk.EffectiveSplitMode)
		}
		if chunk.SectionLevel != 0 || chunk.SectionPath != "" || chunk.TreeNodeID != "" {
			t.Fatalf("expected custom mode to avoid hierarchy metadata, got %+v", chunk)
		}
	}
}

func assertHierarchyMode2NoHierarchyFallsBackToNormal(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "plain paragraph one\nplain paragraph two\nplain paragraph three"
	cfg := service.PreviewSegmentConfigForTest{
		ChunkSize:          64,
		ChunkOverlap:       8,
		Separator:          "\n",
		TextPreprocessRule: []int{},
	}

	_, effectiveMode, _, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:       content,
			RequestedMode: shared.FragmentModeAuto,
			SegmentConfig: cfg,
			Model:         "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedNormalMode {
		t.Fatalf("expected normal, got %q", effectiveMode)
	}
}

func assertHierarchyMaxLevel(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "# L1\nA\n## L2\nB\n### L3\nC"
	cfg := service.PreviewSegmentConfigForTest{
		ChunkSize:          256,
		ChunkOverlap:       16,
		Separator:          "\n\n",
		TextPreprocessRule: []int{},
	}
	fragmentConfig := &shared.FragmentConfig{
		Mode: shared.FragmentModeHierarchy,
		Hierarchy: &shared.HierarchyFragmentConfig{
			MaxLevel: 2,
		},
	}

	chunks, effectiveMode, _, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:        content,
			RequestedMode:  shared.FragmentModeHierarchy,
			FragmentConfig: fragmentConfig,
			SegmentConfig:  cfg,
			Model:          "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedHierarchyAutoMode {
		t.Fatalf("expected hierarchy_auto, got %q", effectiveMode)
	}
	for _, chunk := range chunks {
		if chunk.SectionLevel > 2 {
			t.Fatalf("expected section level <=2, got %d", chunk.SectionLevel)
		}
	}
}

func assertHierarchyDefaultMaxLevelIsThree(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "# L1\nA\n## L2\nB\n### L3\nC\n#### L4\nD\n##### L5\nE"
	cfg := service.PreviewSegmentConfigForTest{ChunkSize: 512, ChunkOverlap: 16, Separator: "\n\n"}
	fragmentConfig := &shared.FragmentConfig{
		Mode: shared.FragmentModeHierarchy,
	}

	chunks, effectiveMode, _, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:        content,
			SourceFileType: "md",
			RequestedMode:  shared.FragmentModeHierarchy,
			FragmentConfig: fragmentConfig,
			SegmentConfig:  cfg,
			Model:          "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedHierarchyAutoMode {
		t.Fatalf("expected hierarchy_auto, got %q", effectiveMode)
	}

	foundMergedLevel4 := false
	for _, chunk := range chunks {
		if chunk.SectionLevel > 3 {
			t.Fatalf("expected default hierarchy level <=3, got %+v", chunk)
		}
		if chunk.SectionPath == "L1 > L2 > L3 > L4 > L5" {
			t.Fatalf("expected L5 not to become standalone section, got %+v", chunk)
		}
		if chunk.SectionPath == "L1 > L2 > L3 > L4" &&
			strings.Contains(chunk.Content, "# L1") &&
			strings.Contains(chunk.Content, "## L2") &&
			strings.Contains(chunk.Content, "### L3") &&
			strings.Contains(chunk.Content, "#### L4") &&
			strings.Contains(chunk.Content, "##### L5") &&
			strings.Contains(chunk.Content, "E") {
			foundMergedLevel4 = true
		}
	}
	if !foundMergedLevel4 {
		t.Fatalf("expected L5 content merged into L4 chunk, got %+v", chunks)
	}
}

func assertHierarchyMode2AutoHierarchy(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "# H1\nalpha\n## H2\nbeta"
	cfg := service.PreviewSegmentConfigForTest{ChunkSize: 256, ChunkOverlap: 16, Separator: "\n\n"}
	fragmentConfig := &shared.FragmentConfig{
		Mode: shared.FragmentModeAuto,
		Hierarchy: &shared.HierarchyFragmentConfig{
			MaxLevel: 3,
		},
	}

	_, effectiveMode, _, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:        content,
			RequestedMode:  shared.FragmentModeAuto,
			FragmentConfig: fragmentConfig,
			SegmentConfig:  cfg,
			Model:          "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedHierarchyAutoMode {
		t.Fatalf("expected hierarchy_auto, got %q", effectiveMode)
	}
}

func assertMarkdownMagicCompressibleContentTags(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "# Teamshare APP 下载\n## 下载链接\n### 1.扫码进行下载\n<MagicCompressibleContent Type=\"Image\">\n```oss-file\n{\"name\":\"image.png\"}\n```\n</MagicCompressibleContent>\n## 2.安装 Teamshare app\n### Install the Teamshare app\nchoose privatization and input KK"
	cfg := service.PreviewSegmentConfigForTest{ChunkSize: 512, ChunkOverlap: 16, Separator: "\n\n"}

	chunks, effectiveMode, detector, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:        content,
			SourceFileType: "md",
			RequestedMode:  shared.FragmentModeAuto,
			SegmentConfig:  cfg,
			Model:          "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedHierarchyAutoMode {
		t.Fatalf("expected hierarchy_auto, got %q", effectiveMode)
	}
	if detector != expectedHierarchyDetectorMarkdownAST {
		t.Fatalf("expected markdown_ast detector, got %q", detector)
	}

	foundOssFileChunk := false
	foundInstallChunk := false
	for _, chunk := range chunks {
		if strings.Contains(chunk.Content, "MagicCompressibleContent") {
			t.Fatalf("expected MagicCompressibleContent tags stripped, got %q", chunk.Content)
		}
		if strings.Contains(chunk.Content, "oss-file") {
			foundOssFileChunk = true
			if !strings.Contains(chunk.Content, "{\"name\":\"image.png\"}") {
				t.Fatalf("expected oss-file json kept, got %q", chunk.Content)
			}
			if strings.Contains(chunk.Content, "## 2.安装 Teamshare app") {
				t.Fatalf("expected next H2 not to stick to image chunk, got %q", chunk.Content)
			}
		}
		if chunk.SectionTitle == "Install the Teamshare app" &&
			strings.Contains(chunk.Content, "## 2.安装 Teamshare app") &&
			strings.Contains(chunk.Content, "### Install the Teamshare app") {
			foundInstallChunk = true
		}
	}
	if !foundOssFileChunk {
		t.Fatalf("expected oss-file content kept, got %+v", chunks)
	}
	if !foundInstallChunk {
		t.Fatalf("expected install section chunk with parent H2 context, got %+v", chunks)
	}
}

func assertHierarchyMode3FallbackToNormal(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "no heading structure content only"
	cfg := service.PreviewSegmentConfigForTest{ChunkSize: 64, ChunkOverlap: 8, Separator: "\n"}

	_, effectiveMode, _, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:       content,
			RequestedMode: shared.FragmentModeHierarchy,
			SegmentConfig: cfg,
			Model:         "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != "normal_fallback" {
		t.Fatalf("expected normal_fallback, got %q", effectiveMode)
	}
}

func assertHierarchyKeepsDescendantContentOnParent(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "# L1\nA\n## L2\nB\n### L3\nC\n#### L4\nD\n## L2-2\nE"
	cfg := service.PreviewSegmentConfigForTest{ChunkSize: 256, ChunkOverlap: 16, Separator: "\n\n"}
	fragmentConfig := &shared.FragmentConfig{
		Mode: shared.FragmentModeHierarchy,
		Hierarchy: &shared.HierarchyFragmentConfig{
			MaxLevel: 2,
		},
	}

	chunks, effectiveMode, _, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:        content,
			SourceFileType: "md",
			RequestedMode:  shared.FragmentModeHierarchy,
			FragmentConfig: fragmentConfig,
			SegmentConfig:  cfg,
			Model:          "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedHierarchyAutoMode {
		t.Fatalf("expected hierarchy_auto, got %q", effectiveMode)
	}

	foundOwnBody := false
	foundMergedDescendant := false
	for _, chunk := range chunks {
		if chunk.SectionPath == "L1 > L3" {
			t.Fatalf("unexpected flattened section path: %+v", chunk)
		}
		if chunk.SectionPath == "L1 > L2 > L3 > L4" {
			t.Fatalf("expected L4 not to become standalone section, got %+v", chunk)
		}
		if chunk.SectionPath != "L1 > L2 > L3" {
			continue
		}
		if strings.Contains(chunk.Content, "### L3") && strings.Contains(chunk.Content, "C") {
			foundOwnBody = true
		}
		if strings.Contains(chunk.Content, "#### L4") && strings.Contains(chunk.Content, "D") {
			foundMergedDescendant = true
		}
	}
	if !foundOwnBody {
		t.Fatalf("expected L3 content to stay under L1 > L2 > L3, got %+v", chunks)
	}
	if !foundMergedDescendant {
		t.Fatalf("expected merged descendant content under L1 > L2 > L3, got %+v", chunks)
	}
}

func assertHierarchyMarkdownASTDetector(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	assertHierarchyDetector(t, tokenizerSvc, "# 一级标题\n正文\n## 二级标题\n正文", "md", expectedHierarchyDetectorMarkdownAST)
}

func assertHierarchyMarkdownFallbackRegexDetector(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	assertHierarchyDetector(t, tokenizerSvc, "1 总则\n正文\n1.1 范围\n正文", "markdown", expectedHierarchyDetectorRegex)
}

func assertHierarchyDocxStyleDetector(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	assertHierarchyDetector(t, tokenizerSvc, "# 第一章 总则\n正文\n## 1.1 范围\n正文", "docx", expectedHierarchyDetectorDocxStyle)
}

func assertHierarchyDetector(t *testing.T, tokenizerSvc *tokenizer.Service, content, sourceFileType, expectedDetector string) {
	t.Helper()

	cfg := service.PreviewSegmentConfigForTest{ChunkSize: 256, ChunkOverlap: 16, Separator: "\n\n"}
	_, effectiveMode, detector, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:        content,
			SourceFileType: sourceFileType,
			RequestedMode:  shared.FragmentModeAuto,
			SegmentConfig:  cfg,
			Model:          "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedHierarchyAutoMode {
		t.Fatalf("expected hierarchy_auto, got %q", effectiveMode)
	}
	if detector != expectedDetector {
		t.Fatalf("expected detector %q, got %q", expectedDetector, detector)
	}
}

func assertHierarchySkipsHeadingOnlyChunks(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "# 录音功能优化讨论会议纪要\n\n## 基本信息\n日期: 2025年9月20日-22日\n\n## 讨论要点及总结\n\n### 1. UI界面与交互体验优化\n\n#### 1.1 录音转文字界面布局\n问题: 当前笔记区域与录音转文字区域比例不合理"
	cfg := service.PreviewSegmentConfigForTest{ChunkSize: 500, ChunkOverlap: 50, Separator: "\n\n"}
	chunks, effectiveMode, _, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:        content,
			SourceFileType: "md",
			RequestedMode:  shared.FragmentModeAuto,
			SegmentConfig:  cfg,
			Model:          "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedHierarchyAutoMode {
		t.Fatalf("expected hierarchy_auto, got %q", effectiveMode)
	}
	for _, chunk := range chunks {
		trimmed := strings.TrimSpace(chunk.Content)
		switch trimmed {
		case "# 录音功能优化讨论会议纪要", "## 讨论要点及总结", "### 1. UI界面与交互体验优化":
			t.Fatalf("unexpected heading-only chunk: %q", trimmed)
		}
	}
}

func assertHierarchyOutlineOnlyKeepsLeafChunks(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	content := "# 项目议程\n\n## 议题一\n\n## 议题二"
	cfg := service.PreviewSegmentConfigForTest{ChunkSize: 256, ChunkOverlap: 16, Separator: "\n\n"}
	chunks, effectiveMode, _, err := service.SplitContentWithEffectiveModePipelineWithSourceTypeAndTokenizerForTest(
		context.Background(),
		service.SplitContentWithEffectiveModePipelineForTestInput{
			Content:        content,
			SourceFileType: "md",
			RequestedMode:  shared.FragmentModeAuto,
			SegmentConfig:  cfg,
			Model:          "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split failed: %v", err)
	}
	if effectiveMode != expectedHierarchyAutoMode {
		t.Fatalf("expected hierarchy_auto, got %q", effectiveMode)
	}
	if len(chunks) == 0 {
		t.Fatal("expected outline-only hierarchy to keep leaf chunks")
	}

	contents := make([]string, 0, len(chunks))
	for _, chunk := range chunks {
		contents = append(contents, strings.TrimSpace(chunk.Content))
	}
	if !containsSubstring(contents, "## 议题一") || !containsSubstring(contents, "## 议题二") {
		t.Fatalf("expected leaf heading chunks, got %+v", contents)
	}
	if containsString(contents, "# 项目议程") {
		t.Fatalf("expected parent heading-only chunk to be skipped, got %+v", contents)
	}
}

func assertMarkdownParserKeepsListItemsForHierarchyPreview(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	chunks, splitVersion := splitHierarchyPreviewMarkdownWithListsForTest(t, tokenizerSvc)
	if splitVersion == "" {
		t.Fatal("expected split version")
	}
	assertHierarchyChunkContains(
		t,
		chunks,
		"录音文本时间区间提取方案 > 📋 背景 > 当前状态",
		"# 录音文本时间区间提取方案",
		"## 📋 背景",
		"### 当前状态",
		"数据来源：前端将录音识别的文本实时写入文件",
		"数据格式：纯文本格式 [HH:MM:SS] 文本内容",
	)
	assertHierarchyChunkContains(
		t,
		chunks,
		"录音文本时间区间提取方案 > 📋 背景 > 存在问题",
		"# 录音文本时间区间提取方案",
		"## 📋 背景",
		"### 存在问题",
		"前端痛点：只能遍历全文",
		"后端痛点：缺乏查询机制",
	)
	assertHierarchyChunkContains(
		t,
		chunks,
		"录音文本时间区间提取方案 > 🎯 需求分析 > 核心需求",
		"# 录音文本时间区间提取方案",
		"## 🎯 需求分析",
		"### 核心需求",
		"时间区间查询：根据时间区间提取对应文本",
		"实时支持：支持录音过程中实时查询",
	)
}

func splitHierarchyPreviewMarkdownWithListsForTest(t *testing.T, tokenizerSvc *tokenizer.Service) ([]service.TokenChunkForTest, string) {
	t.Helper()

	content := strings.Join([]string{
		"# 录音文本时间区间提取方案",
		"",
		"## 📋 背景",
		"",
		"### 当前状态",
		"数据来源：前端将录音识别的文本实时写入文件",
		"数据格式：纯文本格式 [HH:MM:SS] 文本内容",
		"",
		"### 存在问题",
		"前端痛点：只能遍历全文",
		"后端痛点：缺乏查询机制",
		"",
		"## 🎯 需求分析",
		"",
		"### 核心需求",
		"时间区间查询：根据时间区间提取对应文本",
		"实时支持：支持录音过程中实时查询",
	}, "\n")
	parsed := parseddocument.NewPlainTextParsedDocument("md", content)

	chunks, splitVersion, err := service.SplitParsedDocumentToChunksWithTokenizerForTest(
		context.Background(),
		service.SplitParsedDocumentToChunksForTestInput{
			ParsedDocument: parsed,
			SourceFileType: "md",
			RequestedMode:  shared.FragmentModeAuto,
			FragmentConfig: &shared.FragmentConfig{Mode: shared.FragmentModeAuto},
			SegmentConfig: service.PreviewSegmentConfigForTest{
				ChunkSize:    512,
				ChunkOverlap: 32,
				Separator:    "\n\n",
			},
			Model: "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split parsed markdown with lists: %v", err)
	}
	return chunks, splitVersion
}

func assertHierarchyChunkContains(t *testing.T, chunks []service.TokenChunkForTest, sectionPath string, snippets ...string) {
	t.Helper()
	for _, chunk := range chunks {
		if chunk.SectionPath != sectionPath {
			continue
		}
		matched := true
		for _, snippet := range snippets {
			if !strings.Contains(chunk.Content, snippet) {
				matched = false
				break
			}
		}
		if matched {
			return
		}
	}
	t.Fatalf("expected chunk %q to contain %q, got %+v", sectionPath, snippets, chunks)
}

func assertHierarchyChunksCapAtOneKTokensAndReuseHeading(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	chunks := splitHierarchyChunkCapMarkdownForTest(t, tokenizerSvc)
	assertHierarchyChunkCapResult(t, chunks)
	nodes := fragdomain.BuildDocumentNodes("录音功能优化会议纪要.md", buildDocumentNodeSourcesFromTestChunks(chunks))
	assertHierarchyChunkCapNodes(t, chunks, nodes)
}

func splitHierarchyChunkCapMarkdownForTest(t *testing.T, tokenizerSvc *tokenizer.Service) []service.TokenChunkForTest {
	t.Helper()

	content := buildHierarchyChunkCapMarkdown()
	parsed := parseddocument.NewPlainTextParsedDocument("md", content)

	chunks, splitVersion, err := service.SplitParsedDocumentToChunksWithTokenizerForTest(
		context.Background(),
		service.SplitParsedDocumentToChunksForTestInput{
			ParsedDocument: parsed,
			SourceFileType: "md",
			RequestedMode:  shared.FragmentModeAuto,
			FragmentConfig: &shared.FragmentConfig{Mode: shared.FragmentModeAuto},
			SegmentConfig: service.PreviewSegmentConfigForTest{
				ChunkSize:    256,
				ChunkOverlap: 32,
				Separator:    "\n\n",
			},
			Model: "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split parsed markdown with chunk cap: %v", err)
	}
	if splitVersion == "" {
		t.Fatal("expected split version")
	}
	return chunks
}

func assertHierarchyChunkCapResult(t *testing.T, chunks []service.TokenChunkForTest) {
	t.Helper()

	subsection15Path := "录音功能优化会议纪要 > 讨论要点 > 产品体验问题 > 1.5 新建项目流程不顺畅"
	subsection15Chunks := make([]service.TokenChunkForTest, 0, len(chunks))
	foundSubsection16 := false
	for _, chunk := range chunks {
		if chunk.TokenCount > 1000 {
			t.Fatalf("expected hierarchy chunk token count <= 1000, got %+v", chunk)
		}
		if chunk.SectionPath == subsection15Path {
			subsection15Chunks = append(subsection15Chunks, chunk)
			if !strings.Contains(chunk.Content, "# 录音功能优化会议纪要") ||
				!strings.Contains(chunk.Content, "## 讨论要点") ||
				!strings.Contains(chunk.Content, "### 产品体验问题") ||
				!strings.Contains(chunk.Content, "#### 1.5 新建项目流程不顺畅") {
				t.Fatalf("expected hierarchy context injected into subsection 1.5 chunk, got %+v", chunk)
			}
			if strings.Contains(chunk.Content, "我直接提了一些给佳博") &&
				!strings.Contains(chunk.Content, "#### 1.5 新建项目流程不顺畅") {
				t.Fatalf("expected overflow chunk to reuse hierarchy card title, got %q", chunk.Content)
			}
		}
		if chunk.SectionPath == "录音功能优化会议纪要 > 讨论要点 > 产品体验问题 > 1.6 关闭tab导致录音丢失" &&
			strings.Contains(chunk.Content, "#### 1.6 关闭tab导致录音丢失") &&
			strings.Contains(chunk.Content, "现在关闭tab录音就丢了") {
			foundSubsection16 = true
		}
	}

	if len(subsection15Chunks) < 2 {
		t.Fatalf("expected long hierarchy section to produce continuation chunks, got %+v", subsection15Chunks)
	}
	if !foundSubsection16 {
		t.Fatalf("expected hierarchy split to keep subsection 1.6 as standalone card, got %+v", chunks)
	}
}

func assertHierarchyChunkCapNodes(t *testing.T, chunks []service.TokenChunkForTest, nodes []fragdomain.DocumentNode) {
	t.Helper()
	if got := countDocumentNodesByText(nodes, "1.6 关闭tab导致录音丢失"); got != 1 {
		t.Fatalf("expected standalone hierarchy node for subsection 1.6, got %d in %#v", got, nodes)
	}
	if got := countDocumentNodesByText(nodes, "1.5 新建项目流程不顺畅"); got != 1 {
		t.Fatalf("expected standalone hierarchy node for subsection 1.5, got %d in %#v", got, nodes)
	}
	if hasExactDocumentNodeText(nodes, "给佳博\"") {
		t.Fatalf("expected no orphan tail node after document node rebuild, got %#v", nodes)
	}

	subsection15ChunkCount := 0
	for _, chunk := range chunks {
		if chunk.SectionPath == "录音功能优化会议纪要 > 讨论要点 > 产品体验问题 > 1.5 新建项目流程不顺畅" {
			subsection15ChunkCount++
		}
	}
	subsection15ID := findDocumentNodeByText(t, nodes, "1.5 新建项目流程不顺畅")
	if got := countDocumentNodeChildrenByType(nodes, subsection15ID, "section-text"); got != subsection15ChunkCount {
		t.Fatalf("expected one ui text card per subsection 1.5 fragment, want %d got %d in %#v", subsection15ChunkCount, got, nodes)
	}
	subsection16ID := findDocumentNodeByText(t, nodes, "1.6 关闭tab导致录音丢失")
	if got := countDocumentNodeChildrenByType(nodes, subsection16ID, "section-text"); got != 1 {
		t.Fatalf("expected one ui text card for subsection 1.6, got %d in %#v", got, nodes)
	}
}

func assertHierarchyOverflowPreservesChineseUTF8Boundaries(t *testing.T, tokenizerSvc *tokenizer.Service) {
	t.Helper()

	bodyLines := make([]string, 0, 640)
	for range 640 {
		bodyLines = append(bodyLines, "- 膦元素校准能力验证记录，覆盖量块、标准器和环境修正。")
	}
	body := strings.Join(bodyLines, "\n")
	content := "# 文档内容提取汇总\n\n## 表格内容\n\n" + body

	parsed := parseddocument.NewPlainTextParsedDocument("md", content)

	chunks, splitVersion, err := service.SplitParsedDocumentToChunksWithTokenizerForTest(
		context.Background(),
		service.SplitParsedDocumentToChunksForTestInput{
			ParsedDocument: parsed,
			SourceFileType: "md",
			RequestedMode:  shared.FragmentModeAuto,
			FragmentConfig: &shared.FragmentConfig{Mode: shared.FragmentModeAuto},
			SegmentConfig: service.PreviewSegmentConfigForTest{
				ChunkSize:    256,
				ChunkOverlap: 32,
				Separator:    "\n\n",
			},
			Model: "text-embedding-3-small",
		},
		tokenizerSvc,
	)
	if err != nil {
		t.Fatalf("split parsed markdown with utf8 boundary: %v", err)
	}
	if splitVersion == "" {
		t.Fatal("expected split version")
	}
	if len(chunks) < 2 {
		t.Fatalf("expected overflow hierarchy chunks, got %+v", chunks)
	}

	const prefix = "# 文档内容提取汇总\n## 表格内容\n"
	var reconstructed strings.Builder
	sectionChunkCount := 0
	for i, chunk := range chunks {
		if chunk.SectionPath != "文档内容提取汇总 > 表格内容" {
			continue
		}
		sectionChunkCount++
		if !utf8.ValidString(chunk.Content) {
			t.Fatalf("chunk %d contains invalid utf-8: %q", i, chunk.Content)
		}
		if !strings.HasPrefix(chunk.Content, prefix) {
			t.Fatalf("expected hierarchy prefix to be reused, got %q", chunk.Content)
		}
		reconstructed.WriteString(strings.TrimPrefix(chunk.Content, prefix))
	}

	if sectionChunkCount < 2 {
		t.Fatalf("expected long hierarchy section to continue into multiple chunks, got %+v", chunks)
	}

	got := reconstructed.String()
	if strings.Count(got, "膦元素校准能力验证记录") != len(bodyLines) {
		t.Fatalf("expected chinese keyword count preserved, want %d got %d", len(bodyLines), strings.Count(got, "膦元素校准能力验证记录"))
	}
	if strings.ContainsRune(got, utf8.RuneError) {
		t.Fatalf("expected no replacement rune after hierarchy overflow split, got %q", got)
	}
}

func buildDocumentNodeSourcesFromTestChunks(chunks []service.TokenChunkForTest) []fragdomain.DocumentNodeSource {
	sources := make([]fragdomain.DocumentNodeSource, 0, len(chunks))
	for index, chunk := range chunks {
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
	return sources
}

func buildHierarchyChunkCapMarkdown() string {
	repeatedDetail := func(prefix string) string {
		lines := make([]string, 0, 8)
		for range 8 {
			lines = append(lines, "- 讨论记录："+prefix+"，需要同时梳理入口、状态同步、提示反馈和容错降级，避免用户在关键链路中断。")
		}
		return strings.Join(lines, "\n")
	}
	longRepeatedDetail := func(prefix string) string {
		lines := make([]string, 0, 24)
		for range 24 {
			lines = append(lines, "- 详细记录："+prefix+"，需要补齐状态落盘、跨标签页恢复、交互回退提示、异常保护、自动保存和重试兜底，保证整个链路在复杂操作下仍然稳定。")
		}
		return strings.Join(lines, "\n")
	}

	sections := []string{
		"#### 1.1 入口说明不清晰\n- **问题**: 用户进入工作区后不知道下一步该做什么\n- **建议**: 在入口处补充更明确的创建和引导说明\n- **讨论记录**:\n" + repeatedDetail("入口说明不清晰"),
		"#### 1.2 首次创建心智不一致\n- **问题**: 用户预期系统会自动帮忙落位初始化资源\n- **建议**: 在创建流程中补齐默认动作和状态提示\n- **讨论记录**:\n" + repeatedDetail("首次创建心智不一致"),
		"#### 1.3 切换成本偏高\n- **问题**: 用户切换不同工作区和项目时需要重复确认\n- **建议**: 优化工作区切换路径，减少无效确认步骤\n- **讨论记录**:\n" + repeatedDetail("切换成本偏高"),
		"#### 1.4 操作反馈不足\n- **问题**: 提交动作后用户无法快速判断系统是否已经生效\n- **建议**: 增加处理中和完成后的反馈提示\n- **讨论记录**:\n" + repeatedDetail("操作反馈不足"),
		"#### 1.5 新建项目流程不顺畅\n- **问题**: 用户预期在工作区内自动创建项目，但实际需要手动新建\n- **建议**: 优化新建项目流程，支持在工作区内自动创建\n- **讨论记录**:\n  - 黄朝降（小哥）：“然后里面点新建项目的时候一定要先新建项目，但我的心理预期是在某个工作区里面帮我自动创建一个项目”\n  - 陈曹奇昊：\"我直接提了一些给佳博\"\n" + longRepeatedDetail("新建项目流程不顺畅"),
		"#### 1.6 关闭tab导致录音丢失\n- **问题**: 关闭录音tab会导致录音内容丢失\n- **建议**: 优化tab关闭逻辑，保存录音内容\n- **讨论记录**:\n  - 陈曹奇昊：\"现在关闭tab录音就丢了\"",
	}

	return "# 录音功能优化会议纪要\n\n## 讨论要点\n\n### 产品体验问题\n\n" + strings.Join(sections, "\n\n")
}

func countDocumentNodesByText(nodes []fragdomain.DocumentNode, text string) int {
	count := 0
	for _, node := range nodes {
		if node.Text == text {
			count++
		}
	}
	return count
}

func hasExactDocumentNodeText(nodes []fragdomain.DocumentNode, text string) bool {
	for _, node := range nodes {
		if strings.TrimSpace(node.Text) == text {
			return true
		}
	}
	return false
}

func findDocumentNodeByText(t *testing.T, nodes []fragdomain.DocumentNode, text string) int {
	t.Helper()
	for _, node := range nodes {
		if node.Text == text {
			return node.ID
		}
	}
	t.Fatalf("node %q not found in %#v", text, nodes)
	return -1
}

func countDocumentNodeChildrenByType(nodes []fragdomain.DocumentNode, parentID int, nodeType string) int {
	if parentID < 0 || parentID >= len(nodes) {
		return 0
	}
	count := 0
	for _, childID := range nodes[parentID].Children {
		if childID < 0 || childID >= len(nodes) {
			continue
		}
		if nodes[childID].Type == nodeType {
			count++
		}
	}
	return count
}

func containsString(values []string, target string) bool {
	return slices.Contains(values, target)
}

func containsSubstring(values []string, target string) bool {
	for _, value := range values {
		if strings.Contains(value, target) {
			return true
		}
	}
	return false
}
