package document_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	document "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

const testThirdFileID = "FILE-1"

func TestDocumentSourcePolicies(t *testing.T) {
	t.Parallel()

	now := time.Unix(1700000000, 0)
	override := document.NormalizeSourceOverride(&document.SourceOverride{Content: "a\r\n\r\n\r\nb"}, now)
	if override.Content != "a\n\nb" || override.ContentHash == "" || override.FetchedAtUnixMilli != now.UnixMilli() {
		t.Fatalf("unexpected normalized override: %#v", override)
	}

	doc := &document.KnowledgeBaseDocument{
		OrganizationCode:  "ORG",
		KnowledgeBaseCode: "KB1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       testThirdFileID,
		UpdatedUID:        "UPDATER",
		DocumentFile: &document.File{
			Type:       "third_platform",
			Name:       "spec.docx",
			URL:        "https://example.com/spec.docx",
			ThirdID:    testThirdFileID,
			SourceType: "teamshare",
		},
	}
	if !document.ShouldResolveThirdPlatformDocument(doc) || !document.HasDocumentFileURL(doc) {
		t.Fatalf("expected third platform doc with url")
	}

	plan := document.ResolveDocumentContentPlan(doc, nil, true)
	if !plan.TryThirdPlatform || !plan.AllowURLParse || plan.UseSourceOverride {
		t.Fatalf("unexpected content plan: %#v", plan)
	}
	preflight := document.ResolveSourcePreflightPolicy(doc, override, true)
	if !preflight.SkipValidation {
		t.Fatalf("unexpected preflight decision: %#v", preflight)
	}
	redirect := document.ResolveThirdPlatformRedirect(doc, document.SyncModeResync, false, "", "")
	if !redirect.Redirect || redirect.Input == nil || redirect.Input.UserID != "UPDATER" {
		t.Fatalf("unexpected redirect decision: %#v", redirect)
	}

	request := document.BuildThirdPlatformResolveRequest(doc, "")
	if request.OrganizationCode != "ORG" || request.ThirdFileID != testThirdFileID || request.DocumentFile["third_file_id"] != testThirdFileID {
		t.Fatalf("unexpected third platform resolve request: %#v", request)
	}

	parsed, normalized := document.BuildParsedDocumentFromContent(doc, "x\r\n\r\n\r\ny")
	if normalized != "x\n\ny" || parsed == nil {
		t.Fatalf("unexpected parsed content: normalized=%q parsed=%#v", normalized, parsed)
	}
	if got := document.ResolveDocumentFileExtension(&document.File{Name: "a.txt"}, "md"); got != "txt" {
		t.Fatalf("unexpected document file extension: %q", got)
	}
}

func TestDocumentSourcePoliciesDecodeEscapedMarkdownContent(t *testing.T) {
	t.Parallel()

	now := time.Unix(1700000000, 0)
	override := document.NormalizeSourceOverride(&document.SourceOverride{
		Content: "# 录音方案\\n\\n## 背景\\n正文",
		DocumentFile: map[string]any{
			"name":      "demo.md",
			"extension": "md",
		},
	}, now)
	if override == nil || !strings.Contains(override.Content, "\n## 背景\n") {
		t.Fatalf("expected markdown override escaped newlines decoded, got %#v", override)
	}

	doc := &document.KnowledgeBaseDocument{
		DocumentFile: &document.File{
			Name:      "demo.md",
			Extension: "md",
		},
	}
	parsed, normalized := document.BuildParsedDocumentFromContent(doc, "# 标题\\n\\n## 背景\\n正文")
	if parsed == nil || !strings.Contains(normalized, "\n## 背景\n") {
		t.Fatalf("expected markdown content escaped newlines decoded, got normalized=%q parsed=%#v", normalized, parsed)
	}
}

