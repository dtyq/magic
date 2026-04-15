package rebuild

import domainrebuild "magic/internal/domain/knowledge/rebuild"

var ErrInvalidRebuildScopeForTest = errInvalidRebuildScope

func NormalizeMySQLStoreScopeForTest(store *MySQLStore, scope domainrebuild.Scope) (domainrebuild.Scope, error) {
	return store.normalizeScope(scope)
}

func BuildKnowledgeBaseScopeUpdateQueryForTest(baseQuery string, scope domainrebuild.Scope, args []any) (string, []any) {
	return buildKnowledgeBaseScopeUpdateQuery(baseQuery, scope, args)
}

func BuildDocumentScopeUpdateQueryForTest(baseQuery string, scope domainrebuild.Scope, args []any) (string, []any) {
	return buildDocumentScopeUpdateQuery(baseQuery, scope, args)
}
