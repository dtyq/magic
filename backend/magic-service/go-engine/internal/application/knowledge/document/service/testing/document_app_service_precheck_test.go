package docapp_test

import (
	"context"
	"errors"
	"io"
	"strings"
	"testing"
	"time"

	documentapp "magic/internal/application/knowledge/document/service"
	documentdomain "magic/internal/domain/knowledge/document/service"
	knowledgebase "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/thirdplatform"
	"magic/internal/pkg/tokenizer"
)

var errTestFetch = errors.New("fetch not implemented")

var (
	errTestBucketNotFound    = errors.New("bucket not found")
	errTestShouldNotBeCalled = errors.New("should not be called")
)

type precheckFetcher struct {
	statFn func(context.Context, string) error
}

func (f *precheckFetcher) Fetch(ctx context.Context, path string) (io.ReadCloser, error) {
	return nil, errTestFetch
}

func (f *precheckFetcher) GetLink(ctx context.Context, path, method string, expire time.Duration) (string, error) {
	return "", nil
}

func (f *precheckFetcher) Stat(ctx context.Context, path string) error {
	if f.statFn == nil {
		return nil
	}
	return f.statFn(ctx, path)
}

type noopThirdPlatformPort struct{}

func (p *noopThirdPlatformPort) Resolve(context.Context, thirdplatform.DocumentResolveInput) (*thirdplatform.DocumentResolveResult, error) {
	return &thirdplatform.DocumentResolveResult{DocumentFile: map[string]any{}}, nil
}

func TestPreflightDocumentSourceForTest_ReturnsPrecheckError(t *testing.T) {
	t.Parallel()
	parseSvc := documentdomain.NewParseService(&precheckFetcher{
		statFn: func(context.Context, string) error {
			return errTestBucketNotFound
		},
	}, nil, logging.New())
	appSvc := documentapp.NewDocumentAppService(nil, nil, nil, documentapp.AppDeps{
		ParseService: parseSvc,
		Tokenizer:    tokenizer.NewService(),
	}, logging.New())

	doc := &documentdomain.KnowledgeBaseDocument{
		DocumentFile: &documentdomain.File{URL: "DT001/path/to/file.md"},
	}
	err := documentapp.PreflightDocumentSourceForTest(context.Background(), appSvc, doc)
	if err == nil {
		t.Fatal("expected error but got nil")
	}
	if !errors.Is(err, documentapp.ErrDocumentSourcePrecheckFailed) {
		t.Fatalf("expected ErrDocumentSourcePrecheckFailed, got %v", err)
	}
	if !strings.Contains(err.Error(), "bucket not found") {
		t.Fatalf("unexpected error detail: %v", err)
	}
}

func TestPreflightDocumentSourceForTest_SkipWhenThirdPlatformPortEnabled(t *testing.T) {
	t.Parallel()
	statCalls := 0
	parseSvc := documentdomain.NewParseService(&precheckFetcher{
		statFn: func(context.Context, string) error {
			statCalls++
			return errTestShouldNotBeCalled
		},
	}, nil, logging.New())
	appSvc := documentapp.NewDocumentAppService(nil, nil, nil, documentapp.AppDeps{
		ParseService:              parseSvc,
		ThirdPlatformDocumentPort: &noopThirdPlatformPort{},
		Tokenizer:                 tokenizer.NewService(),
	}, logging.New())

	doc := &documentdomain.KnowledgeBaseDocument{
		ThirdFileID: "third-file-1",
		DocumentFile: &documentdomain.File{
			Type: "third_platform",
		},
	}
	if err := documentapp.PreflightDocumentSourceForTest(context.Background(), appSvc, doc); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if statCalls != 0 {
		t.Fatalf("expected Stat not called, got %d", statCalls)
	}
}

func TestPreflightDocumentSourceForTest_ProjectFileSkipsGenericURLStat(t *testing.T) {
	t.Parallel()

	statCalls := 0
	parseSvc := documentdomain.NewParseService(&precheckFetcher{
		statFn: func(context.Context, string) error {
			statCalls++
			return errTestShouldNotBeCalled
		},
	}, nil, logging.New())
	appSvc := documentapp.NewDocumentAppServiceForTest(
		t,
		&documentDomainServiceStub{},
		&knowledgeBaseReaderStub{
			showByCodeAndOrgResult: &knowledgebase.KnowledgeBase{
				Code:             "KB1",
				OrganizationCode: "ORG1",
			},
		},
		nil,
	)
	appSvc.SetParseServiceForTest(parseSvc)
	appSvc.SetProjectFileContentAccessor(&projectFileResolverStub{
		links: map[int64]string{
			501: "https://example.com/project-file.md?signature=get-only",
		},
	})

	doc := &documentdomain.KnowledgeBaseDocument{
		KnowledgeBaseCode: "KB1",
		OrganizationCode:  "ORG1",
		ProjectFileID:     501,
		DocumentFile: &documentdomain.File{
			Type:       "project_file",
			SourceType: "project",
			Name:       "demo.md",
			Extension:  "md",
		},
	}

	if err := documentapp.PreflightDocumentSourceForTest(context.Background(), appSvc, doc); err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if statCalls != 0 {
		t.Fatalf("expected generic Stat not called for project file precheck, got %d", statCalls)
	}
}
