package fragdomain

import (
	"path/filepath"
	"slices"
	"strings"
	"unicode/utf8"
)

const (
	documentNodeTypeTitle       = "title"
	documentNodeTypeSection     = "section-title"
	documentNodeTypeSectionText = "section-text"
	documentRootParentID        = -1
	documentNodeMaxHeadingLevel = 6
)

// DocumentNode 表示结构化文档节点。
type DocumentNode struct {
	ID       int
	Parent   int
	Children []int
	Text     string
	Level    int
	Type     string
}

// DocumentNodeSource 表示构建结构化节点所需的最小语义信息。
type DocumentNodeSource struct {
	Content           string
	SectionPath       string
	SectionTitle      string
	SectionLevel      int
	ChunkIndex        int
	HasChunkIndex     bool
	TreeNodeID        string
	ParentNodeID      string
	SectionChunkIndex int
	HasSectionChunk   bool
}

// BuildDocumentNodes 根据片段语义信息构建结构化文档节点。
func BuildDocumentNodes(documentTitle string, sources []DocumentNodeSource) []DocumentNode {
	sources = sortDocumentNodeSources(sources)
	rootTitle, commonRoot := resolveDocumentRootTitle(documentTitle, sources)
	nodes := []DocumentNode{{
		ID:       0,
		Parent:   documentRootParentID,
		Children: []int{},
		Text:     rootTitle,
		Level:    -1,
		Type:     documentNodeTypeTitle,
	}}

	nextID := 1
	pathToNodeID := map[string]int{}
	treeNodeIDToNodeID := map[string]int{}

	appendNode := func(parentID int, text string, level int, nodeType string) int {
		nodeID := nextID
		nextID++
		nodes = append(nodes, DocumentNode{
			ID:       nodeID,
			Parent:   parentID,
			Children: []int{},
			Text:     text,
			Level:    level,
			Type:     nodeType,
		})
		nodes[parentID].Children = append(nodes[parentID].Children, nodeID)
		return nodeID
	}

	for _, source := range sources {
		parentID := 0
		segments := documentNodeSectionSegments(source, commonRoot, rootTitle)

		currentPath := ""
		for index, segment := range segments {
			if segment == "" {
				continue
			}
			if currentPath == "" {
				currentPath = segment
			} else {
				currentPath += " > " + segment
			}
			treeNodeID := ""
			if index == len(segments)-1 {
				treeNodeID = strings.TrimSpace(source.TreeNodeID)
			}
			nodeID, ok := resolveExistingDocumentSectionNode(pathToNodeID, treeNodeIDToNodeID, currentPath, treeNodeID)
			if !ok {
				nodeID = appendNode(parentID, segment, index, documentNodeTypeSection)
				pathToNodeID[currentPath] = nodeID
			}
			if treeNodeID != "" {
				treeNodeIDToNodeID[treeNodeID] = nodeID
			}
			parentID = nodeID
		}

		content := normalizeDocumentNodeText(source)
		if content == "" {
			continue
		}
		appendNode(parentID, content, -1, documentNodeTypeSectionText)
	}

	return nodes
}

func sortDocumentNodeSources(sources []DocumentNodeSource) []DocumentNodeSource {
	if len(sources) <= 1 {
		return sources
	}

	sorted := append([]DocumentNodeSource(nil), sources...)
	slices.SortStableFunc(sorted, func(a, b DocumentNodeSource) int {
		if a.HasChunkIndex && b.HasChunkIndex && a.ChunkIndex != b.ChunkIndex {
			return a.ChunkIndex - b.ChunkIndex
		}
		if a.HasChunkIndex && !b.HasChunkIndex {
			return -1
		}
		if !a.HasChunkIndex && b.HasChunkIndex {
			return 1
		}
		if strings.TrimSpace(a.SectionPath) == strings.TrimSpace(b.SectionPath) &&
			a.HasSectionChunk && b.HasSectionChunk &&
			a.SectionChunkIndex != b.SectionChunkIndex {
			return a.SectionChunkIndex - b.SectionChunkIndex
		}
		return 0
	})
	return sorted
}

func documentNodeSectionSegments(source DocumentNodeSource, commonRoot, rootTitle string) []string {
	segments := splitSectionSegments(source.SectionPath)
	if commonRoot != "" && len(segments) > 0 && segments[0] == commonRoot {
		segments = segments[1:]
	}
	if len(segments) > 0 {
		return segments
	}
	sectionTitle := strings.TrimSpace(source.SectionTitle)
	if sectionTitle == "" || sectionTitle == rootTitle {
		return nil
	}
	return []string{sectionTitle}
}

func resolveExistingDocumentSectionNode(
	pathToNodeID map[string]int,
	treeNodeIDToNodeID map[string]int,
	currentPath string,
	treeNodeID string,
) (int, bool) {
	if treeNodeID != "" {
		if nodeID, ok := treeNodeIDToNodeID[treeNodeID]; ok {
			return nodeID, true
		}
	}
	nodeID, ok := pathToNodeID[currentPath]
	if ok && treeNodeID != "" {
		treeNodeIDToNodeID[treeNodeID] = nodeID
	}
	return nodeID, ok
}

