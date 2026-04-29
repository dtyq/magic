package docapp_test

import (
	"encoding/json"
	"testing"

	appservice "magic/internal/application/knowledge/document/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

func TestKnowledgeBaseSnapshotFromDomainIsolation(t *testing.T) {
	t.Parallel()

	kb := &kbentity.KnowledgeBase{
		Code:             "KB-1",
		OrganizationCode: "ORG-1",
		Model:            "model-a",
		RetrieveConfig:   &shared.RetrieveConfig{TopK: 4},
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeCustom,
			Normal: &shared.NormalFragmentConfig{
				TextPreprocessRule: []int{2},
				SegmentRule:        &shared.SegmentRule{ChunkSize: 300},
			},
		},
		EmbeddingConfig: &shared.EmbeddingConfig{
			ModelID: "embed-a",
			Extra: map[string]json.RawMessage{
				"provider": json.RawMessage(`"openai"`),
			},
		},
		ResolvedRoute: &sharedroute.ResolvedRoute{
			VectorCollectionName: "vector-a",
			Model:                "route-a",
		},
	}

	snapshot := appservice.KnowledgeBaseSnapshotFromDomainForTest(kb)
	kb.RetrieveConfig.TopK = 10
	kb.FragmentConfig.Normal.SegmentRule.ChunkSize = 900
	kb.EmbeddingConfig.ModelID = "embed-b"
	kb.ResolvedRoute.Model = "route-b"

	if snapshot.RetrieveConfig.TopK != 4 ||
		snapshot.FragmentConfig.Normal.SegmentRule.ChunkSize != 300 ||
		snapshot.EmbeddingConfig.ModelID != "embed-a" ||
		snapshot.ResolvedRoute.Model != "route-a" {
		t.Fatalf("expected isolated snapshot, got %#v", snapshot)
	}
}

func TestFragDocumentFromDomainIsolation(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: "KB-1",
		Code:              "DOC-1",
		Name:              "doc.md",
		DocType:           int(docentity.DocumentInputKindFile),
		DocMetadata:       map[string]any{"channel": "local"},
		DocumentFile: &docentity.File{
			Name:      "doc.md",
			Extension: "md",
		},
		RetrieveConfig:  &shared.RetrieveConfig{TopK: 5},
		EmbeddingConfig: &shared.EmbeddingConfig{ModelID: "embed-a"},
	}

	snapshot := appservice.FragDocumentFromDomainForTest(doc)
	doc.DocMetadata["channel"] = "remote"
	doc.DocumentFile.Extension = "txt"
	doc.RetrieveConfig.TopK = 8
	doc.EmbeddingConfig.ModelID = "embed-b"

	if snapshot.DocMetadata["channel"] != "local" ||
		snapshot.DocumentFile.Extension != "md" ||
		snapshot.RetrieveConfig.TopK != 5 ||
		snapshot.EmbeddingConfig.ModelID != "embed-a" {
		t.Fatalf("expected isolated fragment document snapshot, got %#v", snapshot)
	}
}
