package docparser_test

import (
	"bytes"
	"context"
	"errors"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
	parser "magic/internal/infrastructure/parser"
)

func TestLegacyOfficeParsersSupport(t *testing.T) {
	t.Parallel()

	converter := parser.NewLegacyOfficeConverter(parser.OfficeConversionConfig{Enabled: true})
	if !parser.NewLegacyDocParser(converter, parser.NewDocxParser(nil)).Supports("DOC") {
		t.Fatal("expected legacy doc parser to support doc")
	}
	if !parser.NewLegacyXlsParser(converter, parser.NewXlsxParser()).Supports("xls") {
		t.Fatal("expected legacy xls parser to support xls")
	}
}

func TestLegacyOfficeParsersConvertWithLibreOffice(t *testing.T) {
	t.Parallel()

	command := findOfficeCommandForTest(t)
	cfg := parser.OfficeConversionConfig{
		Enabled:        true,
		Command:        command,
		Timeout:        30 * time.Second,
		MaxInputBytes:  1024 * 1024,
		MaxOutputBytes: 1024 * 1024,
		MaxConcurrent:  1,
	}

	t.Run("doc", func(t *testing.T) {
		t.Parallel()

		converter := parser.NewLegacyOfficeConverter(cfg)
		ctx := context.Background()
		docParser := parser.NewLegacyDocParser(converter, parser.NewDocxParser(nil))
		doc, err := docParser.ParseDocumentWithOptions(
			ctx,
			"legacy.doc",
			bytes.NewReader(readLegacyOfficeFixture(t, "legacy.doc")),
			"doc",
			documentdomain.DefaultParseOptions(),
		)
		if err != nil {
			t.Fatalf("ParseDocumentWithOptions doc returned error: %v", err)
		}
		if doc == nil || !strings.Contains(doc.BestEffortText(), "LEGACY_DOC_MARKER") {
			t.Fatalf("expected converted doc marker, got %#v", doc)
		}
	})

	t.Run("xls", func(t *testing.T) {
		t.Parallel()

		converter := parser.NewLegacyOfficeConverter(cfg)
		ctx := context.Background()
		xlsParser := parser.NewLegacyXlsParser(converter, parser.NewXlsxParser())
		xls, err := xlsParser.ParseDocumentWithOptions(
			ctx,
			"legacy.xls",
			bytes.NewReader(readLegacyOfficeFixture(t, "legacy.xls")),
			"xls",
			documentdomain.DefaultParseOptions(),
		)
		if err != nil {
			t.Fatalf("ParseDocumentWithOptions xls returned error: %v", err)
		}
		if xls == nil || !strings.Contains(xls.BestEffortText(), "LEGACY_XLS_MARKER") {
			t.Fatalf("expected converted xls marker, got %#v", xls)
		}
	})
}

func readLegacyOfficeFixture(t *testing.T, name string) []byte {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("testdata", name))
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			t.Skipf("legacy office fixture %q is not available", name)
		}
		t.Fatalf("read legacy office fixture %q: %v", name, err)
	}
	return data
}

func findOfficeCommandForTest(t *testing.T) string {
	t.Helper()
	for _, command := range []string{"soffice", "libreoffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"} {
		path, err := exec.LookPath(command)
		if err == nil {
			return path
		}
	}
	t.Skip("LibreOffice/soffice not installed")
	return ""
}
