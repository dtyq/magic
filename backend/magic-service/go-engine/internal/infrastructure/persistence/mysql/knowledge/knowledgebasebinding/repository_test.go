package knowledgebasebindingrepo_test

import (
	"context"
	"regexp"
	"strings"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	kbentity "magic/internal/domain/knowledge/knowledgebase/entity"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	knowledgebasebindingrepo "magic/internal/infrastructure/persistence/mysql/knowledge/knowledgebasebinding"
)

func sqlContains(fragment string) string {
	return regexp.QuoteMeta(strings.TrimSpace(fragment))
}

func TestRepositoryUpdateAgentKnowledgeBaseBindingMetadataLocksRowAndPreservesPatch(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	t.Cleanup(func() {
		_ = db.Close()
	})

	repo := knowledgebasebindingrepo.NewRepository(mysqlclient.NewSQLCClientWithDB(db, nil, false))
	mock.ExpectBegin()
	mock.ExpectQuery(sqlContains("FOR UPDATE")).
		WithArgs("ORG-1", string(kbentity.BindingTypeSuperMagicAgent), "SMA-1", "KB-1", string(kbentity.KnowledgeBaseTypeFlowVector)).
		WillReturnRows(sqlmock.NewRows([]string{"knowledge_base_code", "metadata"}).
			AddRow("KB-1", []byte(`{"display_name":"old name","enabled":false}`)))
	mock.ExpectExec(sqlContains("UPDATE knowledge_base_bindings")).
		WithArgs(
			sqlmock.AnyArg(),
			"user-1",
			sqlmock.AnyArg(),
			"ORG-1",
			string(kbentity.BindingTypeSuperMagicAgent),
			"SMA-1",
			"KB-1",
		).
		WillReturnResult(sqlmock.NewResult(0, 1))
	mock.ExpectCommit()

	description := "new description"
	result, err := repo.UpdateAgentKnowledgeBaseBindingMetadata(
		context.Background(),
		"ORG-1",
		"user-1",
		"SMA-1",
		"KB-1",
		kbentity.AgentKnowledgeBaseBindingMetadataPatch{DisplayDescription: &description},
	)
	if err != nil {
		t.Fatalf("UpdateAgentKnowledgeBaseBindingMetadata returned error: %v", err)
	}
	if result.KnowledgeBaseCode != "KB-1" {
		t.Fatalf("unexpected knowledge base code: %q", result.KnowledgeBaseCode)
	}
	if result.Metadata.DisplayName != "old name" || result.Metadata.DisplayDescription != description || result.Metadata.IsEnabled() {
		t.Fatalf("expected patch to preserve existing metadata fields, got %#v", result.Metadata)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
