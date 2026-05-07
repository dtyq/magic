package docfile_test

import (
	"encoding/json"
	"testing"

	docfilehelper "magic/internal/application/knowledge/helper/docfile"
)

func TestDocumentFileDTOUnmarshalJSONCompatFields(t *testing.T) {
	t.Parallel()

	raw := []byte(`{
		"type": 2,
		"name": " spec.docx ",
		"key": "https://example.com/by-key.docx",
		"file_link": {"url": "https://example.com/by-link.docx"},
		"third_file_id": "FILE-1",
		"platform_type": "teamshare",
		"knowledge_base_id": "KB-TS-1",
		"third_file_extension_name": "DOCX",
		"size": 12
	}`)

	var dto docfilehelper.DocumentFileDTO
	if err := json.Unmarshal(raw, &dto); err != nil {
		t.Fatalf("unmarshal document file failed: %v", err)
	}
	if dto.Type != "third_platform" || dto.URL != "https://example.com/by-link.docx" {
		t.Fatalf("unexpected dto after unmarshal: %#v", dto)
	}
	if dto.Extension != "docx" || dto.ThirdID != "FILE-1" || dto.SourceType != "teamshare" || dto.KnowledgeBaseID != "KB-TS-1" {
		t.Fatalf("unexpected compatibility fields: %#v", dto)
	}
	if dto.FileLink == nil || dto.FileLink.URL != "https://example.com/by-link.docx" {
		t.Fatalf("unexpected file link: %#v", dto.FileLink)
	}
}

func TestDocumentFileDTOUnmarshalJSONSupportsFileKeyAlias(t *testing.T) {
	t.Parallel()

	raw := []byte(`{
		"type": "project_file",
		"name": "demo.md",
		"file_key": "ORG1/project/demo.md",
		"extension": "md",
		"source_type": "project"
	}`)

	var dto docfilehelper.DocumentFileDTO
	if err := json.Unmarshal(raw, &dto); err != nil {
		t.Fatalf("unmarshal document file with file_key alias failed: %v", err)
	}
	if dto.Key != "ORG1/project/demo.md" || dto.URL != "ORG1/project/demo.md" {
		t.Fatalf("expected file_key alias retained, got %#v", dto)
	}
}

func TestDocumentFileDTOUnmarshalJSONKeepsProjectFileTransportSemantics(t *testing.T) {
	t.Parallel()

	raw := []byte(`{
		"type": "project_file",
		"name": "demo.md",
		"url": "https://example.com/project/demo.md?sign=1",
		"source_type": "project",
		"extension": "md",
		"project_file_id": 42,
		"relative_file_path": "docs/demo.md"
	}`)

	var dto docfilehelper.DocumentFileDTO
	if err := json.Unmarshal(raw, &dto); err != nil {
		t.Fatalf("unmarshal project preview document file failed: %v", err)
	}
	if dto.Type != "project_file" {
		t.Fatalf("expected project_file type preserved, got %#v", dto)
	}
	if dto.URL != "https://example.com/project/demo.md?sign=1" || dto.SourceType != "project" || dto.Extension != "md" {
		t.Fatalf("unexpected project preview document file fields: %#v", dto)
	}
	if dto.ProjectFileID != 42 || dto.RelativeFilePath != "docs/demo.md" {
		t.Fatalf("unexpected project transport compat fields: %#v", dto)
	}
}

func TestDocumentFileDTOUnmarshalJSONAcceptsStringNumericTransportFields(t *testing.T) {
	t.Parallel()

	raw := []byte(`{
		"type": "project_file",
		"name": "demo.md",
		"size": "12",
		"project_file_id": "42"
	}`)

	var dto docfilehelper.DocumentFileDTO
	if err := json.Unmarshal(raw, &dto); err != nil {
		t.Fatalf("unmarshal string numeric document file failed: %v", err)
	}
	if dto.Size != 12 || dto.ProjectFileID != 42 {
		t.Fatalf("expected string numerics preserved, got %#v", dto)
	}
}

func TestDocumentFileDTOUnmarshalJSONPreservesLargeNumericIDFields(t *testing.T) {
	t.Parallel()

	raw := []byte(`{
		"type": "project_file",
		"name": "demo.md",
		"project_file_id": 904787325064802305,
		"third_file_id": 904787325064802306,
		"knowledge_base_id": 904787325064802307
	}`)

	var dto docfilehelper.DocumentFileDTO
	if err := json.Unmarshal(raw, &dto); err != nil {
		t.Fatalf("unmarshal large numeric id document file failed: %v", err)
	}
	if dto.ProjectFileID != 904787325064802305 {
		t.Fatalf("expected project_file_id preserved, got %#v", dto.ProjectFileID)
	}
	if dto.ThirdID != "904787325064802306" {
		t.Fatalf("expected third id preserved, got %#v", dto.ThirdID)
	}
	if dto.KnowledgeBaseID != "904787325064802307" {
		t.Fatalf("expected knowledge_base_id preserved, got %#v", dto.KnowledgeBaseID)
	}
}

func TestDocumentFileDTOUnmarshalJSONRejectsInvalidNumericTransportFields(t *testing.T) {
	t.Parallel()

	raw := []byte(`{
		"type": "project_file",
		"name": "demo.md",
		"project_file_id": "bad-id"
	}`)

	var dto docfilehelper.DocumentFileDTO
	if err := json.Unmarshal(raw, &dto); err == nil {
		t.Fatal("expected invalid project_file_id to fail")
	}
}

func TestCloneDocumentFileDTOAndToDomainFile(t *testing.T) {
	t.Parallel()

	dto := &docfilehelper.DocumentFileDTO{
		Type:            "external",
		Name:            "doc.txt",
		Key:             "https://example.com/by-key.txt",
		FileLink:        &docfilehelper.DocumentFileLinkDTO{URL: "https://example.com/by-link.txt"},
		ThirdID:         "FILE-1",
		SourceType:      "teamshare",
		KnowledgeBaseID: "KB-TS-1",
	}

	cloned := docfilehelper.CloneDocumentFileDTO(dto)
	if cloned == dto || cloned.FileLink == dto.FileLink {
		t.Fatal("expected deep clone")
	}

	file := docfilehelper.ToDomainFile(dto)
	if file == nil || file.URL != "https://example.com/by-link.txt" {
		t.Fatalf("unexpected domain file: %#v", file)
	}
	if file.Type != "external" || file.ThirdID != "FILE-1" || file.SourceType != "teamshare" || file.KnowledgeBaseID != "KB-TS-1" {
		t.Fatalf("unexpected domain file fields: %#v", file)
	}
}
