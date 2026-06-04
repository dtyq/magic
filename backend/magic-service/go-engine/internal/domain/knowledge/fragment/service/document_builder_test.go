package fragdomain_test

import (
	"strings"
	"testing"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
	sharedsnapshot "magic/internal/domain/knowledge/shared/snapshot"
)

func TestAssembleDocumentFragmentsCopiesDocumentSourceMetadata(t *testing.T) {
	t.Parallel()

	sourceURL := "https://docs.example.test/main/openflow?docid=ext-001"
	fragments, err := fragdomain.AssembleDocumentFragments(fragdomain.DocumentFragmentAssembleInput{
		Doc: &fragmodel.KnowledgeBaseDocument{
			KnowledgeDocumentSnapshot: sharedsnapshot.KnowledgeDocumentSnapshot{
				OrganizationCode:  "ORG-1",
				KnowledgeBaseCode: "KB-1",
				Name:              "external document.md",
				Code:              "DOC-1",
				DocType:           1,
				UpdatedUID:        "U-1",
			},
			DocumentFile: &fragmodel.DocumentFile{
				Name:       "external document.md",
				URL:        sourceURL,
				FileKey:    "ORG-1/kb/source/external-document.md",
				ThirdID:    "external_source:ext-001",
				SourceType: "external_docs",
			},
			ThirdPlatformType: "external_docs",
			ThirdFileID:       "external_source:ext-001",
		},
		Chunks: []fragdomain.TokenChunk{
			{
				Content:    "正文第一段",
				TokenCount: 8,
				Metadata: map[string]any{
					"source_url":      "https://wrong.example.test/doc",
					"url":             "https://wrong.example.test/doc",
					"source_provider": "wrong-provider",
				},
			},
		},
		SplitVersion: "split-v1",
	})
	if err != nil {
		t.Fatalf("AssembleDocumentFragments returned error: %v", err)
	}
	if len(fragments) != 1 {
		t.Fatalf("expected one fragment, got %#v", fragments)
	}
	metadata := fragments[0].Metadata
	if metadata["source_url"] != sourceURL || metadata["url"] != sourceURL {
		t.Fatalf("expected source url metadata, got %#v", metadata)
	}
	if metadata["source_provider"] != "external_docs" ||
		metadata["third_file_id"] != "external_source:ext-001" ||
		metadata["file_key"] != "ORG-1/kb/source/external-document.md" ||
		metadata["source_title"] != "external document.md" {
		t.Fatalf("unexpected source metadata: %#v", metadata)
	}
	if strings.Contains(fragments[0].Content, sourceURL) {
		t.Fatalf("source url should not be written into fragment content: %q", fragments[0].Content)
	}
}

func TestAssembleDocumentFragmentsKeepsFileKeyWithoutSourceURL(t *testing.T) {
	t.Parallel()

	fragments, err := fragdomain.AssembleDocumentFragments(fragdomain.DocumentFragmentAssembleInput{
		Doc: &fragmodel.KnowledgeBaseDocument{
			KnowledgeDocumentSnapshot: sharedsnapshot.KnowledgeDocumentSnapshot{
				OrganizationCode:  "ORG-1",
				KnowledgeBaseCode: "KB-1",
				Name:              "内部资料.pdf",
				Code:              "DOC-1",
				DocType:           2,
				UpdatedUID:        "U-1",
			},
			DocumentFile: &fragmodel.DocumentFile{
				Name:    "内部资料.pdf",
				FileKey: "ORG-1/kb/source/内部资料.pdf",
			},
		},
		Chunks:       []fragdomain.TokenChunk{{Content: "正文第一段"}},
		SplitVersion: "split-v1",
	})
	if err != nil {
		t.Fatalf("AssembleDocumentFragments returned error: %v", err)
	}
	if len(fragments) != 1 || fragments[0].Metadata["file_key"] != "ORG-1/kb/source/内部资料.pdf" {
		t.Fatalf("expected file_key metadata without source URL, got %#v", fragments)
	}
}

