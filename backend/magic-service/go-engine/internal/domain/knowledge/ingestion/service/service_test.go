package service_test

import (
	"errors"
	"strings"
	"testing"
	"time"

	ingestionentity "magic/internal/domain/knowledge/ingestion/entity"
	ingestionservice "magic/internal/domain/knowledge/ingestion/service"
)

func TestPrepareCleanedDocumentNormalizesAndHashes(t *testing.T) {
	t.Parallel()

	now := time.Date(2026, 5, 22, 12, 0, 0, 0, time.UTC)
	svc := ingestionservice.NewDomainService(1024, func() time.Time { return now })

	got, err := svc.PrepareCleanedDocument(ingestionentity.CleanedDocument{
		OrganizationCode: " org-1 ",
		Provider:         " TEAMSHARE ",
		SourceCode:       " source-1 ",
		ItemRef:          " doc-1 ",
		Title:            " 测试 ",
		Content:          "# 测试\n正文",
	})
	if err != nil {
		t.Fatalf("PrepareCleanedDocument returned error: %v", err)
	}
	if got.Provider != "teamshare" {
		t.Fatalf("unexpected provider: %q", got.Provider)
	}
	if got.SourceCode != "source-1" || got.ItemRef != "doc-1" {
		t.Fatalf("unexpected normalized ids: %#v", got)
	}
	if got.CleanHash != ingestionentity.HashText(got.Content) || got.RawHash != got.CleanHash {
		t.Fatalf("unexpected hashes: raw=%s clean=%s", got.RawHash, got.CleanHash)
	}
	if !got.PulledAt.Equal(now) || !got.CleanedAt.Equal(now) {
		t.Fatalf("expected default timestamps, got pulled=%s cleaned=%s", got.PulledAt, got.CleanedAt)
	}
}

func TestPrepareCleanedDocumentRejectsTooLargeContent(t *testing.T) {
	t.Parallel()

	svc := ingestionservice.NewDomainService(8, nil)
	_, err := svc.PrepareCleanedDocument(ingestionentity.CleanedDocument{
		OrganizationCode: "org-1",
		Provider:         "teamshare",
		SourceCode:       "source-1",
		ItemRef:          "doc-1",
		Title:            "doc",
		Content:          strings.Repeat("x", 9),
	})
	if !errors.Is(err, ingestionentity.ErrCleanContentTooLarge) {
		t.Fatalf("expected ErrCleanContentTooLarge, got %v", err)
	}
}

func TestPrepareCleanedDocumentRejectsMismatchedCleanHash(t *testing.T) {
	t.Parallel()

	svc := ingestionservice.NewDomainService(1024, nil)
	_, err := svc.PrepareCleanedDocument(ingestionentity.CleanedDocument{
		OrganizationCode: "org-1",
		Provider:         "teamshare",
		SourceCode:       "source-1",
		ItemRef:          "doc-1",
		Title:            "doc",
		Content:          "# doc",
		CleanHash:        "wrong-hash",
	})
	if !errors.Is(err, ingestionentity.ErrIngestionContentMismatch) {
		t.Fatalf("expected ErrIngestionContentMismatch, got %v", err)
	}
}

func TestThirdFileIDRoundTrip(t *testing.T) {
	t.Parallel()

	thirdFileID := ingestionentity.BuildThirdFileID("source-1", "doc-1")
	sourceCode, itemRef, err := ingestionentity.ParseThirdFileID(thirdFileID)
	if err != nil {
		t.Fatalf("ParseThirdFileID returned error: %v", err)
	}
	if sourceCode != "source-1" || itemRef != "doc-1" {
		t.Fatalf("unexpected parse result: source=%q item=%q", sourceCode, itemRef)
	}
}
