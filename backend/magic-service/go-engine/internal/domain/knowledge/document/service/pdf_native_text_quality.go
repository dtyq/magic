package document

import (
	"strings"
	"unicode"
	"unicode/utf8"
)

const (
	pdfNativeTextDropLineRatioThreshold      = 0.20
	pdfNativeTextRetentionRatioThreshold     = 0.50
	pdfNativeTextSuspiciousDropRatio         = 0.60
	pdfNativeTextSuspiciousNoTextDropRatio   = 0.40
	pdfNativeTextWhitelistedLatin1DegreeSign = '\u00b0'
)

// PDFNativeTextQualityResult 描述 PDF 原生文字层的清洗结果与质量判定。
type PDFNativeTextQualityResult struct {
	CleanedText string
	LowQuality  bool
}

// EvaluatePDFNativeTextQuality 清洗并评估 PDF 原生文字层质量。
func EvaluatePDFNativeTextQuality(content string) PDFNativeTextQualityResult {
	normalized := strings.ReplaceAll(content, "\r\n", "\n")
	normalized = strings.ReplaceAll(normalized, "\r", "\n")

	rawNonWhitespaceCount := countPDFNonWhitespaceRunes(normalized)
	rawNonEmptyLineCount := 0
	droppedNonEmptyLineCount := 0
	hasInvalidControl := false

	lines := strings.Split(normalized, "\n")
	cleanedLines := make([]string, 0, len(lines))
	pendingEmptyLine := false
	sawContent := false

	for _, line := range lines {
		if strings.TrimSpace(line) == "" {
			if sawContent {
				pendingEmptyLine = true
			}
			continue
		}

		rawNonEmptyLineCount++
		analysis := analyzePDFNativeTextLine(line)
		hasInvalidControl = hasInvalidControl || analysis.HasInvalidControl

		if shouldDropPDFNativeTextLine(analysis) || strings.TrimSpace(analysis.CleanedLine) == "" {
			droppedNonEmptyLineCount++
			continue
		}

		if pendingEmptyLine && sawContent {
			cleanedLines = append(cleanedLines, "")
		}
		pendingEmptyLine = false
		sawContent = true
		cleanedLines = append(cleanedLines, analysis.CleanedLine)
	}

	cleanedText := normalizeSourceContent(strings.Join(cleanedLines, "\n"))
	cleanedNonWhitespaceCount := countPDFNonWhitespaceRunes(cleanedText)
	droppedRatio := 0.0
	if rawNonEmptyLineCount > 0 {
		droppedRatio = float64(droppedNonEmptyLineCount) / float64(rawNonEmptyLineCount)
	}

	lowQuality := strings.TrimSpace(cleanedText) == "" ||
		hasInvalidControl ||
		droppedRatio >= pdfNativeTextDropLineRatioThreshold ||
		float64(cleanedNonWhitespaceCount) < float64(rawNonWhitespaceCount)*pdfNativeTextRetentionRatioThreshold

	return PDFNativeTextQualityResult{
		CleanedText: cleanedText,
		LowQuality:  lowQuality,
	}
}

type pdfNativeTextLineAnalysis struct {
	CleanedLine            string
	NonWhitespaceRuneCount int
	TextRuneCount          int
	SuspiciousRuneCount    int
	HasInvalidControl      bool
}

func analyzePDFNativeTextLine(line string) pdfNativeTextLineAnalysis {
	var builder strings.Builder
	analysis := pdfNativeTextLineAnalysis{}
	builder.Grow(len(line))

	for _, r := range line {
		if !unicode.IsSpace(r) {
			analysis.NonWhitespaceRuneCount++
		}

		switch {
		case r == utf8.RuneError:
			analysis.SuspiciousRuneCount++
			analysis.HasInvalidControl = true
			continue
		case isPDFInvalidControlRune(r):
			analysis.SuspiciousRuneCount++
			analysis.HasInvalidControl = true
			continue
		case isPDFC1ControlRune(r):
			analysis.SuspiciousRuneCount++
			analysis.HasInvalidControl = true
			continue
		case isPDFPrivateUseRune(r):
			analysis.SuspiciousRuneCount++
			continue
		case isPDFSuspiciousLatin1Rune(r):
			analysis.SuspiciousRuneCount++
			continue
		}

		if isPDFTextRune(r) {
			analysis.TextRuneCount++
		}
		builder.WriteRune(r)
	}

	analysis.CleanedLine = strings.TrimSpace(builder.String())
	return analysis
}

func shouldDropPDFNativeTextLine(analysis pdfNativeTextLineAnalysis) bool {
	if analysis.NonWhitespaceRuneCount == 0 {
		return false
	}

	suspiciousRatio := float64(analysis.SuspiciousRuneCount) / float64(analysis.NonWhitespaceRuneCount)
	if suspiciousRatio >= pdfNativeTextSuspiciousDropRatio {
		return true
	}
	return suspiciousRatio >= pdfNativeTextSuspiciousNoTextDropRatio && analysis.TextRuneCount == 0
}

func countPDFNonWhitespaceRunes(content string) int {
	count := 0
	for _, r := range content {
		if unicode.IsSpace(r) {
			continue
		}
		count++
	}
	return count
}

func isPDFInvalidControlRune(r rune) bool {
	return unicode.IsControl(r) && r != '\n' && r != '\r' && r != '\t'
}

func isPDFC1ControlRune(r rune) bool {
	return r >= 0x80 && r <= 0x9f
}

func isPDFPrivateUseRune(r rune) bool {
	return (r >= 0xe000 && r <= 0xf8ff) ||
		(r >= 0xf0000 && r <= 0xffffd) ||
		(r >= 0x100000 && r <= 0x10fffd)
}

func isPDFSuspiciousLatin1Rune(r rune) bool {
	return r >= 0x00a0 && r <= 0x00ff && r != pdfNativeTextWhitelistedLatin1DegreeSign
}

func isPDFTextRune(r rune) bool {
	return unicode.Is(unicode.Han, r) || unicode.IsLetter(r) || unicode.IsDigit(r)
}
