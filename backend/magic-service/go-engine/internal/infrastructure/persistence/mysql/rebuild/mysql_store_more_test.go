package rebuild_test

import (
	"context"
	"database/sql"
	"errors"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	"magic/internal/constants"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	mysqlrebuild "magic/internal/infrastructure/persistence/mysql/rebuild"
)

var errMySQLStoreExecFailed = errors.New("mysql store exec failed")

func TestGetCollectionMetaScenarios(t *testing.T) {
	t.Parallel()

	t.Run("no rows", func(t *testing.T) {
		t.Parallel()

		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()

		store := mysqlrebuild.NewMySQLStore(db)
		mock.ExpectQuery(regexp.QuoteMeta("SELECT model, COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config")).
			WithArgs(constants.KnowledgeBaseCollectionMetaCode).
			WillReturnRows(sqlmock.NewRows([]string{"model", "embedding_config"}))

		meta, err := store.GetCollectionMeta(context.Background())
		if err != nil {
			t.Fatalf("GetCollectionMeta() error = %v", err)
		}
		if meta.Exists {
			t.Fatalf("expected empty meta when no rows, got %+v", meta)
		}
	})

	t.Run("trimmed fields", func(t *testing.T) {
		t.Parallel()

		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()

		store := mysqlrebuild.NewMySQLStore(db)
		mock.ExpectQuery(regexp.QuoteMeta("SELECT model, COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config")).
			WithArgs(constants.KnowledgeBaseCollectionMetaCode).
			WillReturnRows(
				sqlmock.NewRows([]string{"model", "embedding_config"}).
					AddRow("  text-embedding-3-large  ", []byte(`{"collection_name":"  shadow  ","vector_dimension":1536}`)),
			)

		meta, err := store.GetCollectionMeta(context.Background())
		if err != nil {
			t.Fatalf("GetCollectionMeta() error = %v", err)
		}
		if !meta.Exists || meta.Model != "text-embedding-3-large" || meta.CollectionName != "shadow" || meta.VectorDimension != 1536 {
			t.Fatalf("unexpected meta: %+v", meta)
		}
	})

	t.Run("invalid json", func(t *testing.T) {
		t.Parallel()

		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()

		store := mysqlrebuild.NewMySQLStore(db)
		mock.ExpectQuery(regexp.QuoteMeta("SELECT model, COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config")).
			WithArgs(constants.KnowledgeBaseCollectionMetaCode).
			WillReturnRows(
				sqlmock.NewRows([]string{"model", "embedding_config"}).
					AddRow("model", []byte(`{"collection_name":`)),
			)

		if _, err := store.GetCollectionMeta(context.Background()); err == nil {
			t.Fatal("expected JSON decode error")
		}
	})
}

func TestGetCollectionMetaObjectCompatibilityPayloads(t *testing.T) {
	t.Parallel()

	cases := []struct {
		name    string
		payload []byte
	}{
		{name: "empty array", payload: []byte(`[]`)},
		{name: "empty string", payload: []byte(`""`)},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()

			db, mock, err := sqlmock.New()
			if err != nil {
				t.Fatalf("sqlmock.New: %v", err)
			}
			defer func() { _ = db.Close() }()

			store := mysqlrebuild.NewMySQLStore(db)
			mock.ExpectQuery(regexp.QuoteMeta("SELECT model, COALESCE(embedding_config, CAST('{}' AS JSON)) AS embedding_config")).
				WithArgs(constants.KnowledgeBaseCollectionMetaCode).
				WillReturnRows(
					sqlmock.NewRows([]string{"model", "embedding_config"}).
						AddRow("model-x", tc.payload),
				)

			meta, err := store.GetCollectionMeta(context.Background())
			if err != nil {
				t.Fatalf("GetCollectionMeta() error = %v", err)
			}
			if !meta.Exists || meta.Model != "model-x" {
				t.Fatalf("unexpected meta: %+v", meta)
			}
			if meta.CollectionName != "" || meta.VectorDimension != 0 || meta.SparseBackend != "" {
				t.Fatalf("expected empty config fields, got %+v", meta)
			}
		})
	}
}