func TestDocumentFileAndResolvedResultPolicies(t *testing.T) {
	t.Parallel()

	file, ok := document.FileFromPayload(map[string]any{
		"type":                      2,
		"name":                      " report.md ",
		"url":                       "https://example.com/report.md",
		"file_key":                  "ORG1/files/report.md",
		"third_file_extension_name": "markdown",
		"third_file_id":             "FILE-1",
		"platform_type":             "teamshare",
	})
	if !ok || file.Type != "third_platform" || file.Extension != "markdown" || file.ThirdID != testThirdFileID || file.FileKey != "ORG1/files/report.md" {
		t.Fatalf("unexpected file from payload: %#v", file)
	}
	if got := document.NormalizeDocumentFileType("thirdplatform"); got != "third_platform" {
		t.Fatalf("unexpected normalized file type: %q", got)
	}
	if got := document.NormalizeHierarchySourceFileType(".Markdown"); got != "md" {
		t.Fatalf("unexpected hierarchy source file type: %q", got)
	}
	if document.CloneDocumentFilePayload(map[string]any{"name": "x"})["name"] != "x" {
		t.Fatal("expected cloned payload")
	}
	if document.HashText("a") == document.HashText("b") {
		t.Fatal("expected different hashes")
	}

	doc := &document.KnowledgeBaseDocument{}
	document.ApplyResolvedDocumentResult(doc, int(document.DocTypeFile), map[string]any{
		"type":          "third_platform",
		"name":          "report.md",
		"url":           "https://example.com/report.md",
		"file_key":      "ORG1/files/report.md",
		"extension":     "md",
		"size":          10,
		"third_file_id": testThirdFileID,
		"platform_type": "teamshare",
	})
	if doc.DocType != int(document.DocTypeFile) || doc.ThirdFileID != testThirdFileID || doc.DocumentFile == nil || doc.DocumentFile.SourceType != "teamshare" || doc.DocumentFile.FileKey != "ORG1/files/report.md" {
		t.Fatalf("unexpected resolved document result: %#v", doc)
	}
	if !doc.ApplySourceOverride(&document.SourceOverride{
		DocType: int(document.DocTypeText),
		DocumentFile: map[string]any{
			"name": "plain.txt",
			"url":  "https://example.com/plain.txt",
		},
	}) {
		t.Fatal("expected source override to change document")
	}
}

func TestDocumentRepairAndCreatePolicies(t *testing.T) {
	t.Parallel()

	kb := &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:             "KB1",
		OrganizationCode: "ORG",
		Model:            "text-embedding-3-small",
		VectorDB:         "qdrant",
		RetrieveConfig:   &shared.RetrieveConfig{TopK: 5},
		FragmentConfig:   &shared.FragmentConfig{Mode: shared.FragmentModeHierarchy},
		EmbeddingConfig:  &shared.EmbeddingConfig{ModelID: "text-embedding-3-small"},
		CreatedUID:       "CREATOR",
		UpdatedUID:       "UPDATER",
	}
	group := document.ThirdFileRepairGroup{
		ThirdFileID:  testThirdFileID,
		PreviewURL:   "[spec.docx](https://example.com/spec.docx)",
		DocumentCode: "DOC-1",
	}
	if got := document.ResolveThirdFileRepairDocumentName(group); got != "spec.docx" {
		t.Fatalf("unexpected repair document name: %q", got)
	}
	if got := document.BuildStableThirdFileRepairDocumentCode("KB1", testThirdFileID); !strings.HasPrefix(got, "DOCUMENT-") || len(got) <= len("DOCUMENT-") {
		t.Fatalf("unexpected stable repair code: %q", got)
	}

	doc := document.BuildThirdFileRepairDocument(kb, "teamshare", group)
	if doc.Name != "spec.docx" || doc.DocumentFile == nil || doc.DocumentFile.Extension != "docx" {
		t.Fatalf("unexpected repaired document: %#v", doc)
	}
	if document.EnsureThirdFileRepairDocumentFields(doc, kb, "teamshare", group) {
		t.Fatal("expected repaired document to already be aligned")
	}

	created := document.BuildDocumentForCreate(kb, "text-embedding-3-large", &document.CreateManagedDocumentInput{
		OrganizationCode:  "ORG",
		UserID:            "USER",
		KnowledgeBaseCode: "KB1",
		Name:              "manual",
		DocType:           int(document.DocTypeText),
		DocumentFile:      &document.File{Name: "manual.md"},
	})
	if created.EmbeddingModel != "text-embedding-3-large" || created.VectorDB != "qdrant" || created.DocumentFile == nil {
		t.Fatalf("unexpected created document: %#v", created)
	}
}

