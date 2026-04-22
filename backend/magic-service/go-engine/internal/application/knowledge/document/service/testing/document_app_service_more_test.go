package docapp_test

import (
	"context"
	"errors"
	"fmt"
	"io"
	"slices"
	"strings"
	"testing"
	"time"

	docdto "magic/internal/application/knowledge/document/dto"
	appservice "magic/internal/application/knowledge/document/service"
	confighelper "magic/internal/application/knowledge/helper/config"
	docfilehelper "magic/internal/application/knowledge/helper/docfile"
	thirdplatformprovider "magic/internal/application/knowledge/shared/thirdplatformprovider"
	documentdomain "magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	sourcebindingdomain "magic/internal/domain/knowledge/sourcebinding/service"
	"magic/internal/pkg/ctxmeta"
	"magic/internal/pkg/projectfile"
	"magic/internal/pkg/thirdplatform"
)

const (
	testDocumentCode      = "DOC1"
	testKnowledgeBaseCode = "KB1"
)

var (
	errDocumentShowFailed    = errors.New("document show failed")
	errDocumentUpdateFailed  = errors.New("document update failed")
	errDocumentListFailed    = errors.New("document list failed")
	errDocumentDestroyFailed = errors.New("document destroy failed")
	errDocumentCountFailed   = errors.New("document count failed")
	errFragmentListFailed    = errors.New("fragment list failed")
	errKnowledgeBaseShowFail = errors.New("knowledge base show failed")
	errWrappedPrecheck       = errors.New("wrap")
	errResyncBoom            = errors.New("resync boom")
)

func TestDocumentAppServiceUpdate(t *testing.T) {
	t.Parallel()

	const renamedDocumentName = "new"

	existing := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "old",
		Description:       "old desc",
		Enabled:           true,
		DocType:           int(documentdomain.DocTypeText),
		DocumentFile:      &documentdomain.File{URL: "old.txt", Extension: "txt"},
	}
	domain := &documentDomainServiceStub{showByCodeAndKBResult: existing}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, nil)

	enabled := false
	docType := int(documentdomain.DocTypeFile)
	wordCount := 42
	result, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              renamedDocumentName,
		Description:       "new desc",
		Enabled:           &enabled,
		DocType:           &docType,
		DocMetadata:       map[string]any{"a": 1},
		DocumentFile:      &docfilehelper.DocumentFileDTO{Name: "doc.md", Key: "bucket/doc.md"},
		WordCount:         &wordCount,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || result.Name != renamedDocumentName || result.WordCount != 42 {
		t.Fatalf("unexpected result: %#v", result)
	}
	if existing.DocumentFile == nil ||
		existing.DocumentFile.URL != "bucket/doc.md" ||
		existing.DocumentFile.Name != renamedDocumentName ||
		existing.DocumentFile.Extension != "md" {
		t.Fatalf("unexpected document file: %#v", existing.DocumentFile)
	}
	if got := existing.DocMetadata[documentdomain.ParsedMetaFileName]; got != renamedDocumentName {
		t.Fatalf("expected metadata file_name=new, got %#v", existing.DocMetadata)
	}
	if existing.DocType != int(documentdomain.DocTypeFile) || existing.Enabled {
		t.Fatalf("unexpected updated state: %#v", existing)
	}
	if existing.UpdatedUID != "U1" {
		t.Fatalf("expected updated uid U1, got %q", existing.UpdatedUID)
	}

	failingSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: existing,
		updateErr:             errDocumentUpdateFailed,
	}, &knowledgeBaseReaderStub{}, nil)
	if _, err := failingSvc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
	}); !errors.Is(err, errDocumentUpdateFailed) {
		t.Fatalf("expected update error, got %v", err)
	}
}

func TestDocumentAppServiceUpdateNameWinsForDocumentFileFields(t *testing.T) {
	t.Parallel()

	const renamedDocumentName = "门店数据 2222.md"

	existing := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "门店数据.txt",
		DocMetadata: map[string]any{
			documentdomain.ParsedMetaFileName:     "门店数据.txt",
			documentdomain.ParsedMetaSourceFormat: "txt",
		},
		DocumentFile: &documentdomain.File{
			Type:      "external",
			Name:      "门店数据.txt",
			URL:       "bucket/original.txt",
			FileKey:   "bucket/original.txt",
			Extension: "txt",
		},
	}
	domain := &documentDomainServiceStub{showByCodeAndKBResult: existing}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, nil)

	result, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              renamedDocumentName,
		DocMetadata: map[string]any{
			documentdomain.ParsedMetaFileName:     "stale.txt",
			documentdomain.ParsedMetaSourceFormat: "txt",
		},
		DocumentFile: &docfilehelper.DocumentFileDTO{
			Type:      "external",
			Name:      "stale.txt",
			Key:       "bucket/stale.txt",
			Extension: "txt",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || result.Name != renamedDocumentName {
		t.Fatalf("unexpected result: %#v", result)
	}
	if result.DocumentFile == nil || result.DocumentFile.Name != renamedDocumentName || result.DocumentFile.Extension != "md" {
		t.Fatalf("unexpected result document file: %#v", result.DocumentFile)
	}
	if existing.DocumentFile == nil ||
		existing.DocumentFile.Name != renamedDocumentName ||
		existing.DocumentFile.Extension != "md" ||
		existing.DocumentFile.URL != "bucket/stale.txt" {
		t.Fatalf("unexpected document file: %#v", existing.DocumentFile)
	}
	if got := existing.DocMetadata[documentdomain.ParsedMetaFileName]; got != renamedDocumentName {
		t.Fatalf("expected metadata file_name updated, got %#v", existing.DocMetadata)
	}
}

func TestDocumentAppServiceUpdateKeepsExistingExtensionWhenNameHasNoSuffix(t *testing.T) {
	t.Parallel()

	const renamedDocumentName = "门店数据 2222"

	existing := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "门店数据.txt",
		DocMetadata: map[string]any{
			documentdomain.ParsedMetaFileName: "门店数据.txt",
		},
		DocumentFile: &documentdomain.File{
			Type:      "external",
			Name:      "门店数据.txt",
			URL:       "bucket/original.txt",
			Extension: "txt",
		},
	}
	domain := &documentDomainServiceStub{showByCodeAndKBResult: existing}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, nil)

	result, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              renamedDocumentName,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || result.DocumentFile == nil {
		t.Fatalf("unexpected result: %#v", result)
	}
	if result.DocumentFile.Name != renamedDocumentName || result.DocumentFile.Extension != "txt" {
		t.Fatalf("unexpected result document file: %#v", result.DocumentFile)
	}
	if existing.DocumentFile == nil || existing.DocumentFile.Name != renamedDocumentName || existing.DocumentFile.Extension != "txt" {
		t.Fatalf("unexpected document file: %#v", existing.DocumentFile)
	}
	if got := existing.DocMetadata[documentdomain.ParsedMetaFileName]; got != renamedDocumentName {
		t.Fatalf("expected metadata file_name updated, got %#v", existing.DocMetadata)
	}
}

func TestDocumentAppServiceUpdateNameOnlyTouchesExistingFileNameMetadataWhenNoDocumentFile(t *testing.T) {
	t.Parallel()

	withFileName := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "门店数据.txt",
		DocMetadata: map[string]any{
			documentdomain.ParsedMetaFileName:     "门店数据.txt",
			documentdomain.ParsedMetaSourceFormat: "txt",
		},
	}
	withFileNameSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: withFileName,
	}, &knowledgeBaseReaderStub{}, nil)
	if _, err := withFileNameSvc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "门店数据 2222.md",
	}); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if withFileName.DocumentFile != nil {
		t.Fatalf("expected document file to stay nil, got %#v", withFileName.DocumentFile)
	}
	if got := withFileName.DocMetadata[documentdomain.ParsedMetaFileName]; got != "门店数据 2222.md" {
		t.Fatalf("expected metadata file_name updated, got %#v", withFileName.DocMetadata)
	}

	withoutFileName := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC2",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "纯文本文档",
		DocMetadata: map[string]any{
			documentdomain.ParsedMetaSourceFormat: "txt",
		},
	}
	withoutFileNameSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: withoutFileName,
	}, &knowledgeBaseReaderStub{}, nil)
	if _, err := withoutFileNameSvc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              "DOC2",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "纯文本文档 2222.md",
	}); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if _, ok := withoutFileName.DocMetadata[documentdomain.ParsedMetaFileName]; ok {
		t.Fatalf("expected metadata file_name to remain absent, got %#v", withoutFileName.DocMetadata)
	}
}

func TestDocumentAppServiceUpdateOrgMismatch(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{
		showByCodeAndKBResult: &documentdomain.KnowledgeBaseDocument{
			Code:              testDocumentCode,
			OrganizationCode:  "ORG2",
			KnowledgeBaseCode: testKnowledgeBaseCode,
		},
	}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, nil)

	_, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
	})
	if !errors.Is(err, appservice.ErrDocumentOrgMismatch) {
		t.Fatalf("expected org mismatch, got %v", err)
	}
}

func TestDocumentAppServiceUpdateSchedulesResyncWhenStrategyConfigChanges(t *testing.T) {
	t.Parallel()

	existing := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		DocMetadata:       map[string]any{"source": "manual"},
	}
	domain := &documentDomainServiceStub{showByCodeAndKBResult: existing}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, scheduler)

	_, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		StrategyConfig: &confighelper.StrategyConfigDTO{
			ParsingType:     documentdomain.ParsingTypeQuick,
			ImageExtraction: false,
			TableExtraction: false,
			ImageOCR:        false,
		},
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if scheduler.scheduleCalls != 1 {
		t.Fatalf("expected one resync schedule, got %d", scheduler.scheduleCalls)
	}
	if scheduler.inputs[0].Mode != documentdomain.SyncModeResync || !scheduler.inputs[0].Async {
		t.Fatalf("unexpected scheduled input: %#v", scheduler.inputs[0])
	}
	if scheduler.inputs[0].BusinessParams == nil || scheduler.inputs[0].BusinessParams.UserID != "U1" || scheduler.inputs[0].BusinessParams.BusinessID != testKnowledgeBaseCode {
		t.Fatalf("unexpected business params: %#v", scheduler.inputs[0].BusinessParams)
	}
}

