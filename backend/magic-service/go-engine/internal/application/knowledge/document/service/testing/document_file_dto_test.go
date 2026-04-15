package docapp_test

import (
	"encoding/json"
	"testing"

	docfilehelper "magic/internal/application/knowledge/helper/docfile"
)

func TestDocumentFileDTOUnmarshalLegacyExternalPayload(t *testing.T) {
	t.Parallel()

	var dto docfilehelper.DocumentFileDTO
	if err := json.Unmarshal([]byte(`{"type":1,"name":"demo.md","key":"DT001/open/demo.md"}`), &dto); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if dto.Type != "external" {
		t.Fatalf("expected type external, got %q", dto.Type)
	}
	if dto.URL != "DT001/open/demo.md" {
		t.Fatalf("expected url from key fallback, got %q", dto.URL)
	}
}

func TestDocumentFileDTOUnmarshalLegacyThirdPlatformAliases(t *testing.T) {
	t.Parallel()

	var dto docfilehelper.DocumentFileDTO
	if err := json.Unmarshal([]byte(`{"type":2,"name":"third","third_file_id":"F-1","platform_type":"lark","file_link":{"url":"https://demo/file"}}`), &dto); err != nil {
		t.Fatalf("unmarshal failed: %v", err)
	}
	if dto.Type != "third_platform" {
		t.Fatalf("expected type third_platform, got %q", dto.Type)
	}
	if dto.ThirdID != "F-1" {
		t.Fatalf("expected third id alias mapping, got %q", dto.ThirdID)
	}
	if dto.SourceType != "lark" {
		t.Fatalf("expected source type alias mapping, got %q", dto.SourceType)
	}
	if dto.URL != "https://demo/file" {
		t.Fatalf("expected url from file_link.url, got %q", dto.URL)
	}
}
