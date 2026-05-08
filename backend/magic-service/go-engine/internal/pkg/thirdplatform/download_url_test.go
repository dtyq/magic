package thirdplatform_test

import (
	"testing"

	"magic/internal/pkg/thirdplatform"
)

func TestSelectDownloadURLPrefersLatestSnapshotCandidate(t *testing.T) {
	t.Parallel()

	got := thirdplatform.SelectDownloadURL("xlsx", []string{
		"https://example.com/a/original.xlsx?token=1",
		"https://example.com/a/.xlsx?token=2",
		"https://example.com/a/.xlsx?token=3",
	}, "")
	if got != "https://example.com/a/.xlsx?token=3" {
		t.Fatalf("expected latest snapshot candidate, got %q", got)
	}
}

func TestSelectDownloadURLFallsBackToLastNonEmptyCandidate(t *testing.T) {
	t.Parallel()

	got := thirdplatform.SelectDownloadURL("docx", []string{
		"",
		"https://example.com/a/first.docx",
		" https://example.com/a/second.docx ",
	}, "")
	if got != "https://example.com/a/second.docx" {
		t.Fatalf("expected last non-empty candidate, got %q", got)
	}
}

func TestSelectDownloadURLFallsBackToLegacyDownloadURL(t *testing.T) {
	t.Parallel()

	got := thirdplatform.SelectDownloadURL("xlsx", nil, " https://example.com/a/fallback.xlsx ")
	if got != "https://example.com/a/fallback.xlsx" {
		t.Fatalf("expected fallback legacy url, got %q", got)
	}
}

func TestSelectDownloadURLIgnoresExtensionCaseAndDotPrefix(t *testing.T) {
	t.Parallel()

	got := thirdplatform.SelectDownloadURL(".XLSX", []string{
		"https://example.com/a/original.xlsx",
		"https://example.com/a/.xlsx?token=9",
	}, "")
	if got != "https://example.com/a/.xlsx?token=9" {
		t.Fatalf("expected dot-prefixed extension to match snapshot, got %q", got)
	}
}
