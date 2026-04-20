package fragdomain_test

import (
	"context"
	"errors"
	"strings"
	"testing"

	fragdomain "magic/internal/domain/knowledge/fragment/service"
	"magic/internal/domain/knowledge/shared"
)

const testManualWriteAutoDocumentCode = "DOC-AUTO"

var (
	errManualWriteShouldNotLoadByCode = errors.New("should not load by code")
	errManualWriteLookupFailed        = errors.New("lookup failed")
)

func TestBuildManualWriteLifecycleUsesExistingDocumentByCode(t *testing.T) {
	t.Parallel()

	existingDoc := &fragdomain.KnowledgeBaseDocument{
		Code:             "DOC-1",
		Name:             "Document 1",
		DocType:          1,
		OrganizationCode: "ORG-1",
	}

	result, err := fragdomain.BuildManualWriteLifecycle(
		context.Background(),
		fragdomain.ManualWriteLifecycleInput{
			KnowledgeBase: &struct{ Code string }{Code: "KB-1"},
			Fragment: fragdomain.ManualFragmentInput{
				KnowledgeCode:    "KB-1",
				DocumentCode:     "DOC-1",
				Content:          "hello world",
				UserID:           "U-1",
				OrganizationCode: "ORG-1",
			},
		},
		fragdomain.ManualWriteLifecyclePorts{
			LoadDocumentByCode: func(context.Context, string, string) (*fragdomain.KnowledgeBaseDocument, error) {
				return existingDoc, nil
			},
		},
	)
	if err != nil {
		t.Fatalf("build manual write lifecycle failed: %v", err)
	}
	if result.Document != existingDoc {
		t.Fatalf("expected existing document, got %#v", result.Document)
	}
	if result.Fragment == nil || result.Fragment.DocumentCode != "DOC-1" || result.Fragment.DocumentName != "Document 1" {
		t.Fatalf("unexpected fragment: %#v", result.Fragment)
	}
}

func TestBuildManualWriteLifecycleFallsBackToManualDocument(t *testing.T) {
	t.Parallel()

	result, err := fragdomain.BuildManualWriteLifecycle(
		context.Background(),
		fragdomain.ManualWriteLifecycleInput{
			KnowledgeBase: &struct {
				Code  string
				Model string
			}{
				Code:  "KB-1",
				Model: "text-embedding-3-small",
			},
			Fragment: fragdomain.ManualFragmentInput{
				KnowledgeCode:    "KB-1",
				DocumentCode:     testManualWriteAutoDocumentCode,
				Content:          "hello world",
				UserID:           "U-1",
				OrganizationCode: "ORG-1",
			},
		},
		fragdomain.ManualWriteLifecyclePorts{
			LoadDocumentByCode: func(context.Context, string, string) (*fragdomain.KnowledgeBaseDocument, error) {
				return nil, fragdomain.ErrManualWriteDocumentMissing
			},
		},
	)
	if err != nil {
		t.Fatalf("build manual write lifecycle failed: %v", err)
	}
	if result.Document == nil || result.Document.Code != testManualWriteAutoDocumentCode || result.Document.Name != testManualWriteAutoDocumentCode {
		t.Fatalf("unexpected fallback document: %#v", result.Document)
	}
	if result.Document.SyncStatus != shared.SyncStatusSynced || result.Document.EmbeddingModel != "text-embedding-3-small" {
		t.Fatalf("unexpected fallback document state: %#v", result.Document)
	}
	if result.Fragment == nil || result.Fragment.DocumentCode != testManualWriteAutoDocumentCode || result.Fragment.DocumentType != 1 {
		t.Fatalf("unexpected fallback fragment: %#v", result.Fragment)
	}
}

func TestBuildManualWriteLifecycleBuildsLegacyThirdPlatformDocument(t *testing.T) {
	t.Parallel()

	result, err := fragdomain.BuildManualWriteLifecycle(
		context.Background(),
		fragdomain.ManualWriteLifecycleInput{
			KnowledgeBase: &struct {
				Code  string
				Model string
			}{
				Code:  "KB-1",
				Model: "text-embedding-3-small",
			},
			Fragment: fragdomain.ManualFragmentInput{
				KnowledgeCode:    "KB-1",
				Content:          "hello world",
				UserID:           "U-1",
				OrganizationCode: "ORG-1",
				Metadata: map[string]any{
					"file_id":             "FILE-1",
					"third_platform_type": "teamshare",
				},
			},
		},
		fragdomain.ManualWriteLifecyclePorts{
			LoadDocumentByCode: func(context.Context, string, string) (*fragdomain.KnowledgeBaseDocument, error) {
				return nil, errManualWriteShouldNotLoadByCode
			},
			FindDocumentByLegacyThirdFile: func(context.Context, string, string, string) (*fragdomain.KnowledgeBaseDocument, error) {
				return nil, fragdomain.ErrManualWriteDocumentMissing
			},
			BuildLegacyThirdPlatformDocSpec: func(context.Context, fragdomain.LegacyThirdPlatformDocumentSeed) (*fragdomain.LegacyThirdPlatformDocumentSpec, error) {
				return &fragdomain.LegacyThirdPlatformDocumentSpec{
					Name:              "file.docx",
					DocType:           2,
					DocumentFile:      &fragdomain.File{Name: "file.docx", Type: "third_platform", Extension: "docx", ThirdID: "FILE-1"},
					ThirdPlatformType: "teamshare",
					ThirdFileID:       "FILE-1",
					UserID:            "U-1",
					OrganizationCode:  "ORG-1",
				}, nil
			},
		},
	)
	if err != nil {
		t.Fatalf("build manual write lifecycle failed: %v", err)
	}
	if result.Document == nil || result.Document.ThirdPlatformType != "teamshare" || result.Document.ThirdFileID != "FILE-1" {
		t.Fatalf("unexpected legacy document: %#v", result.Document)
	}
	if !strings.HasPrefix(result.Document.Code, "DOCUMENT-") {
		t.Fatalf("expected legacy document code prefix, got %#v", result.Document)
	}
	if result.Fragment == nil || result.Fragment.DocumentCode != result.Document.Code || result.Fragment.DocumentName != "file.docx" {
		t.Fatalf("unexpected legacy fragment: %#v", result.Fragment)
	}
}

func TestBuildManualWriteLifecycleReturnsLegacyDocumentLookupError(t *testing.T) {
	t.Parallel()

	_, err := fragdomain.BuildManualWriteLifecycle(
		context.Background(),
		fragdomain.ManualWriteLifecycleInput{
			KnowledgeBase: &struct{ Code string }{Code: "KB-1"},
			Fragment: fragdomain.ManualFragmentInput{
				KnowledgeCode:    "KB-1",
				Content:          "hello world",
				UserID:           "U-1",
				OrganizationCode: "ORG-1",
				Metadata: map[string]any{
					"file_id": "FILE-1",
				},
			},
		},
		fragdomain.ManualWriteLifecyclePorts{
			LoadDocumentByCode: func(context.Context, string, string) (*fragdomain.KnowledgeBaseDocument, error) {
				return nil, errManualWriteShouldNotLoadByCode
			},
			FindDocumentByLegacyThirdFile: func(context.Context, string, string, string) (*fragdomain.KnowledgeBaseDocument, error) {
				return nil, errManualWriteLookupFailed
			},
		},
	)
	if !errors.Is(err, errManualWriteLookupFailed) {
		t.Fatalf("expected lookup error, got %v", err)
	}
}
