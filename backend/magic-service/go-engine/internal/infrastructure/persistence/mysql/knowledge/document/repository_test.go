package documentrepo_test

import (
	"testing"

	documentrepo "magic/internal/infrastructure/persistence/mysql/knowledge/document"
)

func TestDecodeDocumentFile_LegacyCompatibility(t *testing.T) {
	t.Parallel()
	file, err := documentrepo.DecodeDocumentFile([]byte(`{"type":1,"name":"x.md","key":"a/b/c.md","file_link":null,"third_file_id":"f1","platform_type":"lark"}`))
	if err != nil {
		t.Fatalf("DecodeDocumentFile returned error: %v", err)
	}
	if file == nil {
		t.Fatal("expected non-nil document file")
	}

	if file.Type != "external" {
		t.Fatalf("unexpected type: %q", file.Type)
	}
	if file.Name != "x.md" {
		t.Fatalf("unexpected name: %q", file.Name)
	}
	if file.URL != "a/b/c.md" {
		t.Fatalf("unexpected url: %q", file.URL)
	}
	if file.ThirdID != "f1" {
		t.Fatalf("unexpected third_id: %q", file.ThirdID)
	}
	if file.SourceType != "lark" {
		t.Fatalf("unexpected source_type: %q", file.SourceType)
	}
}

func TestDecodeDocumentFile_ArrayIsIgnored(t *testing.T) {
	t.Parallel()
	file, err := documentrepo.DecodeDocumentFile([]byte(`[]`))
	if err != nil {
		t.Fatalf("DecodeDocumentFile returned error: %v", err)
	}
	if file == nil {
		t.Fatal("expected non-nil document file")
	}
	if file.Type != "" || file.Name != "" || file.URL != "" || file.Size != 0 || file.Extension != "" || file.ThirdID != "" || file.SourceType != "" {
		t.Fatalf("expected zero-value document file for non-object json, got %#v", file)
	}
}

func TestDecodeDocumentFile_InferExtensionFromKey(t *testing.T) {
	t.Parallel()
	file, err := documentrepo.DecodeDocumentFile([]byte(`{"name":"demo","key":"a/b/c.md","extension":""}`))
	if err != nil {
		t.Fatalf("DecodeDocumentFile returned error: %v", err)
	}
	if file.Extension != "md" {
		t.Fatalf("unexpected extension: %q", file.Extension)
	}
}

func TestDecodeDocumentFile_InferExtensionFromURL(t *testing.T) {
	t.Parallel()
	file, err := documentrepo.DecodeDocumentFile([]byte(`{"name":"demo","url":"https://x.test/file.csv?sign=1","extension":""}`))
	if err != nil {
		t.Fatalf("DecodeDocumentFile returned error: %v", err)
	}
	if file.Extension != "csv" {
		t.Fatalf("unexpected extension: %q", file.Extension)
	}
}

func TestDecodeDocumentFile_InferExtensionFromName(t *testing.T) {
	t.Parallel()
	file, err := documentrepo.DecodeDocumentFile([]byte(`{"name":"abc.TXT","url":"","extension":""}`))
	if err != nil {
		t.Fatalf("DecodeDocumentFile returned error: %v", err)
	}
	if file.Extension != "txt" {
		t.Fatalf("unexpected extension: %q", file.Extension)
	}
}

func TestDecodeDocumentFile_KeepExistingExtension(t *testing.T) {
	t.Parallel()
	file, err := documentrepo.DecodeDocumentFile([]byte(`{"name":"abc.md","key":"a/b/c.md","extension":"PDF"}`))
	if err != nil {
		t.Fatalf("DecodeDocumentFile returned error: %v", err)
	}
	if file.Extension != "pdf" {
		t.Fatalf("unexpected extension: %q", file.Extension)
	}
}
