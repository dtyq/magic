package docapp_test

import (
	"context"
	"errors"
	"net/http"
	"testing"
	"time"

	appservice "magic/internal/application/knowledge/document/service"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/pkg/thirdplatform"
)

var errOriginalFileLinkBoom = errors.New("original file link boom")

const testOriginalFileLinkTypeThirdPlatform = "third_platform"

type originalFileLinkProviderStub struct {
	link       string
	err        error
	callCount  int
	lastPath   string
	lastMethod string
	lastExpire time.Duration
}

func (s *originalFileLinkProviderStub) GetLink(_ context.Context, path, method string, expire time.Duration) (string, error) {
	s.callCount++
	s.lastPath = path
	s.lastMethod = method
	s.lastExpire = expire
	if s.err != nil {
		return "", s.err
	}
	return s.link, nil
}

func TestDocumentAppServiceGetOriginalFileLink(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC1",
		Name:              "doc-display.md",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile: &documentdomain.File{
			Type: "external",
			Name: "doc.md",
			URL:  "ORG1/path/doc.md",
		},
	}
	provider := &originalFileLinkProviderStub{link: "https://example.com/doc.md"}
	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: doc,
	}, &knowledgeBaseReaderStub{}, nil)
	svc.SetOriginalFileLinkProvider(provider)

	result, err := svc.GetOriginalFileLink(context.Background(), "DOC1", "KB1", "ORG1")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !result.Available || result.URL != "https://example.com/doc.md" {
		t.Fatalf("unexpected result: %#v", result)
	}
	if result.Key != "ORG1/path/doc.md" || result.Type != "external" || result.Name != "doc.md" {
		t.Fatalf("unexpected metadata: %#v", result)
	}
	if provider.callCount != 1 || provider.lastPath != "ORG1/path/doc.md" || provider.lastMethod != http.MethodGet {
		t.Fatalf("unexpected provider state: %#v", provider)
	}
	if provider.lastExpire <= 0 {
		t.Fatalf("expected positive expire, got %v", provider.lastExpire)
	}
}

func TestDocumentAppServiceGetOriginalFileLinkUsesRenamedDocumentFileName(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-RENAMED",
		Name:              "门店数据.txt",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocMetadata: map[string]any{
			documentdomain.ParsedMetaFileName: "门店数据.txt",
		},
		DocumentFile: &documentdomain.File{
			Type:      "external",
			Name:      "门店数据.txt",
			URL:       "ORG1/path/doc.txt",
			Extension: "txt",
		},
	}
	doc.ApplyUpdate(documentdomain.BuildUpdatePatch(&documentdomain.UpdateDocumentInput{
		Name: "门店数据 2222.md",
	}))

	provider := &originalFileLinkProviderStub{link: "https://example.com/doc.txt"}
	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: doc,
	}, &knowledgeBaseReaderStub{}, nil)
	svc.SetOriginalFileLinkProvider(provider)

	result, err := svc.GetOriginalFileLink(context.Background(), "DOC-RENAMED", "KB1", "ORG1")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || result.Name != "门店数据 2222.md" {
		t.Fatalf("expected renamed original file link name, got %#v", result)
	}
}

func TestDocumentAppServiceGetOriginalFileLinkProjectFile(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-PROJECT",
		Name:              "录音功能优化讨论.md",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		ProjectFileID:     501,
		DocumentFile: &documentdomain.File{
			Type:       "project_file",
			Name:       "录音功能优化讨论.md",
			FileKey:    "ORG1/project/录音功能优化讨论.md",
			SourceType: "project",
		},
	}
	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: doc,
	}, &knowledgeBaseReaderStub{}, nil)
	svc.SetProjectFileContentAccessor(&projectFileResolverStub{
		links: map[int64]string{
			501: "https://example.com/project-file.md?signature=get-only",
		},
	})

	result, err := svc.GetOriginalFileLink(context.Background(), "DOC-PROJECT", "KB1", "ORG1")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !result.Available {
		t.Fatalf("expected available project file link, got %#v", result)
	}
	if result.URL != "https://example.com/project-file.md?signature=get-only" {
		t.Fatalf("unexpected project file link: %#v", result)
	}
	if result.Key != "ORG1/project/录音功能优化讨论.md" || result.Type != "project_file" || result.Name != "录音功能优化讨论.md" {
		t.Fatalf("unexpected project file metadata: %#v", result)
	}
}