func TestDocumentAppServiceUpdateSchedulesResyncWhenFragmentConfigChanges(t *testing.T) {
	t.Parallel()

	existing := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
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
	domain := &documentDomainServiceStub{showByCodeAndKBResult: existing}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, scheduler)

	_, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: int(shared.FragmentModeCustom),
			Normal: &confighelper.NormalFragmentConfigDTO{
				TextPreprocessRule: []int{1},
				SegmentRule: &confighelper.SegmentRuleDTO{
					Separator:    "\n\n",
					ChunkSize:    300,
					ChunkOverlap: 20,
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if scheduler.scheduleCalls != 1 || scheduler.inputs[0].Mode != documentdomain.SyncModeResync {
		t.Fatalf("expected one fragment-config resync, got %#v", scheduler.inputs)
	}
}

func TestDocumentAppServiceUpdateWaitForSyncResultReturnsSyncedDocument(t *testing.T) {
	t.Parallel()

	existing := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "bucket/doc.md", Extension: "md"},
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeAuto,
		},
	}
	domain := &documentDomainServiceStub{showByCodeAndKBResult: existing}
	scheduler := &documentSyncSchedulerStub{}
	fragmentSvc := &fragmentDestroyServiceStub{}
	svc := appservice.NewDocumentAppServiceForTest(
		t,
		domain,
		&knowledgeBaseReaderStub{
			showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{
				Code:             testKnowledgeBaseCode,
				OrganizationCode: "ORG1",
				Model:            "text-embedding-3-small",
			},
			routeCollection: "collection",
		},
		scheduler,
		fragmentSvc,
	)
	svc.SetParseServiceForTest(&documentParseServiceStub{
		parseDocumentResult: documentdomain.NewPlainTextParsedDocument("md", "updated sync content"),
	})

	result, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: int(shared.FragmentModeCustom),
			Normal: &confighelper.NormalFragmentConfigDTO{
				SegmentRule: &confighelper.SegmentRuleDTO{
					Separator:    "\n\n",
					ChunkSize:    300,
					ChunkOverlap: 20,
				},
			},
		},
		WaitForSyncResult: true,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if scheduler.scheduleCalls != 0 {
		t.Fatalf("expected inline resync not to schedule background work, got %d", scheduler.scheduleCalls)
	}
	if fragmentSvc.syncFragmentBatchCalls != 1 {
		t.Fatalf("expected one fragment sync batch, got %d", fragmentSvc.syncFragmentBatchCalls)
	}
	if result == nil || result.SyncStatus != int(shared.SyncStatusSynced) {
		t.Fatalf("expected synced result, got %#v", result)
	}
}

func TestDocumentAppServiceUpdateWaitForSyncResultReturnsFailedDocumentState(t *testing.T) {
	t.Parallel()

	existing := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "bucket/doc.md", Extension: "md"},
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeAuto,
		},
	}
	domain := &documentDomainServiceStub{showByCodeAndKBResult: existing}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(
		t,
		domain,
		&knowledgeBaseReaderStub{
			showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{
				Code:             testKnowledgeBaseCode,
				OrganizationCode: "ORG1",
				Model:            "text-embedding-3-small",
			},
			routeCollection: "collection",
		},
		scheduler,
		&fragmentDestroyServiceStub{},
	)
	svc.SetParseServiceForTest(&documentParseServiceStub{
		parseDocumentErr: errResyncBoom,
	})

	result, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: int(shared.FragmentModeCustom),
			Normal: &confighelper.NormalFragmentConfigDTO{
				SegmentRule: &confighelper.SegmentRuleDTO{
					Separator:    "\n\n",
					ChunkSize:    300,
					ChunkOverlap: 20,
				},
			},
		},
		WaitForSyncResult: true,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if scheduler.scheduleCalls != 0 {
		t.Fatalf("expected inline resync not to schedule background work, got %d", scheduler.scheduleCalls)
	}
	if result == nil || result.SyncStatus != int(shared.SyncStatusSyncFailed) {
		t.Fatalf("expected sync failed result, got %#v", result)
	}
	if !strings.Contains(result.SyncStatusMessage, errResyncBoom.Error()) {
		t.Fatalf("expected failure message to contain parse error, got %#v", result)
	}
}

func TestDocumentAppServiceUpdateSkipsResyncWhenEffectiveConfigUnchanged(t *testing.T) {
	t.Parallel()

	existing := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		DocMetadata: map[string]any{
			documentdomain.ParseStrategyConfigKey: map[string]any{
				"parse_mode": "precise",
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
	domain := &documentDomainServiceStub{showByCodeAndKBResult: existing}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, scheduler)

	_, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		StrategyConfig: &confighelper.StrategyConfigDTO{
			ParsingType:     documentdomain.ParsingTypePrecise,
			ImageExtraction: true,
			TableExtraction: true,
			ImageOCR:        true,
		},
		FragmentConfig: &confighelper.FragmentConfigDTO{
			Mode: int(shared.FragmentModeCustom),
			Normal: &confighelper.NormalFragmentConfigDTO{
				TextPreprocessRule: []int{1},
				SegmentRule: &confighelper.SegmentRuleDTO{
					Separator:    "\n\n",
					ChunkSize:    200,
					ChunkOverlap: 20,
				},
			},
		},
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if scheduler.scheduleCalls != 0 {
		t.Fatalf("expected unchanged effective config not to schedule resync, got %#v", scheduler.inputs)
	}
}

func TestDocumentAppServiceUpdateSkipsResyncForNonConfigChangesAndUpdateFailures(t *testing.T) {
	t.Parallel()

	baseDoc := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "old",
	}

	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: baseDoc,
	}, &knowledgeBaseReaderStub{}, scheduler)
	if _, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "new name",
	}); err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if scheduler.scheduleCalls != 0 {
		t.Fatalf("expected non-config update not to schedule resync, got %#v", scheduler.inputs)
	}

	failingScheduler := &documentSyncSchedulerStub{}
	failingSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: &documentdomain.KnowledgeBaseDocument{
			Code:              testDocumentCode,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: testKnowledgeBaseCode,
		},
		updateErr: errDocumentUpdateFailed,
	}, &knowledgeBaseReaderStub{}, failingScheduler)
	if _, err := failingSvc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		StrategyConfig: &confighelper.StrategyConfigDTO{
			ParsingType:     documentdomain.ParsingTypeQuick,
			ImageExtraction: false,
			TableExtraction: false,
			ImageOCR:        false,
		},
	}); !errors.Is(err, errDocumentUpdateFailed) {
		t.Fatalf("expected update failure, got %v", err)
	}
	if failingScheduler.scheduleCalls != 0 {
		t.Fatalf("expected failed update not to schedule resync, got %#v", failingScheduler.inputs)
	}
}

func TestDocumentAppServiceUpdateSchedulesSingleDocumentThirdPlatformResyncWithSourceOverride(t *testing.T) {
	t.Parallel()

	existing := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
		DocumentFile: &documentdomain.File{
			Type:       "third_platform",
			ThirdID:    "FILE-1",
			SourceType: "teamshare",
		},
	}
	domain := &documentDomainServiceStub{showByCodeAndKBResult: existing}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, scheduler)
	svc.SetThirdPlatformDocumentPortForTest(&thirdPlatformResolverStub{
		result: newThirdPlatformRawContentResolveResult("latest source content"),
	})
	svc.SetParseServiceForTest(&documentParseServiceStub{})
	svc.SetThirdPlatformProviders(thirdplatformprovider.NewRegistry(&thirdPlatformProviderStub{
		platformType: "teamshare",
	}))

	_, err := svc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		StrategyConfig: &confighelper.StrategyConfigDTO{
			ParsingType:     documentdomain.ParsingTypeQuick,
			ImageExtraction: false,
			TableExtraction: false,
			ImageOCR:        false,
		},
	})
	if err != nil {
		t.Fatalf("Update returned error: %v", err)
	}
	if scheduler.scheduleCalls != 1 {
		t.Fatalf("expected single-document third-platform resync, got %#v", scheduler.inputs)
	}
	if scheduler.inputs[0].Code != testDocumentCode || scheduler.inputs[0].KnowledgeBaseCode != testKnowledgeBaseCode {
		t.Fatalf("unexpected scheduled target: %#v", scheduler.inputs[0])
	}
	if scheduler.inputs[0].SourceOverride == nil || scheduler.inputs[0].SourceOverride.Content != "latest source content" {
		t.Fatalf("expected scheduled source override, got %#v", scheduler.inputs[0])
	}
	if scheduler.inputs[0].SingleDocumentThirdPlatformResync {
		t.Fatalf("expected direct source override scheduling without redirect fallback, got %#v", scheduler.inputs[0])
	}
}

func TestDocumentAppServiceShowListCountAndDestroy(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		ID:                1,
		Code:              testDocumentCode,
		Name:              "doc",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
	}
	domain := &documentDomainServiceStub{
		showResult:             doc,
		showByCodeAndKBResult:  doc,
		listResult:             []*documentdomain.KnowledgeBaseDocument{doc},
		listTotal:              1,
		countByKnowledgeResult: map[string]int64{testKnowledgeBaseCode: 3},
	}
	fragmentSvc := &fragmentDestroyServiceStub{}
	kbReader := &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{Code: testKnowledgeBaseCode, Model: "m1"},
		routeCollection:        "kb_custom",
	}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, kbReader, nil, fragmentSvc)

	assertDocumentShowScenarios(t, svc)
	assertDocumentListAndCount(t, svc, domain)

	if err := svc.Destroy(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG1"); err != nil {
		t.Fatalf("destroy failed: %v", err)
	}
	if domain.deletedID != 1 {
		t.Fatalf("expected deleted doc id 1, got %d", domain.deletedID)
	}
	if fragmentSvc.lastCollectionName != "kb_custom" {
		t.Fatalf("expected fragment cleanup collection kb_custom, got %q", fragmentSvc.lastCollectionName)
	}
	if fragmentSvc.deletePointsByDocumentCalls != 1 || fragmentSvc.deleteByDocumentCalls != 1 {
		t.Fatalf("expected fragment cleanup in app layer, got %+v", fragmentSvc)
	}
}

func TestDocumentAppServiceIgnoresAgentCodesWhenKnowledgeBaseCanBeDetermined(t *testing.T) {
	t.Parallel()

	for _, tc := range []struct {
		name string
	}{
		{name: "default"},
	} {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			assertDocumentOpsUseKnowledgeBaseScopeForWrite(t)
			assertDocumentOpsUseKnowledgeBaseScopeForRead(t)
			assertDocumentSyncUsesKnowledgeBaseScope(t)
		})
	}
}

func newDigitalEmployeeKnowledgeBaseReaderForDocumentScopeTest() *knowledgeBaseReaderStub {
	sourceType := int(knowledgebase.SourceTypeLocalFile)
	return &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{
			Code:              testKnowledgeBaseCode,
			OrganizationCode:  "ORG1",
			Model:             "text-embedding-3-small",
			SourceType:        &sourceType,
			KnowledgeBaseType: knowledgebase.KnowledgeBaseTypeDigitalEmployee,
		},
		routeCollection: "kb_custom",
		routeModel:      "text-embedding-3-small",
	}
}

