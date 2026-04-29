package document_test

import (
	"errors"
	"slices"
	"strings"
	"testing"
	"time"

	docentity "magic/internal/domain/knowledge/document/entity"
	document "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/pkg/projectfile"
)

const (
	testOrganizationCode = "ORG"
	testThirdFileID      = "FILE-1"
	testTabularSheetName = "sheet-1"
)

func TestDocumentSourcePolicies(t *testing.T) {
	t.Parallel()

	now := time.Unix(1700000000, 0)
	override := document.NormalizeSourceOverride(&document.SourceOverride{Content: "a\r\n\r\n\r\nb"}, now)
	if override.Content != "a\n\nb" || override.ContentHash == "" || override.FetchedAtUnixMilli != now.UnixMilli() {
		t.Fatalf("unexpected normalized override: %#v", override)
	}

	doc := &docentity.KnowledgeBaseDocument{
		OrganizationCode:  testOrganizationCode,
		KnowledgeBaseCode: "KB1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       testThirdFileID,
		UpdatedUID:        "UPDATER",
		DocumentFile: &docentity.File{
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

	request := document.BuildThirdPlatformResolveRequest(doc, "", "", "")
	if request.OrganizationCode != testOrganizationCode || request.ThirdFileID != testThirdFileID || request.DocumentFile["third_file_id"] != testThirdFileID {
		t.Fatalf("unexpected third platform resolve request: %#v", request)
	}

	parsed, normalized := document.BuildParsedDocumentFromContent(doc, "x\r\n\r\n\r\ny")
	if normalized != "x\n\ny" || parsed == nil {
		t.Fatalf("unexpected parsed content: normalized=%q parsed=%#v", normalized, parsed)
	}
	if got := document.ResolveDocumentFileExtension(&docentity.File{Name: "a.txt"}, "md"); got != "txt" {
		t.Fatalf("unexpected document file extension: %q", got)
	}
}

func TestBuildProjectResolvedSourcePlanSkipsUnsupportedStatus(t *testing.T) {
	t.Parallel()

	plan := document.BuildProjectResolvedSourcePlan(&projectfile.ResolveResult{
		Status:           projectfile.ResolveStatusUnsupported,
		OrganizationCode: testOrganizationCode,
		ProjectID:        1,
		ProjectFileID:    2,
		FileName:         "custom.svg",
		FileExtension:    "svg",
		DocumentFile:     map[string]any{"name": "custom.svg", "extension": "svg"},
	}, time.Unix(1700000002, 0))
	if plan.SourceOverride != nil || plan.Snapshot != nil || plan.CacheKey != "" {
		t.Fatalf("expected unsupported project file to produce empty source plan, got %#v", plan)
	}
}

func TestBuildProjectFileChangePlanBackfillsDocumentSyncBusinessParams(t *testing.T) {
	t.Parallel()

	plan := document.BuildProjectFileChangePlan(
		&projectfile.Meta{
			Status:        projectfile.ResolveStatusActive,
			ProjectFileID: 2,
			FileName:      "demo.md",
		},
		nil,
		[]*docentity.KnowledgeBaseDocument{
			{
				OrganizationCode:  testOrganizationCode,
				KnowledgeBaseCode: "KB1",
				Code:              "DOC-1",
				UpdatedUID:        "DOC-UPDATER",
			},
		},
		nil,
	)

	requests := plan.Standard.ResyncRequests
	if len(requests) != 1 || requests[0].BusinessParams == nil {
		t.Fatalf("expected one resync request with business params, got %#v", requests)
	}
	if requests[0].BusinessParams.OrganizationCode != testOrganizationCode ||
		requests[0].BusinessParams.UserID != "DOC-UPDATER" ||
		requests[0].BusinessParams.BusinessID != "KB1" {
		t.Fatalf("unexpected business params: %#v", requests[0].BusinessParams)
	}
}

func TestKnowledgeBaseFileSupportPolicies(t *testing.T) {
	t.Parallel()

	if !document.ShouldMaterializeProjectResolvedFile(&projectfile.ResolveResult{
		Status:           projectfile.ResolveStatusActive,
		OrganizationCode: testOrganizationCode,
		ProjectID:        1,
		ProjectFileID:    2,
		FileName:         "demo.md",
	}) {
		t.Fatal("expected active project file to be materializable")
	}
	if document.ShouldMaterializeProjectResolvedFile(&projectfile.ResolveResult{
		Status:           projectfile.ResolveStatusUnsupported,
		OrganizationCode: testOrganizationCode,
		ProjectID:        1,
		ProjectFileID:    2,
		FileName:         "demo.svg",
	}) {
		t.Fatal("expected unsupported project file to be skipped")
	}
	if !document.IsSupportedKnowledgeBaseFileExtension("docx") || !document.IsSupportedKnowledgeBaseFileExtension(".XLSX") {
		t.Fatal("expected supported extensions to pass")
	}
	if document.IsSupportedKnowledgeBaseFileExtension("svg") {
		t.Fatal("expected unsupported extension to fail")
	}
	supportedExts := document.SupportedKnowledgeBaseFileExtensions()
	if !slices.Contains(supportedExts, "docx") || slices.Contains(supportedExts, "doc") ||
		slices.Contains(supportedExts, "xls") || slices.Contains(supportedExts, "js") {
		t.Fatalf("unexpected supported extensions: %#v", supportedExts)
	}
	if err := document.ValidateKnowledgeBaseDocumentFileSupport(&docentity.File{Name: "demo.docx"}); err != nil {
		t.Fatalf("expected supported document file, got %v", err)
	}
	if err := document.ValidateKnowledgeBaseDocumentFileSupport(&docentity.File{Name: "demo.svg"}); !errors.Is(err, document.ErrUnsupportedKnowledgeBaseFileType) {
		t.Fatalf("expected unsupported file type error, got %v", err)
	}
	normalizedUnsupported := document.NormalizeKnowledgeBaseProjectFileMeta(&projectfile.Meta{
		Status:        projectfile.ResolveStatusActive,
		FileName:      "demo.js",
		FileExtension: "js",
	})
	if normalizedUnsupported == nil || normalizedUnsupported.Status != projectfile.ResolveStatusUnsupported {
		t.Fatalf("expected js project file to normalize as unsupported, got %#v", normalizedUnsupported)
	}
	normalizedSupported := document.NormalizeKnowledgeBaseProjectFileMeta(&projectfile.Meta{
		Status:        projectfile.ResolveStatusActive,
		FileName:      "demo.md",
		FileExtension: "md",
	})
	if normalizedSupported == nil || normalizedSupported.Status != projectfile.ResolveStatusActive {
		t.Fatalf("expected md project file to stay active, got %#v", normalizedSupported)
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

	doc := &docentity.KnowledgeBaseDocument{
		DocumentFile: &docentity.File{
			Name:      "demo.md",
			Extension: "md",
		},
	}
	parsed, normalized := document.BuildParsedDocumentFromContent(doc, "# 标题\\n\\n## 背景\\n正文")
	if parsed == nil || !strings.Contains(normalized, "\n## 背景\n") {
		t.Fatalf("expected markdown content escaped newlines decoded, got normalized=%q parsed=%#v", normalized, parsed)
	}
}

func TestValidateSingleDocumentDeleteAllowed(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{Code: "DOC-1"}

	cases := []struct {
		name               string
		semanticSourceType string
		hasSemantic        bool
		wantErr            error
	}{
		{
			name:               "project blocked",
			semanticSourceType: "project",
			hasSemantic:        true,
			wantErr:            document.ErrManagedDocumentSingleDeleteNotAllowed,
		},
		{
			name:               "enterprise blocked",
			semanticSourceType: "enterprise",
			hasSemantic:        true,
			wantErr:            document.ErrManagedDocumentSingleDeleteNotAllowed,
		},
		{
			name:               "local allowed",
			semanticSourceType: "local",
			hasSemantic:        true,
		},
		{
			name:               "custom allowed",
			semanticSourceType: "custom",
			hasSemantic:        true,
		},
		{
			name: "unknown semantic skipped",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			err := document.ValidateSingleDocumentDeleteAllowed(doc, tc.semanticSourceType, tc.hasSemantic)
			if !errors.Is(err, tc.wantErr) {
				t.Fatalf("expected err=%v, got %v", tc.wantErr, err)
			}
		})
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

	doc := &docentity.KnowledgeBaseDocument{}
	document.ApplyResolvedDocumentResult(doc, int(docentity.DocTypeMarkdown), map[string]any{
		"type":          "third_platform",
		"name":          "report.md",
		"url":           "https://example.com/report.md",
		"file_key":      "ORG1/files/report.md",
		"extension":     "md",
		"size":          10,
		"third_file_id": testThirdFileID,
		"platform_type": "teamshare",
	})
	if doc.DocType != int(docentity.DocTypeMarkdown) || doc.ThirdFileID != testThirdFileID || doc.DocumentFile == nil || doc.DocumentFile.SourceType != "teamshare" || doc.DocumentFile.FileKey != "ORG1/files/report.md" {
		t.Fatalf("unexpected resolved document result: %#v", doc)
	}
	if !document.ApplySourceOverride(doc, &document.SourceOverride{
		DocType: int(docentity.DocTypeText),
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
		OrganizationCode: testOrganizationCode,
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
	if doc.DocType != int(docentity.DocTypeDOCX) {
		t.Fatalf("expected repaired doc_type=%d, got %d", docentity.DocTypeDOCX, doc.DocType)
	}
	if document.EnsureThirdFileRepairDocumentFields(doc, kb, "teamshare", group) {
		t.Fatal("expected repaired document to already be aligned")
	}

	created := document.BuildDocumentForCreate(kb, "text-embedding-3-large", &document.CreateManagedDocumentInput{
		OrganizationCode:  testOrganizationCode,
		UserID:            "USER",
		KnowledgeBaseCode: "KB1",
		Name:              "manual",
		DocType:           int(docentity.DocumentInputKindText),
		DocumentFile:      &docentity.File{Name: "manual.md"},
	})
	if created.EmbeddingModel != "text-embedding-3-large" || created.VectorDB != "qdrant" || created.DocumentFile == nil {
		t.Fatalf("unexpected created document: %#v", created)
	}

	createdEnterprise := document.BuildDocumentForCreate(kb, "text-embedding-3-large", &document.CreateManagedDocumentInput{
		OrganizationCode:  testOrganizationCode,
		UserID:            "USER",
		KnowledgeBaseCode: "KB1",
		Name:              "teamshare-cloud-doc",
		DocType:           int(docentity.DocTypeCloudDocument),
	})
	if createdEnterprise.DocType != int(docentity.DocTypeCloudDocument) {
		t.Fatalf("expected exact doc_type to be preserved, got %d", createdEnterprise.DocType)
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
	if input.OrganizationCode != testOrganizationCode || input.ThirdPlatformType != "teamshare" || input.ThirdFileID != "FILE-1" {
		t.Fatalf("unexpected normalized revectorize input: %#v", input)
	}
	if document.FirstUsableDocument([]*docentity.KnowledgeBaseDocument{{}, {KnowledgeBaseCode: "KB1", Code: "DOC-1"}}).Code != "DOC-1" {
		t.Fatal("expected first usable document")
	}

	seed, err := document.BuildThirdFileRevectorizeSeed(input, []*docentity.KnowledgeBaseDocument{{KnowledgeBaseCode: "KB1", Code: "DOC-1", UpdatedUID: "UPDATER"}})
	if err != nil {
		t.Fatalf("build revectorize seed failed: %v", err)
	}
	if seed.SourceCacheKey != "teamshare:ORG:teamshare:FILE-1" {
		t.Fatalf("unexpected source cache key: %#v", seed)
	}

	snapshot := document.BuildResolvedSourceSnapshot(document.SourceSnapshotInput{
		Content:      "a\r\n\r\n\r\nb",
		DocType:      int(docentity.DocTypeDOCX),
		DocumentFile: map[string]any{"name": "spec.docx"},
		Source:       "resolve",
		Now:          time.Unix(1700000001, 0),
	})
	if snapshot.Content != "a\n\nb" || snapshot.ContentHash == "" || snapshot.FetchedAtUnixMilli == 0 {
		t.Fatalf("unexpected source snapshot: %#v", snapshot)
	}

	docs := []*docentity.KnowledgeBaseDocument{
		{KnowledgeBaseCode: "KB1", Code: "DOC-1", UpdatedUID: "DOC-USER"},
		{},
	}
	requests := document.BuildThirdFileRevectorizeRequests(input, docs, seed, snapshot)
	if len(requests) != 1 || requests[0].BusinessParams.UserID != "DOC-USER" || requests[0].SourceOverride == nil {
		t.Fatalf("unexpected revectorize requests: %#v", requests)
	}

	createdByRequests := document.BuildThirdFileRevectorizeRequests(input, []*docentity.KnowledgeBaseDocument{
		{KnowledgeBaseCode: "KB1", Code: "DOC-1", CreatedUID: "CREATOR"},
	}, seed, snapshot)
	if len(createdByRequests) != 1 || createdByRequests[0].BusinessParams.UserID != "CREATOR" {
		t.Fatalf("expected created_uid fallback, got %#v", createdByRequests)
	}

	missingUserRequests := document.BuildThirdFileRevectorizeRequests(input, []*docentity.KnowledgeBaseDocument{
		{KnowledgeBaseCode: "KB1", Code: "DOC-1"},
	}, seed, snapshot)
	if len(missingUserRequests) != 1 || missingUserRequests[0].BusinessParams.UserID != "" {
		t.Fatalf("expected empty user instead of falling back to request user, got %#v", missingUserRequests)
	}

	if _, err := document.BuildThirdFileRevectorizeSeed(nil, nil); !errors.Is(err, shared.ErrDocumentNotFound) {
		t.Fatalf("expected document not found, got %v", err)
	}
}

func TestDocumentSyncPoliciesPreserveParsedDocumentAcrossSnapshotAndOverride(t *testing.T) {
	t.Parallel()

	parsed := &parseddocument.ParsedDocument{
		SourceType: parseddocument.SourceTabular,
		Blocks: []parseddocument.ParsedBlock{
			{
				Type:    parseddocument.BlockTypeTableRow,
				Content: "row-1",
				Metadata: map[string]any{
					parseddocument.MetaSheetName:  testTabularSheetName,
					parseddocument.MetaTableTitle: "table-1",
					parseddocument.MetaRowIndex:   2,
					parseddocument.MetaFields: []map[string]any{
						{"header": "门店编码", "value": "V90901"},
						{"header": "门店名称", "value": "博乐友好时尚购物中心KKV店"},
					},
				},
			},
		},
	}

	snapshot := document.BuildResolvedSourceSnapshot(document.SourceSnapshotInput{
		Content:            "this content should be replaced by parsed text",
		DocType:            int(docentity.DocumentInputKindFile),
		DocumentFile:       map[string]any{"name": "rag.xlsx", "extension": "xlsx"},
		ParsedDocument:     parsed,
		Source:             "resolve",
		FetchedAtUnixMilli: time.Unix(1700000003, 0).UnixMilli(),
		Now:                time.Unix(1700000003, 0),
	})
	if snapshot == nil || snapshot.ParsedDocument == nil {
		t.Fatalf("expected parsed document snapshot, got %#v", snapshot)
	}
	if snapshot.ParsedDocument.SourceType != parseddocument.SourceTabular {
		t.Fatalf("expected tabular source type, got %#v", snapshot.ParsedDocument)
	}
	if snapshot.Content == "this content should be replaced by parsed text" || snapshot.ContentHash == "" {
		t.Fatalf("expected content normalized from parsed document, got %#v", snapshot)
	}
	if snapshot.ParsedDocument == parsed {
		t.Fatal("expected snapshot parsed document to be cloned")
	}
	parsed.Blocks[0].Metadata[parseddocument.MetaSheetName] = "mutated"
	if got := snapshot.ParsedDocument.Blocks[0].Metadata[parseddocument.MetaSheetName]; got != testTabularSheetName {
		t.Fatalf("expected snapshot parsed metadata isolated from source, got %#v", got)
	}

	input := document.NormalizeThirdFileRevectorizeInput(&document.ThirdFileRevectorizeInput{
		OrganizationCode:  testOrganizationCode,
		UserID:            "USER",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
	})
	seed, err := document.BuildThirdFileRevectorizeSeed(input, []*docentity.KnowledgeBaseDocument{{
		KnowledgeBaseCode: "KB1",
		Code:              "DOC-1",
		UpdatedUID:        "DOC-USER",
	}})
	if err != nil {
		t.Fatalf("build revectorize seed failed: %v", err)
	}
	requests := document.BuildThirdFileRevectorizeRequests(input, []*docentity.KnowledgeBaseDocument{
		{KnowledgeBaseCode: "KB1", Code: "DOC-1", UpdatedUID: "DOC-USER"},
		{KnowledgeBaseCode: "KB2", Code: "DOC-2", UpdatedUID: "DOC-USER-2"},
	}, seed, snapshot)
	if len(requests) != 2 {
		t.Fatalf("expected two requests, got %d", len(requests))
	}
	if requests[0].SourceOverride == nil || requests[0].SourceOverride.ParsedDocument == nil {
		t.Fatalf("expected parsed document in source override, got %#v", requests[0].SourceOverride)
	}
	if requests[0].SourceOverride.ParsedDocument == requests[1].SourceOverride.ParsedDocument {
		t.Fatal("expected each request to receive an isolated parsed document clone")
	}
	requests[0].SourceOverride.ParsedDocument.Blocks[0].Metadata[parseddocument.MetaSheetName] = "request-1"
	if got := requests[1].SourceOverride.ParsedDocument.Blocks[0].Metadata[parseddocument.MetaSheetName]; got != testTabularSheetName {
		t.Fatalf("expected second request parsed document to stay isolated, got %#v", got)
	}
}

func TestDocumentSyncPoliciesBuildSyncContentFromStructuredSourceOverride(t *testing.T) {
	t.Parallel()

	override := document.NormalizeSourceOverride(&document.SourceOverride{
		Content: "plain fallback",
		DocumentFile: map[string]any{
			"name":      "rag.xlsx",
			"extension": "xlsx",
		},
		ParsedDocument: &parseddocument.ParsedDocument{
			SourceType: parseddocument.SourceTabular,
			Blocks: []parseddocument.ParsedBlock{
				{
					Type:    parseddocument.BlockTypeTableRow,
					Content: "row-2",
					Metadata: map[string]any{
						parseddocument.MetaSheetName:  testTabularSheetName,
						parseddocument.MetaTableTitle: "table-1",
						parseddocument.MetaRowIndex:   3,
						parseddocument.MetaFields: []map[string]any{
							{"header": "门店编码", "value": "T909001"},
							{"header": "门店名称", "value": "博乐友好时尚购物中心TC店"},
						},
					},
				},
			},
		},
	}, time.Unix(1700000004, 0))
	if override == nil || override.ParsedDocument == nil || override.ContentHash == "" {
		t.Fatalf("expected normalized structured override, got %#v", override)
	}
	if override.Content == "plain fallback" {
		t.Fatalf("expected override content to be rebuilt from parsed document, got %#v", override)
	}

	result, err := document.BuildSyncContentFromSourceOverride(&docentity.KnowledgeBaseDocument{
		DocumentFile: &docentity.File{Name: "rag.xlsx", Extension: "xlsx"},
	}, override)
	if err != nil {
		t.Fatalf("build sync content from structured override: %v", err)
	}
	if result.Parsed == nil || result.Parsed.SourceType != parseddocument.SourceTabular {
		t.Fatalf("expected structured parsed document, got %#v", result)
	}
	if result.Parsed == override.ParsedDocument {
		t.Fatal("expected returned parsed document to be cloned")
	}
	if len(result.Parsed.Blocks) != 1 || result.Content == "" {
		t.Fatalf("unexpected structured sync content result: %#v", result)
	}
	result.Parsed.Blocks[0].Metadata[parseddocument.MetaSheetName] = "mutated"
	if got := override.ParsedDocument.Blocks[0].Metadata[parseddocument.MetaSheetName]; got != testTabularSheetName {
		t.Fatalf("expected source override parsed document to stay isolated, got %#v", got)
	}

	plainResult, err := document.BuildSyncContentFromSourceOverride(&docentity.KnowledgeBaseDocument{
		DocumentFile: &docentity.File{Name: "demo.md", Extension: "md"},
	}, &document.SourceOverride{
		Content: "alpha\n\nbeta",
		DocumentFile: map[string]any{
			"name":      "demo.md",
			"extension": "md",
		},
	})
	if err != nil {
		t.Fatalf("build sync content from plain override: %v", err)
	}
	if plainResult.Parsed == nil || plainResult.Parsed.SourceType != parseddocument.SourceText {
		t.Fatalf("expected plain text parsed document fallback, got %#v", plainResult)
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
	doc := &docentity.KnowledgeBaseDocument{FragmentConfig: cfg}

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
		DocType:           int(docentity.DocumentInputKindText),
	})
	if doc == nil || doc.RetrieveConfig == nil || doc.FragmentConfig == nil {
		t.Fatalf("expected managed document to inherit normalized configs, got %#v", doc)
	}
}

func TestResolveEffectiveSyncSplitPlan(t *testing.T) {
	t.Parallel()

	cfg := &shared.FragmentConfig{
		Mode: shared.FragmentModeCustom,
		Normal: &shared.NormalFragmentConfig{
			TextPreprocessRule: []int{1, 2},
			SegmentRule: &shared.SegmentRule{
				Separator:    "\n\n",
				ChunkSize:    256,
				ChunkOverlap: 24,
			},
		},
	}
	kb := &sharedsnapshot.KnowledgeBaseRuntimeSnapshot{FragmentConfig: cfg}
	doc := &docentity.KnowledgeBaseDocument{FragmentConfig: cfg}

	preserved := document.ResolveEffectiveSyncSplitPlan(doc, kb, false)
	if preserved.RequestedMode != shared.FragmentModeCustom || preserved.FragmentConfig == cfg {
		t.Fatalf("expected preserved custom plan with cloned config, got %#v", preserved)
	}
	if preserved.SegmentConfig.ChunkSize != 256 || preserved.SegmentConfig.ChunkOverlap != 24 || preserved.SegmentConfig.Separator != "\n\n" {
		t.Fatalf("unexpected preserved segment config: %#v", preserved.SegmentConfig)
	}

	forced := document.ResolveEffectiveSyncSplitPlan(doc, kb, true)
	if forced.RequestedMode != shared.FragmentModeAuto {
		t.Fatalf("expected forced auto mode, got %#v", forced)
	}
	if forced.FragmentConfig == nil || forced.FragmentConfig.Mode != shared.FragmentModeAuto {
		t.Fatalf("expected forced auto fragment config, got %#v", forced.FragmentConfig)
	}
	if forced.SegmentConfig.ChunkSize != 1000 || forced.SegmentConfig.ChunkOverlap != 80 || forced.SegmentConfig.Separator != "\n" {
		t.Fatalf("unexpected forced auto segment config: %#v", forced.SegmentConfig)
	}
	if len(forced.SegmentConfig.TextPreprocessRule) != 0 {
		t.Fatalf("expected forced auto to ignore preprocess rules, got %#v", forced.SegmentConfig)
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

func TestDocumentUpdateResyncPolicyDetectsNormalizedConfigChanges(t *testing.T) {
	t.Parallel()

	before := &docentity.KnowledgeBaseDocument{
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
	afterSame := &docentity.KnowledgeBaseDocument{
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

	afterStrategyChanged := &docentity.KnowledgeBaseDocument{
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

	afterFragmentChanged := &docentity.KnowledgeBaseDocument{
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

func TestDocumentUpdateResyncPolicyRecoveryRequiresNonSyncedDocument(t *testing.T) {
	t.Parallel()

	if document.ShouldRecoveryResyncForNonSyncedDocument(nil) {
		t.Fatal("expected nil document not to require recovery resync")
	}
	syncedDoc := &docentity.KnowledgeBaseDocument{SyncStatus: shared.SyncStatusSynced}
	if document.ShouldRecoveryResyncForNonSyncedDocument(syncedDoc) {
		t.Fatalf("expected synced document not to require recovery resync: %#v", syncedDoc)
	}
	for _, status := range []shared.SyncStatus{
		shared.SyncStatusPending,
		shared.SyncStatusSyncing,
		shared.SyncStatusSyncFailed,
	} {
		doc := &docentity.KnowledgeBaseDocument{SyncStatus: status}
		if !document.ShouldRecoveryResyncForNonSyncedDocument(doc) {
			t.Fatalf("expected status %v to require recovery resync: %#v", status, doc)
		}
	}
}
