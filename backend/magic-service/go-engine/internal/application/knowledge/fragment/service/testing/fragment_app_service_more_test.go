package fragapp_test

import (
	"bytes"
	"context"
	"errors"
	"maps"
	"slices"
	"strings"
	"testing"

	fragdto "magic/internal/application/knowledge/fragment/dto"
	appservice "magic/internal/application/knowledge/fragment/service"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	autoloadcfg "magic/internal/config/autoload"
	docentity "magic/internal/domain/knowledge/document/entity"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragretrieval "magic/internal/domain/knowledge/fragment/retrieval"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	kbrepository "magic/internal/domain/knowledge/knowledgebase/repository"
	"magic/internal/domain/knowledge/shared"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/thirdplatform"
)

var (
	errFragmentSaveFailed       = errors.New("fragment save failed")
	errFragmentShowFailed       = errors.New("fragment show failed")
	errFragmentListFailed       = errors.New("fragment list failed")
	errFragmentDestroyFailed    = errors.New("fragment destroy failed")
	errFragmentSyncFailed       = errors.New("fragment sync failed")
	errFragmentSimilarityFailed = errors.New("fragment similarity failed")
	errFragmentKnowledgeFailed  = errors.New("fragment knowledge failed")
	errPayloadRepairFailed      = errors.New("payload repair failed")
)

const (
	testAutoDocumentCode      = "DOC_AUTO"
	testLegacyThirdFileID     = "FILE-1"
	testFragmentKnowledgeCode = "KB1"
	testFragmentOrganization  = "ORG1"
	testSimilarityBusinessID  = "BIZ-42"
	testBackfillBusinessID    = "BIZ-88"
)

func TestFragmentAppServiceCreate(t *testing.T) {
	t.Parallel()

	documentSvc := &fragmentAppDocumentReaderStub{
		showResult: &docentity.KnowledgeBaseDocument{
			Code:             "DOC1",
			Name:             "Document 1",
			DocType:          int(docentity.DocumentInputKindFile),
			OrganizationCode: testFragmentOrganization,
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		KBService:                 &fragmentAppKnowledgeReaderStub{showByCodeAndOrgResult: &kbentity.KnowledgeBase{Code: "KB1"}},
		DocumentService:           documentSvc,
		ManualFragmentCoordinator: documentSvc,
		DefaultEmbeddingModel:     "text-embedding-3-small",
	})

	dto, err := svc.Create(context.Background(), &fragdto.CreateFragmentInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		Content:          "hello world",
		Metadata:         map[string]any{"tag": "news"},
	})
	if err != nil {
		t.Fatalf("create fragment failed: %v", err)
	}
	if dto == nil || dto.DocumentName != "Document 1" || dto.DocumentType != int(docentity.DocumentInputKindFile) {
		t.Fatalf("unexpected dto: %#v", dto)
	}
	if documentSvc.ensuredFragment == nil {
		t.Fatal("expected ensured fragment")
	}
	if documentSvc.ensuredFragment.OrganizationCode != testFragmentOrganization {
		t.Fatalf("unexpected ensured fragment: %#v", documentSvc.ensuredFragment)
	}

	errorSvc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		KBService: &fragmentAppKnowledgeReaderStub{showByCodeAndOrgResult: &kbentity.KnowledgeBase{Code: "KB1"}},
		DocumentService: &fragmentAppDocumentReaderStub{
			showResult: &docentity.KnowledgeBaseDocument{
				Code:             "DOC1",
				Name:             "Document 1",
				DocType:          int(docentity.DocumentInputKindFile),
				OrganizationCode: testFragmentOrganization,
			},
			ensureErr: errFragmentSaveFailed,
		},
		ManualFragmentCoordinator: &fragmentAppDocumentReaderStub{
			showResult: &docentity.KnowledgeBaseDocument{
				Code:             "DOC1",
				Name:             "Document 1",
				DocType:          int(docentity.DocumentInputKindFile),
				OrganizationCode: testFragmentOrganization,
			},
			ensureErr: errFragmentSaveFailed,
		},
	})
	if _, err := errorSvc.Create(context.Background(), &fragdto.CreateFragmentInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		Content:          "hello world",
	}); !errors.Is(err, errFragmentSaveFailed) {
		t.Fatalf("expected save error, got %v", err)
	}
}

func TestFragmentAppServiceShowRejectsUnauthorizedKnowledgeBase(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               1,
		KnowledgeCode:    testFragmentKnowledgeCode,
		DocumentCode:     "DOC1",
		OrganizationCode: testFragmentOrganization,
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: &fragmentAppFragmentServiceStub{showResult: fragment},
		KBService: &fragmentAppKnowledgeReaderStub{
			showResult: &kbentity.KnowledgeBase{Code: testFragmentKnowledgeCode, OrganizationCode: testFragmentOrganization},
		},
	})
	svc.SetKnowledgeBasePermissionReaderForTest(fragmentPermissionReaderStub{
		operations: map[string]string{testFragmentKnowledgeCode: "none"},
	})

	ctx := ctxmeta.WithAccessActor(context.Background(), ctxmeta.AccessActor{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
	})
	_, err := svc.Show(ctx, 1, testFragmentOrganization, testFragmentKnowledgeCode, "DOC1")
	if !errors.Is(err, appservice.ErrFragmentPermissionDenied) {
		t.Fatalf("expected fragment permission denied, got %v", err)
	}
}

func TestFragmentAppServiceCreateAutoCreatesDocument(t *testing.T) {
	t.Parallel()

	kb := &kbentity.KnowledgeBase{
		Code:             "KB1",
		OrganizationCode: testFragmentOrganization,
		VectorDB:         "qdrant",
	}
	documentSvc := &fragmentAppDocumentReaderStub{
		showErr: shared.ErrDocumentNotFound,
		ensureResult: &docentity.KnowledgeBaseDocument{
			Code:             testAutoDocumentCode,
			Name:             testAutoDocumentCode,
			DocType:          int(docentity.DocumentInputKindText),
			OrganizationCode: testFragmentOrganization,
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		KBService:                 &fragmentAppKnowledgeReaderStub{showByCodeAndOrgResult: kb},
		DocumentService:           documentSvc,
		ManualFragmentCoordinator: documentSvc,
		DefaultEmbeddingModel:     "text-embedding-3-small",
	})

	dto, err := svc.Create(context.Background(), &fragdto.CreateFragmentInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
		KnowledgeCode:    "KB1",
		DocumentCode:     testAutoDocumentCode,
		Content:          "hello world",
	})
	if err != nil {
		t.Fatalf("create fragment failed: %v", err)
	}
	if dto == nil || dto.DocumentCode != testAutoDocumentCode || dto.DocumentName != testAutoDocumentCode {
		t.Fatalf("unexpected dto: %#v", dto)
	}
	if documentSvc.ensuredDoc == nil || documentSvc.ensuredDoc.Code != testAutoDocumentCode || documentSvc.ensuredDoc.Name != testAutoDocumentCode {
		t.Fatalf("unexpected ensured doc: %#v", documentSvc.ensuredDoc)
	}
	if documentSvc.ensuredDoc.DocType != int(docentity.DocumentInputKindText) || documentSvc.ensuredDoc.SyncStatus != shared.SyncStatusSynced {
		t.Fatalf("unexpected auto created doc fields: %#v", documentSvc.ensuredDoc)
	}
	if documentSvc.ensuredFragment == nil || documentSvc.ensuredFragment.DocumentType != int(docentity.DocumentInputKindText) {
		t.Fatalf("unexpected ensured fragment: %#v", documentSvc.ensuredFragment)
	}
}

func TestFragmentAppServiceCreateLegacyThirdPlatformFragmentAutoCreatesMapping(t *testing.T) {
	t.Parallel()

	kb := &kbentity.KnowledgeBase{
		Code:             testFragmentKnowledgeCode,
		OrganizationCode: testFragmentOrganization,
		Model:            "text-embedding-3-small",
		VectorDB:         "qdrant",
	}
	documentSvc := &fragmentAppDocumentReaderStub{
		findByThirdFileErr: shared.ErrDocumentNotFound,
		ensureResult: &docentity.KnowledgeBaseDocument{
			Code:              "DOCUMENT-LEGACY-1",
			Name:              "file.docx",
			DocType:           int(docentity.DocumentInputKindFile),
			OrganizationCode:  testFragmentOrganization,
			KnowledgeBaseCode: testFragmentKnowledgeCode,
			ThirdPlatformType: "teamshare",
			ThirdFileID:       testLegacyThirdFileID,
		},
	}
	resolver := &fragmentThirdPlatformResolverStub{
		result: &thirdplatform.DocumentResolveResult{
			DocType: 2,
			DocumentFile: map[string]any{
				"type":          "third_platform",
				"name":          "file.docx",
				"third_file_id": testLegacyThirdFileID,
				"platform_type": "teamshare",
				"extension":     "docx",
			},
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		KBService:                 &fragmentAppKnowledgeReaderStub{showByCodeAndOrgResult: kb},
		DocumentService:           documentSvc,
		ManualFragmentCoordinator: documentSvc,
		ThirdPlatformDocumentPort: resolver,
		ThirdPlatformProviders:    thirdplatformprovider.NewRegistry(thirdplatformprovider.NewTeamshareProvider(resolver, nil)),
		DefaultEmbeddingModel:     "text-embedding-3-small",
	})

	dto, err := svc.Create(context.Background(), &fragdto.CreateFragmentInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
		KnowledgeCode:    testFragmentKnowledgeCode,
		Content:          "hello world",
		BusinessID:       "BIZ-1",
		Metadata: map[string]any{
			"file_id": testLegacyThirdFileID,
			"url":     "[file.docx](https://demo/doc)",
		},
	})
	if err != nil {
		t.Fatalf("create legacy fragment failed: %v", err)
	}
	if dto == nil || dto.DocumentCode != "DOCUMENT-LEGACY-1" || dto.BusinessID != "BIZ-1" {
		t.Fatalf("unexpected dto: %#v", dto)
	}
	if documentSvc.lastFindByThirdFileKnowledgeCode != testFragmentKnowledgeCode || documentSvc.lastFindByThirdFileID != testLegacyThirdFileID {
		t.Fatalf("unexpected third file lookup: %#v", documentSvc)
	}
	if documentSvc.ensuredDoc == nil || documentSvc.ensuredDoc.ThirdFileID != testLegacyThirdFileID || documentSvc.ensuredDoc.ThirdPlatformType != "teamshare" {
		t.Fatalf("unexpected ensured doc: %#v", documentSvc.ensuredDoc)
	}
	if documentSvc.ensuredFragment == nil || documentSvc.ensuredFragment.BusinessID != "BIZ-1" || documentSvc.ensuredFragment.DocumentCode == "" {
		t.Fatalf("unexpected ensured fragment: %#v", documentSvc.ensuredFragment)
	}
	if resolver.lastInput == nil || resolver.lastInput.ThirdFileID != testLegacyThirdFileID {
		t.Fatalf("unexpected resolve input: %#v", resolver.lastInput)
	}
}

func TestFragmentAppServiceShowListAndDestroy(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               1,
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		DocumentName:     "Document 1",
		DocumentType:     int(docentity.DocumentInputKindFile),
		Content:          "section content",
		Metadata:         map[string]any{"section_title": "Intro"},
		SyncStatus:       sharedentity.SyncStatusSynced,
	}
	fragmentSvc := &fragmentAppFragmentServiceStub{
		showResult: fragment,
		listResult: []*fragmodel.KnowledgeBaseFragment{fragment},
		listTotal:  1,
	}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: "text-embedding-3-small"}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService:       &fragmentAppKnowledgeReaderStub{showResult: kb},
	})

	dto, err := svc.Show(context.Background(), 1, testFragmentOrganization, "KB1", "DOC1")
	if err != nil || dto == nil || dto.DocumentCode != "DOC1" {
		t.Fatalf("unexpected show result dto=%#v err=%v", dto, err)
	}

	page, err := svc.List(context.Background(), &fragdto.ListFragmentInput{
		KnowledgeCode: "KB1",
		DocumentCode:  "DOC1",
		Content:       "section",
		SyncStatus:    new(int(shared.SyncStatusSynced)),
		Offset:        3,
		Limit:         7,
	})
	list, ok := page.List.([]*fragdto.FragmentDTO)
	if err != nil || !ok || page.Total != 1 || len(list) != 1 {
		t.Fatalf("unexpected list page=%#v err=%v", page, err)
	}
	if fragmentSvc.lastListQuery == nil || fragmentSvc.lastListQuery.Offset != 3 || fragmentSvc.lastListQuery.Limit != 7 {
		t.Fatalf("unexpected list query: %#v", fragmentSvc.lastListQuery)
	}
	if fragmentSvc.lastListQuery.SyncStatus == nil || *fragmentSvc.lastListQuery.SyncStatus != shared.SyncStatusSynced {
		t.Fatalf("unexpected list sync status query: %#v", fragmentSvc.lastListQuery)
	}

	if err := svc.Destroy(context.Background(), 1, "KB1", "DOC1", testFragmentOrganization); err != nil {
		t.Fatalf("destroy failed: %v", err)
	}
	if fragmentSvc.destroyCollection != kb.CollectionName() {
		t.Fatalf("unexpected destroy collection %q", fragmentSvc.destroyCollection)
	}
}

