package text_test

import (
	"testing"

	texthelper "magic/internal/application/knowledge/helper/text"
	"magic/internal/pkg/ctxmeta"
)

func TestNormalizeContentAndHashText(t *testing.T) {
	t.Parallel()

	if got := texthelper.NormalizeContent("a\r\n\r\n\r\nb\r"); got != "a\n\nb\n" {
		t.Fatalf("unexpected normalized content: %q", got)
	}
	if got := texthelper.NormalizeHierarchySourceFileType(".Markdown"); got != "md" {
		t.Fatalf("unexpected source file type: %q", got)
	}
	if texthelper.HashText("hello") == texthelper.HashText("world") {
		t.Fatal("expected different hashes for different content")
	}
}

func TestHelperStringsAndBusinessParams(t *testing.T) {
	t.Parallel()

	if got := texthelper.FirstNonEmptyString("", "a", "b"); got != "a" {
		t.Fatalf("unexpected first non-empty string: %q", got)
	}
	if got := texthelper.StringValue(123); got != "" {
		t.Fatalf("expected empty string, got %q", got)
	}
	if got := texthelper.StringValue("ok"); got != "ok" {
		t.Fatalf("unexpected string value: %q", got)
	}

	params := texthelper.BuildCreateBusinessParams("ORG", "USER", "BIZ")
	want := &ctxmeta.BusinessParams{
		OrganizationCode: "ORG",
		UserID:           "USER",
		BusinessID:       "BIZ",
	}
	if *params != *want {
		t.Fatalf("unexpected business params: %#v", params)
	}
}