func normalizeDocumentNodeText(source DocumentNodeSource) string {
	content := strings.TrimSpace(source.Content)
	content = trimDocumentNodeDisplayPrefix(content, strings.TrimSpace(source.SectionPath))
	content = trimDocumentNodeHierarchyPrefix(content, source)
	sectionTitle := strings.TrimSpace(source.SectionTitle)
	if sectionTitle != "" && !strings.Contains(strings.TrimSpace(source.SectionPath), sectionTitle) {
		content = trimDocumentNodeDisplayPrefix(content, sectionTitle)
	}
	return trimLeadingDocumentNodeHeading(content, sectionTitle)
}

func trimDocumentNodeHierarchyPrefix(content string, source DocumentNodeSource) string {
	segments := splitSectionSegments(source.SectionPath)
	if len(segments) == 0 {
		return content
	}

	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	firstContentLine := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		firstContentLine = i
		break
	}
	if firstContentLine < 0 {
		return content
	}

	startLevel := 1
	if source.SectionLevel > 0 {
		startLevel = max(1, source.SectionLevel-len(segments)+1)
	}
	for index, segment := range segments {
		lineIndex := firstContentLine + index
		if lineIndex >= len(lines) || !documentNodeLineMatchesTitle(lines[lineIndex], segment) {
			return content
		}
		if expectedLevel := min(documentNodeMaxHeadingLevel, startLevel+index); !documentNodeLineMatchesLevel(lines[lineIndex], expectedLevel) {
			return content
		}
	}

	lines = append(lines[:firstContentLine], lines[firstContentLine+len(segments):]...)
	for len(lines) > 0 && strings.TrimSpace(lines[0]) == "" {
		lines = lines[1:]
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func trimDocumentNodeDisplayPrefix(content, prefix string) string {
	if content == "" || prefix == "" {
		return content
	}
	if content == prefix {
		return ""
	}
	if after, ok := strings.CutPrefix(content, prefix+"\n\n"); ok {
		return strings.TrimSpace(after)
	}
	return content
}

func trimLeadingDocumentNodeHeading(content, sectionTitle string) string {
	if content == "" || strings.TrimSpace(sectionTitle) == "" {
		return content
	}
	lines := strings.Split(strings.ReplaceAll(content, "\r\n", "\n"), "\n")
	firstContentLine := -1
	for i, line := range lines {
		if strings.TrimSpace(line) == "" {
			continue
		}
		firstContentLine = i
		break
	}
	if firstContentLine < 0 || !documentNodeLineMatchesTitle(lines[firstContentLine], sectionTitle) {
		return content
	}
	lines = append(lines[:firstContentLine], lines[firstContentLine+1:]...)
	for len(lines) > 0 && strings.TrimSpace(lines[0]) == "" {
		lines = lines[1:]
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

func documentNodeLineMatchesTitle(line, sectionTitle string) bool {
	title := strings.TrimSpace(sectionTitle)
	candidates := []string{
		strings.TrimSpace(line),
		normalizeMarkdownDocumentNodeHeading(line),
		trimOrderedDocumentNodeHeadingMarker(normalizeMarkdownDocumentNodeHeading(line)),
	}
	return slices.Contains(candidates, title)
}

func documentNodeLineMatchesLevel(line string, level int) bool {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, "#") {
		return false
	}
	count := 0
	for count < len(trimmed) && trimmed[count] == '#' {
		count++
	}
	return count == level
}

func normalizeMarkdownDocumentNodeHeading(line string) string {
	trimmed := strings.TrimSpace(line)
	if !strings.HasPrefix(trimmed, "#") {
		return trimmed
	}
	return strings.TrimSpace(strings.TrimRight(strings.TrimLeft(trimmed, "# "), "#"))
}

func trimOrderedDocumentNodeHeadingMarker(line string) string {
	trimmed := strings.TrimSpace(line)
	index := 0
	for index < len(trimmed) {
		r, size := utf8.DecodeRuneInString(trimmed[index:])
		switch {
		case r == ' ' || r == '\t' || r == '.' || r == ')' || r == '、':
			index += size
		case r >= '0' && r <= '9':
			index += size
		case index == 0:
			return trimmed
		default:
			return strings.TrimSpace(trimmed[index:])
		}
	}
	return trimmed
}

func resolveDocumentRootTitle(documentTitle string, sources []DocumentNodeSource) (string, string) {
	cleanTitle := strings.TrimSpace(strings.TrimSuffix(filepath.Base(documentTitle), filepath.Ext(documentTitle)))
	commonRoot := ""
	hasCommonRoot := true
	hasSectionRoot := false

	for _, source := range sources {
		segments := splitSectionSegments(source.SectionPath)
		if len(segments) == 0 {
			continue
		}
		hasSectionRoot = true
		if commonRoot == "" {
			commonRoot = segments[0]
			continue
		}
		if segments[0] != commonRoot {
			hasCommonRoot = false
			break
		}
	}

	if hasSectionRoot && hasCommonRoot && commonRoot != "" {
		return commonRoot, commonRoot
	}
	if cleanTitle != "" {
		return cleanTitle, ""
	}
	if commonRoot != "" {
		return commonRoot, commonRoot
	}
	return "文档", ""
}

func splitSectionSegments(sectionPath string) []string {
	if strings.TrimSpace(sectionPath) == "" {
		return nil
	}
	parts := strings.Split(sectionPath, ">")
	segments := make([]string, 0, len(parts))
	for _, part := range parts {
		segment := strings.TrimSpace(part)
		if segment == "" {
			continue
		}
		segments = append(segments, segment)
	}
	return segments
}
