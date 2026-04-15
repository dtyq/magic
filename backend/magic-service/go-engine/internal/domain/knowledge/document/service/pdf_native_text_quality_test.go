package document_test

import (
	"strings"
	"testing"

	document "magic/internal/domain/knowledge/document/service"
)

func TestEvaluatePDFNativeTextQuality_PreservesReadableChineseText(t *testing.T) {
	t.Parallel()

	result := document.EvaluatePDFNativeTextQuality(strings.Join([]string{
		"主要特点",
		"",
		"皮疹",
		"体温可达39°以上",
	}, "\n"))

	if result.LowQuality {
		t.Fatalf("expected readable content not to be low quality: %#v", result)
	}
	if result.CleanedText != "主要特点\n\n皮疹\n体温可达39°以上" {
		t.Fatalf("unexpected cleaned text: %q", result.CleanedText)
	}
}

func TestEvaluatePDFNativeTextQuality_DropsGarbledLinesAndMarksLowQuality(t *testing.T) {
	t.Parallel()

	result := document.EvaluatePDFNativeTextQuality(strings.Join([]string{
		"\u00bc",
		"\u0095",
		"\u0086",
		"\u000e",
		"主要特点",
		"皮疹",
		"体温可达39°以上",
	}, "\n"))

	if !result.LowQuality {
		t.Fatalf("expected garbled content to be low quality: %#v", result)
	}
	for _, unwanted := range []string{"\u00bc", "\u0095", "\u0086", "\u000e"} {
		if strings.Contains(result.CleanedText, unwanted) {
			t.Fatalf("expected cleaned text to remove %q, got %q", unwanted, result.CleanedText)
		}
	}
	for _, wanted := range []string{"主要特点", "皮疹", "39°"} {
		if !strings.Contains(result.CleanedText, wanted) {
			t.Fatalf("expected cleaned text to keep %q, got %q", wanted, result.CleanedText)
		}
	}
}