func TestFragmentAppServiceShowListAndListV2SanitizeMetadata(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               1,
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		DocumentName:     "Document 1",
		DocumentType:     int(docentity.DocumentInputKindFile),
		Content:          "section content",
		Metadata: map[string]any{
			"section_title": "Intro",
			"ext":           map[string]any{"hidden": "value"},
		},
		SyncStatus: sharedentity.SyncStatusSynced,
	}
	fragmentSvc := &fragmentAppFragmentServiceStub{
		showResult: fragment,
		listResult: []*fragmodel.KnowledgeBaseFragment{fragment},
		listTotal:  1,
	}
	sourceType := int(kbentity.SourceTypeEnterpriseWiki)
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService: &fragmentAppKnowledgeReaderStub{showResult: &kbentity.KnowledgeBase{
			Code:              "KB1",
			OrganizationCode:  testFragmentOrganization,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
			SourceType:        &sourceType,
		}},
	})

	showDTO, err := svc.Show(context.Background(), 1, testFragmentOrganization, "KB1", "DOC1")
	if err != nil {
		t.Fatalf("show failed: %v", err)
	}
	assertFragmentMetadataSanitized(t, showDTO.Metadata)

	page, err := svc.List(context.Background(), &fragdto.ListFragmentInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		Offset:           0,
		Limit:            10,
	})
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	list, ok := page.List.([]*fragdto.FragmentDTO)
	if !ok || len(list) != 1 {
		t.Fatalf("unexpected list payload: %#v", page)
	}
	assertFragmentMetadataSanitized(t, list[0].Metadata)

	pageV2, err := svc.ListV2(context.Background(), &fragdto.ListFragmentInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		Offset:           0,
		Limit:            10,
	})
	if err != nil {
		t.Fatalf("listV2 failed: %v", err)
	}
	if len(pageV2.List) != 1 {
		t.Fatalf("unexpected listV2 payload: %#v", pageV2)
	}
	assertFragmentMetadataSanitized(t, pageV2.List[0].Metadata)
	if pageV2.List[0].KnowledgeBaseType != string(kbentity.KnowledgeBaseTypeDigitalEmployee) ||
		pageV2.List[0].SourceType == nil ||
		*pageV2.List[0].SourceType != int(kbentity.SourceTypeEnterpriseWiki) {
		t.Fatalf("expected listV2 item to carry knowledge base source context, got %#v", pageV2.List[0])
	}
}

func TestFragmentAppServiceIgnoresAgentCodesWhenKnowledgeBaseCanBeDetermined(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name string
	}{
		{name: "default"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertFragmentCreateUsesKnowledgeBaseScope(t)
			assertFragmentReadOpsUseKnowledgeBaseScope(t)
		})
	}
}

func newDigitalEmployeeKnowledgeBaseReaderForFragmentScopeTest() *fragmentAppKnowledgeReaderStub {
	sourceType := int(kbentity.SourceTypeLocalFile)
	return &fragmentAppKnowledgeReaderStub{
		showByCodeAndOrgResult: &kbentity.KnowledgeBase{
			Code:              "KB1",
			OrganizationCode:  testFragmentOrganization,
			Model:             "text-embedding-3-small",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
		showResult: &kbentity.KnowledgeBase{
			Code:              "KB1",
			OrganizationCode:  testFragmentOrganization,
			Model:             "text-embedding-3-small",
			SourceType:        &sourceType,
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		},
	}
}

func newFragmentScopeDocumentReader() *fragmentAppDocumentReaderStub {
	return &fragmentAppDocumentReaderStub{
		showResult: &docentity.KnowledgeBaseDocument{
			Code:             "DOC1",
			Name:             "Document 1",
			DocType:          int(docentity.DocumentInputKindFile),
			OrganizationCode: testFragmentOrganization,
		},
	}
}

func assertFragmentCreateUsesKnowledgeBaseScope(t *testing.T) {
	t.Helper()

	createSvc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		KBService:       newDigitalEmployeeKnowledgeBaseReaderForFragmentScopeTest(),
		DocumentService: newFragmentScopeDocumentReader(),
		ManualFragmentCoordinator: &fragmentAppDocumentReaderStub{
			ensureResult: &docentity.KnowledgeBaseDocument{
				Code:             "DOC1",
				Name:             "Document 1",
				DocType:          int(docentity.DocumentInputKindFile),
				OrganizationCode: testFragmentOrganization,
			},
		},
		DefaultEmbeddingModel: "text-embedding-3-small",
	})
	if _, err := createSvc.Create(context.Background(), &fragdto.CreateFragmentInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		Content:          "hello world",
	}); err != nil {
		t.Fatalf("create failed: %v", err)
	}
}

func assertFragmentReadOpsUseKnowledgeBaseScope(t *testing.T) {
	t.Helper()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               1,
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		DocumentName:     "Document 1",
		DocumentType:     int(docentity.DocumentInputKindFile),
		Content:          "section content",
	}
	fragmentSvc := &fragmentAppFragmentServiceStub{
		showResult:        fragment,
		listResult:        []*fragmodel.KnowledgeBaseFragment{fragment},
		listTotal:         1,
		similarityResults: buildSimilarityResultsForTest(),
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:       fragmentSvc,
		KBService:             newDigitalEmployeeKnowledgeBaseReaderForFragmentScopeTest(),
		DocumentService:       newFragmentScopeDocumentReader(),
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	if _, err := svc.Show(context.Background(), 1, testFragmentOrganization, "KB1", "DOC1"); err != nil {
		t.Fatalf("show failed: %v", err)
	}
	page, err := svc.ListV2(context.Background(), &fragdto.ListFragmentInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
		Offset:           0,
		Limit:            10,
	})
	if err != nil {
		t.Fatalf("listV2 failed: %v", err)
	}
	if page.Total != 1 {
		t.Fatalf("expected total=1, got %#v", page)
	}
	if err := svc.Destroy(context.Background(), 1, "KB1", "DOC1", testFragmentOrganization); err != nil {
		t.Fatalf("destroy failed: %v", err)
	}
	results, err := svc.Similarity(context.Background(), &fragdto.SimilarityInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		Query:            "intro",
	})
	if err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %#v", results)
	}
}

func TestFragmentAppServiceSimilarityByAgent(t *testing.T) {
	t.Parallel()

	kbList := []*kbentity.KnowledgeBase{
		{Code: "KB1", OrganizationCode: testFragmentOrganization, KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee, Model: "text-embedding-3-small"},
		{Code: "KB2", OrganizationCode: testFragmentOrganization, KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee, Model: "text-embedding-3-small"},
	}
	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResultsByKB: map[string][]*fragmodel.SimilarityResult{
			"KB1": {
				{FragmentID: 11, KnowledgeCode: "KB1", DocumentCode: "DOC1", DocumentName: "doc-1.md", DocumentType: int(docentity.DocumentInputKindFile), Content: "第一条命中", Score: 0.88},
			},
			"KB2": {
				{FragmentID: 22, KnowledgeCode: "KB2", DocumentCode: "DOC2", DocumentName: "doc-2.md", DocumentType: int(docentity.DocumentInputKindFile), Content: "第二条命中", Score: 0.95},
			},
		},
	}
	kbReader := &fragmentAppKnowledgeReaderStub{
		listResult: kbList,
		listTotal:  int64(len(kbList)),
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService:       kbReader,
		KnowledgeBaseBindingRepo: &fragmentAppKnowledgeBaseBindingReaderStub{
			knowledgeBaseCodes: []string{testFragmentKnowledgeCode, "KB2"},
		},
		SuperMagicAgentAccess: &fragmentAppSuperMagicAgentAccessCheckerStub{
			accessibleCodes: map[string]struct{}{"SMA-001": {}},
		},
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	businessParams := &ctxmeta.BusinessParams{OrganizationCode: testFragmentOrganization, UserID: "U1"}
	result, err := svc.SimilarityByAgent(context.Background(), &fragdto.AgentSimilarityInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
		AgentCode:        "SMA-001",
		Query:            "修复 package manage 页面报错",
		BusinessParams:   businessParams,
	})
	if err != nil {
		t.Fatalf("similarity by agent failed: %v", err)
	}
	if result == nil || result.HitCount != 2 || len(result.Hits) != 2 {
		t.Fatalf("unexpected agent similarity result: %#v", result)
	}
	if kbReader.lastListQuery == nil || kbReader.lastListQuery.Enabled == nil || !*kbReader.lastListQuery.Enabled {
		t.Fatalf("expected agent similarity to list only enabled knowledge bases, got %#v", kbReader.lastListQuery)
	}
	if kbReader.lastListQuery.KnowledgeBaseType == nil || *kbReader.lastListQuery.KnowledgeBaseType != kbentity.KnowledgeBaseTypeDigitalEmployee {
		t.Fatalf("expected agent similarity to scope by digital employee knowledge base type, got %#v", kbReader.lastListQuery)
	}
	if kbReader.showCalls != 0 {
		t.Fatalf("expected agent similarity to avoid per-knowledge-base show calls, got %d", kbReader.showCalls)
	}
	if fragmentSvc.lastSimilarityReq.ResultScoreThreshold != 0.25 {
		t.Fatalf("expected agent similarity to apply shared minimum threshold, got %#v", fragmentSvc.lastSimilarityReq)
	}
	if fragmentSvc.lastSimilarityReq.BusinessParams != businessParams {
		t.Fatalf("expected agent similarity to pass business params, got %#v", fragmentSvc.lastSimilarityReq.BusinessParams)
	}
	if result.Hits[0].CitationID == "" || !strings.Contains(result.ContextText, result.Hits[0].CitationID) {
		t.Fatalf("expected context text to include citation id, got %#v", result)
	}
}

func TestFragmentAppServiceSimilaritySanitizesMetadata(t *testing.T) {
	t.Parallel()

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResults: []*fragmodel.SimilarityResult{
			{
				FragmentID: 42,
				Content:    "hello similarity",
				Score:      0.88,
				Metadata: map[string]any{
					"url":           "https://example.test/doc",
					"section_title": "Intro",
					"fragment_id":   int64(42),
					"business_id":   "BIZ-42",
					"custom_debug":  "hidden",
					"ext":           map[string]any{"hidden": "value"},
					"retrieval_ranking": fragretrieval.Ranking{
						BM25Query: fragretrieval.BM25Query{Backend: fragretrieval.SparseBackendQdrantBM25ZHV1},
					},
				},
				KnowledgeCode: "KB1",
				DocumentCode:  "DOC1",
				DocumentName:  "Document 1",
				DocumentType:  int(docentity.DocumentInputKindFile),
			},
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService:       &fragmentAppKnowledgeReaderStub{showResult: &kbentity.KnowledgeBase{Code: "KB1"}},
	})

	results, err := svc.Similarity(context.Background(), &fragdto.SimilarityInput{
		KnowledgeCode: "KB1",
		Query:         "intro",
	})
	if err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %#v", results)
	}
	assertFragmentMetadataSanitized(t, results[0].Metadata)
	if _, ok := results[0].Metadata["retrieval_ranking"]; ok {
		t.Fatalf("expected retrieval_ranking to be hidden by default, got %#v", results[0].Metadata)
	}
	if _, ok := results[0].Metadata["custom_debug"]; ok {
		t.Fatalf("expected custom debug metadata to be hidden by default, got %#v", results[0].Metadata)
	}
	if results[0].Metadata["url"] != "https://example.test/doc" || results[0].Metadata["fragment_id"] != int64(42) || results[0].Metadata["business_id"] != "BIZ-42" {
		t.Fatalf("expected whitelist metadata to be preserved, got %#v", results[0].Metadata)
	}
}