func assertDocumentOpsUseKnowledgeBaseScopeForWrite(t *testing.T) {
	t.Helper()

	createSvc := appservice.NewDocumentAppServiceForTest(
		t,
		&documentDomainServiceStub{},
		newDigitalEmployeeKnowledgeBaseReaderForDocumentScopeTest(),
		&documentSyncSchedulerStub{},
	)
	if _, err := createSvc.Create(context.Background(), &docdto.CreateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "doc.md",
		DocType:           int(documentdomain.DocTypeText),
		DocumentFile:      &docfilehelper.DocumentFileDTO{Name: "doc.md", Key: "ORG1/doc.md"},
	}); err != nil {
		t.Fatalf("create failed: %v", err)
	}

	updateSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: &documentdomain.KnowledgeBaseDocument{
			Code:              testDocumentCode,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: testKnowledgeBaseCode,
			DocumentFile:      &documentdomain.File{Name: "doc.md", URL: "ORG1/doc.md", Extension: "md"},
		},
	}, newDigitalEmployeeKnowledgeBaseReaderForDocumentScopeTest(), nil)
	if _, err := updateSvc.Update(context.Background(), &docdto.UpdateDocumentInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "updated",
	}); err != nil {
		t.Fatalf("update failed: %v", err)
	}
}

func assertDocumentOpsUseKnowledgeBaseScopeForRead(t *testing.T) {
	t.Helper()

	doc := &documentdomain.KnowledgeBaseDocument{
		ID:                1,
		Code:              testDocumentCode,
		Name:              "doc",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		DocumentFile:      &documentdomain.File{Type: "external", Name: "doc.md", URL: "ORG1/doc.md"},
	}
	showListDomain := &documentDomainServiceStub{
		showResult:            doc,
		showByCodeAndKBResult: doc,
		listResult:            []*documentdomain.KnowledgeBaseDocument{doc},
		listTotal:             1,
	}
	showListSvc := appservice.NewDocumentAppServiceForTest(
		t,
		showListDomain,
		newDigitalEmployeeKnowledgeBaseReaderForDocumentScopeTest(),
		nil,
		&fragmentDestroyServiceStub{},
	)
	if _, err := showListSvc.Show(context.Background(), testDocumentCode, "", "ORG1"); !errors.Is(err, shared.ErrDocumentKnowledgeBaseRequired) {
		t.Fatalf("expected knowledge base required error, got %v", err)
	}
	if _, err := showListSvc.Show(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG1"); err != nil {
		t.Fatalf("show failed: %v", err)
	}
	page, err := showListSvc.List(context.Background(), &docdto.ListDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Offset:            0,
		Limit:             10,
	})
	if err != nil {
		t.Fatalf("list failed: %v", err)
	}
	if page.Total != 1 {
		t.Fatalf("expected total=1, got %#v", page)
	}
	if err := showListSvc.Destroy(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG1"); err != nil {
		t.Fatalf("destroy failed: %v", err)
	}

	linkSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: doc,
	}, newDigitalEmployeeKnowledgeBaseReaderForDocumentScopeTest(), nil)
	linkSvc.SetOriginalFileLinkProvider(&originalFileLinkProviderStub{link: "https://example.com/doc.md"})
	if _, err := linkSvc.GetOriginalFileLink(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG1"); err != nil {
		t.Fatalf("get original file link failed: %v", err)
	}
}

func assertDocumentSyncUsesKnowledgeBaseScope(t *testing.T) {
	t.Helper()

	syncSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: &documentdomain.KnowledgeBaseDocument{
			Code:              testDocumentCode,
			KnowledgeBaseCode: testKnowledgeBaseCode,
			OrganizationCode:  "ORG1",
			ThirdPlatformType: "teamshare",
			ThirdFileID:       "FILE-1",
			UpdatedUID:        "DOC-USER",
		},
	}, newDigitalEmployeeKnowledgeBaseReaderForDocumentScopeTest(), nil, &fragmentDestroyServiceStub{})
	thirdFileScheduler := &thirdFileSchedulerStub{}
	syncSvc.SetThirdFileRevectorizeScheduler(thirdFileScheduler)
	if err := syncSvc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Code:              testDocumentCode,
		Mode:              documentdomain.SyncModeResync,
		Async:             true,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
			BusinessID:       testKnowledgeBaseCode,
		},
	}); err != nil {
		t.Fatalf("sync failed: %v", err)
	}
	if thirdFileScheduler.scheduleCalls != 1 {
		t.Fatalf("expected one redirected third-file sync, got %d", thirdFileScheduler.scheduleCalls)
	}
}

func TestDocumentAppServiceDestroyOrgMismatch(t *testing.T) {
	t.Parallel()

	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: &documentdomain.KnowledgeBaseDocument{
			ID:                1,
			Code:              testDocumentCode,
			OrganizationCode:  "ORG2",
			KnowledgeBaseCode: testKnowledgeBaseCode,
		},
	}, &knowledgeBaseReaderStub{}, nil)

	err := svc.Destroy(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG1")
	if !errors.Is(err, appservice.ErrDocumentOrgMismatch) {
		t.Fatalf("expected org mismatch, got %v", err)
	}
}

func TestDocumentAppServiceGetByThirdFileID(t *testing.T) {
	t.Parallel()

	const (
		orgCode      = "ORG1"
		platformType = "teamshare"
		thirdFileID  = "FILE-1"
	)

	doc1 := &documentdomain.KnowledgeBaseDocument{
		ID:                1,
		Code:              testDocumentCode,
		Name:              "doc-1",
		OrganizationCode:  orgCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		ThirdPlatformType: platformType,
		ThirdFileID:       thirdFileID,
	}
	doc2 := &documentdomain.KnowledgeBaseDocument{
		ID:                2,
		Code:              "DOC2",
		Name:              "doc-2",
		OrganizationCode:  orgCode,
		KnowledgeBaseCode: "KB2",
		ThirdPlatformType: platformType,
		ThirdFileID:       thirdFileID,
	}
	domain := &documentDomainServiceStub{
		findByKBAndThirdResult: doc1,
		listByThirdFileInOrgResult: []*documentdomain.KnowledgeBaseDocument{
			doc1,
			doc2,
		},
	}
	kbReader := &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{Code: testKnowledgeBaseCode, OrganizationCode: orgCode},
	}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, kbReader, nil)

	filtered, err := svc.GetByThirdFileID(context.Background(), &docdto.GetDocumentsByThirdFileIDInput{
		OrganizationCode:  orgCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		ThirdPlatformType: platformType,
		ThirdFileID:       thirdFileID,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(filtered) != 1 || filtered[0].Code != testDocumentCode {
		t.Fatalf("unexpected filtered result: %#v", filtered)
	}

	list, err := svc.GetByThirdFileID(context.Background(), &docdto.GetDocumentsByThirdFileIDInput{
		OrganizationCode:  orgCode,
		ThirdPlatformType: platformType,
		ThirdFileID:       thirdFileID,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(list) != 2 {
		t.Fatalf("expected 2 documents, got %#v", list)
	}
	if domain.lastListByThirdFileOrg != orgCode || domain.lastListByThirdFilePlatform != platformType || domain.lastListByThirdFileID != thirdFileID {
		t.Fatalf("unexpected list-by-third-file query: org=%q platform=%q file=%q", domain.lastListByThirdFileOrg, domain.lastListByThirdFilePlatform, domain.lastListByThirdFileID)
	}
}

func TestDocumentAppServiceGetByThirdFileIDHandlesEmptyAndErrors(t *testing.T) {
	t.Parallel()

	const (
		orgCode      = "ORG1"
		platformType = "teamshare"
		thirdFileID  = "FILE-1"
	)

	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{}, &knowledgeBaseReaderStub{}, nil)
	empty, err := svc.GetByThirdFileID(context.Background(), &docdto.GetDocumentsByThirdFileIDInput{})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(empty) != 0 {
		t.Fatalf("expected empty result, got %#v", empty)
	}

	notFoundSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		findByKBAndThirdErr: shared.ErrDocumentNotFound,
	}, &knowledgeBaseReaderStub{}, nil)
	notFound, err := notFoundSvc.GetByThirdFileID(context.Background(), &docdto.GetDocumentsByThirdFileIDInput{
		OrganizationCode:  orgCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		ThirdPlatformType: platformType,
		ThirdFileID:       thirdFileID,
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(notFound) != 0 {
		t.Fatalf("expected empty result for not found, got %#v", notFound)
	}

	listErrSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		listByThirdFileInOrgErr: errDocumentListFailed,
	}, &knowledgeBaseReaderStub{}, nil)
	if _, err := listErrSvc.GetByThirdFileID(context.Background(), &docdto.GetDocumentsByThirdFileIDInput{
		OrganizationCode:  orgCode,
		ThirdPlatformType: platformType,
		ThirdFileID:       thirdFileID,
	}); !errors.Is(err, errDocumentListFailed) {
		t.Fatalf("expected list error, got %v", err)
	}
}

func assertDocumentShowScenarios(t *testing.T, svc *appservice.DocumentAppService) {
	t.Helper()

	if _, err := svc.Show(context.Background(), testDocumentCode, "", "ORG1"); !errors.Is(err, shared.ErrDocumentKnowledgeBaseRequired) {
		t.Fatalf("expected knowledge base required error, got %v", err)
	}
	if _, err := svc.Show(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG1"); err != nil {
		t.Fatalf("show with kb code failed: %v", err)
	}
	if _, err := svc.Show(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG2"); !errors.Is(err, appservice.ErrDocumentOrgMismatch) {
		t.Fatalf("expected show org mismatch, got %v", err)
	}
}

func assertDocumentListAndCount(t *testing.T, svc *appservice.DocumentAppService, domain *documentDomainServiceStub) {
	t.Helper()

	page, err := svc.List(context.Background(), &docdto.ListDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Name:              "keyword",
		Offset:            2,
		Limit:             5,
		SyncStatus:        new(int(shared.SyncStatusSynced)),
	})
	list, ok := page.List.([]*docdto.DocumentDTO)
	if err != nil || !ok || page.Total != 1 || len(list) != 1 {
		t.Fatalf("unexpected page=%#v err=%v", page, err)
	}
	if domain.lastListQuery == nil || domain.lastListQuery.Offset != 2 || domain.lastListQuery.Limit != 5 || domain.lastListQuery.Name != "keyword" {
		t.Fatalf("unexpected list query: %#v", domain.lastListQuery)
	}
	if domain.lastListQuery.SyncStatus == nil || *domain.lastListQuery.SyncStatus != shared.SyncStatusSynced {
		t.Fatalf("unexpected list sync status query: %#v", domain.lastListQuery)
	}

	counts, err := svc.CountByKnowledgeBaseCodes(context.Background(), "ORG1", []string{testKnowledgeBaseCode})
	if err != nil || counts[testKnowledgeBaseCode] != 3 {
		t.Fatalf("unexpected counts=%#v err=%v", counts, err)
	}
}

