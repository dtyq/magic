package splitter

import (
	"fmt"
	"slices"
	"strings"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/ast"
	mdtext "github.com/yuin/goldmark/text"
)

type hierarchyDetectionResult struct {
	Headings []hierarchyHeading
	Detector string
}

type hierarchyDetector interface {
	Name() string
	Supports(sourceFileType string) bool
	Detect(content string) ([]hierarchyHeading, error)
}

type markdownASTHierarchyDetector struct{}

func (d markdownASTHierarchyDetector) Name() string {
	return hierarchyDetectorMarkdownAST
}

func (d markdownASTHierarchyDetector) Supports(sourceFileType string) bool {
	return sourceFileType == "md"
}

func (d markdownASTHierarchyDetector) Detect(content string) ([]hierarchyHeading, error) {
	normalizedContent := strings.ReplaceAll(content, "\r\n", "\n")
	source := []byte(normalizedContent)
	root := goldmark.DefaultParser().Parse(mdtext.NewReader(source))
	lineStarts := buildLineStartOffsets(normalizedContent)

	headings := make([]hierarchyHeading, 0, len(lineStarts)/8+1)
	if err := ast.Walk(root, func(node ast.Node, entering bool) (ast.WalkStatus, error) {
		if !entering || node.Kind() != ast.KindHeading {
			return ast.WalkContinue, nil
		}

		heading, ok := node.(*ast.Heading)
		if !ok {
			return ast.WalkContinue, nil
		}
		title := strings.TrimSpace(string(heading.Lines().Value(source)))
		if title == "" || heading.Lines().Len() == 0 {
			return ast.WalkContinue, nil
		}

		firstSegment := heading.Lines().At(0)
		lastSegment := heading.Lines().At(heading.Lines().Len() - 1)
		startLine := offsetToLine(firstSegment.Start, lineStarts)
		endOffset := max(firstSegment.Start, lastSegment.Stop-1)
		endLine := offsetToLine(endOffset, lineStarts)

		headings = append(headings, hierarchyHeading{
			StartLine:      startLine,
			HeadingEndLine: endLine,
			Level:          clampHierarchyLevel(heading.Level),
			Title:          title,
		})
		return ast.WalkContinue, nil
	}); err != nil {
		return nil, fmt.Errorf("walk markdown ast headings: %w", err)
	}

	return headings, nil
}

type docxStyleHierarchyDetector struct{}

func (d docxStyleHierarchyDetector) Name() string {
	return hierarchyDetectorDocxStyle
}

func (d docxStyleHierarchyDetector) Supports(sourceFileType string) bool {
	return sourceFileType == "docx"
}

func (d docxStyleHierarchyDetector) Detect(content string) ([]hierarchyHeading, error) {
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	headings := make([]hierarchyHeading, 0, len(lines)/8+1)
	for i, line := range lines {
		trimmed := strings.TrimSpace(line)
		if trimmed == "" {
			continue
		}
		level, title, ok := parseMarkdownHeading(trimmed)
		if !ok {
			continue
		}
		headings = append(headings, hierarchyHeading{
			StartLine:      i,
			HeadingEndLine: i,
			Level:          level,
			Title:          title,
		})
	}
	return headings, nil
}

func resolveHierarchyDetection(content, sourceFileType string) hierarchyDetectionResult {
	normalizedType := normalizeHierarchySourceFileType(sourceFileType)
	detectors := []hierarchyDetector{
		markdownASTHierarchyDetector{},
		docxStyleHierarchyDetector{},
	}

	for _, detector := range detectors {
		if !detector.Supports(normalizedType) {
			continue
		}
		headings, err := detector.Detect(content)
		if err == nil && len(headings) > 0 {
			return hierarchyDetectionResult{
				Headings: headings,
				Detector: detector.Name(),
			}
		}
		break
	}

	headings := detectHierarchyHeadingsRegex(content)
	return hierarchyDetectionResult{
		Headings: headings,
		Detector: hierarchyDetectorRegexFallback,
	}
}

func buildLineStartOffsets(content string) []int {
	offsets := make([]int, 1, len(content)/32+1)
	offsets[0] = 0
	for i, ch := range content {
		if ch == '\n' {
			offsets = append(offsets, i+1)
		}
	}
	return offsets
}

func offsetToLine(offset int, lineStarts []int) int {
	if len(lineStarts) == 0 {
		return 0
	}
	if offset <= 0 {
		return 0
	}
	idx, _ := slices.BinarySearchFunc(lineStarts, offset, func(lineStart, target int) int {
		if lineStart <= target {
			return -1
		}
		return 1
	})
	idx--
	if idx < 0 {
		return 0
	}
	return idx
}