func TestFragmentAppServiceSimilarityKeepsDebugMetadataWhenRequested(t *testing.T) {
	t.Parallel()

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResults: []*fragmodel.SimilarityResult{
			{
				FragmentID: 42,
				Content:    "hello similarity",
				Score:      0.88,
				Metadata: map[string]any{
					"section_title": "Intro",
					"custom_debug":  "visible",
					"retrieval_ranking": fragretrieval.Ranking{
						BM25Query: fragretrieval.BM25Query{Backend: fragretrieval.SparseBackendQdrantBM25ZHV1},
					},
				},
				KnowledgeCode: "KB1",
				DocumentCode:  "DOC1",
				DocumentName:  "Document 1",
				DocumentType:  int(docentity.DocumentInputKindFile),
			},
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService:       &fragmentAppKnowledgeReaderStub{showResult: &kbentity.KnowledgeBase{Code: "KB1"}},
	})

	results, err := svc.Similarity(context.Background(), &fragdto.SimilarityInput{
		KnowledgeCode: "KB1",
		Query:         "intro",
		Debug:         true,
	})
	if err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %#v", results)
	}
	if _, ok := results[0].Metadata["retrieval_ranking"]; !ok {
		t.Fatalf("expected retrieval_ranking to be preserved in debug mode, got %#v", results[0].Metadata)
	}
	if results[0].Metadata["custom_debug"] != "visible" {
		t.Fatalf("expected debug metadata to be preserved, got %#v", results[0].Metadata)
	}
}

func TestFragmentAppServiceSimilarityByAgentSkipsDisabledKnowledgeBases(t *testing.T) {
	t.Parallel()

	kbList := []*kbentity.KnowledgeBase{
		{Code: "KB1", OrganizationCode: testFragmentOrganization, KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee, Enabled: true, Model: "text-embedding-3-small"},
	}
	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResultsByKB: map[string][]*fragmodel.SimilarityResult{
			"KB1": {
				{FragmentID: 11, KnowledgeCode: "KB1", DocumentCode: "DOC1", DocumentName: "doc-1.md", DocumentType: int(docentity.DocumentInputKindFile), Content: "启用知识库命中", Score: 0.88},
			},
			"KB2": {
				{FragmentID: 22, KnowledgeCode: "KB2", DocumentCode: "DOC2", DocumentName: "doc-2.md", DocumentType: int(docentity.DocumentInputKindFile), Content: "禁用知识库命中", Score: 0.95},
			},
		},
	}
	kbReader := &fragmentAppKnowledgeReaderStub{
		listResult: kbList,
		listTotal:  int64(len(kbList)),
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService:       kbReader,
		KnowledgeBaseBindingRepo: &fragmentAppKnowledgeBaseBindingReaderStub{
			knowledgeBaseCodes: []string{"KB1", "KB2"},
		},
		SuperMagicAgentAccess: &fragmentAppSuperMagicAgentAccessCheckerStub{
			accessibleCodes: map[string]struct{}{"SMA-001": {}},
		},
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	result, err := svc.SimilarityByAgent(context.Background(), &fragdto.AgentSimilarityInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
		AgentCode:        "SMA-001",
		Query:            "修复 package manage 页面报错",
	})
	if err != nil {
		t.Fatalf("similarity by agent failed: %v", err)
	}
	if result == nil || result.HitCount != 1 || len(result.Hits) != 1 {
		t.Fatalf("unexpected agent similarity result: %#v", result)
	}
	if result.Hits[0].KnowledgeBaseCode != testFragmentKnowledgeCode {
		t.Fatalf("expected only enabled knowledge base hit, got %#v", result.Hits)
	}
}

func TestFragmentAppServiceSimilarityByAgentReturnsEmptyWhenAllKnowledgeBasesDisabled(t *testing.T) {
	t.Parallel()

	kbReader := &fragmentAppKnowledgeReaderStub{}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: &fragmentAppFragmentServiceStub{},
		KBService:       kbReader,
		KnowledgeBaseBindingRepo: &fragmentAppKnowledgeBaseBindingReaderStub{
			knowledgeBaseCodes: []string{"KB1", "KB2"},
		},
		SuperMagicAgentAccess: &fragmentAppSuperMagicAgentAccessCheckerStub{
			accessibleCodes: map[string]struct{}{"SMA-001": {}},
		},
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	result, err := svc.SimilarityByAgent(context.Background(), &fragdto.AgentSimilarityInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
		AgentCode:        "SMA-001",
		Query:            "修复 package manage 页面报错",
	})
	if err != nil {
		t.Fatalf("similarity by agent failed: %v", err)
	}
	if result == nil {
		t.Fatal("expected empty result, got nil")
	}
	if result.HitCount != 0 || len(result.Hits) != 0 {
		t.Fatalf("expected no hits when all bound knowledge bases are disabled, got %#v", result)
	}
	if result.QueryUsed != "修复 package manage 页面报错" {
		t.Fatalf("expected query used to be preserved, got %#v", result)
	}
	if kbReader.lastListQuery == nil || kbReader.lastListQuery.Enabled == nil || !*kbReader.lastListQuery.Enabled {
		t.Fatalf("expected enabled-only list query, got %#v", kbReader.lastListQuery)
	}
}

func TestFragmentAppServiceSimilarityByAgentSanitizesMetadata(t *testing.T) {
	t.Parallel()

	kbList := []*kbentity.KnowledgeBase{
		{Code: "KB1", OrganizationCode: testFragmentOrganization, KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee, Model: "text-embedding-3-small"},
	}
	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResultsByKB: map[string][]*fragmodel.SimilarityResult{
			"KB1": {
				{
					FragmentID:    11,
					KnowledgeCode: "KB1",
					DocumentCode:  "DOC1",
					DocumentName:  "doc-1.md",
					DocumentType:  int(docentity.DocumentInputKindFile),
					Content:       "第一条命中",
					Score:         0.88,
					Metadata: map[string]any{
						"ext": map[string]any{"hidden": "value"},
					},
				},
			},
		},
	}
	kbReader := &fragmentAppKnowledgeReaderStub{
		listResult: kbList,
		listTotal:  int64(len(kbList)),
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService:       kbReader,
		KnowledgeBaseBindingRepo: &fragmentAppKnowledgeBaseBindingReaderStub{
			knowledgeBaseCodes: []string{"KB1"},
		},
		SuperMagicAgentAccess: &fragmentAppSuperMagicAgentAccessCheckerStub{
			accessibleCodes: map[string]struct{}{"SMA-001": {}},
		},
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	result, err := svc.SimilarityByAgent(context.Background(), &fragdto.AgentSimilarityInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "U1",
		AgentCode:        "SMA-001",
		Query:            "修复 package manage 页面报错",
	})
	if err != nil {
		t.Fatalf("similarity by agent failed: %v", err)
	}
	if result == nil || len(result.Hits) != 1 {
		t.Fatalf("unexpected agent similarity result: %#v", result)
	}
	assertFragmentMetadataSanitized(t, result.Hits[0].Metadata)
}

func TestFragmentAppServiceOperationErrors(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               1,
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
	}

	showSvc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: &fragmentAppFragmentServiceStub{showErr: errFragmentShowFailed},
	})
	if _, err := showSvc.Show(context.Background(), 1, testFragmentOrganization, "KB1", "DOC1"); !errors.Is(err, errFragmentShowFailed) {
		t.Fatalf("expected show error, got %v", err)
	}

	listSvc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: &fragmentAppFragmentServiceStub{listErr: errFragmentListFailed},
	})
	if _, err := listSvc.List(context.Background(), &fragdto.ListFragmentInput{}); !errors.Is(err, errFragmentListFailed) {
		t.Fatalf("expected list error, got %v", err)
	}

	destroyKBSvc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: &fragmentAppFragmentServiceStub{showResult: fragment},
		KBService:       &fragmentAppKnowledgeReaderStub{showErr: errFragmentKnowledgeFailed},
	})
	if err := destroyKBSvc.Destroy(context.Background(), 1, "KB1", "DOC1", testFragmentOrganization); !errors.Is(err, errFragmentKnowledgeFailed) {
		t.Fatalf("expected kb error, got %v", err)
	}

	destroySvc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: &fragmentAppFragmentServiceStub{
			showResult: fragment,
			destroyErr: errFragmentDestroyFailed,
		},
		KBService: &fragmentAppKnowledgeReaderStub{showResult: &kbentity.KnowledgeBase{Code: "KB1"}},
	})
	if err := destroySvc.Destroy(context.Background(), 1, "KB1", "DOC1", testFragmentOrganization); !errors.Is(err, errFragmentDestroyFailed) {
		t.Fatalf("expected destroy error, got %v", err)
	}
}

func TestFragmentAppServiceSync(t *testing.T) {
	t.Parallel()

	fragment := &fragmodel.KnowledgeBaseFragment{
		ID:               1,
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		DocumentCode:     "DOC1",
	}
	kb := &kbentity.KnowledgeBase{Code: "KB1", Model: "text-embedding-3-small"}
	fragmentSvc := &fragmentAppFragmentServiceStub{showResult: fragment}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService:       &fragmentAppKnowledgeReaderStub{showResult: kb},
	})

	dto, err := svc.Sync(context.Background(), &fragdto.SyncFragmentInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		FragmentID:       1,
	})
	if err != nil || dto == nil || fragmentSvc.syncedFragment != fragment {
		t.Fatalf("unexpected sync result dto=%#v err=%v", dto, err)
	}
	if fragmentSvc.syncedKnowledgeBase == nil || fragmentSvc.syncedKnowledgeBase.Code != kb.Code || fragmentSvc.syncedKnowledgeBase.Model != kb.Model {
		t.Fatalf("expected synced kb snapshot to carry code/model from %#v, got %#v", kb, fragmentSvc.syncedKnowledgeBase)
	}

	errorSvc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: &fragmentAppFragmentServiceStub{
			showResult: fragment,
			syncErr:    errFragmentSyncFailed,
		},
		KBService: &fragmentAppKnowledgeReaderStub{showResult: kb},
	})
	if _, err := errorSvc.Sync(context.Background(), &fragdto.SyncFragmentInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    "KB1",
		FragmentID:       1,
	}); !errors.Is(err, errFragmentSyncFailed) {
		t.Fatalf("expected sync error, got %v", err)
	}
}

func TestBuildSimilaritySearchOptionsForTest(t *testing.T) {
	t.Parallel()

	input := &fragdto.SimilarityInput{
		Query: "intro",
		Filters: &fragdto.SimilarityFilterInput{
			DocumentCodes: []string{"DOC1"},
			DocumentTypes: []int{2},
			SectionPaths:  []string{"A>B"},
			SectionLevels: []int{1},
			Tags:          []string{"tag-1"},
			TimeRange:     &fragdto.SimilarityTimeRangeInput{StartUnix: 10, EndUnix: 20},
		},
		Debug: true,
	}
	options := appservice.BuildSimilaritySearchOptionsForTest(input)
	if options == nil || !options.Debug || options.Filters == nil || options.Filters.TimeRange == nil {
		t.Fatalf("unexpected similarity options: %#v", options)
	}
	input.Filters.DocumentCodes[0] = "MUTATED"
	if options.Filters.DocumentCodes[0] != "DOC1" {
		t.Fatalf("expected copied document codes, got %#v", options.Filters.DocumentCodes)
	}
}

func TestFragmentAppServiceSimilarity(t *testing.T) {
	t.Parallel()

	for _, tc := range buildFragmentAppServiceSimilarityCases() {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			runFragmentAppServiceSimilarityCase(t, tc)
		})
	}
}