func TestDocumentAppServiceShowAndListErrors(t *testing.T) {
	t.Parallel()

	errorCases := []struct {
		name   string
		svc    *appservice.DocumentAppService
		target error
		call   func(*appservice.DocumentAppService) error
	}{
		{
			name: "show failed",
			svc: appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
				showByCodeAndKBErr: errDocumentShowFailed,
			}, &knowledgeBaseReaderStub{}, nil),
			target: errDocumentShowFailed,
			call: func(s *appservice.DocumentAppService) error {
				_, err := s.Show(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG1")
				return fmt.Errorf("show: %w", err)
			},
		},
		{
			name: "list failed",
			svc: appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
				listErr: errDocumentListFailed,
			}, &knowledgeBaseReaderStub{}, nil),
			target: errDocumentListFailed,
			call: func(s *appservice.DocumentAppService) error {
				_, err := s.List(context.Background(), &docdto.ListDocumentInput{})
				return fmt.Errorf("list: %w", err)
			},
		},
	}
	for _, tc := range errorCases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			if err := tc.call(tc.svc); !errors.Is(err, tc.target) {
				t.Fatalf("expected %v, got %v", tc.target, err)
			}
		})
	}
}

func TestDocumentAppServiceCountAndDestroyErrors(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
	}
	kbReader := &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{Code: testKnowledgeBaseCode},
		routeCollection:        "kb_custom",
	}

	countSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		countByKnowledgeErr: errDocumentCountFailed,
	}, &knowledgeBaseReaderStub{}, nil)
	if _, err := countSvc.CountByKnowledgeBaseCodes(context.Background(), "ORG1", []string{testKnowledgeBaseCode}); !errors.Is(err, errDocumentCountFailed) {
		t.Fatalf("expected count error, got %v", err)
	}

	kbErrSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: doc,
	}, &knowledgeBaseReaderStub{
		showByCodeAndOrgErr: errKnowledgeBaseShowFail,
	}, nil)
	if err := kbErrSvc.Destroy(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG1"); !errors.Is(err, errKnowledgeBaseShowFail) {
		t.Fatalf("expected kb error, got %v", err)
	}

	destroySvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: doc,
		deleteErr:             errDocumentDestroyFailed,
	}, kbReader, nil, &fragmentDestroyServiceStub{})
	if err := destroySvc.Destroy(context.Background(), testDocumentCode, testKnowledgeBaseCode, "ORG1"); !errors.Is(err, errDocumentDestroyFailed) {
		t.Fatalf("expected destroy error, got %v", err)
	}
}

func TestDocumentAppServiceFetchDocumentHelpers(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		ID:                1,
		Code:              testDocumentCode,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		DocumentFile: &documentdomain.File{
			Type:       "third_platform",
			Name:       "doc",
			URL:        "https://example.com/doc.pdf",
			Extension:  "pdf",
			ThirdID:    "third-a",
			SourceType: "share",
			Size:       12,
		},
		ThirdFileID:       "third-b",
		ThirdPlatformType: "drive",
	}
	domain := &documentDomainServiceStub{
		showResult:            doc,
		showByCodeAndKBResult: doc,
	}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, nil)

	if got, err := appservice.FetchDocumentForSyncForTest(context.Background(), svc, &documentdomain.SyncDocumentInput{Code: testDocumentCode}); !errors.Is(err, shared.ErrDocumentKnowledgeBaseRequired) || got != nil {
		t.Fatalf("expected knowledge base required error, got=%#v err=%v", got, err)
	}
	if got, err := appservice.FetchDocumentForSyncForTest(context.Background(), svc, &documentdomain.SyncDocumentInput{Code: testDocumentCode, KnowledgeBaseCode: testKnowledgeBaseCode}); err != nil || got != doc {
		t.Fatalf("fetch with kb failed: got=%#v err=%v", got, err)
	}
}

func TestDocumentAppServiceSyncStatusHelpers(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{}
	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{}, &knowledgeBaseReaderStub{}, nil)

	if err := appservice.MarkDocumentSyncingForTest(context.Background(), svc, doc); err != nil {
		t.Fatalf("mark syncing failed: %v", err)
	}
	if doc.SyncStatus != shared.SyncStatusSyncing || doc.SyncTimes != 1 {
		t.Fatalf("unexpected syncing state: %#v", doc)
	}

	if err := appservice.FinishSyncForTest(context.Background(), svc, doc, "中文abc"); err != nil {
		t.Fatalf("finish sync failed: %v", err)
	}
	if doc.SyncStatus != shared.SyncStatusSynced || doc.WordCount != len([]rune("中文abc")) {
		t.Fatalf("unexpected finished state: %#v", doc)
	}

	appservice.FailSyncForTest(context.Background(), svc, doc, "boom")
	if doc.SyncStatus != shared.SyncStatusSyncFailed || doc.SyncStatusMessage != "boom" {
		t.Fatalf("unexpected fail state: %#v", doc)
	}
}

func TestDocumentAppServiceDocumentFileHelpers(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		DocumentFile: &documentdomain.File{
			Type:       "third_platform",
			Name:       "doc",
			URL:        "https://example.com/doc.pdf",
			Extension:  "pdf",
			ThirdID:    "third-a",
			SourceType: "share",
			Size:       12,
		},
		ThirdFileID:       "third-b",
		ThirdPlatformType: "drive",
	}

	payload := appservice.BuildDocumentFilePayloadForTest(doc)
	if payload["third_id"] != "third-b" || payload["platform_type"] != "drive" {
		t.Fatalf("unexpected payload: %#v", payload)
	}

	appservice.ApplyResolvedDocumentResultForTest(doc, 7, map[string]any{
		"type":          "external",
		"name":          "doc-final",
		"url":           "https://example.com/final.docx",
		"extension":     "docx",
		"size":          int64(99),
		"third_file_id": "third-c",
		"platform_type": "wiki",
	})
	if doc.DocType != 7 || doc.DocumentFile.Name != "doc-final" || doc.DocumentFile.Extension != "docx" {
		t.Fatalf("unexpected resolved doc: %#v", doc)
	}
	if doc.ThirdFileID != "third-c" || doc.ThirdPlatformType != "wiki" {
		t.Fatalf("unexpected third-platform fields: %#v", doc)
	}
	if got := appservice.ResolveDocumentSourceFileTypeForTest(doc); got != "docx" {
		t.Fatalf("unexpected source file type: %q", got)
	}
	if got := appservice.ResolveDocumentSourceFileTypeForTest(nil); got != "" {
		t.Fatalf("expected empty source file type, got %q", got)
	}
}

func TestDocumentAppServiceHelperErrors(t *testing.T) {
	t.Parallel()

	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showErr:            errDocumentShowFailed,
		showByCodeAndKBErr: errDocumentShowFailed,
		updateErr:          errDocumentUpdateFailed,
	}, &knowledgeBaseReaderStub{}, nil)

	if _, err := appservice.FetchDocumentForSyncForTest(context.Background(), svc, &documentdomain.SyncDocumentInput{Code: testDocumentCode}); err == nil {
		t.Fatal("expected fetch error")
	}
	if _, err := appservice.FetchDocumentForSyncForTest(context.Background(), svc, &documentdomain.SyncDocumentInput{
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
	}); err == nil {
		t.Fatal("expected fetch by kb error")
	}

	doc := &documentdomain.KnowledgeBaseDocument{}
	if err := appservice.MarkDocumentSyncingForTest(context.Background(), svc, doc); err == nil {
		t.Fatal("expected mark syncing error")
	}
	if err := appservice.FinishSyncForTest(context.Background(), svc, doc, "abc"); err == nil {
		t.Fatal("expected finish sync error")
	}
}

func TestIsDocumentSourcePrecheckError(t *testing.T) {
	t.Parallel()

	if !appservice.IsDocumentSourcePrecheckError(appservice.ErrDocumentSourcePrecheckFailed) {
		t.Fatal("expected precheck error to be recognized")
	}
	if !appservice.IsDocumentSourcePrecheckError(errors.Join(errWrappedPrecheck, appservice.ErrDocumentSourcePrecheckFailed)) {
		t.Fatal("expected joined precheck error to be recognized")
	}
	if appservice.IsDocumentSourcePrecheckError(errDocumentShowFailed) {
		t.Fatal("did not expect unrelated error to be recognized")
	}
}

func TestDocumentAppServiceReVectorizedByThirdFileIDSchedulesThirdFileTask(t *testing.T) {
	t.Parallel()

	const (
		orgCode      = "ORG1"
		userID       = "U1"
		platformType = "teamshare"
		thirdFileID  = "FILE-1"
	)

	thirdFileScheduler := &thirdFileSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{}, &knowledgeBaseReaderStub{}, nil, &fragmentDestroyServiceStub{})
	svc.SetThirdFileRevectorizeScheduler(thirdFileScheduler)

	if err := svc.ReVectorizedByThirdFileID(context.Background(), &docdto.ReVectorizedByThirdFileIDInput{
		OrganizationCode:  orgCode,
		UserID:            userID,
		ThirdPlatformType: platformType,
		ThirdFileID:       thirdFileID,
	}); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if thirdFileScheduler.scheduleCalls != 1 {
		t.Fatalf("expected 1 third-file schedule call, got %d", thirdFileScheduler.scheduleCalls)
	}
	if got := thirdFileScheduler.inputs[0]; got.OrganizationCode != orgCode || got.UserID != userID || got.ThirdPlatformType != platformType || got.ThirdFileID != thirdFileID {
		t.Fatalf("unexpected third-file schedule input: %#v", got)
	}
}

func TestDocumentAppServiceSyncRedirectsThirdPlatformResyncToThirdFileFlow(t *testing.T) {
	t.Parallel()

	const thirdFileID = "FILE-1"

	domain := &documentDomainServiceStub{
		showByCodeAndKBResult: &documentdomain.KnowledgeBaseDocument{
			Code:              testDocumentCode,
			KnowledgeBaseCode: testKnowledgeBaseCode,
			OrganizationCode:  "ORG1",
			ThirdPlatformType: "teamshare",
			ThirdFileID:       thirdFileID,
			UpdatedUID:        "DOC-USER",
		},
	}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, nil, &fragmentDestroyServiceStub{})
	thirdFileScheduler := &thirdFileSchedulerStub{}
	svc.SetThirdFileRevectorizeScheduler(thirdFileScheduler)

	err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Code:              testDocumentCode,
		Mode:              documentdomain.SyncModeResync,
		Async:             true,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
			BusinessID:       testKnowledgeBaseCode,
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if thirdFileScheduler.scheduleCalls != 1 {
		t.Fatalf("expected 1 third-file schedule call, got %d", thirdFileScheduler.scheduleCalls)
	}
	if got := thirdFileScheduler.inputs[0]; got.OrganizationCode != "ORG1" || got.UserID != "U1" || got.ThirdPlatformType != "teamshare" || got.ThirdFileID != thirdFileID {
		t.Fatalf("unexpected redirected third-file input: %#v", got)
	}
}

