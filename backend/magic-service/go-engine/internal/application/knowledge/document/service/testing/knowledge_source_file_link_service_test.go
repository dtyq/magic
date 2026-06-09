package docapp_test

import (
	"context"
	"errors"
	"testing"

	appservice "magic/internal/application/knowledge/document/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	"magic/internal/pkg/thirdplatform"
	"magic/internal/pkg/webauth"
)

var errSourceFileAuthUnavailable = errors.New("source file auth unavailable")

const (
	testSourceFileTypeExternal    = "external"
	testSourceFileTypeProjectFile = "project_file"
)

type sourceFileAuthStub struct {
	user webauth.User
	err  error
}

func (s sourceFileAuthStub) Authenticate(context.Context, webauth.Request) (webauth.User, error) {
	if s.err != nil {
		return webauth.User{}, s.err
	}
	return s.user, nil
}

func TestKnowledgeSourceFileLinkServiceExternalFile(t *testing.T) {
	t.Parallel()

	provider := &originalFileLinkProviderStub{link: "https://download.test/doc.md"}
	service := newKnowledgeSourceFileLinkServiceForTest(
		t,
		sourceFileAuthStub{user: webauth.User{UserID: "USER1", OrganizationCode: "ORG1"}},
		&documentDomainServiceStub{
			showByCodeAndKBResult: &docentity.KnowledgeBaseDocument{
				Code:              "DOC1",
				Name:              "doc-display.md",
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: "KB1",
				DocumentFile: &docentity.File{
					Type:       testSourceFileTypeExternal,
					Name:       "doc.md",
					FileKey:    "ORG1/files/doc.md",
					SourceType: "oss",
				},
			},
		},
		knowledgeSourceFileLinkTestDeps{
			fileLinkProvider: provider,
			permissionReader: documentPermissionReaderStub{operations: map[string]string{"KB1": "read"}},
		},
	)

	result, err := service.GetLink(context.Background(), appservice.KnowledgeSourceFileLinkRequest{
		Authorization:     "token-1",
		KnowledgeBaseCode: "KB1",
		DocumentCode:      "DOC1",
		FileKey:           "ORG1/files/doc.md",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !result.Available {
		t.Fatalf("expected available source file, got %#v", result)
	}
	if result.URL != "https://download.test/doc.md" ||
		result.Key != "ORG1/files/doc.md" ||
		result.Name != "doc.md" ||
		result.Type != testSourceFileTypeExternal ||
		result.SourceType != "oss" ||
		result.LinkType != "download" {
		t.Fatalf("unexpected source file result: %#v", result)
	}
	if provider.callCount != 1 || provider.lastPath != "ORG1/files/doc.md" {
		t.Fatalf("unexpected file link provider state: %#v", provider)
	}
}

func TestKnowledgeSourceFileLinkServiceProjectFile(t *testing.T) {
	t.Parallel()

	service := newKnowledgeSourceFileLinkServiceForTest(
		t,
		sourceFileAuthStub{user: webauth.User{UserID: "USER1", OrganizationCode: "ORG1"}},
		&documentDomainServiceStub{
			showByCodeAndKBResult: &docentity.KnowledgeBaseDocument{
				Code:              "DOC-PROJECT",
				Name:              "project.md",
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: "KB1",
				ProjectFileID:     501,
				DocumentFile: &docentity.File{
					Type:       testSourceFileTypeProjectFile,
					Name:       "project.md",
					FileKey:    "ORG1/project/project.md",
					SourceType: "project",
				},
			},
		},
		knowledgeSourceFileLinkTestDeps{
			projectFileContent: &projectFileResolverStub{
				links: map[int64]string{501: "https://download.test/project.md"},
			},
			permissionReader: documentPermissionReaderStub{operations: map[string]string{"KB1": "read"}},
		},
	)

	result, err := service.GetLink(context.Background(), appservice.KnowledgeSourceFileLinkRequest{
		Authorization:     "token-1",
		KnowledgeBaseCode: "KB1",
		DocumentCode:      "DOC-PROJECT",
		FileKey:           "ORG1/project/project.md",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil ||
		!result.Available ||
		result.URL != "https://download.test/project.md" ||
		result.Type != testSourceFileTypeProjectFile ||
		result.SourceType != "project" ||
		result.LinkType != "download" {
		t.Fatalf("unexpected project source file result: %#v", result)
	}
}

func TestKnowledgeSourceFileLinkServiceThirdPlatformWebLink(t *testing.T) {
	t.Parallel()

	service := newKnowledgeSourceFileLinkServiceForTest(
		t,
		sourceFileAuthStub{user: webauth.User{UserID: "USER1", OrganizationCode: "ORG1"}},
		&documentDomainServiceStub{
			showByCodeAndKBResult: &docentity.KnowledgeBaseDocument{
				Code:              "DOC-EXT",
				Name:              "external doc",
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: "KB1",
				ThirdPlatformType: "external_docs",
				ThirdFileID:       "EXT-1",
				DocumentFile: &docentity.File{
					Type:       "third_platform",
					Name:       "external doc",
					ThirdID:    "EXT-1",
					SourceType: "external_docs",
				},
			},
		},
		knowledgeSourceFileLinkTestDeps{
			thirdPlatformDocument: &thirdPlatformResolverStub{
				result: &thirdplatform.DocumentResolveResult{
					SourceKind: thirdplatform.DocumentSourceKindRawContent,
					DocumentFile: map[string]any{
						"type":        "third_platform",
						"name":        "external doc",
						"url":         "https://docs.example/main/document?docid=EXT-1",
						"source_type": "external_docs",
						"third_id":    "EXT-1",
					},
				},
			},
			permissionReader: documentPermissionReaderStub{operations: map[string]string{"KB1": "read"}},
		},
	)

	result, err := service.GetLink(context.Background(), appservice.KnowledgeSourceFileLinkRequest{
		Authorization:     "token-1",
		KnowledgeBaseCode: "KB1",
		DocumentCode:      "DOC-EXT",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil ||
		!result.Available ||
		result.URL != "https://docs.example/main/document?docid=EXT-1" ||
		result.Key != "third_platform/external_docs/EXT-1" ||
		result.SourceType != "external_docs" ||
		result.LinkType != "web" {
		t.Fatalf("unexpected third-platform web result: %#v", result)
	}
}

func TestKnowledgeSourceFileLinkServiceRejectsMissingAuth(t *testing.T) {
	t.Parallel()

	service := newKnowledgeSourceFileLinkServiceForTest(
		t,
		sourceFileAuthStub{user: webauth.User{UserID: "USER1", OrganizationCode: "ORG1"}},
		&documentDomainServiceStub{},
		knowledgeSourceFileLinkTestDeps{},
	)
	_, err := service.GetLink(context.Background(), appservice.KnowledgeSourceFileLinkRequest{})
	if !errors.Is(err, appservice.ErrKnowledgeSourceFileUnauthorized) {
		t.Fatalf("expected unauthorized, got %v", err)
	}
}

func TestKnowledgeSourceFileLinkServiceRejectsUnavailableAuth(t *testing.T) {
	t.Parallel()

	service := newKnowledgeSourceFileLinkServiceForTest(
		t,
		sourceFileAuthStub{err: errSourceFileAuthUnavailable},
		&documentDomainServiceStub{},
		knowledgeSourceFileLinkTestDeps{},
	)
	_, err := service.GetLink(context.Background(), appservice.KnowledgeSourceFileLinkRequest{
		Authorization: "token-1",
	})
	if !errors.Is(err, appservice.ErrKnowledgeSourceFileAuthUnavailable) {
		t.Fatalf("expected auth unavailable, got %v", err)
	}
}

func TestKnowledgeSourceFileLinkServiceRejectsPermissionDenied(t *testing.T) {
	t.Parallel()

	service := newKnowledgeSourceFileLinkServiceForTest(
		t,
		sourceFileAuthStub{user: webauth.User{UserID: "USER1", OrganizationCode: "ORG1"}},
		&documentDomainServiceStub{},
		knowledgeSourceFileLinkTestDeps{permissionReader: documentPermissionReaderStub{}},
	)
	_, err := service.GetLink(context.Background(), appservice.KnowledgeSourceFileLinkRequest{
		Authorization:     "token-1",
		KnowledgeBaseCode: "KB1",
		DocumentCode:      "DOC1",
	})
	if !errors.Is(err, appservice.ErrDocumentPermissionDenied) {
		t.Fatalf("expected permission denied, got %v", err)
	}
}

func TestKnowledgeSourceFileLinkServiceRejectsFileKeyMismatch(t *testing.T) {
	t.Parallel()

	service := newKnowledgeSourceFileLinkServiceForTest(
		t,
		sourceFileAuthStub{user: webauth.User{UserID: "USER1", OrganizationCode: "ORG1"}},
		&documentDomainServiceStub{
			showByCodeAndKBResult: &docentity.KnowledgeBaseDocument{
				Code:              "DOC1",
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: "KB1",
				DocumentFile:      &docentity.File{Type: testSourceFileTypeExternal, Name: "doc.md", FileKey: "ORG1/files/doc.md"},
			},
		},
		knowledgeSourceFileLinkTestDeps{
			fileLinkProvider: &originalFileLinkProviderStub{link: "https://download.test/doc.md"},
			permissionReader: documentPermissionReaderStub{operations: map[string]string{"KB1": "read"}},
		},
	)
	_, err := service.GetLink(context.Background(), appservice.KnowledgeSourceFileLinkRequest{
		Authorization:     "token-1",
		KnowledgeBaseCode: "KB1",
		DocumentCode:      "DOC1",
		FileKey:           "ORG1/files/other.md",
	})
	if !errors.Is(err, appservice.ErrKnowledgeSourceFileKeyMismatch) {
		t.Fatalf("expected key mismatch, got %v", err)
	}
}

func TestKnowledgeSourceFileLinkServiceReturnsUnavailableWithoutSourceFile(t *testing.T) {
	t.Parallel()

	service := newKnowledgeSourceFileLinkServiceForTest(
		t,
		sourceFileAuthStub{user: webauth.User{UserID: "USER1", OrganizationCode: "ORG1"}},
		&documentDomainServiceStub{
			showByCodeAndKBResult: &docentity.KnowledgeBaseDocument{
				Code:              "DOC1",
				OrganizationCode:  "ORG1",
				KnowledgeBaseCode: "KB1",
			},
		},
		knowledgeSourceFileLinkTestDeps{
			permissionReader: documentPermissionReaderStub{operations: map[string]string{"KB1": "read"}},
		},
	)
	result, err := service.GetLink(context.Background(), appservice.KnowledgeSourceFileLinkRequest{
		Authorization:     "token-1",
		KnowledgeBaseCode: "KB1",
		DocumentCode:      "DOC1",
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || result.Available {
		t.Fatalf("expected unavailable source file result, got %#v", result)
	}
}

type knowledgeSourceFileLinkTestDeps struct {
	fileLinkProvider      appservice.SourceFileObjectLinkProvider
	projectFileContent    *projectFileResolverStub
	thirdPlatformDocument *thirdPlatformResolverStub
	permissionReader      documentPermissionReaderStub
}

func newKnowledgeSourceFileLinkServiceForTest(
	t *testing.T,
	auth appservice.SourceFileWebAuthenticator,
	documentReader appservice.SourceFileDocumentReader,
	deps knowledgeSourceFileLinkTestDeps,
) *appservice.KnowledgeSourceFileLinkService {
	t.Helper()

	return appservice.NewKnowledgeSourceFileLinkService(auth, appservice.KnowledgeSourceFileLinkDeps{
		DocumentReader:            documentReader,
		KnowledgeBaseReader:       &knowledgeBaseReaderStub{},
		PermissionReader:          deps.permissionReader,
		FileLinkProvider:          deps.fileLinkProvider,
		ProjectFileContentPort:    deps.projectFileContent,
		ThirdPlatformDocumentPort: deps.thirdPlatformDocument,
	})
}
