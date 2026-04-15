package docapp_test

import (
	"testing"

	appservice "magic/internal/application/knowledge/document/service"
)

func TestCleanupStrategyForCreateSync(t *testing.T) {
	t.Parallel()

	if !appservice.ShouldCleanupDocumentBeforeSyncForTest("create") {
		t.Fatal("expected create mode to cleanup existing document fragments before sync")
	}
}

func TestCleanupStrategyForResync(t *testing.T) {
	t.Parallel()

	if appservice.ShouldCleanupDocumentBeforeSyncForTest("resync") {
		t.Fatal("expected resync mode not to cleanup old data before new sync succeeds")
	}
}