func TestDocumentAppServiceSyncThirdPlatformResyncRunsFanoutInlineWhenSync(t *testing.T) {
	t.Parallel()

	doc1 := newThirdFileMappedDocument(testDocumentCode, "U1")
	doc2 := newThirdFileMappedDocument("DOC2", "U2")
	domain := &documentDomainServiceStub{
		showByCodeAndKBResults: map[string]*documentdomain.KnowledgeBaseDocument{
			testDocumentCode: doc1,
			"DOC2":           doc2,
		},
		listByThirdFileInOrgResult: []*documentdomain.KnowledgeBaseDocument{doc1, doc2},
	}
	scheduler := &documentSyncSchedulerStub{}
	fragmentSvc := &fragmentDestroyServiceStub{}
	svc := appservice.NewDocumentAppServiceForTest(
		t,
		domain,
		&knowledgeBaseReaderStub{
			showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{
				Code:             testKnowledgeBaseCode,
				Model:            "text-embedding-3-small",
				OrganizationCode: "ORG1",
			},
			routeCollection: "collection",
		},
		scheduler,
		fragmentSvc,
	)
	thirdFileScheduler := &thirdFileSchedulerStub{}
	svc.SetThirdFileRevectorizeScheduler(thirdFileScheduler)
	svc.SetThirdPlatformDocumentPortForTest(&thirdPlatformResolverStub{
		result: newThirdPlatformRawContentResolveResult("new content"),
	})
	svc.SetParseServiceForTest(&documentParseServiceStub{})
	svc.SetThirdPlatformProviders(thirdplatformprovider.NewRegistry(&thirdPlatformProviderStub{
		platformType: "teamshare",
	}))

	err := svc.Sync(context.Background(), &documentdomain.SyncDocumentInput{
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: testKnowledgeBaseCode,
		Code:              testDocumentCode,
		Mode:              documentdomain.SyncModeResync,
		BusinessParams: &ctxmeta.BusinessParams{
			OrganizationCode: "ORG1",
			UserID:           "U1",
			BusinessID:       testKnowledgeBaseCode,
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if thirdFileScheduler.scheduleCalls != 0 {
		t.Fatalf("expected third-file scheduler not to be called, got %d", thirdFileScheduler.scheduleCalls)
	}
	if scheduler.scheduleCalls != 0 {
		t.Fatalf("expected document sync scheduler not to be called, got %d", scheduler.scheduleCalls)
	}
	if fragmentSvc.syncFragmentBatchCalls != 2 {
		t.Fatalf("expected fan-out to sync two mapped documents inline, got %d", fragmentSvc.syncFragmentBatchCalls)
	}
	if doc1.DocumentFile == nil || doc2.DocumentFile == nil {
		t.Fatalf("expected source override document file to be applied, got %#v %#v", doc1.DocumentFile, doc2.DocumentFile)
	}
}

func newThirdFileMappedDocument(code, updatedUID string) *documentdomain.KnowledgeBaseDocument {
	return &documentdomain.KnowledgeBaseDocument{
		Code:              code,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		OrganizationCode:  "ORG1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
		UpdatedUID:        updatedUID,
	}
}

func TestDocumentAppServiceRunThirdFileRevectorizeSchedulesSingleMappedDocument(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{
		listByThirdFileInOrgResult: []*documentdomain.KnowledgeBaseDocument{
			{
				Code:              testDocumentCode,
				KnowledgeBaseCode: testKnowledgeBaseCode,
				OrganizationCode:  "ORG1",
				ThirdPlatformType: "teamshare",
				ThirdFileID:       "FILE-1",
			},
		},
	}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, &knowledgeBaseReaderStub{}, scheduler, &fragmentDestroyServiceStub{})
	svc.SetThirdPlatformDocumentPortForTest(&thirdPlatformResolverStub{
		result: newThirdPlatformRawContentResolveResult("new content"),
	})
	svc.SetParseServiceForTest(&documentParseServiceStub{})
	svc.SetThirdPlatformProviders(thirdplatformprovider.NewRegistry(&thirdPlatformProviderStub{
		platformType: "teamshare",
	}))

	err := svc.RunThirdFileRevectorize(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		UserID:            "U1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if domain.lastListByThirdFileOrg != "ORG1" || domain.lastListByThirdFilePlatform != "teamshare" || domain.lastListByThirdFileID != "FILE-1" {
		t.Fatalf("unexpected third file query: %#v", domain)
	}
	if scheduler.scheduleCalls != 1 {
		t.Fatalf("expected 1 schedule call, got %d", scheduler.scheduleCalls)
	}
	if scheduler.inputs[0].Code != testDocumentCode || scheduler.inputs[0].KnowledgeBaseCode != testKnowledgeBaseCode {
		t.Fatalf("unexpected scheduled inputs: %#v", scheduler.inputs)
	}
	if !scheduler.inputs[0].Async || scheduler.inputs[0].Mode != documentdomain.SyncModeResync {
		t.Fatalf("unexpected first scheduled input: %#v", scheduler.inputs[0])
	}
	if scheduler.inputs[0].SourceOverride == nil || scheduler.inputs[0].SourceOverride.Content != "new content" {
		t.Fatalf("expected source override to be forwarded, got %#v", scheduler.inputs[0].SourceOverride)
	}
}

func TestDocumentAppServiceRunThirdFileRevectorizeErrors(t *testing.T) {
	t.Parallel()

	scheduler := &documentSyncSchedulerStub{}

	notFoundSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{}, &knowledgeBaseReaderStub{}, scheduler, &fragmentDestroyServiceStub{})
	if err := notFoundSvc.RunThirdFileRevectorize(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
	}); !errors.Is(err, shared.ErrDocumentNotFound) {
		t.Fatalf("expected document not found, got %v", err)
	}

	fragmentErrSvc := appservice.NewDocumentAppServiceForTest(t,
		&documentDomainServiceStub{listByThirdFileInOrgErr: errFragmentListFailed},
		&knowledgeBaseReaderStub{},
		scheduler,
		&fragmentDestroyServiceStub{},
	)
	if err := fragmentErrSvc.RunThirdFileRevectorize(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
	}); !errors.Is(err, errFragmentListFailed) {
		t.Fatalf("expected third file list error, got %v", err)
	}

	documentErrSvc := appservice.NewDocumentAppServiceForTest(t,
		&documentDomainServiceStub{
			listByThirdFileInOrgResult: []*documentdomain.KnowledgeBaseDocument{
				{KnowledgeBaseCode: testKnowledgeBaseCode, Code: testDocumentCode, OrganizationCode: "ORG1"},
				{KnowledgeBaseCode: "KB2", Code: "DOC2", OrganizationCode: "ORG1"},
			},
		},
		&knowledgeBaseReaderStub{},
		scheduler,
		&fragmentDestroyServiceStub{},
	)
	documentErrSvc.SetThirdPlatformDocumentPortForTest(&thirdPlatformResolverStub{
		result: newThirdPlatformRawContentResolveResult("fanout"),
	})
	documentErrSvc.SetParseServiceForTest(&documentParseServiceStub{})
	documentErrSvc.SetThirdPlatformProviders(thirdplatformprovider.NewRegistry(&thirdPlatformProviderStub{
		platformType: "teamshare",
	}))
	if err := documentErrSvc.RunThirdFileRevectorize(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
	}); err != nil {
		t.Fatalf("expected fan-out success, got %v", err)
	}
	if scheduler.scheduleCalls != 2 {
		t.Fatalf("expected 2 schedule calls for multi-document fan-out, got %d", scheduler.scheduleCalls)
	}

	unsupportedSvc := appservice.NewDocumentAppServiceForTest(t,
		&documentDomainServiceStub{
			listByThirdFileInOrgResult: []*documentdomain.KnowledgeBaseDocument{
				{KnowledgeBaseCode: testKnowledgeBaseCode, Code: testDocumentCode, OrganizationCode: "ORG1", ThirdPlatformType: "unknown", ThirdFileID: "FILE-1"},
			},
		},
		&knowledgeBaseReaderStub{},
		scheduler,
		&fragmentDestroyServiceStub{},
	)
	if err := unsupportedSvc.RunThirdFileRevectorize(context.Background(), &documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  "ORG1",
		ThirdPlatformType: "unknown",
		ThirdFileID:       "FILE-1",
	}); !errors.Is(err, shared.ErrUnsupportedThirdPlatformType) {
		t.Fatalf("expected unsupported platform error, got %v", err)
	}
}

func TestDocumentAppServiceNotifyProjectFileChangeAutoCreatesRealtimeAllBinding(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{}
	kbReader := &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{
			Code:             testKnowledgeBaseCode,
			Model:            "text-embedding-3-small",
			VectorDB:         "odin_qdrant",
			OrganizationCode: "ORG1",
		},
	}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, kbReader, scheduler, &fragmentDestroyServiceStub{})
	svc.SetSourceBindingRepository(&sourceBindingRepositoryStub{
		realtimeBindings: []sourcebindingdomain.Binding{
			{
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: testKnowledgeBaseCode,
				Provider:          sourcebindingdomain.ProviderProject,
				RootType:          sourcebindingdomain.RootTypeProject,
				RootRef:           "900",
				SyncMode:          sourcebindingdomain.SyncModeRealtime,
				Enabled:           true,
				UpdatedUID:        "U1",
			},
		},
	})
	svc.SetProjectFileResolver(&projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			501: {
				Status:           "active",
				OrganizationCode: "ORG1",
				ProjectID:        900,
				ProjectFileID:    501,
				FileName:         "new-file.md",
				Content:          "project content",
				ContentHash:      "hash-501",
				DocType:          1,
				DocumentFile:     map[string]any{"type": "external", "name": "new-file.md", "url": "project://501", "extension": "md"},
			},
		},
	})
	svc.SetProjectFileMetadataReader(&projectFileMetadataReaderStub{
		metas: map[int64]*projectfile.Meta{
			501: {
				Status:           "active",
				OrganizationCode: "ORG1",
				ProjectID:        900,
				ProjectFileID:    501,
				FileName:         "new-file.md",
				FileExtension:    "md",
				UpdatedAt:        "2026-04-08 17:22:22",
			},
		},
	})

	if err := svc.NotifyProjectFileChange(context.Background(), &docdto.NotifyProjectFileChangeInput{ProjectFileID: 501}); err != nil {
		t.Fatalf("NotifyProjectFileChange returned error: %v", err)
	}
	if len(domain.savedDocs) != 1 {
		t.Fatalf("expected one auto-created document, got %#v", domain.savedDocs)
	}
	if !domain.savedDocs[0].AutoAdded || domain.savedDocs[0].ProjectFileID != 501 {
		t.Fatalf("unexpected saved document: %#v", domain.savedDocs[0])
	}
	if scheduler.scheduleCalls != 1 || scheduler.inputs[0].Mode != documentdomain.SyncModeCreate {
		t.Fatalf("expected one create sync, got %#v", scheduler.inputs)
	}
	if scheduler.inputs[0].SourceOverride != nil {
		t.Fatalf("expected standard project binding not to inject source override, got %#v", scheduler.inputs[0].SourceOverride)
	}
}

