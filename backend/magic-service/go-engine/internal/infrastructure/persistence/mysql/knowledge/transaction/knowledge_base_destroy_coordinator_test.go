package transaction_test

import (
	"context"
	"errors"
	"regexp"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	transaction "magic/internal/infrastructure/persistence/mysql/knowledge/transaction"
)

const (
	testDestroyKnowledgeBaseID   int64  = 42
	testDestroyKnowledgeBaseCode string = "KB-DESTROY"
)

var errDestroyFailed = errors.New("destroy failed")

func TestKnowledgeBaseDestroyCoordinatorDestroyCommits(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	coordinator := transaction.NewKnowledgeBaseDestroyCoordinator(mysqlclient.NewSQLCClientWithDB(db, nil, false))

	mock.ExpectBegin()
	expectDeleteSourceBindingTargetsByKnowledgeBase(mock, testDestroyKnowledgeBaseCode).WillReturnResult(sqlmock.NewResult(0, 1))
	expectDeleteSourceBindingItemsByKnowledgeBase(mock, testDestroyKnowledgeBaseCode).WillReturnResult(sqlmock.NewResult(0, 2))
	expectDeleteSourceBindingsByKnowledgeBase(mock, testDestroyKnowledgeBaseCode).WillReturnResult(sqlmock.NewResult(0, 1))
	expectDeleteKnowledgeBaseBindingsByCode(mock, testDestroyKnowledgeBaseCode).WillReturnResult(sqlmock.NewResult(0, 3))
	expectDeleteFragmentsByKnowledgeBase(mock, testDestroyKnowledgeBaseCode).WillReturnResult(sqlmock.NewResult(0, 5))
	expectDeleteDocumentsByKnowledgeBase(mock, testDestroyKnowledgeBaseCode).WillReturnResult(sqlmock.NewResult(0, 4))
	expectDeleteKnowledgeBaseByID(mock, testDestroyKnowledgeBaseID).WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	if err := coordinator.Destroy(context.Background(), testDestroyKnowledgeBaseID, testDestroyKnowledgeBaseCode); err != nil {
		t.Fatalf("Destroy returned error: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func TestKnowledgeBaseDestroyCoordinatorDestroyRollsBackOnDeleteError(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() { _ = db.Close() })

	coordinator := transaction.NewKnowledgeBaseDestroyCoordinator(mysqlclient.NewSQLCClientWithDB(db, nil, false))

	mock.ExpectBegin()
	expectDeleteSourceBindingTargetsByKnowledgeBase(mock, testDestroyKnowledgeBaseCode).WillReturnResult(sqlmock.NewResult(0, 1))
	expectDeleteSourceBindingItemsByKnowledgeBase(mock, testDestroyKnowledgeBaseCode).WillReturnResult(sqlmock.NewResult(0, 2))
	expectDeleteSourceBindingsByKnowledgeBase(mock, testDestroyKnowledgeBaseCode).WillReturnResult(sqlmock.NewResult(0, 1))
	expectDeleteKnowledgeBaseBindingsByCode(mock, testDestroyKnowledgeBaseCode).WillReturnError(assertCoordinatorErr())
	mock.ExpectRollback()

	if err := coordinator.Destroy(context.Background(), testDestroyKnowledgeBaseID, testDestroyKnowledgeBaseCode); err == nil {
		t.Fatal("expected error but got nil")
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet expectations: %v", err)
	}
}

func sqlPattern(query string) string {
	return `(?s)(?:-- name: .*?\n)?` + regexp.QuoteMeta(strings.TrimSpace(query))
}

func expectDeleteSourceBindingItemsByKnowledgeBase(mock sqlmock.Sqlmock, knowledgeBaseCode string) *sqlmock.ExpectedExec {
	return mock.ExpectExec(sqlPattern(`DELETE knowledge_source_binding_items
FROM knowledge_source_binding_items
INNER JOIN knowledge_source_bindings
    ON knowledge_source_bindings.id = knowledge_source_binding_items.binding_id
WHERE knowledge_source_bindings.knowledge_base_code = ?`)).
		WithArgs(knowledgeBaseCode)
}

func expectDeleteSourceBindingTargetsByKnowledgeBase(mock sqlmock.Sqlmock, knowledgeBaseCode string) *sqlmock.ExpectedExec {
	return mock.ExpectExec(sqlPattern(`DELETE knowledge_source_binding_targets
FROM knowledge_source_binding_targets
INNER JOIN knowledge_source_bindings
    ON knowledge_source_bindings.id = knowledge_source_binding_targets.binding_id
WHERE knowledge_source_bindings.knowledge_base_code = ?`)).
		WithArgs(knowledgeBaseCode)
}

func expectDeleteSourceBindingsByKnowledgeBase(mock sqlmock.Sqlmock, knowledgeBaseCode string) *sqlmock.ExpectedExec {
	return mock.ExpectExec(sqlPattern(`DELETE FROM knowledge_source_bindings
WHERE knowledge_base_code = ?`)).
		WithArgs(knowledgeBaseCode)
}

func expectDeleteKnowledgeBaseBindingsByCode(mock sqlmock.Sqlmock, knowledgeBaseCode string) *sqlmock.ExpectedExec {
	return mock.ExpectExec(sqlPattern(`DELETE FROM knowledge_base_bindings
WHERE knowledge_base_code = ?`)).
		WithArgs(knowledgeBaseCode)
}

func expectDeleteFragmentsByKnowledgeBase(mock sqlmock.Sqlmock, knowledgeBaseCode string) *sqlmock.ExpectedExec {
	return mock.ExpectExec(sqlPattern(`DELETE FROM magic_flow_knowledge_fragment
WHERE knowledge_code = ?`)).
		WithArgs(knowledgeBaseCode)
}

func expectDeleteDocumentsByKnowledgeBase(mock sqlmock.Sqlmock, knowledgeBaseCode string) *sqlmock.ExpectedExec {
	return mock.ExpectExec(sqlPattern(`DELETE FROM knowledge_base_documents
WHERE knowledge_base_code = ?`)).
		WithArgs(knowledgeBaseCode)
}

func expectDeleteKnowledgeBaseByID(mock sqlmock.Sqlmock, knowledgeBaseID int64) *sqlmock.ExpectedExec {
	return mock.ExpectExec(sqlPattern(`DELETE FROM magic_flow_knowledge
WHERE id = ?`)).
		WithArgs(knowledgeBaseID)
}

func assertCoordinatorErr() error {
	return errDestroyFailed
}