func TestFragmentAppServiceSimilarityAllowsDisabledKnowledgeBaseWhenExplicitlyScoped(t *testing.T) {
	t.Parallel()

	kb := &kbentity.KnowledgeBase{
		Code:              "KB1",
		OrganizationCode:  testFragmentOrganization,
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
		Enabled:           false,
		Model:             "text-embedding-3-small",
	}
	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResultsByKB: map[string][]*fragmodel.SimilarityResult{
			"KB1": {
				{FragmentID: 11, KnowledgeCode: "KB1", DocumentCode: "DOC1", DocumentName: "doc-1.md", DocumentType: int(docentity.DocumentInputKindFile), Content: "显式知识库召回命中", Score: 0.88},
			},
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService: &fragmentAppKnowledgeReaderStub{
			showByCodeAndOrgResult: kb,
		},
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	result, err := svc.Similarity(context.Background(), &fragdto.SimilarityInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    testFragmentKnowledgeCode,
		Query:            "hello",
	})
	if err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(result) != 1 || result[0].KnowledgeBaseCode != testFragmentKnowledgeCode {
		t.Fatalf("expected explicit knowledge base similarity to ignore enabled status, got %#v", result)
	}
}

func TestFragmentAppServiceSimilarityAuthorizesByBoundAccessibleAgent(t *testing.T) {
	t.Parallel()

	fragmentSvc, bindingRepo, agentAccess, svc := newSimilarityAuthorizationTestService(t, similarityAuthorizationTestDeps{
		bindIDs:         []string{"AGENT-1"},
		accessibleCodes: map[string]struct{}{"AGENT-1": {}},
		permissionReader: fragmentPermissionReaderStub{
			err: errFragmentKnowledgeFailed,
		},
	})

	results, err := svc.Similarity(context.Background(), similarityAuthorizationInput())
	if err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(results) != 1 || results[0].KnowledgeBaseCode != testFragmentKnowledgeCode {
		t.Fatalf("unexpected similarity results: %#v", results)
	}
	if bindingRepo.lastOrganizationCode != testFragmentOrganization ||
		bindingRepo.lastKnowledgeBaseCode != testFragmentKnowledgeCode ||
		bindingRepo.lastBindIDsBindType != kbentity.BindingTypeSuperMagicAgent {
		t.Fatalf("expected organization-scoped binding lookup, got %#v", bindingRepo)
	}
	if agentAccess.lastOrg != testFragmentOrganization || agentAccess.lastUserID != "U1" || !slices.Equal(agentAccess.lastCodes, []string{"AGENT-1"}) {
		t.Fatalf("unexpected agent access check: %#v", agentAccess)
	}
	if fragmentSvc.lastSimilarityReq.Query != "intro" {
		t.Fatalf("expected similarity search to run, got %#v", fragmentSvc.lastSimilarityReq)
	}
}

func TestFragmentAppServiceSimilarityRejectsInaccessibleBoundAgent(t *testing.T) {
	t.Parallel()

	_, _, _, svc := newSimilarityAuthorizationTestService(t, similarityAuthorizationTestDeps{
		bindIDs:         []string{"AGENT-1"},
		accessibleCodes: map[string]struct{}{},
		permissionReader: fragmentPermissionReaderStub{
			operations: map[string]string{testFragmentKnowledgeCode: "read"},
		},
	})

	_, err := svc.Similarity(context.Background(), similarityAuthorizationInput())
	if !errors.Is(err, appservice.ErrFragmentPermissionDenied) {
		t.Fatalf("expected permission denied, got %v", err)
	}
}

func TestFragmentAppServiceSimilarityAllowsAnyAccessibleBoundAgent(t *testing.T) {
	t.Parallel()

	_, _, agentAccess, svc := newSimilarityAuthorizationTestService(t, similarityAuthorizationTestDeps{
		bindIDs:         []string{"AGENT-1", "AGENT-2"},
		accessibleCodes: map[string]struct{}{"AGENT-2": {}},
		permissionReader: fragmentPermissionReaderStub{
			err: errFragmentKnowledgeFailed,
		},
	})

	if _, err := svc.Similarity(context.Background(), similarityAuthorizationInput()); err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if !slices.Equal(agentAccess.lastCodes, []string{"AGENT-1", "AGENT-2"}) {
		t.Fatalf("expected all bound agents to be checked, got %#v", agentAccess.lastCodes)
	}
}

func TestFragmentAppServiceSimilarityFallsBackToKnowledgeReadWithoutAgentBinding(t *testing.T) {
	t.Parallel()

	_, _, agentAccess, svc := newSimilarityAuthorizationTestService(t, similarityAuthorizationTestDeps{
		permissionReader: fragmentPermissionReaderStub{
			operations: map[string]string{testFragmentKnowledgeCode: "read"},
		},
	})

	if _, err := svc.Similarity(context.Background(), similarityAuthorizationInput()); err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(agentAccess.lastCodes) != 0 {
		t.Fatalf("expected no agent access check without binding, got %#v", agentAccess.lastCodes)
	}
}

func TestFragmentAppServiceSimilarityDoesNotUseOtherOrganizationBinding(t *testing.T) {
	t.Parallel()

	bindingRepo := &fragmentAppKnowledgeBaseBindingReaderStub{
		bindIDsByOrganization: map[string][]string{
			"ORG-OTHER": {"AGENT-1"},
		},
	}
	fragmentSvc, _, agentAccess, svc := newSimilarityAuthorizationTestService(t, similarityAuthorizationTestDeps{
		bindingRepo: bindingRepo,
		permissionReader: fragmentPermissionReaderStub{
			operations: map[string]string{},
		},
		accessibleCodes: map[string]struct{}{"AGENT-1": {}},
	})

	_, err := svc.Similarity(context.Background(), similarityAuthorizationInput())
	if !errors.Is(err, appservice.ErrFragmentPermissionDenied) {
		t.Fatalf("expected permission denied, got %v", err)
	}
	if bindingRepo.lastOrganizationCode != testFragmentOrganization {
		t.Fatalf("expected binding lookup to use current organization, got %q", bindingRepo.lastOrganizationCode)
	}
	if len(agentAccess.lastCodes) != 0 {
		t.Fatalf("expected other organization binding not to trigger agent access check, got %#v", agentAccess.lastCodes)
	}
	if fragmentSvc.lastSimilarityReq.Query != "" {
		t.Fatalf("expected similarity search not to run, got %#v", fragmentSvc.lastSimilarityReq)
	}
}

type fragmentAppServiceSimilarityCase struct {
	name                    string
	query                   string
	inputTopK               int
	inputThreshold          float64
	kbRetrieveConfig        *shared.RetrieveConfig
	expectedTopK            int
	expectedCandidateThresh float64
	expectedResultThreshold float64
}

type similarityAuthorizationTestDeps struct {
	bindingRepo      *fragmentAppKnowledgeBaseBindingReaderStub
	bindIDs          []string
	accessibleCodes  map[string]struct{}
	permissionReader fragmentPermissionReaderStub
}

func newSimilarityAuthorizationTestService(
	t *testing.T,
	deps similarityAuthorizationTestDeps,
) (
	*fragmentAppFragmentServiceStub,
	*fragmentAppKnowledgeBaseBindingReaderStub,
	*fragmentAppSuperMagicAgentAccessCheckerStub,
	*appservice.FragmentAppService,
) {
	t.Helper()

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResults: []*fragmodel.SimilarityResult{{
			FragmentID:    42,
			KnowledgeCode: testFragmentKnowledgeCode,
			DocumentCode:  "DOC1",
			DocumentName:  "Document 1",
			DocumentType:  int(docentity.DocumentInputKindFile),
			Content:       "hello similarity",
			Score:         0.88,
		}},
	}
	bindingRepo := deps.bindingRepo
	if bindingRepo == nil {
		bindingRepo = &fragmentAppKnowledgeBaseBindingReaderStub{bindIDs: deps.bindIDs}
	}
	agentAccess := &fragmentAppSuperMagicAgentAccessCheckerStub{accessibleCodes: deps.accessibleCodes}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService: &fragmentAppKnowledgeReaderStub{
			showByCodeAndOrgResult: &kbentity.KnowledgeBase{
				Code:             testFragmentKnowledgeCode,
				OrganizationCode: testFragmentOrganization,
				Model:            "text-embedding-3-small",
			},
		},
		KnowledgeBaseBindingRepo: bindingRepo,
		SuperMagicAgentAccess:    agentAccess,
		PermissionReader:         deps.permissionReader,
		DefaultEmbeddingModel:    "text-embedding-3-small",
	})
	return fragmentSvc, bindingRepo, agentAccess, svc
}

func similarityAuthorizationInput() *fragdto.SimilarityInput {
	return &fragdto.SimilarityInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    testFragmentKnowledgeCode,
		Query:            "intro",
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: testFragmentOrganization,
			UserID:           "U1",
		},
	}
}

func buildFragmentAppServiceSimilarityCases() []fragmentAppServiceSimilarityCase {
	return []fragmentAppServiceSimilarityCase{
		{
			name:                    "explicit threshold above shared minimum is used directly",
			query:                   "intro",
			inputThreshold:          0.72,
			expectedTopK:            10,
			expectedCandidateThresh: 0.1,
			expectedResultThreshold: 0.72,
		},
		{
			name:                    "explicit threshold below shared minimum is raised",
			query:                   "这是一个用于验证中等长度查询会命中 normal 阈值的测试语句，长度会超过三十二个字符",
			inputThreshold:          0.1,
			expectedTopK:            10,
			expectedCandidateThresh: 0.1,
			expectedResultThreshold: 0.25,
		},
		{
			name:                    "zero input threshold applies shared minimum",
			query:                   strings.Repeat("这是一个用于验证长查询阈值分档的测试语句，会持续补充背景说明和上下文信息。", 4),
			inputThreshold:          0,
			expectedTopK:            10,
			expectedCandidateThresh: 0.1,
			expectedResultThreshold: 0.25,
		},
		{
			name:                    "negative input threshold applies shared minimum",
			query:                   "短问题",
			inputThreshold:          -1,
			expectedTopK:            10,
			expectedCandidateThresh: 0.1,
			expectedResultThreshold: 0.25,
		},
		{
			name:  "knowledge base retrieve config threshold above shared minimum is used directly when enabled",
			query: "问题 1",
			kbRetrieveConfig: &shared.RetrieveConfig{
				TopK:                  3,
				ScoreThreshold:        0.72,
				ScoreThresholdEnabled: true,
			},
			expectedTopK:            10,
			expectedCandidateThresh: 0.1,
			expectedResultThreshold: 0.72,
		},
		{
			name:  "knowledge base retrieve config raises topk above default with shared minimum threshold",
			query: "问题 1",
			kbRetrieveConfig: &shared.RetrieveConfig{
				TopK: 20,
			},
			expectedTopK:            20,
			expectedCandidateThresh: 0.1,
			expectedResultThreshold: 0.25,
		},
		{
			name:      "external topk keeps precedence before max with shared minimum threshold",
			query:     "问题 1",
			inputTopK: 5,
			kbRetrieveConfig: &shared.RetrieveConfig{
				TopK: 30,
			},
			expectedTopK:            10,
			expectedCandidateThresh: 0.1,
			expectedResultThreshold: 0.25,
		},
		{
			name:  "knowledge base threshold below shared minimum is raised",
			query: "intro",
			kbRetrieveConfig: &shared.RetrieveConfig{
				ScoreThreshold:        0.2,
				ScoreThresholdEnabled: true,
			},
			expectedTopK:            10,
			expectedCandidateThresh: 0.1,
			expectedResultThreshold: 0.25,
		},
	}
}

