package splitter_test

import (
	"context"
	"errors"
	"fmt"
	"strings"
	"testing"

	document "magic/internal/domain/knowledge/document/service"
	documentsplitter "magic/internal/domain/knowledge/document/splitter"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
)

func TestSplitParsedDocumentToChunksLimitsTokenChunks(t *testing.T) {
	t.Parallel()

	_, _, err := documentsplitter.SplitParsedDocumentToChunks(context.Background(), documentsplitter.ParsedDocumentChunkInput{
		Parsed:         parseddocument.NewPlainTextParsedDocument("txt", strings.Repeat("alpha ", 80)),
		RequestedMode:  shared.FragmentModeCustom,
		SegmentConfig:  documentsplitter.PreviewSegmentConfig{ChunkSize: 5},
		Model:          "text-embedding-3-small",
		MaxChunks:      2,
		SourceFileType: "txt",
	})
	assertMaxChunksResourceLimit(t, err)
}

func TestSplitParsedDocumentToChunksLimitsHierarchyChunks(t *testing.T) {
	t.Parallel()

	content := "# 第一章\n" + strings.Repeat("alpha ", 80) + "\n\n# 第二章\n" + strings.Repeat("beta ", 80)
	_, _, err := documentsplitter.SplitParsedDocumentToChunks(context.Background(), documentsplitter.ParsedDocumentChunkInput{
		Parsed:         parseddocument.NewPlainTextParsedDocument("md", content),
		RequestedMode:  shared.FragmentModeNormal,
		SegmentConfig:  documentsplitter.PreviewSegmentConfig{ChunkSize: 5},
		Model:          "text-embedding-3-small",
		MaxChunks:      1,
		SourceFileType: "md",
	})
	assertMaxChunksResourceLimit(t, err)
}

func TestSplitParsedDocumentToChunksLimitsTabularChunks(t *testing.T) {
	t.Parallel()

	fields := make([]map[string]any, 0, 8)
	for i := range 8 {
		fields = append(fields, map[string]any{
			"header_path": fmt.Sprintf("字段%d", i+1),
			"value":       strings.Repeat("value ", 8),
		})
	}
	_, _, err := documentsplitter.SplitParsedDocumentToChunks(context.Background(), documentsplitter.ParsedDocumentChunkInput{
		Parsed: &parseddocument.ParsedDocument{
			SourceType: parseddocument.SourceTabular,
			Blocks: []parseddocument.ParsedBlock{{
				Type: parseddocument.BlockTypeTableRow,
				Metadata: map[string]any{
					parseddocument.MetaFields:       fields,
					parseddocument.MetaSourceFormat: "csv",
					parseddocument.MetaSheetName:    "sheet",
					parseddocument.MetaTableTitle:   "table",
				},
			}},
		},
		SegmentConfig:  documentsplitter.PreviewSegmentConfig{ChunkSize: 5},
		Model:          "text-embedding-3-small",
		MaxChunks:      2,
		SourceFileType: "csv",
	})
	assertMaxChunksResourceLimit(t, err)
}

func assertMaxChunksResourceLimit(t *testing.T, err error) {
	t.Helper()

	if !errors.Is(err, document.ErrDocumentResourceLimitExceeded) {
		t.Fatalf("expected document resource limit error, got %v", err)
	}
	var resourceErr *document.ResourceLimitError
	if !errors.As(err, &resourceErr) {
		t.Fatalf("expected structured resource limit error, got %v", err)
	}
	if resourceErr.LimitName != document.ResourceLimitMaxFragmentsPerDocument {
		t.Fatalf("expected max fragments limit, got %#v", resourceErr)
	}
}
