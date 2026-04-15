package rebuild_test

import (
	"errors"
	"testing"

	"magic/internal/constants"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	mysqlrebuild "magic/internal/infrastructure/persistence/mysql/rebuild"
)

const (
	testOrgCode           = "ORG1"
	testKnowledgeBaseCode = "KB1"
	testDocumentCode      = "DOC1"
)

func TestMySQLStoreNormalizeScopeRejectsOrganizationWithoutOrgCode(t *testing.T) {
	t.Parallel()

	store := &mysqlrebuild.MySQLStore{}
	_, err := mysqlrebuild.NormalizeMySQLStoreScopeForTest(store, domainrebuild.Scope{
		Mode: domainrebuild.ScopeModeOrganization,
	})
	if err == nil || !errors.Is(err, mysqlrebuild.ErrInvalidRebuildScopeForTest) {
		t.Fatalf("expected invalid scope error, got %v", err)
	}
}

func TestBuildKnowledgeBaseScopeUpdateQueryOrganization(t *testing.T) {
	t.Parallel()

	scope := domainrebuild.Scope{
		Mode:             domainrebuild.ScopeModeOrganization,
		OrganizationCode: testOrgCode,
	}
	query, args := mysqlrebuild.BuildKnowledgeBaseScopeUpdateQueryForTest(
		"UPDATE magic_flow_knowledge SET model = ? WHERE deleted_at IS NULL AND code <> ?",
		scope,
		[]any{"text-embedding-3-small", constants.KnowledgeBaseCollectionMetaCode},
	)
	want := "UPDATE magic_flow_knowledge SET model = ? WHERE deleted_at IS NULL AND code <> ?\n  AND magic_flow_knowledge.organization_code = ?"
	if query != want {
		t.Fatalf("unexpected query:\n%s", query)
	}
	if len(args) != 3 || args[2] != testOrgCode {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestBuildDocumentScopeUpdateQueryOrganization(t *testing.T) {
	t.Parallel()

	scope := domainrebuild.Scope{
		Mode:             domainrebuild.ScopeModeOrganization,
		OrganizationCode: testOrgCode,
	}
	query, args := mysqlrebuild.BuildDocumentScopeUpdateQueryForTest("UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL", scope, []any{"text-embedding-3-small"})
	want := "UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL\n  AND organization_code = ?"
	if query != want {
		t.Fatalf("unexpected query:\n%s", query)
	}
	if len(args) != 2 || args[1] != testOrgCode {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestMySQLStoreNormalizeScopeRejectsKnowledgeBaseWithoutRequiredFields(t *testing.T) {
	t.Parallel()

	store := &mysqlrebuild.MySQLStore{}
	_, err := mysqlrebuild.NormalizeMySQLStoreScopeForTest(store, domainrebuild.Scope{
		Mode:             domainrebuild.ScopeModeKnowledgeBase,
		OrganizationCode: testOrgCode,
	})
	if err == nil || !errors.Is(err, mysqlrebuild.ErrInvalidRebuildScopeForTest) {
		t.Fatalf("expected invalid scope error, got %v", err)
	}
}

func TestBuildKnowledgeBaseScopeUpdateQueryKnowledgeBase(t *testing.T) {
	t.Parallel()

	scope := domainrebuild.Scope{
		Mode:              domainrebuild.ScopeModeKnowledgeBase,
		OrganizationCode:  testOrgCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
	}
	query, args := mysqlrebuild.BuildKnowledgeBaseScopeUpdateQueryForTest(
		"UPDATE magic_flow_knowledge SET model = ? WHERE deleted_at IS NULL AND code <> ?",
		scope,
		[]any{"text-embedding-3-small", constants.KnowledgeBaseCollectionMetaCode},
	)
	want := "UPDATE magic_flow_knowledge SET model = ? WHERE deleted_at IS NULL AND code <> ?\n  AND magic_flow_knowledge.organization_code = ?\n  AND magic_flow_knowledge.code = ?"
	if query != want {
		t.Fatalf("unexpected query:\n%s", query)
	}
	if len(args) != 4 || args[2] != testOrgCode || args[3] != testKnowledgeBaseCode {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestBuildDocumentScopeUpdateQueryKnowledgeBase(t *testing.T) {
	t.Parallel()

	scope := domainrebuild.Scope{
		Mode:              domainrebuild.ScopeModeKnowledgeBase,
		OrganizationCode:  testOrgCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
	}
	query, args := mysqlrebuild.BuildDocumentScopeUpdateQueryForTest(
		"UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL",
		scope,
		[]any{"text-embedding-3-small"},
	)
	want := "UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL\n  AND organization_code = ?\n  AND knowledge_base_code = ?"
	if query != want {
		t.Fatalf("unexpected query:\n%s", query)
	}
	if len(args) != 3 || args[1] != testOrgCode || args[2] != testKnowledgeBaseCode {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestBuildDocumentScopeUpdateQueryKnowledgeBaseWithMetaExclusionArg(t *testing.T) {
	t.Parallel()

	scope := domainrebuild.Scope{
		Mode:              domainrebuild.ScopeModeKnowledgeBase,
		OrganizationCode:  testOrgCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
	}
	query, args := mysqlrebuild.BuildDocumentScopeUpdateQueryForTest(
		"UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL AND knowledge_base_code <> ?",
		scope,
		[]any{"text-embedding-3-small", constants.KnowledgeBaseCollectionMetaCode},
	)
	want := "UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL AND knowledge_base_code <> ?\n  AND organization_code = ?\n  AND knowledge_base_code = ?"
	if query != want {
		t.Fatalf("unexpected query:\n%s", query)
	}
	if len(args) != 4 || args[2] != testOrgCode || args[3] != testKnowledgeBaseCode {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestMySQLStoreNormalizeScopeRejectsDocumentWithoutRequiredFields(t *testing.T) {
	t.Parallel()

	store := &mysqlrebuild.MySQLStore{}
	_, err := mysqlrebuild.NormalizeMySQLStoreScopeForTest(store, domainrebuild.Scope{
		Mode:             domainrebuild.ScopeModeDocument,
		OrganizationCode: testOrgCode,
	})
	if err == nil || !errors.Is(err, mysqlrebuild.ErrInvalidRebuildScopeForTest) {
		t.Fatalf("expected invalid scope error, got %v", err)
	}
}

func TestBuildKnowledgeBaseScopeUpdateQueryDocument(t *testing.T) {
	t.Parallel()

	scope := domainrebuild.Scope{
		Mode:              domainrebuild.ScopeModeDocument,
		OrganizationCode:  testOrgCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		DocumentCode:      testDocumentCode,
	}
	query, args := mysqlrebuild.BuildKnowledgeBaseScopeUpdateQueryForTest(
		"UPDATE magic_flow_knowledge SET model = ? WHERE deleted_at IS NULL AND code <> ?",
		scope,
		[]any{"text-embedding-3-small", constants.KnowledgeBaseCollectionMetaCode},
	)
	want := "UPDATE magic_flow_knowledge SET model = ? WHERE deleted_at IS NULL AND code <> ?\n  AND magic_flow_knowledge.organization_code = ?\n  AND magic_flow_knowledge.code = ?"
	if query != want {
		t.Fatalf("unexpected query:\n%s", query)
	}
	if len(args) != 4 || args[2] != testOrgCode || args[3] != testKnowledgeBaseCode {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestBuildDocumentScopeUpdateQueryDocument(t *testing.T) {
	t.Parallel()

	scope := domainrebuild.Scope{
		Mode:              domainrebuild.ScopeModeDocument,
		OrganizationCode:  testOrgCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		DocumentCode:      testDocumentCode,
	}
	query, args := mysqlrebuild.BuildDocumentScopeUpdateQueryForTest("UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL", scope, []any{"text-embedding-3-small"})
	want := "UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL\n  AND organization_code = ?\n  AND knowledge_base_code = ?\n  AND code = ?"
	if query != want {
		t.Fatalf("unexpected query:\n%s", query)
	}
	if len(args) != 4 || args[1] != testOrgCode || args[2] != testKnowledgeBaseCode || args[3] != testDocumentCode {
		t.Fatalf("unexpected args %#v", args)
	}
}

func TestBuildDocumentScopeUpdateQueryDocumentWithMetaExclusionArg(t *testing.T) {
	t.Parallel()

	scope := domainrebuild.Scope{
		Mode:              domainrebuild.ScopeModeDocument,
		OrganizationCode:  testOrgCode,
		KnowledgeBaseCode: testKnowledgeBaseCode,
		DocumentCode:      testDocumentCode,
	}

	query, args := mysqlrebuild.BuildDocumentScopeUpdateQueryForTest(
		"UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL AND knowledge_base_code <> ?",
		scope,
		[]any{"text-embedding-3-small", constants.KnowledgeBaseCollectionMetaCode},
	)

	want := "UPDATE knowledge_base_documents SET embedding_model = ? WHERE deleted_at IS NULL AND knowledge_base_code <> ?\n  AND organization_code = ?\n  AND knowledge_base_code = ?\n  AND code = ?"
	if query != want {
		t.Fatalf("unexpected query:\n%s", query)
	}
	if len(args) != 5 || args[2] != testOrgCode || args[3] != testKnowledgeBaseCode || args[4] != testDocumentCode {
		t.Fatalf("unexpected args %#v", args)
	}
}