func runFragmentAppServiceSimilarityCase(t *testing.T, tc fragmentAppServiceSimilarityCase) {
	t.Helper()

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResults: buildSimilarityResultsForTest(),
	}
	docSvc := &fragmentAppDocumentReaderStub{
		showResult: &docentity.KnowledgeBaseDocument{Name: "Document 1", DocType: int(docentity.DocumentInputKindFile)},
	}
	sourceType := int(kbentity.SourceTypeEnterpriseWiki)
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService: &fragmentAppKnowledgeReaderStub{showResult: &kbentity.KnowledgeBase{
			Code:              "KB1",
			KnowledgeBaseType: kbentity.KnowledgeBaseTypeDigitalEmployee,
			SourceType:        &sourceType,
			RetrieveConfig:    tc.kbRetrieveConfig,
		}},
		DocumentService:       docSvc,
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	results, err := svc.Similarity(context.Background(), &fragdto.SimilarityInput{
		KnowledgeCode:  "KB1",
		Query:          tc.query,
		TopK:           tc.inputTopK,
		ScoreThreshold: tc.inputThreshold,
		Filters:        buildSimilarityFiltersForTest(),
		Debug:          true,
	})
	if err != nil || len(results) != 1 {
		t.Fatalf("unexpected similarity results=%#v err=%v", results, err)
	}
	if fragmentSvc.lastSimilarityReq.TopK != tc.expectedTopK ||
		fragmentSvc.lastSimilarityReq.CandidateScoreThreshold != tc.expectedCandidateThresh ||
		fragmentSvc.lastSimilarityReq.ResultScoreThreshold != tc.expectedResultThreshold {
		t.Fatalf("unexpected similarity request: %#v", fragmentSvc.lastSimilarityReq)
	}
	if results[0].DocumentName != "Document 1" || results[0].DocumentType != int(docentity.DocumentInputKindFile) {
		t.Fatalf("unexpected similarity dto: %#v", results[0])
	}
	if results[0].ID != 42 || results[0].KnowledgeBaseCode != "KB1" || results[0].DocType != results[0].DocumentType {
		t.Fatalf("unexpected similarity compat fields: %#v", results[0])
	}
	if results[0].KnowledgeBaseType != string(kbentity.KnowledgeBaseTypeDigitalEmployee) ||
		results[0].SourceType == nil ||
		*results[0].SourceType != int(kbentity.SourceTypeEnterpriseWiki) {
		t.Fatalf("expected similarity dto to carry knowledge base source context, got %#v", results[0])
	}
}

func buildSimilarityFiltersForTest() *fragdto.SimilarityFilterInput {
	return &fragdto.SimilarityFilterInput{
		DocumentCodes: []string{"DOC1"},
		DocumentTypes: []int{2},
		SectionPaths:  []string{"A>B"},
		SectionLevels: []int{1},
		Tags:          []string{"tag-1"},
		TimeRange:     &fragdto.SimilarityTimeRangeInput{StartUnix: 10, EndUnix: 20},
	}
}

func buildSimilarityResultsForTest() []*fragmodel.SimilarityResult {
	return []*fragmodel.SimilarityResult{
		{
			FragmentID:    42,
			Content:       "hello similarity",
			Score:         0.88,
			Metadata:      map[string]any{"section_title": "Intro"},
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
		},
	}
}

func assertFragmentMetadataSanitized(t *testing.T, metadata map[string]any) {
	t.Helper()

	if metadata == nil {
		t.Fatal("expected metadata")
	}
	if _, exists := metadata["ext"]; exists {
		t.Fatalf("expected metadata.ext to be removed, got %#v", metadata)
	}
	if _, exists := metadata["metadata_contract_version"]; exists {
		t.Fatalf("expected metadata.metadata_contract_version to be removed, got %#v", metadata)
	}
}

func TestFragmentAppServiceSimilaritySkipsPointLookupWhenResultAlreadyHasFragmentFields(t *testing.T) {
	t.Parallel()

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResults: []*fragmodel.SimilarityResult{
			{
				FragmentID:    42,
				BusinessID:    testSimilarityBusinessID,
				Content:       "hello similarity",
				Score:         0.88,
				Metadata:      map[string]any{"point_id": "POINT-42", "section_title": "Intro"},
				KnowledgeCode: "KB1",
				DocumentCode:  "DOC1",
				DocumentName:  "Document 1",
				DocumentType:  int(docentity.DocumentInputKindFile),
			},
		},
	}
	kbReader := &fragmentAppKnowledgeReaderStub{
		showResult: &kbentity.KnowledgeBase{Code: "KB1"},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:       fragmentSvc,
		KBService:             kbReader,
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	results, err := svc.Similarity(context.Background(), &fragdto.SimilarityInput{
		KnowledgeCode: "KB1",
		Query:         "intro",
	})
	if err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %#v", results)
	}
	if results[0].ID != 42 || results[0].BusinessID != testSimilarityBusinessID {
		t.Fatalf("expected domain-backfilled fields to be preserved, got %#v", results[0])
	}
	if len(fragmentSvc.lastPointIDs) != 0 {
		t.Fatalf("expected app fallback point lookup to be skipped, got %#v", fragmentSvc.lastPointIDs)
	}
	if fragmentSvc.lastSetPayloadCollection != "" {
		t.Fatalf("expected payload repair to stay disabled, got %q", fragmentSvc.lastSetPayloadCollection)
	}
	if results[0].Metadata["fragment_id"] != int64(42) || results[0].Metadata["business_id"] != testSimilarityBusinessID {
		t.Fatalf("expected metadata to be synced from existing result fields, got %#v", results[0].Metadata)
	}
}

func TestFragmentAppServiceSimilarityBackfillsViaPointIDsWithoutPayloadRepair(t *testing.T) {
	t.Parallel()

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResults: []*fragmodel.SimilarityResult{{
			Content:       "hello similarity",
			Score:         0.88,
			Metadata:      map[string]any{"point_id": "POINT-88", "section_title": "Intro"},
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			DocumentName:  "Document 1",
			DocumentType:  int(docentity.DocumentInputKindFile),
		}},
		findByPointResults: []*fragmodel.KnowledgeBaseFragment{{
			ID:            88,
			PointID:       "POINT-88",
			BusinessID:    testBackfillBusinessID,
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
		}},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:       fragmentSvc,
		KBService:             &fragmentAppKnowledgeReaderStub{showResult: &kbentity.KnowledgeBase{Code: "KB1"}},
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	results, err := svc.Similarity(context.Background(), &fragdto.SimilarityInput{
		KnowledgeCode: "KB1",
		Query:         "intro",
	})
	if err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %#v", results)
	}
	if results[0].ID != 88 || results[0].BusinessID != testBackfillBusinessID {
		t.Fatalf("expected point-id backfill result, got %#v", results[0])
	}
	if !slices.Equal(fragmentSvc.lastPointIDs, []string{"POINT-88"}) {
		t.Fatalf("unexpected point lookup batch: %#v", fragmentSvc.lastPointIDs)
	}
	if results[0].Metadata["fragment_id"] != int64(88) || results[0].Metadata["business_id"] != testBackfillBusinessID {
		t.Fatalf("expected metadata to be synced after point-id backfill, got %#v", results[0].Metadata)
	}
	if fragmentSvc.lastSetPayloadCollection != "" || len(fragmentSvc.lastSetPayloadUpdates) != 0 {
		t.Fatalf("expected point-id backfill to avoid payload writeback, got collection=%q updates=%#v", fragmentSvc.lastSetPayloadCollection, fragmentSvc.lastSetPayloadUpdates)
	}
}

func TestFragmentAppServiceSimilarityBackfillDoesNotAttemptPayloadRepair(t *testing.T) {
	t.Parallel()

	var logBuf bytes.Buffer
	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResults: []*fragmodel.SimilarityResult{{
			Content:       "hello similarity",
			Score:         0.88,
			Metadata:      map[string]any{"point_id": "POINT-99", "section_title": "Intro"},
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			DocumentName:  "Document 1",
			DocumentType:  int(docentity.DocumentInputKindFile),
		}},
		findByPointResults: []*fragmodel.KnowledgeBaseFragment{{
			ID:            99,
			PointID:       "POINT-99",
			BusinessID:    "BIZ-99",
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
		}},
		setPayloadErr: errPayloadRepairFailed,
	}
	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevelInfo,
		Format: autoloadcfg.LogFormatJSON,
	}, &logBuf)
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:       fragmentSvc,
		KBService:             &fragmentAppKnowledgeReaderStub{showResult: &kbentity.KnowledgeBase{Code: "KB1"}},
		DefaultEmbeddingModel: "text-embedding-3-small",
		Logger:                logger,
	})

	results, err := svc.Similarity(context.Background(), &fragdto.SimilarityInput{
		KnowledgeCode: "KB1",
		Query:         "intro",
	})
	if err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(results) != 1 || results[0].ID != 99 || results[0].BusinessID != "BIZ-99" {
		t.Fatalf("expected similarity result to succeed without payload writeback, got %#v", results)
	}
	if strings.Contains(logBuf.String(), "Repair similarity payload fields failed") {
		t.Fatalf("expected no payload repair warning, got %s", logBuf.String())
	}
	if fragmentSvc.lastSetPayloadCollection != "" || len(fragmentSvc.lastSetPayloadUpdates) != 0 {
		t.Fatalf("expected no payload writeback attempt, got collection=%q updates=%#v", fragmentSvc.lastSetPayloadCollection, fragmentSvc.lastSetPayloadUpdates)
	}
}

func TestFragmentAppServiceSimilaritySkipsPayloadRepairWhenPointBackfillMisses(t *testing.T) {
	t.Parallel()

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResults: []*fragmodel.SimilarityResult{{
			Content:       "hello similarity",
			Score:         0.88,
			Metadata:      map[string]any{"point_id": "POINT-MISS", "section_title": "Intro"},
			KnowledgeCode: "KB1",
			DocumentCode:  "DOC1",
			DocumentName:  "Document 1",
			DocumentType:  int(docentity.DocumentInputKindFile),
		}},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:       fragmentSvc,
		KBService:             &fragmentAppKnowledgeReaderStub{showResult: &kbentity.KnowledgeBase{Code: "KB1"}},
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	results, err := svc.Similarity(context.Background(), &fragdto.SimilarityInput{
		KnowledgeCode: "KB1",
		Query:         "intro",
	})
	if err != nil {
		t.Fatalf("similarity failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one similarity result, got %#v", results)
	}
	if results[0].ID != 0 || results[0].BusinessID != "" {
		t.Fatalf("expected missing point lookup to leave result fields untouched, got %#v", results[0])
	}
	if _, ok := results[0].Metadata["fragment_id"]; ok {
		t.Fatalf("expected missing point lookup not to fabricate metadata, got %#v", results[0].Metadata)
	}
	if !slices.Equal(fragmentSvc.lastPointIDs, []string{"POINT-MISS"}) {
		t.Fatalf("unexpected point lookup batch: %#v", fragmentSvc.lastPointIDs)
	}
	if fragmentSvc.lastSetPayloadCollection != "" || len(fragmentSvc.lastSetPayloadUpdates) != 0 {
		t.Fatalf("expected no payload repair update for missing point lookup, got collection=%q updates=%#v", fragmentSvc.lastSetPayloadCollection, fragmentSvc.lastSetPayloadUpdates)
	}
}

func TestFragmentEntityToDTOForTest(t *testing.T) {
	t.Parallel()

	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{})
	entityDTO := appservice.FragmentEntityToDTOForTest(svc, &fragmodel.KnowledgeBaseFragment{
		ID:           99,
		CreatedUID:   "creator-uid",
		UpdatedUID:   "modifier-uid",
		Content:      "manual content",
		Metadata:     map[string]any{"section_title": "Title"},
		SectionPath:  "A>B",
		SectionTitle: "Title",
	})
	if entityDTO == nil || entityDTO.ID != 99 || entityDTO.Content == "" {
		t.Fatalf("unexpected entity dto: %#v", entityDTO)
	}
	if entityDTO.Creator != "creator-uid" || entityDTO.Modifier != "modifier-uid" {
		t.Fatalf("unexpected creator/modifier mapping: %#v", entityDTO)
	}
}

func TestFragmentAppServiceSimilarityError(t *testing.T) {
	t.Parallel()

	errorSvc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: &fragmentAppFragmentServiceStub{
			similarityErr: errFragmentSimilarityFailed,
		},
		KBService: &fragmentAppKnowledgeReaderStub{showResult: &kbentity.KnowledgeBase{Code: "KB1"}},
	})
	if _, err := errorSvc.Similarity(context.Background(), &fragdto.SimilarityInput{
		KnowledgeCode: "KB1",
		Query:         "intro",
	}); !errors.Is(err, errFragmentSimilarityFailed) {
		t.Fatalf("expected similarity error, got %v", err)
	}
}

