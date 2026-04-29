package document_test

import (
	"errors"
	"testing"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

func TestDefaultResourceLimitsMaxFragmentsPerDocument(t *testing.T) {
	t.Parallel()

	limits := documentdomain.DefaultResourceLimits()
	if limits.MaxFragmentsPerDocument != 10_000 {
		t.Fatalf("expected default max fragments 10000, got %d", limits.MaxFragmentsPerDocument)
	}
	if err := documentdomain.CheckFragmentCount(10_000, limits); err != nil {
		t.Fatalf("expected 10000 fragments to pass, got %v", err)
	}
	err := documentdomain.CheckFragmentCount(10_001, limits)
	if !errors.Is(err, documentdomain.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected resource limit error, got %v", err)
	}
}