func TestAssembleDocumentFragmentsFallsBackToStorageURLFileKey(t *testing.T) {
	t.Parallel()

	fragments, err := fragdomain.AssembleDocumentFragments(fragdomain.DocumentFragmentAssembleInput{
		Doc: &fragmodel.KnowledgeBaseDocument{
			KnowledgeDocumentSnapshot: sharedsnapshot.KnowledgeDocumentSnapshot{
				OrganizationCode:  "ORG-1",
				KnowledgeBaseCode: "KB-1",
				Name:              "历史资料.md",
				Code:              "DOC-1",
				DocType:           2,
				UpdatedUID:        "U-1",
			},
			DocumentFile: &fragmodel.DocumentFile{
				Name: "历史资料.md",
				URL:  "ORG-1/kb/source/历史资料.md",
			},
		},
		Chunks:       []fragdomain.TokenChunk{{Content: "正文第一段"}},
		SplitVersion: "split-v1",
	})
	if err != nil {
		t.Fatalf("AssembleDocumentFragments returned error: %v", err)
	}
	if len(fragments) != 1 || fragments[0].Metadata["file_key"] != "ORG-1/kb/source/历史资料.md" {
		t.Fatalf("expected storage URL to be exposed as file_key, got %#v", fragments)
	}
}

func TestAssembleDocumentFragmentsDoesNotUseExternalURLAsFileKey(t *testing.T) {
	t.Parallel()

	fragments, err := fragdomain.AssembleDocumentFragments(fragdomain.DocumentFragmentAssembleInput{
		Doc: &fragmodel.KnowledgeBaseDocument{
			KnowledgeDocumentSnapshot: sharedsnapshot.KnowledgeDocumentSnapshot{
				OrganizationCode:  "ORG-1",
				KnowledgeBaseCode: "KB-1",
				Name:              "外部资料.md",
				Code:              "DOC-1",
				DocType:           2,
				UpdatedUID:        "U-1",
			},
			DocumentFile: &fragmodel.DocumentFile{
				Name: "外部资料.md",
				URL:  "https://example.test/source.md",
			},
		},
		Chunks:       []fragdomain.TokenChunk{{Content: "正文第一段"}},
		SplitVersion: "split-v1",
	})
	if err != nil {
		t.Fatalf("AssembleDocumentFragments returned error: %v", err)
	}
	if len(fragments) != 1 || fragments[0].Metadata["file_key"] != nil {
		t.Fatalf("external URL should not be exposed as file_key, got %#v", fragments)
	}
}

func TestAssembleDocumentFragmentsBuildsStableThirdPlatformFileKey(t *testing.T) {
	t.Parallel()

	fragments, err := fragdomain.AssembleDocumentFragments(fragdomain.DocumentFragmentAssembleInput{
		Doc: &fragmodel.KnowledgeBaseDocument{
			KnowledgeDocumentSnapshot: sharedsnapshot.KnowledgeDocumentSnapshot{
				OrganizationCode:  "ORG-1",
				KnowledgeBaseCode: "KB-1",
				Name:              "第三方资料.md",
				Code:              "DOC-1",
				DocType:           2,
				UpdatedUID:        "U-1",
			},
			DocumentFile: &fragmodel.DocumentFile{
				Type:       "third_platform",
				Name:       "第三方资料.md",
				SourceType: "teamshare",
				ThirdID:    "FILE-1",
				URL:        "https://example.test/temporary/download?token=1",
			},
			ThirdPlatformType: "teamshare",
			ThirdFileID:       "FILE-1",
		},
		Chunks:       []fragdomain.TokenChunk{{Content: "正文第一段"}},
		SplitVersion: "split-v1",
	})
	if err != nil {
		t.Fatalf("AssembleDocumentFragments returned error: %v", err)
	}
	if len(fragments) != 1 || fragments[0].Metadata["file_key"] != "third_platform/teamshare/FILE-1" {
		t.Fatalf("expected stable third-platform file_key, got %#v", fragments)
	}
}