func TestFragmentAppServiceRuntimeSimilaritySupportsExplicitZeroThreshold(t *testing.T) {
	t.Parallel()

	zeroThreshold := 0.0
	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResultsByKB: map[string][]*fragmodel.SimilarityResult{
			testFragmentKnowledgeCode: {
				{
					FragmentID:    41,
					KnowledgeCode: testFragmentKnowledgeCode,
					DocumentCode:  "DOC1",
					DocumentName:  "doc-1.md",
					DocumentType:  int(docentity.DocumentInputKindFile),
					Content:       "zero threshold",
					Score:         0.61,
				},
			},
		},
	}
	kbReader := &fragmentAppKnowledgeReaderStub{
		showByCodeAndOrgErr: errFragmentKnowledgeFailed,
		listResult: []*kbentity.KnowledgeBase{{
			Code:             testFragmentKnowledgeCode,
			OrganizationCode: testFragmentOrganization,
			Enabled:          true,
			Model:            "text-embedding-3-small",
			RetrieveConfig: &shared.RetrieveConfig{
				TopK:                  4,
				ScoreThreshold:        0.72,
				ScoreThresholdEnabled: true,
			},
		}},
		listTotal: 1,
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:       fragmentSvc,
		KBService:             kbReader,
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	results, err := svc.RuntimeSimilarity(context.Background(), &fragdto.RuntimeSimilarityInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCodes:   []string{testFragmentKnowledgeCode},
		Query:            "keyword",
		ScoreThreshold:   &zeroThreshold,
	})
	if err != nil {
		t.Fatalf("runtime similarity failed: %v", err)
	}
	if len(results) != 1 {
		t.Fatalf("expected one runtime similarity result, got %#v", results)
	}
	if fragmentSvc.lastSimilarityReq.ResultScoreThreshold != 0 {
		t.Fatalf("expected explicit zero threshold to be forwarded, got %#v", fragmentSvc.lastSimilarityReq)
	}
}

func TestFragmentAppServiceRuntimeSimilarityDoesNotReadUserKnowledgePermission(t *testing.T) {
	t.Parallel()

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResultsByKB: map[string][]*fragmodel.SimilarityResult{
			testFragmentKnowledgeCode: {{
				FragmentID:    41,
				KnowledgeCode: testFragmentKnowledgeCode,
				DocumentCode:  "DOC1",
				DocumentName:  "doc-1.md",
				DocumentType:  int(docentity.DocumentInputKindFile),
				Content:       "runtime trust upstream binding",
				Score:         0.61,
			}},
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService: fragmentSvc,
		KBService: &fragmentAppKnowledgeReaderStub{
			showByCodeAndOrgResult: &kbentity.KnowledgeBase{
				Code:             testFragmentKnowledgeCode,
				OrganizationCode: testFragmentOrganization,
				Enabled:          true,
				Model:            "text-embedding-3-small",
			},
		},
		PermissionReader: fragmentPermissionReaderStub{
			err: errFragmentKnowledgeFailed,
		},
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	results, err := svc.RuntimeSimilarity(context.Background(), &fragdto.RuntimeSimilarityInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCodes:   []string{testFragmentKnowledgeCode},
		Query:            "keyword",
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: testFragmentOrganization,
			UserID:           "U1",
		},
	})
	if err != nil {
		t.Fatalf("runtime similarity failed: %v", err)
	}
	if len(results) != 1 || results[0].KnowledgeCode != testFragmentKnowledgeCode {
		t.Fatalf("unexpected runtime similarity results: %#v", results)
	}
}

func TestFragmentAppServiceRuntimeSimilarityLoadsKnowledgeBasesInBatch(t *testing.T) {
	t.Parallel()

	fragmentSvc, kbReader := newRuntimeSimilarityBatchTestDeps()
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:       fragmentSvc,
		KBService:             kbReader,
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	results, err := svc.RuntimeSimilarity(context.Background(), &fragdto.RuntimeSimilarityInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCodes:   []string{testFragmentKnowledgeCode, "KB2"},
		Query:            "keyword",
	})
	if err != nil {
		t.Fatalf("runtime similarity failed: %v", err)
	}
	if len(results) != 2 {
		t.Fatalf("expected two runtime similarity results, got %#v", results)
	}
	if fragmentSvc.lastSimilarityReq.ResultScoreThreshold != 0 {
		t.Fatalf("expected runtime similarity to use default zero threshold when not explicitly provided, got %#v", fragmentSvc.lastSimilarityReq)
	}
	if kbReader.lastListQuery == nil {
		t.Fatal("expected runtime similarity to list knowledge bases in batch")
	}
	if kbReader.lastListQuery.OrganizationCode != testFragmentOrganization ||
		!slices.Equal(kbReader.lastListQuery.Codes, []string{testFragmentKnowledgeCode, "KB2"}) ||
		kbReader.lastListQuery.Limit != 2 {
		t.Fatalf("unexpected batch knowledge base query: %#v", kbReader.lastListQuery)
	}
	if results[0].KnowledgeCode != testFragmentKnowledgeCode || results[1].KnowledgeCode != "KB2" {
		t.Fatalf("expected runtime similarity results to preserve knowledge base order, got %#v", results)
	}
	assertRuntimeSimilaritySourceContext(t, results)
}

func newRuntimeSimilarityBatchTestDeps() (*fragmentAppFragmentServiceStub, *fragmentAppKnowledgeReaderStub) {
	enterpriseSourceType := int(kbentity.SourceTypeLegacyEnterpriseWiki)
	localSourceType := int(kbentity.SourceTypeLocalFile)
	return &fragmentAppFragmentServiceStub{
			similarityResultsByKB: map[string][]*fragmodel.SimilarityResult{
				testFragmentKnowledgeCode: {{
					FragmentID:    11,
					KnowledgeCode: testFragmentKnowledgeCode,
					DocumentCode:  "DOC1",
					DocumentName:  "doc-1.md",
					DocumentType:  int(docentity.DocumentInputKindFile),
					Content:       "alpha",
					Score:         0.91,
				}},
				"KB2": {{
					FragmentID:    12,
					KnowledgeCode: "KB2",
					DocumentCode:  "DOC2",
					DocumentName:  "doc-2.md",
					DocumentType:  int(docentity.DocumentInputKindFile),
					Content:       "beta",
					Score:         0.82,
				}},
			},
		}, &fragmentAppKnowledgeReaderStub{
			showByCodeAndOrgErr: errFragmentKnowledgeFailed,
			listResult: []*kbentity.KnowledgeBase{
				runtimeSimilarityBatchKnowledgeBase("KB2", &localSourceType, nil),
				runtimeSimilarityBatchKnowledgeBase(testFragmentKnowledgeCode, &enterpriseSourceType, &shared.RetrieveConfig{TopK: 3}),
			},
			listTotal: 2,
		}
}

func runtimeSimilarityBatchKnowledgeBase(
	code string,
	sourceType *int,
	retrieveConfig *shared.RetrieveConfig,
) *kbentity.KnowledgeBase {
	return &kbentity.KnowledgeBase{
		Code:              code,
		OrganizationCode:  testFragmentOrganization,
		KnowledgeBaseType: kbentity.KnowledgeBaseTypeFlowVector,
		SourceType:        sourceType,
		Enabled:           true,
		Model:             "text-embedding-3-small",
		RetrieveConfig:    retrieveConfig,
	}
}

func assertRuntimeSimilaritySourceContext(t *testing.T, results []*fragdto.SimilarityResultDTO) {
	t.Helper()

	if results[0].KnowledgeBaseType != string(kbentity.KnowledgeBaseTypeFlowVector) ||
		results[0].SourceType == nil ||
		*results[0].SourceType != int(kbentity.SourceTypeLegacyEnterpriseWiki) ||
		results[1].SourceType == nil ||
		*results[1].SourceType != int(kbentity.SourceTypeLocalFile) {
		t.Fatalf("expected runtime similarity results to carry source context, got %#v", results)
	}
}

func TestFragmentAppServiceRuntimeSimilarityFallsBackToSingleKnowledgeBaseLoad(t *testing.T) {
	t.Parallel()

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResultsByKB: map[string][]*fragmodel.SimilarityResult{
			testFragmentKnowledgeCode: {
				{
					FragmentID:    1,
					KnowledgeCode: testFragmentKnowledgeCode,
					DocumentCode:  "DOC-1",
					DocumentName:  "Doc 1",
					DocumentType:  1,
					Content:       "matched",
					Score:         0.9,
				},
			},
		},
	}
	kbReader := &fragmentAppKnowledgeReaderStub{
		listResult: []*kbentity.KnowledgeBase{
			{
				Code:             "KB-OTHER",
				OrganizationCode: testFragmentOrganization,
				Enabled:          true,
				Model:            "text-embedding-3-small",
			},
		},
		listTotal: 1,
		showByCodeAndOrgResult: &kbentity.KnowledgeBase{
			Code:             testFragmentKnowledgeCode,
			OrganizationCode: testFragmentOrganization,
			Enabled:          true,
			Model:            "text-embedding-3-small",
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:       fragmentSvc,
		KBService:             kbReader,
		DefaultEmbeddingModel: "text-embedding-3-small",
	})

	results, err := svc.RuntimeSimilarity(context.Background(), &fragdto.RuntimeSimilarityInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCodes:   []string{testFragmentKnowledgeCode},
		Query:            "keyword",
	})
	if err != nil {
		t.Fatalf("runtime similarity failed: %v", err)
	}
	if len(results) != 1 || results[0].KnowledgeCode != testFragmentKnowledgeCode {
		t.Fatalf("expected runtime similarity to fall back to single knowledge base load, got %#v", results)
	}
}

func TestFragmentAppServiceRuntimeSimilarityResolvesTeamshareTempCode(t *testing.T) {
	t.Parallel()

	const (
		tempKnowledgeCode = "KB-TEMP"
		realKnowledgeCode = "KB-REAL"
		teamshareBusiness = "TS-KB-1"
	)

	fragmentSvc := &fragmentAppFragmentServiceStub{
		similarityResultsByKB: map[string][]*fragmodel.SimilarityResult{
			realKnowledgeCode: {{
				FragmentID:    31,
				KnowledgeCode: realKnowledgeCode,
				DocumentCode:  "DOC-REAL",
				DocumentName:  "real-doc.md",
				DocumentType:  1,
				Content:       "resolved from temp code",
				Score:         0.88,
			}},
		},
	}
	kbReader := &fragmentAppKnowledgeReaderStub{
		filterListByQuery: true,
		listResult: []*kbentity.KnowledgeBase{{
			Code:             realKnowledgeCode,
			BusinessID:       teamshareBusiness,
			OrganizationCode: testFragmentOrganization,
			Enabled:          true,
			Model:            "text-embedding-3-small",
		}},
	}
	teamshareMapper := &fragmentAppTeamshareTempCodeMapperStub{
		businessIDsByCode: map[string]string{
			tempKnowledgeCode: teamshareBusiness,
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:         fragmentSvc,
		KBService:               kbReader,
		TeamshareTempCodeMapper: teamshareMapper,
		DefaultEmbeddingModel:   "text-embedding-3-small",
	})

	results, err := svc.RuntimeSimilarity(context.Background(), &fragdto.RuntimeSimilarityInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCodes:   []string{tempKnowledgeCode},
		Query:            "keyword",
	})
	if err != nil {
		t.Fatalf("runtime similarity failed: %v", err)
	}
	if len(results) != 1 || results[0].KnowledgeCode != realKnowledgeCode {
		t.Fatalf("expected runtime similarity to resolve temp code to real knowledge base, got %#v", results)
	}
	if !slices.Equal(teamshareMapper.lastLookupCodes, []string{tempKnowledgeCode}) {
		t.Fatalf("expected temp code lookup, got %#v", teamshareMapper.lastLookupCodes)
	}
	if kbReader.lastListQuery == nil || !slices.Equal(kbReader.lastListQuery.BusinessIDs, []string{teamshareBusiness}) {
		t.Fatalf("expected business-id fallback query, got %#v", kbReader.lastListQuery)
	}
}

