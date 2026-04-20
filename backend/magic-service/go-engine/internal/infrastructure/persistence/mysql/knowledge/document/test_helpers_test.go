package documentrepo_test

import (
	"encoding/json"
	"testing"
	"time"

	"magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/domain/knowledge/shared"
)

func sampleKnowledgeBase() *knowledgebase.KnowledgeBase {
	now := time.Date(2026, 3, 11, 10, 0, 0, 0, time.Local)
	return &knowledgebase.KnowledgeBase{
		Code:              "KB-1",
		Version:           1,
		Name:              "知识库",
		Description:       "desc",
		Type:              1,
		Enabled:           true,
		BusinessID:        "BIZ-1",
		SyncStatus:        shared.SyncStatusPending,
		SyncStatusMessage: "",
		Model:             "text-embedding-3-large",
		VectorDB:          "odin_qdrant",
		OrganizationCode:  "ORG-1",
		CreatedUID:        "creator",
		UpdatedUID:        "modifier",
		ExpectedNum:       8,
		CompletedNum:      4,
		RetrieveConfig:    &shared.RetrieveConfig{TopK: 4},
		FragmentConfig:    &shared.FragmentConfig{Mode: shared.FragmentModeNormal},
		EmbeddingConfig:   &shared.EmbeddingConfig{ModelID: "text-embedding-3-large"},
		WordCount:         123,
		Icon:              "book",
		CreatedAt:         now,
		UpdatedAt:         now,
	}
}

func mustJSON(t *testing.T, value any) []byte {
	t.Helper()
	data, err := json.Marshal(value)
	if err != nil {
		t.Fatalf("json.Marshal failed: %v", err)
	}
	return data
}
