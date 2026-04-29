package fragapp_test

import (
	"encoding/json"
	"testing"

	appservice "magic/internal/application/knowledge/fragment/service"
	docentity "magic/internal/domain/knowledge/document/entity"
	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	"magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
)

func TestKnowledgeBaseSnapshotFromDomainClonesMutableState(t *testing.T) {
	t.Parallel()

	kb := &kbentity.KnowledgeBase{
		Code:             "KB-1",
		OrganizationCode: "ORG-1",
		Model:            "model-a",
		VectorDB:         "qdrant",
		RetrieveConfig:   &shared.RetrieveConfig{TopK: 3},
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeCustom,
			Normal: &shared.NormalFragmentConfig{
				TextPreprocessRule: []int{1},
				SegmentRule:        &shared.SegmentRule{ChunkSize: 128},
			},
		},
		EmbeddingConfig: &shared.EmbeddingConfig{
			ModelID: "embed-a",
			Extra: map[string]json.RawMessage{
				"vendor": json.RawMessage(`"openai"`),
			},
		},
		ResolvedRoute: &sharedroute.ResolvedRoute{
			VectorCollectionName: "vector-a",
			Model:                "route-a",
		},
	}

	snapshot := appservice.KnowledgeBaseSnapshotFromDomainForTest(kb)
	kb.RetrieveConfig.TopK = 9
	kb.FragmentConfig.Normal.TextPreprocessRule[0] = 99
	kb.FragmentConfig.Normal.SegmentRule.ChunkSize = 512
	kb.EmbeddingConfig.ModelID = "embed-b"
	kb.EmbeddingConfig.Extra["vendor"] = json.RawMessage(`"azure"`)
	kb.ResolvedRoute.Model = "route-b"

	if snapshot.RetrieveConfig.TopK != 3 {
		t.Fatalf("expected cloned retrieve config, got %#v", snapshot.RetrieveConfig)
	}
	if snapshot.FragmentConfig.Normal.TextPreprocessRule[0] != 1 || snapshot.FragmentConfig.Normal.SegmentRule.ChunkSize != 128 {
		t.Fatalf("expected cloned fragment config, got %#v", snapshot.FragmentConfig)
	}
	if snapshot.EmbeddingConfig.ModelID != "embed-a" || string(snapshot.EmbeddingConfig.Extra["vendor"]) != `"openai"` {
		t.Fatalf("expected cloned embedding config, got %#v", snapshot.EmbeddingConfig)
	}
	if snapshot.ResolvedRoute == nil || snapshot.ResolvedRoute.Model != "route-a" {
		t.Fatalf("expected cloned resolved route, got %#v", snapshot.ResolvedRoute)
	}
}

func TestFragDocumentFromDomainClonesMutableState(t *testing.T) {
	t.Parallel()

	doc := &docentity.KnowledgeBaseDocument{
		OrganizationCode:  "ORG-1",
		KnowledgeBaseCode: "KB-1",
		Code:              "DOC-1",
		Name:              "doc.md",
		DocType:           int(docentity.DocumentInputKindFile),
		DocMetadata: map[string]any{
			"source": "local",
		},
		DocumentFile: &docentity.File{
			Name:      "doc.md",
			Extension: "md",
		},
		RetrieveConfig: &shared.RetrieveConfig{TopK: 2},
		FragmentConfig: &shared.FragmentConfig{
			Mode: shared.FragmentModeCustom,
			Normal: &shared.NormalFragmentConfig{
				TextPreprocessRule: []int{1},
				SegmentRule:        &shared.SegmentRule{ChunkSize: 256},
			},
		},
		EmbeddingConfig: &shared.EmbeddingConfig{ModelID: "embed-a"},
	}

	snapshot := appservice.FragDocumentFromDomainForTest(doc)
	doc.DocMetadata["source"] = "remote"
	doc.DocumentFile.Extension = "txt"
	doc.RetrieveConfig.TopK = 7
	doc.FragmentConfig.Normal.TextPreprocessRule[0] = 8
	doc.FragmentConfig.Normal.SegmentRule.ChunkSize = 1024
	doc.EmbeddingConfig.ModelID = "embed-b"

	if snapshot.DocMetadata["source"] != "local" {
		t.Fatalf("expected cloned metadata, got %#v", snapshot.DocMetadata)
	}
	if snapshot.DocumentFile == nil || snapshot.DocumentFile.Extension != "md" {
		t.Fatalf("expected cloned document file, got %#v", snapshot.DocumentFile)
	}
	if snapshot.RetrieveConfig.TopK != 2 {
		t.Fatalf("expected cloned retrieve config, got %#v", snapshot.RetrieveConfig)
	}
	if snapshot.FragmentConfig.Normal.TextPreprocessRule[0] != 1 || snapshot.FragmentConfig.Normal.SegmentRule.ChunkSize != 256 {
		t.Fatalf("expected cloned fragment config, got %#v", snapshot.FragmentConfig)
	}
	if snapshot.EmbeddingConfig.ModelID != "embed-a" {
		t.Fatalf("expected cloned embedding config, got %#v", snapshot.EmbeddingConfig)
	}
}