func TestDocumentAppServiceGetOriginalFileLinkThirdPlatformDownloadURL(t *testing.T) {
	t.Parallel()

	doc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC-THIRD",
		Name:              "测试向量化",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		ThirdPlatformType: "teamshare",
		ThirdFileID:       "FILE-1",
		DocumentFile: &documentdomain.File{
			Type:       testOriginalFileLinkTypeThirdPlatform,
			Name:       "测试向量化",
			ThirdID:    "FILE-1",
			SourceType: "teamshare",
		},
	}
	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: doc,
	}, &knowledgeBaseReaderStub{}, nil)
	svc.SetThirdPlatformDocumentPortForTest(&thirdPlatformResolverStub{
		result: &thirdplatform.DocumentResolveResult{
			SourceKind:  thirdplatform.DocumentSourceKindDownloadURL,
			DownloadURL: "https://example.com/teamshare/file.docx?token=1",
			DocumentFile: map[string]any{
				"type":          testOriginalFileLinkTypeThirdPlatform,
				"name":          "测试向量化.docx",
				"third_file_id": "FILE-1",
				"source_type":   "teamshare",
				"extension":     "docx",
			},
		},
	})

	result, err := svc.GetOriginalFileLink(context.Background(), "DOC-THIRD", "KB1", "ORG1")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !result.Available {
		t.Fatalf("expected available third-platform link, got %#v", result)
	}
	if result.URL != "https://example.com/teamshare/file.docx?token=1" {
		t.Fatalf("unexpected third-platform url: %#v", result)
	}
	if result.Key != "https://example.com/teamshare/file.docx?token=1" || result.Type != testOriginalFileLinkTypeThirdPlatform || result.Name != "测试向量化.docx" {
		t.Fatalf("unexpected third-platform metadata: %#v", result)
	}
}

func TestDocumentAppServiceGetOriginalFileLinkUnsupportedAndErrors(t *testing.T) {
	t.Parallel()

	externalDoc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC1",
		Name:              "doc-display.md",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile: &documentdomain.File{
			Type: "external",
			Name: "doc.md",
			URL:  "ORG1/path/doc.md",
		},
	}
	thirdDoc := &documentdomain.KnowledgeBaseDocument{
		Code:              "DOC2",
		Name:              "cloud-doc",
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		DocumentFile: &documentdomain.File{
			Type: "third_platform",
			Name: "cloud-doc",
			URL:  "ORG1/ignored",
		},
	}
	provider := &originalFileLinkProviderStub{}
	svc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: thirdDoc,
	}, &knowledgeBaseReaderStub{}, nil)
	svc.SetOriginalFileLinkProvider(provider)

	result, err := svc.GetOriginalFileLink(context.Background(), "DOC2", "KB1", "ORG1")
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || result.Available || result.Type != "third_platform" {
		t.Fatalf("unexpected unsupported result: %#v", result)
	}
	if provider.callCount != 0 {
		t.Fatalf("expected provider not called, got %d", provider.callCount)
	}

	mismatchSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: &documentdomain.KnowledgeBaseDocument{
			Code:              "DOC3",
			OrganizationCode:  "ORG2",
			KnowledgeBaseCode: "KB1",
			DocumentFile:      &documentdomain.File{Type: "external", URL: "ORG2/doc.md"},
		},
	}, &knowledgeBaseReaderStub{}, nil)
	if _, err := mismatchSvc.GetOriginalFileLink(context.Background(), "DOC3", "KB1", "ORG1"); !errors.Is(err, appservice.ErrDocumentOrgMismatch) {
		t.Fatalf("expected org mismatch, got %v", err)
	}

	errSvc := appservice.NewDocumentAppServiceForTest(t, &documentDomainServiceStub{
		showByCodeAndKBResult: externalDoc,
	}, &knowledgeBaseReaderStub{}, nil)
	errSvc.SetOriginalFileLinkProvider(&originalFileLinkProviderStub{err: errOriginalFileLinkBoom})
	if _, err := errSvc.GetOriginalFileLink(context.Background(), "DOC1", "KB1", "ORG1"); !errors.Is(err, errOriginalFileLinkBoom) {
		t.Fatalf("expected provider error, got %v", err)
	}
}