func TestFragmentAppServiceRuntimeCreateResolvesTeamshareTempCode(t *testing.T) {
	t.Parallel()

	const (
		tempKnowledgeCode = "KB-TEMP"
		realKnowledgeCode = "KB-REAL"
		teamshareBusiness = "TS-KB-1"
	)

	fragmentSvc := &fragmentAppFragmentServiceStub{}
	documentSvc := &fragmentAppDocumentReaderStub{
		ensureResult: &docentity.KnowledgeBaseDocument{
			Code:              "DOC-REAL",
			Name:              "default",
			DocType:           int(docentity.DocumentInputKindText),
			OrganizationCode:  testFragmentOrganization,
			KnowledgeBaseCode: realKnowledgeCode,
		},
	}
	kbReader := &fragmentAppKnowledgeReaderStub{
		filterListByQuery:   true,
		showByCodeAndOrgErr: shared.ErrKnowledgeBaseNotFound,
		listResult: []*kbentity.KnowledgeBase{{
			Code:             realKnowledgeCode,
			BusinessID:       teamshareBusiness,
			OrganizationCode: testFragmentOrganization,
			Enabled:          true,
			Model:            "text-embedding-3-small",
		}},
	}
	teamshareMapper := &fragmentAppTeamshareTempCodeMapperStub{
		businessIDsByCode: map[string]string{
			tempKnowledgeCode: teamshareBusiness,
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:         fragmentSvc,
		DocumentService:         documentSvc,
		KBService:               kbReader,
		TeamshareTempCodeMapper: teamshareMapper,
		DefaultEmbeddingModel:   "text-embedding-3-small",
	})

	dto, err := svc.RuntimeCreate(context.Background(), &fragdto.RuntimeCreateFragmentInput{
		OrganizationCode: testFragmentOrganization,
		UserID:           "user-1",
		KnowledgeCode:    tempKnowledgeCode,
		Content:          "runtime fragment",
		BusinessID:       "BIZ-1",
	})
	if err != nil {
		t.Fatalf("runtime create failed: %v", err)
	}
	if dto == nil || dto.KnowledgeCode != realKnowledgeCode {
		t.Fatalf("expected runtime create dto to use real knowledge code, got %#v", dto)
	}
	if fragmentSvc.savedFragment == nil || fragmentSvc.savedFragment.KnowledgeCode != realKnowledgeCode {
		t.Fatalf("expected persisted fragment to use real knowledge code, got %#v", fragmentSvc.savedFragment)
	}
	if fragmentSvc.syncedFragment == nil || fragmentSvc.syncedFragment.KnowledgeCode != realKnowledgeCode {
		t.Fatalf("expected synced fragment to use real knowledge code, got %#v", fragmentSvc.syncedFragment)
	}
}

func TestFragmentAppServiceRuntimeDestroyByBusinessIDResolvesTeamshareTempCode(t *testing.T) {
	t.Parallel()

	const (
		tempKnowledgeCode = "KB-TEMP"
		realKnowledgeCode = "KB-REAL"
		teamshareBusiness = "TS-KB-1"
	)

	fragmentSvc := &fragmentAppFragmentServiceStub{
		listResult: []*fragmodel.KnowledgeBaseFragment{{
			ID:            11,
			KnowledgeCode: realKnowledgeCode,
			PointID:       "POINT-1",
			BusinessID:    "BIZ-1",
		}},
		listTotal: 1,
	}
	kbReader := &fragmentAppKnowledgeReaderStub{
		filterListByQuery:   true,
		showByCodeAndOrgErr: shared.ErrKnowledgeBaseNotFound,
		listResult: []*kbentity.KnowledgeBase{{
			Code:             realKnowledgeCode,
			BusinessID:       teamshareBusiness,
			OrganizationCode: testFragmentOrganization,
			Enabled:          true,
			Model:            "text-embedding-3-small",
		}},
	}
	teamshareMapper := &fragmentAppTeamshareTempCodeMapperStub{
		businessIDsByCode: map[string]string{
			tempKnowledgeCode: teamshareBusiness,
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:         fragmentSvc,
		KBService:               kbReader,
		TeamshareTempCodeMapper: teamshareMapper,
		DefaultEmbeddingModel:   "text-embedding-3-small",
	})

	err := svc.RuntimeDestroyByBusinessID(context.Background(), &fragdto.RuntimeDestroyByBusinessIDInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    tempKnowledgeCode,
		BusinessID:       "BIZ-1",
	})
	if err != nil {
		t.Fatalf("runtime destroy by business id failed: %v", err)
	}
	if fragmentSvc.lastListQuery == nil || fragmentSvc.lastListQuery.KnowledgeCode != realKnowledgeCode {
		t.Fatalf("expected fragment list query to use real knowledge code, got %#v", fragmentSvc.lastListQuery)
	}
	if len(fragmentSvc.destroyedBatch) != 1 || fragmentSvc.destroyedBatch[0].KnowledgeCode != realKnowledgeCode {
		t.Fatalf("expected destroy batch to receive real knowledge fragments, got %#v", fragmentSvc.destroyedBatch)
	}
}

func TestFragmentAppServiceRuntimeDestroyByMetadataFilterResolvesTeamshareTempCode(t *testing.T) {
	t.Parallel()

	const (
		tempKnowledgeCode = "KB-TEMP"
		realKnowledgeCode = "KB-REAL"
		teamshareBusiness = "TS-KB-1"
	)

	kbReader := &fragmentAppKnowledgeReaderStub{
		filterListByQuery:   true,
		showByCodeAndOrgErr: shared.ErrKnowledgeBaseNotFound,
		listResult: []*kbentity.KnowledgeBase{{
			Code:             realKnowledgeCode,
			BusinessID:       teamshareBusiness,
			OrganizationCode: testFragmentOrganization,
			Enabled:          true,
			Model:            "text-embedding-3-small",
		}},
	}
	teamshareMapper := &fragmentAppTeamshareTempCodeMapperStub{
		businessIDsByCode: map[string]string{
			tempKnowledgeCode: teamshareBusiness,
		},
	}
	svc := appservice.NewFragmentAppServiceForTest(t, appservice.AppServiceForTestOptions{
		FragmentService:         &fragmentAppFragmentServiceStub{},
		KBService:               kbReader,
		TeamshareTempCodeMapper: teamshareMapper,
		DefaultEmbeddingModel:   "text-embedding-3-small",
	})

	err := svc.RuntimeDestroyByMetadataFilter(context.Background(), &fragdto.RuntimeDestroyByMetadataFilterInput{
		OrganizationCode: testFragmentOrganization,
		KnowledgeCode:    tempKnowledgeCode,
		MetadataFilter:   map[string]any{"doc_type": "wiki"},
	})
	if err != nil {
		t.Fatalf("runtime destroy by metadata filter failed: %v", err)
	}
	if !slices.Equal(teamshareMapper.lastLookupCodes, []string{tempKnowledgeCode}) {
		t.Fatalf("expected temp code lookup, got %#v", teamshareMapper.lastLookupCodes)
	}
	if kbReader.lastListQuery == nil || !slices.Equal(kbReader.lastListQuery.BusinessIDs, []string{teamshareBusiness}) {
		t.Fatalf("expected business-id fallback query, got %#v", kbReader.lastListQuery)
	}
}

func TestFragmentAppServicePreviewHelpers(t *testing.T) {
	t.Parallel()

	file := appservice.NormalizePreviewDocumentFileForTest(&docfilehelper.DocumentFileDTO{
		Type:       "2",
		Name:       " demo.PDF ",
		Key:        "bucket/demo.PDF",
		Extension:  " PDF ",
		ThirdID:    "third-1",
		SourceType: "drive",
		FileLink:   &docfilehelper.DocumentFileLinkDTO{URL: "https://example.com/demo.PDF"},
	})
	if file.Type != "third_platform" || file.URL != "bucket/demo.PDF" || file.Extension != "pdf" {
		t.Fatalf("unexpected normalized file: %#v", file)
	}
	if !appservice.IsThirdPlatformPreviewDocumentForTest(file) {
		t.Fatal("expected third-platform preview document")
	}

	projectFile := appservice.NormalizePreviewDocumentFileForTest(&docfilehelper.DocumentFileDTO{
		Type:       "project_file",
		Name:       "demo.md",
		URL:        "https://example.com/project/demo.md",
		SourceType: "project",
	})
	if appservice.IsThirdPlatformPreviewDocumentForTest(projectFile) {
		t.Fatalf("expected project file preview document not treated as third platform: %#v", projectFile)
	}

	payload := appservice.BuildPreviewDocumentFilePayloadForTest(file)
	if payload["third_file_id"] != "third-1" || payload["platform_type"] != "drive" {
		t.Fatalf("unexpected preview payload: %#v", payload)
	}

	appservice.ApplyResolvedPreviewDocumentFileForTest(file, map[string]any{
		"type":          "external",
		"name":          "resolved.docx",
		"url":           "https://example.com/resolved.docx",
		"extension":     "docx",
		"third_file_id": "third-2",
		"platform_type": "wiki",
	})
	if file.Type != "external" || file.ThirdID != "third-2" || file.SourceType != "wiki" {
		t.Fatalf("unexpected resolved preview file: %#v", file)
	}
}

type fragmentAppFragmentServiceStub struct {
	saveErr                  error
	savedFragment            *fragmodel.KnowledgeBaseFragment
	showResult               *fragmodel.KnowledgeBaseFragment
	showErr                  error
	findByPointResults       []*fragmodel.KnowledgeBaseFragment
	findByPointErr           error
	lastPointIDs             []string
	listResult               []*fragmodel.KnowledgeBaseFragment
	listTotal                int64
	listErr                  error
	destroyErr               error
	syncErr                  error
	similarityResults        []*fragmodel.SimilarityResult
	similarityResultsByKB    map[string][]*fragmodel.SimilarityResult
	similarityErr            error
	lastListQuery            *fragmodel.Query
	destroyCollection        string
	destroyedFragment        *fragmodel.KnowledgeBaseFragment
	destroyedBatch           []*fragmodel.KnowledgeBaseFragment
	filterPointIDs           []string
	filterPointErr           error
	syncedKnowledgeBase      *sharedsnapshot.KnowledgeBaseRuntimeSnapshot
	syncedFragment           *fragmodel.KnowledgeBaseFragment
	lastSimilarityReq        fragretrieval.SimilarityRequest
	setPayloadErr            error
	lastSetPayloadCollection string
	lastSetPayloadUpdates    map[string]map[string]any
	warmupErr                error
	warmupCalls              int
}

func (s *fragmentAppFragmentServiceStub) Save(_ context.Context, fragment *fragmodel.KnowledgeBaseFragment) error {
	s.savedFragment = fragment
	return s.saveErr
}

func (s *fragmentAppFragmentServiceStub) Show(context.Context, int64) (*fragmodel.KnowledgeBaseFragment, error) {
	return s.showResult, s.showErr
}

func (s *fragmentAppFragmentServiceStub) FindByPointIDs(_ context.Context, pointIDs []string) ([]*fragmodel.KnowledgeBaseFragment, error) {
	s.lastPointIDs = append([]string(nil), pointIDs...)
	return s.findByPointResults, s.findByPointErr
}

func (s *fragmentAppFragmentServiceStub) List(_ context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	s.lastListQuery = query
	return s.listResult, s.listTotal, s.listErr
}

func (s *fragmentAppFragmentServiceStub) Destroy(_ context.Context, fragment *fragmodel.KnowledgeBaseFragment, collectionName string) error {
	s.destroyedFragment = fragment
	s.destroyCollection = collectionName
	return s.destroyErr
}

func (s *fragmentAppFragmentServiceStub) DestroyBatch(
	_ context.Context,
	fragments []*fragmodel.KnowledgeBaseFragment,
	collectionName string,
) error {
	s.destroyedBatch = append([]*fragmodel.KnowledgeBaseFragment(nil), fragments...)
	s.destroyCollection = collectionName
	return s.destroyErr
}

func (s *fragmentAppFragmentServiceStub) ListPointIDsByFilter(
	_ context.Context,
	_ string,
	_ *fragmodel.VectorFilter,
	_ int,
) ([]string, error) {
	return append([]string(nil), s.filterPointIDs...), s.filterPointErr
}

func (s *fragmentAppFragmentServiceStub) SetPayloadByPointIDs(
	_ context.Context,
	collection string,
	updates map[string]map[string]any,
) error {
	s.lastSetPayloadCollection = collection
	s.lastSetPayloadUpdates = clonePointPayloadUpdatesForTest(updates)
	return s.setPayloadErr
}

func (s *fragmentAppFragmentServiceStub) SyncFragment(_ context.Context, kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot, fragment *fragmodel.KnowledgeBaseFragment, _ *ctxmeta.BusinessParams) error {
	s.syncedKnowledgeBase = kb
	s.syncedFragment = fragment
	return s.syncErr
}