func TestDocumentAppServiceNotifyProjectFileChangeSkipsNonRealtimeBindings(t *testing.T) {
	t.Parallel()

	domain := &documentDomainServiceStub{}
	kbReader := &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{
			Code:             testKnowledgeBaseCode,
			Model:            "text-embedding-3-small",
			VectorDB:         "odin_qdrant",
			OrganizationCode: "ORG1",
		},
	}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, kbReader, scheduler, &fragmentDestroyServiceStub{})
	svc.SetSourceBindingRepository(&sourceBindingRepositoryStub{
		realtimeBindings: []sourcebindingdomain.Binding{
			{
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: testKnowledgeBaseCode,
				Provider:          sourcebindingdomain.ProviderProject,
				RootType:          sourcebindingdomain.RootTypeProject,
				RootRef:           "900",
				SyncMode:          sourcebindingdomain.SyncModeRealtime,
				Enabled:           true,
				Targets: []sourcebindingdomain.BindingTarget{
					{TargetType: sourcebindingdomain.TargetTypeFile, TargetRef: "999"},
				},
			},
			{
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: "KB2",
				Provider:          sourcebindingdomain.ProviderProject,
				RootType:          sourcebindingdomain.RootTypeProject,
				RootRef:           "900",
				SyncMode:          sourcebindingdomain.SyncModeManual,
				Enabled:           true,
			},
		},
	})
	svc.SetProjectFileResolver(&projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			502: {
				Status:           "active",
				OrganizationCode: "ORG1",
				ProjectID:        900,
				ProjectFileID:    502,
				FileName:         "skip-file.md",
				Content:          "project content",
				ContentHash:      "hash-502",
				DocType:          1,
				DocumentFile:     map[string]any{"type": "external", "name": "skip-file.md", "url": "project://502", "extension": "md"},
			},
		},
	})
	svc.SetProjectFileMetadataReader(&projectFileMetadataReaderStub{
		metas: map[int64]*projectfile.Meta{
			502: {
				Status:           "active",
				OrganizationCode: "ORG1",
				ProjectID:        900,
				ProjectFileID:    502,
				FileName:         "skip-file.md",
				FileExtension:    "md",
				UpdatedAt:        "2026-04-08 17:22:22",
			},
		},
	})

	if err := svc.NotifyProjectFileChange(context.Background(), &docdto.NotifyProjectFileChangeInput{ProjectFileID: 502}); err != nil {
		t.Fatalf("NotifyProjectFileChange returned error: %v", err)
	}
	if len(domain.savedDocs) != 0 {
		t.Fatalf("expected no auto-created documents, got %#v", domain.savedDocs)
	}
	if scheduler.scheduleCalls != 0 {
		t.Fatalf("expected no sync scheduling, got %#v", scheduler.inputs)
	}
}

func TestDocumentAppServiceNotifyProjectFileChangeDeletesAndResyncsExistingDocs(t *testing.T) {
	t.Parallel()

	existing := &documentdomain.KnowledgeBaseDocument{
		ID:                1,
		Code:              testDocumentCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		OrganizationCode:  "ORG1",
		SourceBindingID:   1,
		ProjectID:         900,
		ProjectFileID:     503,
	}
	svc, _, scheduler := newRealtimeProjectChangeService(t, existing, &projectfile.ResolveResult{
		Status:           "active",
		OrganizationCode: "ORG1",
		ProjectID:        900,
		ProjectFileID:    503,
		FileName:         "existing.md",
		Content:          "updated content",
		ContentHash:      "hash-503",
		DocType:          1,
		DocumentFile:     map[string]any{"type": "external", "name": "existing.md", "url": "project://503", "extension": "md"},
	})

	if err := svc.NotifyProjectFileChange(context.Background(), &docdto.NotifyProjectFileChangeInput{ProjectFileID: 503}); err != nil {
		t.Fatalf("NotifyProjectFileChange returned error: %v", err)
	}
	if scheduler.scheduleCalls != 1 || scheduler.inputs[0].Mode != documentdomain.SyncModeResync {
		t.Fatalf("expected one resync schedule, got %#v", scheduler.inputs)
	}

	var domain *documentDomainServiceStub
	svc, domain, _ = newRealtimeProjectChangeService(t, existing, &projectfile.ResolveResult{
		Status:           "deleted",
		OrganizationCode: "ORG1",
		ProjectID:        900,
		ProjectFileID:    503,
	})

	if err := svc.NotifyProjectFileChange(context.Background(), &docdto.NotifyProjectFileChangeInput{ProjectFileID: 503}); err != nil {
		t.Fatalf("NotifyProjectFileChange delete returned error: %v", err)
	}
	if domain.deletedID != 1 {
		t.Fatalf("expected existing document to be destroyed, got %#v", domain)
	}
}

func TestDocumentAppServiceNotifyProjectFileChangeUsesEnterpriseSourceOverride(t *testing.T) {
	t.Parallel()

	assertProjectFileChangeUsesEnterpriseSourceOverride(
		t,
		projectFileEnterpriseOverrideCase{
			knowledgeBaseCode: "KB-ENT",
			knowledgeBaseType: knowledgebase.KnowledgeBaseTypeDigitalEmployee,
			sourceType:        int(knowledgebase.SourceTypeEnterpriseWiki),
			projectID:         900,
			projectFileID:     504,
			fileName:          "enterprise.md",
			content:           "enterprise content",
		},
	)
}

func TestDocumentAppServiceNotifyProjectFileChangeUsesEnterpriseSourceOverrideForFlowKnowledgeBase(t *testing.T) {
	t.Parallel()

	assertProjectFileChangeUsesEnterpriseSourceOverride(
		t,
		projectFileEnterpriseOverrideCase{
			knowledgeBaseCode: "KB-FLOW-ENT",
			knowledgeBaseType: knowledgebase.KnowledgeBaseTypeFlowVector,
			sourceType:        int(knowledgebase.SourceTypeLegacyEnterpriseWiki),
			projectID:         901,
			projectFileID:     505,
			fileName:          "flow-enterprise.md",
			content:           "flow enterprise content",
		},
	)
}

type projectFileEnterpriseOverrideCase struct {
	knowledgeBaseCode string
	knowledgeBaseType knowledgebase.Type
	sourceType        int
	projectID         int64
	projectFileID     int64
	fileName          string
	content           string
}

func assertProjectFileChangeUsesEnterpriseSourceOverride(
	t *testing.T,
	tc projectFileEnterpriseOverrideCase,
) {
	t.Helper()

	svc, domain, scheduler := newProjectFileEnterpriseOverrideService(t, tc)
	if err := svc.NotifyProjectFileChange(context.Background(), &docdto.NotifyProjectFileChangeInput{ProjectFileID: tc.projectFileID}); err != nil {
		t.Fatalf("NotifyProjectFileChange returned error: %v", err)
	}
	if len(domain.savedDocs) != 1 {
		t.Fatalf("expected one auto-created document, got %#v", domain.savedDocs)
	}
	if scheduler.scheduleCalls != 1 || scheduler.inputs[0].SourceOverride == nil {
		t.Fatalf("expected one create sync with source override, got %#v", scheduler.inputs)
	}
	if scheduler.inputs[0].SourceOverride.Content != tc.content {
		t.Fatalf("expected enterprise source override content %q, got %#v", tc.content, scheduler.inputs[0].SourceOverride)
	}
}

func newProjectFileEnterpriseOverrideService(
	t *testing.T,
	tc projectFileEnterpriseOverrideCase,
) (*appservice.DocumentAppService, *documentDomainServiceStub, *documentSyncSchedulerStub) {
	t.Helper()

	domain := &documentDomainServiceStub{}
	kbReader := &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{
			Code:              tc.knowledgeBaseCode,
			Model:             "text-embedding-3-small",
			VectorDB:          "odin_qdrant",
			OrganizationCode:  "ORG1",
			SourceType:        &tc.sourceType,
			KnowledgeBaseType: tc.knowledgeBaseType,
		},
		listResult: []*knowledgebase.KnowledgeBase{
			{
				Code:              tc.knowledgeBaseCode,
				OrganizationCode:  "ORG1",
				SourceType:        &tc.sourceType,
				KnowledgeBaseType: tc.knowledgeBaseType,
			},
		},
	}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, domain, kbReader, scheduler, &fragmentDestroyServiceStub{})
	configureProjectFileEnterpriseOverrideService(svc, tc)
	return svc, domain, scheduler
}

func configureProjectFileEnterpriseOverrideService(
	svc *appservice.DocumentAppService,
	tc projectFileEnterpriseOverrideCase,
) {
	if svc == nil {
		return
	}
	svc.SetSourceBindingRepository(&sourceBindingRepositoryStub{
		realtimeBindings: []sourcebindingdomain.Binding{
			{
				ID:                7,
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: tc.knowledgeBaseCode,
				Provider:          sourcebindingdomain.ProviderProject,
				RootType:          sourcebindingdomain.RootTypeProject,
				RootRef:           fmt.Sprintf("%d", tc.projectID),
				SyncMode:          sourcebindingdomain.SyncModeRealtime,
				Enabled:           true,
				UpdatedUID:        "U1",
			},
		},
	})
	svc.SetProjectFileResolver(&projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{
			tc.projectFileID: {
				Status:           "active",
				OrganizationCode: "ORG1",
				ProjectID:        tc.projectID,
				ProjectFileID:    tc.projectFileID,
				FileName:         tc.fileName,
				Content:          tc.content,
				ContentHash:      fmt.Sprintf("hash-%d", tc.projectFileID),
				DocType:          1,
				DocumentFile:     map[string]any{"type": "external", "name": tc.fileName, "url": fmt.Sprintf("project://%d", tc.projectFileID), "extension": "md"},
			},
		},
	})
	svc.SetProjectFileMetadataReader(&projectFileMetadataReaderStub{
		metas: map[int64]*projectfile.Meta{
			tc.projectFileID: {
				Status:           "active",
				OrganizationCode: "ORG1",
				ProjectID:        tc.projectID,
				ProjectFileID:    tc.projectFileID,
				FileName:         tc.fileName,
				FileExtension:    "md",
				UpdatedAt:        "2026-04-08 17:22:22",
			},
		},
	})
}

type documentDomainServiceStub struct {
	showResult                   *documentdomain.KnowledgeBaseDocument
	showErr                      error
	showByCodeAndKBResult        *documentdomain.KnowledgeBaseDocument
	showByCodeAndKBResults       map[string]*documentdomain.KnowledgeBaseDocument
	showByCodeAndKBErr           error
	findByKBAndThirdResult       *documentdomain.KnowledgeBaseDocument
	findByKBAndThirdErr          error
	findByKBAndProjectResult     *documentdomain.KnowledgeBaseDocument
	findByKBAndProjectErr        error
	listByProjectFileInOrgResult []*documentdomain.KnowledgeBaseDocument
	listByProjectFileInOrgErr    error
	listByThirdFileInOrgResult   []*documentdomain.KnowledgeBaseDocument
	listByThirdFileInOrgErr      error
	listByKBAndProjectResult     []*documentdomain.KnowledgeBaseDocument
	listByKBAndProjectErr        error
	listResult                   []*documentdomain.KnowledgeBaseDocument
	listTotal                    int64
	listErr                      error
	countByKnowledgeResult       map[string]int64
	countByKnowledgeErr          error
	saveErr                      error
	updateErr                    error
	deleteErr                    error

	lastListQuery               *documentdomain.Query
	lastListByThirdFileOrg      string
	lastListByThirdFilePlatform string
	lastListByThirdFileID       string
	deletedID                   int64
	savedDocs                   []*documentdomain.KnowledgeBaseDocument
	updateCalls                 int
	lastUpdatedDoc              *documentdomain.KnowledgeBaseDocument
}