func TestDocumentSyncAndThirdFilePolicies(t *testing.T) {
	t.Parallel()

	if document.ResolveSyncMode("") != document.SyncModeCreate || !document.ShouldCleanupBeforeSync("") {
		t.Fatal("unexpected sync mode defaults")
	}

	input := document.NormalizeThirdFileRevectorizeInput(&document.ThirdFileRevectorizeInput{
		OrganizationCode:  " ORG ",
		UserID:            " USER ",
		ThirdPlatformType: " TeamShare ",
		ThirdFileID:       " FILE-1 ",
	})
	if input.OrganizationCode != "ORG" || input.ThirdPlatformType != "teamshare" || input.ThirdFileID != "FILE-1" {
		t.Fatalf("unexpected normalized revectorize input: %#v", input)
	}
	if document.FirstUsableDocument([]*document.KnowledgeBaseDocument{{}, {KnowledgeBaseCode: "KB1", Code: "DOC-1"}}).Code != "DOC-1" {
		t.Fatal("expected first usable document")
	}

	seed, err := document.BuildThirdFileRevectorizeSeed(input, []*document.KnowledgeBaseDocument{{KnowledgeBaseCode: "KB1", Code: "DOC-1", UpdatedUID: "UPDATER"}})
	if err != nil {
		t.Fatalf("build revectorize seed failed: %v", err)
	}
	if seed.SourceCacheKey != "teamshare:ORG:teamshare:FILE-1" {
		t.Fatalf("unexpected source cache key: %#v", seed)
	}

	snapshot := document.BuildResolvedSourceSnapshot(document.SourceSnapshotInput{
		Content:      "a\r\n\r\n\r\nb",
		DocType:      int(document.DocTypeFile),
		DocumentFile: map[string]any{"name": "spec.docx"},
		Source:       "resolve",
		Now:          time.Unix(1700000001, 0),
	})
	if snapshot.Content != "a\n\nb" || snapshot.ContentHash == "" || snapshot.FetchedAtUnixMilli == 0 {
		t.Fatalf("unexpected source snapshot: %#v", snapshot)
	}

	docs := []*document.KnowledgeBaseDocument{
		{KnowledgeBaseCode: "KB1", Code: "DOC-1", UpdatedUID: "DOC-USER"},
		{},
	}
	requests := document.BuildThirdFileRevectorizeRequests(input, docs, seed, snapshot)
	if len(requests) != 1 || requests[0].BusinessParams.UserID != "USER" || requests[0].SourceOverride == nil {
		t.Fatalf("unexpected revectorize requests: %#v", requests)
	}

	if _, err := document.BuildThirdFileRevectorizeSeed(nil, nil); !errors.Is(err, shared.ErrDocumentNotFound) {
		t.Fatalf("expected document not found, got %v", err)
	}
}

func TestDocumentSyncPoliciesDecodeEscapedMarkdownSnapshot(t *testing.T) {
	t.Parallel()

	snapshot := document.BuildResolvedSourceSnapshot(document.SourceSnapshotInput{
		Content: "# 标题\\n\\n## 背景\\n正文",
		DocumentFile: map[string]any{
			"name":      "demo.md",
			"extension": "md",
		},
		Source: "resolve",
		Now:    time.Unix(1700000002, 0),
	})
	if snapshot == nil || !strings.Contains(snapshot.Content, "\n## 背景\n") {
		t.Fatalf("expected markdown snapshot escaped newlines decoded, got %#v", snapshot)
	}
}

func TestDocumentFragmentConfigPolicy(t *testing.T) {
	t.Parallel()

	cfg := &shared.FragmentConfig{
		Mode: shared.FragmentModeHierarchy,
		Normal: &shared.NormalFragmentConfig{
			TextPreprocessRule: []int{1, 2},
			SegmentRule:        &shared.SegmentRule{Separator: `\n\n`},
		},
	}
	kb := &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{FragmentConfig: cfg}
	doc := &document.KnowledgeBaseDocument{FragmentConfig: cfg}

	segment := document.BuildSyncSegmentConfig(doc, kb)
	if segment.Separator != "\n\n" || len(segment.TextPreprocessRule) != 2 {
		t.Fatalf("unexpected sync segment config: %#v", segment)
	}

	mode, resolvedCfg := document.ResolveSyncRequestedModeAndConfig(doc, kb)
	if mode != shared.FragmentModeHierarchy || resolvedCfg == cfg {
		t.Fatalf("expected cloned config, got mode=%v cfg=%#v", mode, resolvedCfg)
	}
	resolvedCfg.Normal.TextPreprocessRule[0] = 9
	if cfg.Normal.TextPreprocessRule[0] == 9 {
		t.Fatal("expected clone to be isolated from source config")
	}
	if got := document.ResolveSplitModel("", " custom "); got != "custom" {
		t.Fatalf("unexpected split model: %q", got)
	}
}