func (s *fragmentAppFragmentServiceStub) Similarity(_ context.Context, kb *sharedsnapshot.KnowledgeBaseRuntimeSnapshot, req fragretrieval.SimilarityRequest) ([]*fragmodel.SimilarityResult, error) {
	s.lastSimilarityReq = req
	if kb != nil && s.similarityResultsByKB != nil {
		if result, ok := s.similarityResultsByKB[kb.Code]; ok {
			return result, s.similarityErr
		}
	}
	return s.similarityResults, s.similarityErr
}

func (s *fragmentAppFragmentServiceStub) WarmupRetrieval(context.Context) error {
	s.warmupCalls++
	return s.warmupErr
}

func clonePointPayloadUpdatesForTest(updates map[string]map[string]any) map[string]map[string]any {
	cloned := make(map[string]map[string]any, len(updates))
	for pointID, payload := range updates {
		payloadCopy := make(map[string]any, len(payload))
		maps.Copy(payloadCopy, payload)
		cloned[pointID] = payloadCopy
	}
	return cloned
}

type fragmentAppKnowledgeReaderStub struct {
	showResult             *kbentity.KnowledgeBase
	showErr                error
	showByCodeAndOrgResult *kbentity.KnowledgeBase
	showByCodeAndOrgErr    error
	listResult             []*kbentity.KnowledgeBase
	listTotal              int64
	listErr                error
	lastListQuery          *kbrepository.Query
	filterListByQuery      bool
	showCalls              int
}

type fragmentPermissionReaderStub struct {
	operations map[string]string
	err        error
}

func (s fragmentPermissionReaderStub) ListOperations(context.Context, string, string, []string) (map[string]string, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.operations == nil {
		return map[string]string{}, nil
	}
	result := make(map[string]string, len(s.operations))
	maps.Copy(result, s.operations)
	return result, nil
}

type fragmentAppKnowledgeBaseBindingReaderStub struct {
	knowledgeBaseCodes    []string
	bindIDs               []string
	bindIDsByOrganization map[string][]string
	err                   error
	lastOrganizationCode  string
	lastKnowledgeBaseCode string
	lastBindIDsBindType   kbentity.BindingType
}

func (s *fragmentAppKnowledgeBaseBindingReaderStub) ListBindIDsByKnowledgeBase(
	context.Context,
	string,
	kbentity.BindingType,
) ([]string, error) {
	return append([]string(nil), s.bindIDs...), s.err
}

func (s *fragmentAppKnowledgeBaseBindingReaderStub) ListBindIDsByKnowledgeBaseInOrg(
	_ context.Context,
	organizationCode string,
	knowledgeBaseCode string,
	bindType kbentity.BindingType,
) ([]string, error) {
	s.lastOrganizationCode = organizationCode
	s.lastKnowledgeBaseCode = knowledgeBaseCode
	s.lastBindIDsBindType = bindType
	if s.bindIDsByOrganization != nil {
		return append([]string(nil), s.bindIDsByOrganization[organizationCode]...), s.err
	}
	return append([]string(nil), s.bindIDs...), s.err
}

func (s *fragmentAppKnowledgeBaseBindingReaderStub) ListKnowledgeBaseCodesByBindID(
	context.Context,
	kbentity.BindingType,
	string,
	string,
) ([]string, error) {
	return append([]string(nil), s.knowledgeBaseCodes...), s.err
}

type fragmentAppSuperMagicAgentAccessCheckerStub struct {
	accessibleCodes map[string]struct{}
	err             error
	lastOrg         string
	lastUserID      string
	lastCodes       []string
}

func (s *fragmentAppSuperMagicAgentAccessCheckerStub) ListAccessibleCodes(
	_ context.Context,
	organizationCode string,
	userID string,
	codes []string,
) (map[string]struct{}, error) {
	s.lastOrg = organizationCode
	s.lastUserID = userID
	s.lastCodes = append([]string(nil), codes...)
	if s.accessibleCodes == nil {
		return map[string]struct{}{}, s.err
	}
	result := make(map[string]struct{}, len(s.accessibleCodes))
	for code := range s.accessibleCodes {
		result[code] = struct{}{}
	}
	return result, s.err
}

func (s *fragmentAppKnowledgeReaderStub) Show(_ context.Context, code string) (*kbentity.KnowledgeBase, error) {
	s.showCalls++
	if s.showResult == nil && s.showErr == nil && len(s.listResult) == 0 {
		return &kbentity.KnowledgeBase{
			Code:  code,
			Model: "text-embedding-3-small",
		}, nil
	}
	return s.lookupKnowledgeBase(code), s.showErr
}

func (s *fragmentAppKnowledgeReaderStub) ShowByCodeAndOrg(_ context.Context, code, _ string) (*kbentity.KnowledgeBase, error) {
	if s.showByCodeAndOrgResult != nil || s.showByCodeAndOrgErr != nil {
		return s.showByCodeAndOrgResult, s.showByCodeAndOrgErr
	}
	if s.showResult == nil && s.showErr == nil && len(s.listResult) == 0 {
		return &kbentity.KnowledgeBase{
			Code:  code,
			Model: "text-embedding-3-small",
		}, nil
	}
	return s.lookupKnowledgeBase(code), s.showErr
}

func (s *fragmentAppKnowledgeReaderStub) List(_ context.Context, query *kbrepository.Query) ([]*kbentity.KnowledgeBase, int64, error) {
	s.lastListQuery = cloneKnowledgeBaseQuery(query)
	if s.listResult != nil || s.listErr != nil {
		if s.filterListByQuery {
			filtered := s.filterKnowledgeBaseList(query)
			return filtered, int64(len(filtered)), s.listErr
		}
		return s.listResult, s.listTotal, s.listErr
	}
	if s.showResult != nil {
		return []*kbentity.KnowledgeBase{s.showResult}, 1, nil
	}
	return nil, 0, nil
}

func (s *fragmentAppKnowledgeReaderStub) lookupKnowledgeBase(code string) *kbentity.KnowledgeBase {
	if code != "" {
		for _, item := range s.listResult {
			if item != nil && item.Code == code {
				return item
			}
		}
	}
	if s.showResult != nil {
		return s.showResult
	}
	if len(s.listResult) > 0 {
		return s.listResult[0]
	}
	return nil
}

func (s *fragmentAppKnowledgeReaderStub) filterKnowledgeBaseList(query *kbrepository.Query) []*kbentity.KnowledgeBase {
	if len(s.listResult) == 0 {
		return nil
	}
	codeSet := make(map[string]struct{}, len(query.Codes))
	for _, code := range query.Codes {
		if trimmed := strings.TrimSpace(code); trimmed != "" {
			codeSet[trimmed] = struct{}{}
		}
	}
	businessIDSet := make(map[string]struct{}, len(query.BusinessIDs))
	for _, businessID := range query.BusinessIDs {
		if trimmed := strings.TrimSpace(businessID); trimmed != "" {
			businessIDSet[trimmed] = struct{}{}
		}
	}

	filtered := make([]*kbentity.KnowledgeBase, 0, len(s.listResult))
	for _, item := range s.listResult {
		if item == nil {
			continue
		}
		if orgCode := strings.TrimSpace(query.OrganizationCode); orgCode != "" && item.OrganizationCode != orgCode {
			continue
		}
		if len(codeSet) > 0 {
			if _, ok := codeSet[item.Code]; !ok {
				continue
			}
		}
		if len(businessIDSet) > 0 {
			if _, ok := businessIDSet[item.BusinessID]; !ok {
				continue
			}
		}
		filtered = append(filtered, item)
	}
	return filtered
}

type fragmentAppTeamshareTempCodeMapperStub struct {
	businessIDsByCode map[string]string
	err               error
	lastLookupCodes   []string
}

func (s *fragmentAppTeamshareTempCodeMapperStub) LookupBusinessIDs(
	_ context.Context,
	knowledgeCodes []string,
) (map[string]string, error) {
	s.lastLookupCodes = append([]string(nil), knowledgeCodes...)
	result := make(map[string]string, len(knowledgeCodes))
	for _, knowledgeCode := range knowledgeCodes {
		if businessID := strings.TrimSpace(s.businessIDsByCode[knowledgeCode]); businessID != "" {
			result[knowledgeCode] = businessID
		}
	}
	return result, s.err
}

func (s *fragmentAppKnowledgeReaderStub) ResolveRuntimeRoute(_ context.Context, kb *kbentity.KnowledgeBase) sharedroute.ResolvedRoute {
	collectionName := ""
	if kb != nil {
		collectionName = kb.CollectionName()
	}
	return sharedroute.ResolvedRoute{
		LogicalCollectionName:  collectionName,
		PhysicalCollectionName: collectionName,
		VectorCollectionName:   collectionName,
		TermCollectionName:     collectionName,
		Model:                  "text-embedding-3-small",
	}
}

func cloneKnowledgeBaseQuery(query *kbrepository.Query) *kbrepository.Query {
	if query == nil {
		return nil
	}
	cloned := *query
	cloned.Codes = append([]string(nil), query.Codes...)
	cloned.BusinessIDs = append([]string(nil), query.BusinessIDs...)
	if query.Type != nil {
		value := *query.Type
		cloned.Type = &value
	}
	if query.KnowledgeBaseType != nil {
		value := *query.KnowledgeBaseType
		cloned.KnowledgeBaseType = &value
	}
	if query.Enabled != nil {
		value := *query.Enabled
		cloned.Enabled = &value
	}
	if query.SyncStatus != nil {
		value := *query.SyncStatus
		cloned.SyncStatus = &value
	}
	return &cloned
}

type fragmentAppDocumentReaderStub struct {
	showResult                       *docentity.KnowledgeBaseDocument
	showErr                          error
	findByThirdFileResult            *docentity.KnowledgeBaseDocument
	findByThirdFileErr               error
	ensureResult                     *docentity.KnowledgeBaseDocument
	ensureErr                        error
	ensuredDoc                       *docentity.KnowledgeBaseDocument
	ensuredFragment                  *fragmodel.KnowledgeBaseFragment
	lastFindByThirdFileKnowledgeCode string
	lastFindByThirdFilePlatform      string
	lastFindByThirdFileID            string
}

func (s *fragmentAppDocumentReaderStub) ShowByCodeAndKnowledgeBase(context.Context, string, string) (*docentity.KnowledgeBaseDocument, error) {
	return s.showResult, s.showErr
}

func (s *fragmentAppDocumentReaderStub) Show(context.Context, string) (*docentity.KnowledgeBaseDocument, error) {
	return s.showResult, s.showErr
}

func (s *fragmentAppDocumentReaderStub) FindByKnowledgeBaseAndThirdFile(
	_ context.Context,
	knowledgeBaseCode string,
	thirdPlatformType string,
	thirdFileID string,
) (*docentity.KnowledgeBaseDocument, error) {
	s.lastFindByThirdFileKnowledgeCode = knowledgeBaseCode
	s.lastFindByThirdFilePlatform = thirdPlatformType
	s.lastFindByThirdFileID = thirdFileID
	return s.findByThirdFileResult, s.findByThirdFileErr
}

func (s *fragmentAppDocumentReaderStub) EnsureDefaultDocument(
	_ context.Context,
	_ *sharedsnapshot.KnowledgeBaseRuntimeSnapshot,
) (*docentity.KnowledgeBaseDocument, bool, error) {
	if s.ensureErr != nil {
		return nil, false, s.ensureErr
	}
	if s.ensureResult != nil {
		return s.ensureResult, true, nil
	}
	if s.showResult != nil {
		return s.showResult, false, nil
	}
	return &docentity.KnowledgeBaseDocument{}, true, nil
}

func (s *fragmentAppDocumentReaderStub) EnsureDocumentAndSaveFragment(
	_ context.Context,
	doc *docentity.KnowledgeBaseDocument,
	fragment *fragmodel.KnowledgeBaseFragment,
) (*docentity.KnowledgeBaseDocument, error) {
	s.ensuredDoc = doc
	s.ensuredFragment = fragment
	if s.ensureErr != nil {
		return nil, s.ensureErr
	}
	if s.ensureResult != nil {
		return s.ensureResult, nil
	}
	if s.showResult != nil {
		return s.showResult, nil
	}
	return doc, nil
}

type fragmentThirdPlatformResolverStub struct {
	result    *thirdplatform.DocumentResolveResult
	err       error
	lastInput *thirdplatform.DocumentResolveInput
}

func (s *fragmentThirdPlatformResolverStub) Resolve(_ context.Context, input thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error) {
	s.lastInput = &input
	return s.result, s.err
}