func (s *documentDomainServiceStub) Save(_ context.Context, doc *documentdomain.KnowledgeBaseDocument) error {
	if doc != nil {
		cloned := *doc
		s.savedDocs = append(s.savedDocs, &cloned)
		s.showByCodeAndKBResult = &cloned
		s.showResult = &cloned
	}
	return s.saveErr
}

func (s *documentDomainServiceStub) Update(_ context.Context, doc *documentdomain.KnowledgeBaseDocument) error {
	s.updateCalls++
	if doc != nil {
		cloned := *doc
		s.lastUpdatedDoc = &cloned
		s.showByCodeAndKBResult = &cloned
		s.showResult = &cloned
	}
	return s.updateErr
}

func (s *documentDomainServiceStub) Show(context.Context, string) (*documentdomain.KnowledgeBaseDocument, error) {
	return s.showResult, s.showErr
}

func (s *documentDomainServiceStub) ShowByCodeAndKnowledgeBase(_ context.Context, code, _ string) (*documentdomain.KnowledgeBaseDocument, error) {
	if len(s.showByCodeAndKBResults) > 0 {
		return s.showByCodeAndKBResults[code], s.showByCodeAndKBErr
	}
	return s.showByCodeAndKBResult, s.showByCodeAndKBErr
}

func (s *documentDomainServiceStub) FindByKnowledgeBaseAndThirdFile(context.Context, string, string, string) (*documentdomain.KnowledgeBaseDocument, error) {
	return s.findByKBAndThirdResult, s.findByKBAndThirdErr
}

func (s *documentDomainServiceStub) FindByKnowledgeBaseAndProjectFile(context.Context, string, int64) (*documentdomain.KnowledgeBaseDocument, error) {
	if s.findByKBAndProjectErr != nil {
		return nil, s.findByKBAndProjectErr
	}
	if s.findByKBAndProjectResult == nil {
		return nil, shared.ErrDocumentNotFound
	}
	return s.findByKBAndProjectResult, nil
}

func (s *documentDomainServiceStub) ListByProjectFileInOrg(context.Context, string, int64) ([]*documentdomain.KnowledgeBaseDocument, error) {
	if s.listByProjectFileInOrgErr != nil {
		return nil, s.listByProjectFileInOrgErr
	}
	return s.listByProjectFileInOrgResult, nil
}

func (s *documentDomainServiceStub) ResolveThirdFileDocumentPlan(_ context.Context, input documentdomain.ThirdFileDocumentPlanInput) (documentdomain.ThirdFileDocumentPlan, error) {
	var docs []*documentdomain.KnowledgeBaseDocument
	s.lastListByThirdFileOrg = input.OrganizationCode
	s.lastListByThirdFilePlatform = input.ThirdPlatformType
	s.lastListByThirdFileID = input.ThirdFileID
	if s.listByThirdFileInOrgErr != nil {
		return documentdomain.ThirdFileDocumentPlan{}, s.listByThirdFileInOrgErr
	}
	docs = s.listByThirdFileInOrgResult
	seed, err := documentdomain.BuildThirdFileRevectorizeSeed(&documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  input.OrganizationCode,
		ThirdPlatformType: input.ThirdPlatformType,
		ThirdFileID:       input.ThirdFileID,
	}, docs)
	if err != nil {
		return documentdomain.ThirdFileDocumentPlan{}, fmt.Errorf("build third-file revectorize seed: %w", err)
	}
	return documentdomain.ThirdFileDocumentPlan{
		Documents: docs,
		Seed:      seed,
	}, nil
}

func (s *documentDomainServiceStub) ListByThirdFileInOrg(_ context.Context, organizationCode, thirdPlatformType, thirdFileID string) ([]*documentdomain.KnowledgeBaseDocument, error) {
	s.lastListByThirdFileOrg = organizationCode
	s.lastListByThirdFilePlatform = thirdPlatformType
	s.lastListByThirdFileID = thirdFileID
	return s.listByThirdFileInOrgResult, s.listByThirdFileInOrgErr
}

func (s *documentDomainServiceStub) ListByKnowledgeBaseAndProject(context.Context, string, int64) ([]*documentdomain.KnowledgeBaseDocument, error) {
	return s.listByKBAndProjectResult, s.listByKBAndProjectErr
}

func (s *documentDomainServiceStub) List(_ context.Context, query *documentdomain.Query) ([]*documentdomain.KnowledgeBaseDocument, int64, error) {
	s.lastListQuery = query
	return s.listResult, s.listTotal, s.listErr
}

func (s *documentDomainServiceStub) CountByKnowledgeBaseCodes(context.Context, string, []string) (map[string]int64, error) {
	return s.countByKnowledgeResult, s.countByKnowledgeErr
}

func (s *documentDomainServiceStub) Delete(_ context.Context, id int64) error {
	s.deletedID = id
	return s.deleteErr
}

func (s *documentDomainServiceStub) UpdateSyncStatus(context.Context, *documentdomain.KnowledgeBaseDocument) error {
	return s.updateErr
}

type sourceBindingRepositoryStub struct {
	realtimeBindings []sourcebindingdomain.Binding
	sourceItems      []*sourcebindingdomain.SourceItem
}

type knowledgeBaseBindingRepositoryStub struct {
	bindIDsByKnowledgeBase map[string][]string
	err                    error
}

func (s *knowledgeBaseBindingRepositoryStub) ListBindIDsByKnowledgeBase(
	_ context.Context,
	knowledgeBaseCode string,
	_ knowledgebase.BindingType,
) ([]string, error) {
	if s.err != nil {
		return nil, s.err
	}
	if s.bindIDsByKnowledgeBase == nil {
		return nil, nil
	}
	return slices.Clone(s.bindIDsByKnowledgeBase[knowledgeBaseCode]), nil
}

func (s *knowledgeBaseBindingRepositoryStub) ListBindIDsByKnowledgeBases(
	_ context.Context,
	knowledgeBaseCodes []string,
	_ knowledgebase.BindingType,
) (map[string][]string, error) {
	if s.err != nil {
		return nil, s.err
	}
	result := make(map[string][]string, len(knowledgeBaseCodes))
	for _, code := range knowledgeBaseCodes {
		result[code] = slices.Clone(s.bindIDsByKnowledgeBase[code])
	}
	return result, nil
}

func (s *sourceBindingRepositoryStub) ReplaceBindings(context.Context, string, []sourcebindingdomain.Binding) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (s *sourceBindingRepositoryStub) SaveBindings(context.Context, string, []sourcebindingdomain.Binding) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (s *sourceBindingRepositoryStub) ListBindingsByKnowledgeBase(context.Context, string) ([]sourcebindingdomain.Binding, error) {
	return nil, nil
}

func (s *sourceBindingRepositoryStub) ListRealtimeProjectBindingsByProject(context.Context, string, int64) ([]sourcebindingdomain.Binding, error) {
	return slices.Clone(s.realtimeBindings), nil
}

func (s *sourceBindingRepositoryStub) UpsertSourceItem(_ context.Context, item sourcebindingdomain.SourceItem) (*sourcebindingdomain.SourceItem, error) {
	item.ID = int64(len(s.sourceItems) + 1)
	cloned := item
	s.sourceItems = append(s.sourceItems, &cloned)
	return &cloned, nil
}

func (s *sourceBindingRepositoryStub) ReplaceBindingItems(context.Context, int64, []sourcebindingdomain.BindingItem) error {
	return nil
}

func (s *sourceBindingRepositoryStub) ListBindingItemsByKnowledgeBase(context.Context, string) ([]sourcebindingdomain.BindingItem, error) {
	return nil, nil
}

type projectFileResolverStub struct {
	resolveResults map[int64]*projectfile.ResolveResult
	links          map[int64]string
}

func (s *projectFileResolverStub) Resolve(_ context.Context, projectFileID int64) (*projectfile.ResolveResult, error) {
	return s.resolveResults[projectFileID], nil
}

func (s *projectFileResolverStub) ListByProject(context.Context, int64) ([]projectfile.ListItem, error) {
	return nil, nil
}

func (s *projectFileResolverStub) GetLink(_ context.Context, projectFileID int64, _ time.Duration) (string, error) {
	if s.links == nil {
		return "", nil
	}
	return s.links[projectFileID], nil
}

type projectFileMetadataReaderStub struct {
	metas map[int64]*projectfile.Meta
}

func (s *projectFileMetadataReaderStub) FindByID(_ context.Context, projectFileID int64) (meta *projectfile.Meta, err error) {
	if s == nil || s.metas == nil {
		var zeroMeta *projectfile.Meta
		return zeroMeta, nil
	}
	return s.metas[projectFileID], nil
}

func newRealtimeProjectChangeService(
	tb testing.TB,
	existing *documentdomain.KnowledgeBaseDocument,
	resolved *projectfile.ResolveResult,
) (*appservice.DocumentAppService, *documentDomainServiceStub, *documentSyncSchedulerStub) {
	tb.Helper()

	domain := &documentDomainServiceStub{
		showByCodeAndKBResult:        existing,
		findByKBAndProjectResult:     existing,
		listByProjectFileInOrgResult: []*documentdomain.KnowledgeBaseDocument{existing},
	}
	kbReader := &knowledgeBaseReaderStub{
		showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{Code: testKnowledgeBaseCode, OrganizationCode: "ORG1"},
		routeCollection:        "kb_custom",
	}
	scheduler := &documentSyncSchedulerStub{}
	svc := appservice.NewDocumentAppServiceForTest(tb, domain, kbReader, scheduler, &fragmentDestroyServiceStub{})
	svc.SetSourceBindingRepository(&sourceBindingRepositoryStub{
		realtimeBindings: []sourcebindingdomain.Binding{
			{
				ID:                1,
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: testKnowledgeBaseCode,
				Provider:          sourcebindingdomain.ProviderProject,
				RootType:          sourcebindingdomain.RootTypeProject,
				RootRef:           "900",
				SyncMode:          sourcebindingdomain.SyncModeRealtime,
				Enabled:           true,
				UpdatedUID:        "U1",
			},
		},
	})
	svc.SetProjectFileResolver(&projectFileResolverStub{
		resolveResults: map[int64]*projectfile.ResolveResult{503: resolved},
	})
	svc.SetProjectFileMetadataReader(&projectFileMetadataReaderStub{
		metas: map[int64]*projectfile.Meta{
			503: {
				Status:           strings.TrimSpace(resolved.Status),
				OrganizationCode: strings.TrimSpace(resolved.OrganizationCode),
				ProjectID:        resolved.ProjectID,
				ProjectFileID:    resolved.ProjectFileID,
				FileKey:          resolved.FileKey,
				RelativeFilePath: resolved.RelativeFilePath,
				FileName:         resolved.FileName,
				FileExtension:    resolved.FileExtension,
				UpdatedAt:        resolved.UpdatedAt,
			},
		},
	})
	return svc, domain, scheduler
}

