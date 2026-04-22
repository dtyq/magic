package transaction_test

import (
	"database/sql"
	"database/sql/driver"
	"encoding/json"
	"testing"
	"time"

	"github.com/DATA-DOG/go-sqlmock"

	"magic/internal/domain/knowledge/document/service"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	sharedentity "magic/internal/domain/knowledge/shared/entity"
	"magic/pkg/convert"
)

func sampleDocument() *document.KnowledgeBaseDocument {
	now := time.Date(2026, 3, 11, 9, 0, 0, 0, time.Local)
	return &document.KnowledgeBaseDocument{
		ID:                1,
		OrganizationCode:  "ORG1",
		KnowledgeBaseCode: "KB1",
		SourceBindingID:   0,
		SourceItemID:      0,
		AutoAdded:         false,
		Name:              "doc-1",
		Description:       "desc",
		Code:              "DOC1",
		Enabled:           true,
		DocType:           int(document.DocTypeFile),
		DocMetadata:       map[string]any{"lang": "zh"},
		DocumentFile:      &document.File{Name: "doc.md", URL: "bucket/doc.md", Extension: "md"},
		ThirdPlatformType: "drive",
		ThirdFileID:       "TF-1",
		SyncStatus:        shared.SyncStatusSynced,
		SyncTimes:         1,
		SyncStatusMessage: "ok",
		EmbeddingModel:    "text-embedding-3-small",
		VectorDB:          "odin_qdrant",
		RetrieveConfig:    &shared.RetrieveConfig{TopK: 4},
		FragmentConfig:    &shared.FragmentConfig{Mode: shared.FragmentModeNormal},
		EmbeddingConfig:   &shared.EmbeddingConfig{ModelID: "text-embedding-3-small"},
		VectorDBConfig:    &shared.VectorDBConfig{Extra: map[string]json.RawMessage{"collection_name": json.RawMessage(`"kb1"`)}},
		WordCount:         42,
		CreatedUID:        "U1",
		UpdatedUID:        "U1",
		CreatedAt:         now,
		UpdatedAt:         now,
	}
}

func sampleFragment() *fragmodel.KnowledgeBaseFragment {
	now := time.Date(2026, 3, 11, 11, 0, 0, 0, time.Local)
	fragment := fragmodel.NewFragment("KB1", "DOC1", "hello world", map[string]any{"section_title": "Intro"}, "U1")
	fragment.ID = 1
	fragment.PointID = "point-1"
	fragment.BusinessID = "BIZ1"
	fragment.SyncStatus = sharedentity.SyncStatusSynced
	fragment.SyncTimes = 1
	fragment.SyncStatusMessage = "ok"
	fragment.WordCount = 11
	fragment.CreatedAt = now
	fragment.UpdatedAt = now
	return fragment
}

func expectDocumentFindByCodeAndKnowledgeBaseMiss(mock sqlmock.Sqlmock, code, knowledgeBaseCode string) {
	mock.ExpectQuery(sqlPattern(`SELECT id, organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
       enabled, doc_type, doc_metadata, document_file, sync_status, sync_times, sync_status_message, embedding_model, vector_db,
       retrieve_config, fragment_config, embedding_config, vector_db_config, word_count, third_platform_type, third_file_id,
       created_uid, updated_uid, created_at, updated_at, deleted_at
FROM knowledge_base_documents
WHERE code = ?
  AND knowledge_base_code = ?
  AND deleted_at IS NULL
ORDER BY id DESC
LIMIT 1`)).
		WithArgs(code, knowledgeBaseCode).
		WillReturnError(sql.ErrNoRows)
}

func documentRowColumns() []string {
	return []string{
		"id", "organization_code", "knowledge_base_code", "source_binding_id", "source_item_id", "auto_added", "name", "description", "code",
		"enabled", "doc_type", "doc_metadata", "document_file",
		"sync_status", "sync_times", "sync_status_message", "embedding_model", "vector_db",
		"retrieve_config", "fragment_config", "embedding_config", "vector_db_config", "word_count", "third_platform_type", "third_file_id",
		"created_uid", "updated_uid", "created_at", "updated_at", "deleted_at",
	}
}

func sampleDocumentRowValuesWithCode(t *testing.T, code string, deletedAt sql.NullTime) []driver.Value {
	t.Helper()
	doc := sampleDocument()
	doc.Code = code
	return []driver.Value{
		doc.ID, doc.OrganizationCode, doc.KnowledgeBaseCode, doc.SourceBindingID, doc.SourceItemID, doc.AutoAdded, doc.Name, doc.Description, doc.Code,
		doc.Enabled, mustUint32Repo(t, doc.DocType), mustJSON(t, doc.DocMetadata), mustJSON(t, doc.DocumentFile),
		mustInt32Repo(t, int(doc.SyncStatus)), mustInt32Repo(t, doc.SyncTimes), doc.SyncStatusMessage, doc.EmbeddingModel, doc.VectorDB,
		mustJSON(t, doc.RetrieveConfig), mustJSON(t, doc.FragmentConfig), mustJSON(t, doc.EmbeddingConfig), mustJSON(t, doc.VectorDBConfig), mustUint64Repo(t, doc.WordCount),
		doc.ThirdPlatformType, doc.ThirdFileID,
		doc.CreatedUID, doc.UpdatedUID, doc.CreatedAt, doc.UpdatedAt, deletedAt,
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

func mustInt32Repo(t *testing.T, value int) int32 {
	t.Helper()
	converted, err := convert.SafeIntToInt32(value, "value")
	if err != nil {
		t.Fatalf("SafeIntToInt32 failed: %v", err)
	}
	return converted
}

func mustUint32Repo(t *testing.T, value int) uint32 {
	t.Helper()
	converted, err := convert.SafeIntToUint32(value, "value")
	if err != nil {
		t.Fatalf("SafeIntToUint32 failed: %v", err)
	}
	return converted
}

func mustUint64Repo(t *testing.T, value int) uint64 {
	t.Helper()
	converted, err := convert.SafeIntToUint64(value, "value")
	if err != nil {
		t.Fatalf("SafeIntToUint64 failed: %v", err)
	}
	return converted
}
