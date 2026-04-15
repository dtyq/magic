package docparser_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"baliance.com/gooxml/common"
	"baliance.com/gooxml/presentation"

	documentdomain "magic/internal/domain/knowledge/document/service"
	parser "magic/internal/infrastructure/parser"
)

func TestPptxParser_ParseDocumentIncludesSlideTextAndImageOCR(t *testing.T) {
	t.Parallel()

	tmpDir := t.TempDir()
	imagePath := filepath.Join(tmpDir, "slide.png")
	pptxPath := filepath.Join(tmpDir, "demo.pptx")
	writeTestPNG(t, imagePath)

	ppt := presentation.New()
	slide := ppt.AddSlide()
	box := slide.AddTextBox()
	paragraph := box.AddParagraph()
	run := paragraph.AddRun()
	run.SetText("幻灯片正文")

	imageFile, err := common.ImageFromFile(imagePath)
	if err != nil {
		t.Fatalf("read image: %v", err)
	}
	imageRef, err := ppt.AddImage(imageFile)
	if err != nil {
		t.Fatalf("add image ref: %v", err)
	}
	_ = slide.AddImage(imageRef)

	if err := ppt.SaveToFile(pptxPath); err != nil {
		t.Fatalf("save pptx: %v", err)
	}

	file, err := os.Open(pptxPath)
	if err != nil {
		t.Fatalf("open pptx: %v", err)
	}
	defer func() { _ = file.Close() }()

	parsed, err := parser.NewPptxParserWithLimit(&fakeDocxOCR{textsByType: map[string]string{"png": "幻灯片图片关键词"}}, 20).
		ParseDocument(context.Background(), pptxPath, file, "pptx")
	if err != nil {
		t.Fatalf("parse pptx: %v", err)
	}

	content := parsed.BestEffortText()
	if !strings.Contains(content, "# Slide 1") {
		t.Fatalf("expected slide heading, got %q", content)
	}
	if !strings.Contains(content, "幻灯片正文") || !strings.Contains(content, "幻灯片图片关键词") {
		t.Fatalf("expected slide text and OCR text, got %q", content)
	}
	if got := parsed.DocumentMeta[documentdomain.ParsedMetaEmbeddedImageOCRSuccessCount]; got != 1 {
		t.Fatalf("expected 1 OCR success, got %#v", got)
	}
}
