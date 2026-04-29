package fragdomain_test

import (
	"testing"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	fragdomain "magic/internal/domain/knowledge/fragment/service"
)

func TestResolvePreviewPlan_NameOnlyIsNotURLParseable(t *testing.T) {
	t.Parallel()

	plan := fragdomain.ResolvePreviewPlan(&fragmodel.DocumentFile{
		Type: "external",
		Name: "服务商、供应商、承包商资质审查标准.docx",
	}, nil, false)

	if plan.AllowURLParse {
		t.Fatalf("expected name-only document_file to be non-parseable, got %#v", plan.DocumentFile)
	}
	if plan.DocumentFile.URL != "" {
		t.Fatalf("expected URL to stay empty, got %q", plan.DocumentFile.URL)
	}
	if plan.DocumentFile.Extension != "docx" {
		t.Fatalf("expected extension inferred from name, got %q", plan.DocumentFile.Extension)
	}
}