func TestListDocumentsBatchBuildsScopeQueryAndScansRows(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() { _ = db.Close() }()

	store := mysqlrebuild.NewMySQLStore(db)
	mock.ExpectQuery(regexp.QuoteMeta("SELECT d.id,")).
		WithArgs(int64(99), constants.KnowledgeBaseCollectionMetaCode, "org-1", "org-1", 2).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "organization_code", "knowledge_base_code", "code", "user_id"}).
				AddRow(int64(100), "org-1", "kb-1", "doc-1", "user-1").
				AddRow(int64(101), "org-1", "kb-1", "doc-2", "user-2"),
		)

	tasks, err := store.ListDocumentsBatch(context.Background(), domainrebuild.Scope{
		Mode:             domainrebuild.ScopeModeOrganization,
		OrganizationCode: "org-1",
	}, 99, 2)
	if err != nil {
		t.Fatalf("ListDocumentsBatch() error = %v", err)
	}
	if len(tasks) != 2 || tasks[0].DocumentCode != "doc-1" || tasks[1].UserID != "user-2" {
		t.Fatalf("unexpected tasks: %+v", tasks)
	}
}

func TestListDocumentsBatchRejectsInvalidScope(t *testing.T) {
	t.Parallel()

	store := mysqlrebuild.NewMySQLStore(&sql.DB{})
	_, err := store.ListDocumentsBatch(context.Background(), domainrebuild.Scope{
		Mode: domainrebuild.ScopeModeOrganization,
	}, 0, 1)
	if !errors.Is(err, mysqlrebuild.ErrInvalidRebuildScopeForTest) {
		t.Fatalf("expected errInvalidRebuildScope, got %v", err)
	}
}

func TestScopedMigrationFlows(t *testing.T) {
	t.Parallel()

	t.Run("reset sync status success", func(t *testing.T) {
		t.Parallel()

		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()

		store := mysqlrebuild.NewMySQLStore(db)
		mock.ExpectBegin()
		mock.ExpectExec(regexp.QuoteMeta("UPDATE magic_flow_knowledge")).
			WithArgs(0, constants.KnowledgeBaseCollectionMetaCode).
			WillReturnResult(sqlmock.NewResult(0, 3))
		mock.ExpectExec(regexp.QuoteMeta("UPDATE knowledge_base_documents")).
			WithArgs(0, constants.KnowledgeBaseCollectionMetaCode).
			WillReturnResult(sqlmock.NewResult(0, 5))
		mock.ExpectCommit()

		stats, err := store.ResetSyncStatus(context.Background(), domainrebuild.Scope{Mode: domainrebuild.ScopeModeAll})
		if err != nil {
			t.Fatalf("ResetSyncStatus() error = %v", err)
		}
		if stats.KnowledgeBaseRows != 3 || stats.DocumentRows != 5 {
			t.Fatalf("unexpected stats: %+v", stats)
		}
	})

	t.Run("update model query failure", func(t *testing.T) {
		t.Parallel()

		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New: %v", err)
		}
		defer func() { _ = db.Close() }()

		store := mysqlrebuild.NewMySQLStore(db)
		mock.ExpectBegin()
		mock.ExpectExec(regexp.QuoteMeta("UPDATE magic_flow_knowledge")).
			WithArgs("model-x", "model-x", constants.KnowledgeBaseCollectionMetaCode, "org-1", "kb-1").
			WillReturnError(errMySQLStoreExecFailed)
		mock.ExpectRollback()

		_, err = store.UpdateModel(context.Background(), domainrebuild.Scope{
			Mode:              domainrebuild.ScopeModeKnowledgeBase,
			OrganizationCode:  "org-1",
			KnowledgeBaseCode: "kb-1",
		}, "model-x")
		if err == nil || !regexp.MustCompile(`update magic_flow_knowledge model`).MatchString(err.Error()) {
			t.Fatalf("expected wrapped UpdateModel error, got %v", err)
		}
	})
}