type fragmentDestroyServiceStub struct {
	deletePointsByDocumentCalls int
	deleteByDocumentCalls       int
	updateCalls                 int
	updateBatchCalls            int
	listCalls                   int
	listByDocumentCalls         int
	deletePointDataCalls        int
	deletePointDataBatchCalls   int
	destroyCalls                int
	destroyBatchCalls           int
	syncFragmentBatchCalls      int
	lastCollectionName          string
	lastKnowledgeCode           string
	lastDocumentCode            string
	lastListQuery               *fragmodel.Query
	listResult                  []*fragmodel.KnowledgeBaseFragment
	listTotal                   int64
	listErr                     error
}

func (s *fragmentDestroyServiceStub) SaveBatch(context.Context, []*fragmodel.KnowledgeBaseFragment) error {
	return nil
}

func (s *fragmentDestroyServiceStub) Update(context.Context, *fragmodel.KnowledgeBaseFragment) error {
	s.updateCalls++
	return nil
}

func (s *fragmentDestroyServiceStub) UpdateBatch(context.Context, []*fragmodel.KnowledgeBaseFragment) error {
	s.updateBatchCalls++
	return nil
}

func (s *fragmentDestroyServiceStub) List(_ context.Context, query *fragmodel.Query) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	s.listCalls++
	s.lastListQuery = query
	return s.listResult, s.listTotal, s.listErr
}

func (s *fragmentDestroyServiceStub) ListByDocument(context.Context, string, string, int, int) ([]*fragmodel.KnowledgeBaseFragment, int64, error) {
	s.listByDocumentCalls++
	return nil, 0, nil
}

func (*fragmentDestroyServiceStub) ListExistingPointIDs(context.Context, string, []string) (map[string]struct{}, error) {
	return map[string]struct{}{}, nil
}

func (s *fragmentDestroyServiceStub) SyncFragmentBatch(context.Context, any, []*fragmodel.KnowledgeBaseFragment, *ctxmeta.BusinessParams) error {
	s.syncFragmentBatchCalls++
	return nil
}

func (s *fragmentDestroyServiceStub) DeletePointData(context.Context, string, string, string) error {
	s.deletePointDataCalls++
	return nil
}

func (s *fragmentDestroyServiceStub) DeletePointDataBatch(context.Context, string, string, []string) error {
	s.deletePointDataBatchCalls++
	return nil
}

func (s *fragmentDestroyServiceStub) DeletePointsByDocument(_ context.Context, collectionName, _, _, documentCode string) error {
	s.deletePointsByDocumentCalls++
	s.lastCollectionName = collectionName
	s.lastDocumentCode = documentCode
	return nil
}

func (s *fragmentDestroyServiceStub) DeleteByDocument(_ context.Context, knowledgeCode, documentCode string) error {
	s.deleteByDocumentCalls++
	s.lastKnowledgeCode = knowledgeCode
	s.lastDocumentCode = documentCode
	return nil
}

func (s *fragmentDestroyServiceStub) Destroy(_ context.Context, fragment *fragmodel.KnowledgeBaseFragment, collectionName string) error {
	s.destroyCalls++
	s.lastCollectionName = collectionName
	if fragment != nil {
		s.lastDocumentCode = fragment.DocumentCode
	}
	return nil
}

func (s *fragmentDestroyServiceStub) DestroyBatch(_ context.Context, fragments []*fragmodel.KnowledgeBaseFragment, collectionName string) error {
	s.destroyBatchCalls++
	s.lastCollectionName = collectionName
	if len(fragments) > 0 && fragments[0] != nil {
		s.lastDocumentCode = fragments[0].DocumentCode
	}
	return nil
}

type knowledgeBaseReaderStub struct {
	showByCodeAndOrgResult *knowledgebase.KnowledgeBase
	showByCodeAndOrgErr    error
	showResult             *knowledgebase.KnowledgeBase
	showErr                error
	listResult             []*knowledgebase.KnowledgeBase
	listTotal              int64
	listErr                error
	lastListQuery          *knowledgebase.Query
	routeCollection        string
	routeModel             string
}

func (s *knowledgeBaseReaderStub) ShowByCodeAndOrg(_ context.Context, code, orgCode string) (*knowledgebase.KnowledgeBase, error) {
	if s.showByCodeAndOrgResult != nil || s.showByCodeAndOrgErr != nil {
		return s.showByCodeAndOrgResult, s.showByCodeAndOrgErr
	}
	return &knowledgebase.KnowledgeBase{
		Code:             code,
		OrganizationCode: orgCode,
		Model:            "text-embedding-3-small",
	}, nil
}

func (s *knowledgeBaseReaderStub) Show(_ context.Context, code string) (*knowledgebase.KnowledgeBase, error) {
	if s.showResult != nil || s.showErr != nil {
		return s.showResult, s.showErr
	}
	return &knowledgebase.KnowledgeBase{
		Code:  code,
		Model: "text-embedding-3-small",
	}, nil
}

func (s *knowledgeBaseReaderStub) List(_ context.Context, query *knowledgebase.Query) ([]*knowledgebase.KnowledgeBase, int64, error) {
	s.lastListQuery = query
	return s.listResult, s.listTotal, s.listErr
}

func (s *knowledgeBaseReaderStub) ResolveRuntimeRoute(_ context.Context, kb *knowledgebase.KnowledgeBase) sharedroute.ResolvedRoute {
	model := s.routeModel
	if model == "" && kb != nil {
		model = kb.Model
	}
	if model == "" {
		if s.showByCodeAndOrgResult != nil {
			model = s.showByCodeAndOrgResult.Model
		}
	}
	return sharedroute.ResolvedRoute{
		LogicalCollectionName:  s.routeCollection,
		PhysicalCollectionName: s.routeCollection,
		VectorCollectionName:   s.routeCollection,
		TermCollectionName:     s.routeCollection,
		Model:                  model,
	}
}

type documentSyncSchedulerStub struct {
	scheduleCalls int
	ctxs          []context.Context
	inputs        []*documentdomain.SyncDocumentInput
}

func (s *documentSyncSchedulerStub) Schedule(ctx context.Context, input *documentdomain.SyncDocumentInput) {
	s.scheduleCalls++
	s.ctxs = append(s.ctxs, ctx)
	s.inputs = append(s.inputs, input)
}

type thirdFileSchedulerStub struct {
	scheduleCalls int
	ctxs          []context.Context
	inputs        []*documentdomain.ThirdFileRevectorizeInput
}

func (s *thirdFileSchedulerStub) Schedule(ctx context.Context, input *documentdomain.ThirdFileRevectorizeInput) {
	s.scheduleCalls++
	s.ctxs = append(s.ctxs, ctx)
	s.inputs = append(s.inputs, input)
}

type thirdPlatformProviderStub struct {
	platformType  string
	latestContent *thirdplatformprovider.LatestContentResult
	latestErr     error
}

func (s *thirdPlatformProviderStub) PlatformType() string {
	return s.platformType
}

func (s *thirdPlatformProviderStub) BuildInitialDocument(context.Context, thirdplatformprovider.BuildInitialDocumentInput) (*thirdplatformprovider.InitialDocumentSpec, error) {
	return &thirdplatformprovider.InitialDocumentSpec{
		Name:         "doc",
		DocType:      int(documentdomain.DocTypeText),
		DocumentFile: &documentdomain.File{Type: "third_platform"},
	}, nil
}

func (s *thirdPlatformProviderStub) ResolveLatestContent(context.Context, thirdplatformprovider.ResolveLatestContentInput) (*thirdplatformprovider.LatestContentResult, error) {
	if s.latestErr != nil {
		return nil, s.latestErr
	}
	return s.latestContent, nil
}

type thirdPlatformResolverStub struct {
	result    *thirdplatform.DocumentResolveResult
	err       error
	lastInput *thirdplatform.DocumentResolveInput
}

func (s *thirdPlatformResolverStub) Resolve(_ context.Context, input thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error) {
	s.lastInput = &input
	return s.result, s.err
}

func newThirdPlatformRawContentResolveResult(content string) *thirdplatform.DocumentResolveResult {
	return &thirdplatform.DocumentResolveResult{
		SourceKind: thirdplatform.DocumentSourceKindRawContent,
		RawContent: content,
		DocType:    int(documentdomain.DocTypeText),
		DocumentFile: map[string]any{
			"type":          "third_platform",
			"name":          "doc.md",
			"third_file_id": "FILE-1",
			"source_type":   "teamshare",
			"extension":     "md",
		},
	}
}

type documentParseServiceStub struct {
	parseDocumentResult *documentdomain.ParsedDocument
	parseDocumentErr    error
	readerCalls         int
	urlCalls            int
	lastReaderContent   string
}

func (s *documentParseServiceStub) ValidateSource(context.Context, string) error {
	return nil
}

func (s *documentParseServiceStub) Parse(context.Context, string, string) (string, error) {
	if s.parseDocumentErr != nil {
		return "", s.parseDocumentErr
	}
	if s.parseDocumentResult != nil {
		return s.parseDocumentResult.BestEffortText(), nil
	}
	return "", nil
}

func (s *documentParseServiceStub) ParseDocument(context.Context, string, string) (*documentdomain.ParsedDocument, error) {
	if s.parseDocumentErr != nil {
		return nil, s.parseDocumentErr
	}
	if s.parseDocumentResult != nil {
		return s.parseDocumentResult, nil
	}
	return documentdomain.NewPlainTextParsedDocument("txt", ""), nil
}

func (s *documentParseServiceStub) ParseDocumentReaderWithOptions(
	_ context.Context,
	_ string,
	file io.Reader,
	fileType string,
	_ documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	s.readerCalls++
	if s.parseDocumentErr != nil {
		return nil, s.parseDocumentErr
	}
	data, err := io.ReadAll(file)
	if err != nil {
		return nil, fmt.Errorf("read parse reader input: %w", err)
	}
	s.lastReaderContent = string(data)
	if s.parseDocumentResult != nil {
		return s.parseDocumentResult, nil
	}
	return documentdomain.NewPlainTextParsedDocument(fileType, s.lastReaderContent), nil
}

func (s *documentParseServiceStub) ParseDocumentWithOptions(
	ctx context.Context,
	rawURL, ext string,
	_ documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	s.urlCalls++
	return s.ParseDocument(ctx, rawURL, ext)
}

func (s *documentParseServiceStub) ResolveFileType(context.Context, string) (string, error) {
	return "", nil
}