func TestDocumentRuntimePoliciesNormalizeNilKnowledgeBaseConfigs(t *testing.T) {
	t.Parallel()

	kb := &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:             "KB-1",
		OrganizationCode: "ORG-1",
	}

	segment := document.BuildSyncSegmentConfig(nil, kb)
	if segment.ChunkSize != 1000 || segment.ChunkOverlap != 80 || segment.Separator != "\n" {
		t.Fatalf("unexpected sync defaults: %#v", segment)
	}

	mode, cfg := document.ResolveSyncRequestedModeAndConfig(nil, kb)
	if mode != shared.FragmentModeAuto || cfg == nil || cfg.Mode != shared.FragmentModeAuto {
		t.Fatalf("expected normalized auto config, got mode=%v cfg=%#v", mode, cfg)
	}

	doc := document.BuildDocumentForCreate(kb, "text-embedding-3-large", &document.CreateManagedDocumentInput{
		KnowledgeBaseCode: "KB-1",
		OrganizationCode:  "ORG-1",
		UserID:            "USER-1",
		Name:              "文档",
		DocType:           int(document.DocTypeText),
	})
	if doc == nil || doc.RetrieveConfig == nil || doc.FragmentConfig == nil {
		t.Fatalf("expected managed document to inherit normalized configs, got %#v", doc)
	}
}

func TestBuildThirdFileRepairDocumentNormalizesKnowledgeBaseConfigs(t *testing.T) {
	t.Parallel()

	doc := document.BuildThirdFileRepairDocument(&sharedsnapshot.KnowledgeBaseRuntimeSnapshot{
		Code:             "KB-1",
		OrganizationCode: "ORG-1",
	}, "teamshare", document.ThirdFileRepairGroup{
		KnowledgeCode: "KB-1",
		ThirdFileID:   "FILE-1",
	})
	if doc == nil || doc.RetrieveConfig == nil || doc.FragmentConfig == nil {
		t.Fatalf("expected repair document to inherit normalized configs, got %#v", doc)
	}
	if doc.FragmentConfig.Mode != shared.FragmentModeAuto {
		t.Fatalf("expected auto fragment config, got %#v", doc.FragmentConfig)
	}
}

func TestDocumentUpdateResyncPolicy(t *testing.T) {
	t.Parallel()

	before := &document.KnowledgeBaseDocument{
		DocMetadata: map[string]any{
			document.ParseStrategyConfigKey: map[string]any{
				"parse_mode": "quick",
			},
		},
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeCustom,
			Normal: &shared.NormalFragmentConfig{
				TextPreprocessRule: []int{1},
				SegmentRule: &shared.SegmentRule{
					Separator:    "\n\n",
					ChunkSize:    200,
					ChunkOverlap: 20,
				},
			},
		},
	}
	afterSame := &document.KnowledgeBaseDocument{
		DocMetadata: map[string]any{
			document.ParseStrategyConfigKey: map[string]any{
				"parsing_type":     document.ParsingTypeQuick,
				"image_extraction": false,
				"table_extraction": false,
				"image_ocr":        false,
			},
		},
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeCustom,
			Normal: &shared.NormalFragmentConfig{
				TextPreprocessRule: []int{1},
				SegmentRule: &shared.SegmentRule{
					Separator:    "\n\n",
					ChunkSize:    200,
					ChunkOverlap: 20,
				},
			},
		},
	}
	beforeState := document.CaptureEffectiveConfigState(before)
	if document.ShouldResyncAfterConfigUpdate(beforeState, afterSame) {
		t.Fatalf("expected normalized-equivalent config not to trigger resync: before=%#v after=%#v", beforeState, afterSame)
	}

	afterStrategyChanged := &document.KnowledgeBaseDocument{
		DocMetadata: map[string]any{
			document.ParseStrategyConfigKey: map[string]any{
				"parsing_type":     document.ParsingTypePrecise,
				"image_extraction": true,
				"table_extraction": false,
				"image_ocr":        true,
			},
		},
		FragmentConfig: shared.CloneFragmentConfig(afterSame.FragmentConfig),
	}
	if !document.ShouldResyncAfterConfigUpdate(beforeState, afterStrategyChanged) {
		t.Fatalf("expected strategy config change to trigger resync: %#v", afterStrategyChanged)
	}

	afterFragmentChanged := &document.KnowledgeBaseDocument{
		DocMetadata: afterSame.DocMetadata,
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeCustom,
			Normal: &shared.NormalFragmentConfig{
				TextPreprocessRule: []int{1},
				SegmentRule: &shared.SegmentRule{
					Separator:    "\n\n",
					ChunkSize:    300,
					ChunkOverlap: 20,
				},
			},
		},
	}
	if !document.ShouldResyncAfterConfigUpdate(beforeState, afterFragmentChanged) {
		t.Fatalf("expected fragment config change to trigger resync: %#v", afterFragmentChanged)
	}
}
