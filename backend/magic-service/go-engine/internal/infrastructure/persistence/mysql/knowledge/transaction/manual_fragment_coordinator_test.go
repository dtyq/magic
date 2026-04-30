package transaction_test

import (
	"context"
	"database/sql"
	"database/sql/driver"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"
	mysqlDriver "github.com/go-sql-driver/mysql"

	docentity "magic/internal/domain/knowledge/document/entity"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/domain/knowledge/shared"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	transaction "magic/internal/infrastructure/persistence/mysql/knowledge/transaction"
)

const (
	testExistingDocumentCode = "DOC1"
	testAutoCreatedDocCode   = "DOC_AUTO"
)

func TestManualFragmentCoordinatorEnsureDocumentAndSaveFragmentWithExistingDocument(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	coordinator := transaction.NewManualFragmentCoordinator(mysqlclient.NewSQLCClientWithDB(db, nil, false), nil)
	doc := sampleDocument()
	doc.Code = testExistingDocumentCode
	doc.Name = testExistingDocumentCode
	doc.DocType = int(docentity.DocumentInputKindFile)
	doc.OrganizationCode = "ORG1"
	doc.KnowledgeBaseCode = "KB1"
	fragment := sampleFragment()
	fragment.KnowledgeCode = "KB1"
	fragment.DocumentCode = testExistingDocumentCode

	mock.ExpectBegin()
	expectDocumentFindByCodeAndKnowledgeBaseHit(t, mock, doc)
	expectFragmentInsert(t, mock, fragment, 88)
	mock.ExpectCommit()

	resolvedDoc, err := coordinator.EnsureDocumentAndSaveFragment(context.Background(), doc, fragment)
	if err != nil {
		t.Fatalf("EnsureDocumentAndSaveFragment returned error: %v", err)
	}
	if resolvedDoc == nil || resolvedDoc.Code != testExistingDocumentCode || fragment.ID != 88 {
		t.Fatalf("unexpected resolved doc=%#v fragment=%#v", resolvedDoc, fragment)
	}
	if fragment.DocumentName != testExistingDocumentCode || fragment.DocumentType != int(docentity.DocumentInputKindFile) {
		t.Fatalf("unexpected fragment after save: %#v", fragment)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestManualFragmentCoordinatorEnsureDocumentAndSaveFragmentAutoCreatesDocument(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	coordinator := transaction.NewManualFragmentCoordinator(mysqlclient.NewSQLCClientWithDB(db, nil, false), nil)
	doc := docentity.NewDocument("KB1", testAutoCreatedDocCode, testAutoCreatedDocCode, docentity.DocumentInputKindText, "U1", "ORG1")
	doc.SyncStatus = shared.SyncStatusSynced
	doc.EmbeddingModel = "text-embedding-3-small"
	doc.VectorDB = "qdrant"
	doc.WordCount = 0
	fragment := fragmodel.NewFragment("KB1", testAutoCreatedDocCode, "manual content", map[string]any{"tag": "manual"}, "U1")
	fragment.OrganizationCode = "ORG1"
	fragment.DocumentName = testAutoCreatedDocCode
	fragment.DocumentType = int(docentity.DocumentInputKindText)

	mock.ExpectBegin()
	expectDocumentFindByCodeAndKnowledgeBaseMiss(mock, testAutoCreatedDocCode, "KB1")
	expectDocumentInsert(t, mock, doc, 21)
	expectFragmentInsert(t, mock, fragment, 22)
	mock.ExpectCommit()

	resolvedDoc, err := coordinator.EnsureDocumentAndSaveFragment(context.Background(), doc, fragment)
	if err != nil {
		t.Fatalf("EnsureDocumentAndSaveFragment returned error: %v", err)
	}
	if resolvedDoc == nil || resolvedDoc.ID != 21 || resolvedDoc.Code != testAutoCreatedDocCode {
		t.Fatalf("unexpected resolved doc: %#v", resolvedDoc)
	}
	if fragment.ID != 22 || fragment.DocumentName != testAutoCreatedDocCode || fragment.DocumentType != int(docentity.DocumentInputKindText) {
		t.Fatalf("unexpected fragment: %#v", fragment)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestManualFragmentCoordinatorEnsureDocumentAndSaveFragmentRollsBackOnFragmentError(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	coordinator := transaction.NewManualFragmentCoordinator(mysqlclient.NewSQLCClientWithDB(db, nil, false), nil)
	doc := docentity.NewDocument("KB1", testAutoCreatedDocCode, testAutoCreatedDocCode, docentity.DocumentInputKindText, "U1", "ORG1")
	doc.SyncStatus = shared.SyncStatusSynced
	fragment := fragmodel.NewFragment("KB1", testAutoCreatedDocCode, "manual content", map[string]any{}, "U1")

	mock.ExpectBegin()
	expectDocumentFindByCodeAndKnowledgeBaseMiss(mock, testAutoCreatedDocCode, "KB1")
	expectDocumentInsert(t, mock, doc, 31)
	mock.ExpectExec(sqlPattern(`INSERT INTO magic_flow_knowledge_fragment (
knowledge_code, document_code, content, metadata, business_id,
sync_status, sync_times, sync_status_message, point_id, word_count,
created_uid, updated_uid, created_at, updated_at
) VALUES (
?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)`)).
		WillReturnError(assertDuplicateRollbackErr())
	mock.ExpectRollback()

	if _, err := coordinator.EnsureDocumentAndSaveFragment(context.Background(), doc, fragment); err == nil {
		t.Fatal("expected error but got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestManualFragmentCoordinatorEnsureDocumentAndSaveFragmentFallsBackAfterDuplicateDocumentInsert(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	coordinator := transaction.NewManualFragmentCoordinator(mysqlclient.NewSQLCClientWithDB(db, nil, false), nil)
	doc := docentity.NewDocument("KB1", testAutoCreatedDocCode, testAutoCreatedDocCode, docentity.DocumentInputKindText, "U1", "ORG1")
	doc.SyncStatus = shared.SyncStatusSynced
	fragment := fragmodel.NewFragment("KB1", testAutoCreatedDocCode, "manual content", map[string]any{}, "U1")

	mock.ExpectBegin()
	expectDocumentFindByCodeAndKnowledgeBaseMiss(mock, testAutoCreatedDocCode, "KB1")
	expectDocumentInsertDuplicate(t, mock, doc)
	expectDocumentFindByCodeAndKnowledgeBaseHit(t, mock, doc)
	expectFragmentInsert(t, mock, fragment, 52)
	mock.ExpectCommit()

	resolvedDoc, err := coordinator.EnsureDocumentAndSaveFragment(context.Background(), doc, fragment)
	if err != nil {
		t.Fatalf("EnsureDocumentAndSaveFragment returned error: %v", err)
	}
	if resolvedDoc == nil || resolvedDoc.Code != testAutoCreatedDocCode || fragment.ID != 52 {
		t.Fatalf("unexpected resolved doc=%#v fragment=%#v", resolvedDoc, fragment)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func expectDocumentFindByCodeAndKnowledgeBaseHit(t *testing.T, mock sqlmock.Sqlmock, doc *docentity.KnowledgeBaseDocument) {
	t.Helper()
	mock.ExpectQuery(sqlContains("FindDocumentByCodeAndKnowledgeBase")).
		WithArgs(doc.Code, doc.KnowledgeBaseCode).
		WillReturnRows(sqlmock.NewRows(documentRowColumns()).AddRow(sampleDocumentRowValuesFromDocument(t, doc)...))
}

func expectDocumentInsert(t *testing.T, mock sqlmock.Sqlmock, doc *docentity.KnowledgeBaseDocument, id int64) {
	t.Helper()
	mock.ExpectExec(sqlPattern(`INSERT INTO knowledge_base_documents (
  organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
  enabled, doc_type, doc_metadata, document_file,
  sync_status, sync_times, sync_status_message, embedding_model, vector_db,
  retrieve_config, fragment_config, embedding_config, vector_db_config, word_count,
  created_uid, updated_uid, created_at, updated_at, third_platform_type, third_file_id
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)`)).
		WithArgs(
			doc.OrganizationCode, doc.KnowledgeBaseCode, doc.SourceBindingID, doc.SourceItemID, doc.AutoAdded, doc.Name, doc.Description, doc.Code,
			doc.Enabled, mustUint32Repo(t, doc.DocType), sqlmock.AnyArg(), sqlmock.AnyArg(),
			mustInt32Repo(t, int(doc.SyncStatus)), mustInt32Repo(t, doc.SyncTimes), doc.SyncStatusMessage, doc.EmbeddingModel, doc.VectorDB,
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), mustUint64Repo(t, doc.WordCount),
			doc.CreatedUID, doc.UpdatedUID, sqlmock.AnyArg(), sqlmock.AnyArg(),
			sql.NullString{String: doc.ThirdPlatformType, Valid: doc.ThirdPlatformType != ""},
			sql.NullString{String: doc.ThirdFileID, Valid: doc.ThirdFileID != ""},
		).
		WillReturnResult(sqlmock.NewResult(id, 1))
}

func expectDocumentInsertDuplicate(t *testing.T, mock sqlmock.Sqlmock, doc *docentity.KnowledgeBaseDocument) {
	t.Helper()
	mock.ExpectExec(sqlPattern(`INSERT INTO knowledge_base_documents (
  organization_code, knowledge_base_code, source_binding_id, source_item_id, auto_added, name, description, code,
  enabled, doc_type, doc_metadata, document_file,
  sync_status, sync_times, sync_status_message, embedding_model, vector_db,
  retrieve_config, fragment_config, embedding_config, vector_db_config, word_count,
  created_uid, updated_uid, created_at, updated_at, third_platform_type, third_file_id
) VALUES (
  ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)`)).
		WithArgs(
			doc.OrganizationCode, doc.KnowledgeBaseCode, doc.SourceBindingID, doc.SourceItemID, doc.AutoAdded, doc.Name, doc.Description, doc.Code,
			doc.Enabled, mustUint32Repo(t, doc.DocType), sqlmock.AnyArg(), sqlmock.AnyArg(),
			mustInt32Repo(t, int(doc.SyncStatus)), mustInt32Repo(t, doc.SyncTimes), doc.SyncStatusMessage, doc.EmbeddingModel, doc.VectorDB,
			sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), sqlmock.AnyArg(), mustUint64Repo(t, doc.WordCount),
			doc.CreatedUID, doc.UpdatedUID, sqlmock.AnyArg(), sqlmock.AnyArg(),
			sql.NullString{String: doc.ThirdPlatformType, Valid: doc.ThirdPlatformType != ""},
			sql.NullString{String: doc.ThirdFileID, Valid: doc.ThirdFileID != ""},
		).
		WillReturnError(&mysqlDriver.MySQLError{Number: 1062, Message: "duplicate"})
}

func expectFragmentInsert(t *testing.T, mock sqlmock.Sqlmock, fragment *fragmodel.KnowledgeBaseFragment, id int64) {
	t.Helper()
	mock.ExpectExec(sqlPattern(`INSERT INTO magic_flow_knowledge_fragment (
knowledge_code, document_code, content, metadata, business_id,
sync_status, sync_times, sync_status_message, point_id, word_count,
created_uid, updated_uid, created_at, updated_at
) VALUES (
?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
)`)).
		WithArgs(
			fragment.KnowledgeCode,
			fragment.DocumentCode,
			fragment.Content,
			sqlmock.AnyArg(),
			fragment.BusinessID,
			mustInt32Repo(t, int(fragment.SyncStatus)),
			mustInt32Repo(t, fragment.SyncTimes),
			fragment.SyncStatusMessage,
			fragment.PointID,
			mustUint64Repo(t, fragment.WordCount),
			fragment.CreatedUID,
			fragment.UpdatedUID,
			sqlmock.AnyArg(),
			sqlmock.AnyArg(),
		).
		WillReturnResult(sqlmock.NewResult(id, 1))
}

func sampleDocumentRowValuesFromDocument(t *testing.T, doc *docentity.KnowledgeBaseDocument) []driver.Value {
	t.Helper()
	rowValues := sampleDocumentRowValuesWithCode(t, doc.Code, sql.NullTime{})
	rowValues[1] = doc.OrganizationCode
	rowValues[2] = doc.KnowledgeBaseCode
	rowValues[3] = doc.SourceBindingID
	rowValues[4] = doc.SourceItemID
	rowValues[5] = doc.AutoAdded
	rowValues[6] = doc.Name
	rowValues[7] = doc.Description
	rowValues[8] = doc.Code
	rowValues[11] = mustUint32Repo(t, doc.DocType)
	rowValues[17] = doc.EmbeddingModel
	rowValues[18] = doc.VectorDB
	if doc.ThirdPlatformType == "" {
		rowValues[29] = nil
	} else {
		rowValues[29] = doc.ThirdPlatformType
	}
	if doc.ThirdFileID == "" {
		rowValues[30] = nil
	} else {
		rowValues[30] = doc.ThirdFileID
	}
	return rowValues
}

func assertDuplicateRollbackErr() error {
	return &mysqlDriver.MySQLError{Number: 1205, Message: "lock wait timeout"}
}
