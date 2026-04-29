package ctxmeta_test

import (
	"context"
	"testing"

	"magic/internal/pkg/ctxmeta"
)

func TestDetachKeepsMetadataAndIgnoresParentCancel(t *testing.T) {
	t.Parallel()

	parent, cancel := context.WithCancel(context.Background())
	parent = ctxmeta.WithRequestID(parent, "req-detach-1")
	parent = ctxmeta.WithBusinessParams(parent, &ctxmeta.BusinessParams{
		OrganizationCode: "ORG-1",
		UserID:           "U-1",
		BusinessID:       "BIZ-1",
	})

	detached := ctxmeta.Detach(parent)
	cancel()

	if err := detached.Err(); err != nil {
		t.Fatalf("expected detached context to ignore parent cancel, got %v", err)
	}
	if requestID, ok := ctxmeta.RequestIDFromContext(detached); !ok || requestID != "req-detach-1" {
		t.Fatalf("unexpected detached request_id: %q ok=%v", requestID, ok)
	}
	businessParams, ok := ctxmeta.BusinessParamsFromContext(detached)
	if !ok || businessParams == nil {
		t.Fatal("expected detached business params")
	}
	if businessParams.OrganizationCode != "ORG-1" || businessParams.UserID != "U-1" || businessParams.BusinessID != "BIZ-1" {
		t.Fatalf("unexpected detached business params: %#v", businessParams)
	}
}
