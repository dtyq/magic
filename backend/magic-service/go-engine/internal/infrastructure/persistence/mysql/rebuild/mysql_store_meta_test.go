package rebuild_test

import (
	"context"
	"regexp"
	"testing"

	"github.com/DATA-DOG/go-sqlmock"

	"magic/internal/constants"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	mysqlrebuild "magic/internal/infrastructure/persistence/mysql/rebuild"
)

func TestMySQLStoreUpsertCollectionMeta_UsesFixedOrganizationCode(t *testing.T) {
	t.Parallel()

	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New: %v", err)
	}
	defer func() {
		_ = db.Close()
	}()

	store := mysqlrebuild.NewMySQLStore(db)
	mock.ExpectExec(regexp.QuoteMeta("INSERT INTO magic_flow_knowledge")).
		WithArgs(
			constants.KnowledgeBaseCollectionMetaCode,
			constants.KnowledgeBaseCollectionMetaName,
			constants.KnowledgeBaseCollectionMetaDescription,
			"text-embedding-3-large",
			constants.KnowledgeBaseCollectionMetaVectorDB,
			constants.KnowledgeBaseCollectionMetaOrganizationCode,
			[]byte(`{"collection_name":"magic_knowledge","physical_collection_name":"magic_knowledge_shadow_r1","vector_dimension":3072,"sparse_backend":""}`),
		).
		WillReturnResult(sqlmock.NewResult(1, 1))

	err = store.UpsertCollectionMeta(context.Background(), domainrebuild.CollectionMeta{
		CollectionName:         "magic_knowledge",
		PhysicalCollectionName: "magic_knowledge_shadow_r1",
		Model:                  "text-embedding-3-large",
		VectorDimension:        3072,
	})
	if err != nil {
		t.Fatalf("upsert collection meta: %v", err)
	}
	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet sql expectations: %v", err)
	}
}
