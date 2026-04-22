package docparser

import "strings"

const maxHierarchyMarkdownLevel = 6

type hierarchyMarkdownField struct {
	Name  string
	Value string
}

type hierarchyMarkdownSection struct {
	Title    string
	Fields   []hierarchyMarkdownField
	Children []*hierarchyMarkdownSection
}

type hierarchyMarkdownRenderer struct{}

func (hierarchyMarkdownRenderer) Render(root *hierarchyMarkdownSection) string {
	if root == nil {
		return ""
	}
	blocks := make([]string, 0)
	collectHierarchyMarkdownBlocks(root, 1, &blocks)
	return strings.TrimSpace(strings.Join(filterNonEmptyStrings(blocks), "\n\n"))
}

func collectHierarchyMarkdownBlocks(section *hierarchyMarkdownSection, level int, blocks *[]string) {
	if section == nil {
		return
	}

	lines := make([]string, 0, len(section.Fields)+1)
	if trimmedTitle := strings.TrimSpace(section.Title); trimmedTitle != "" {
		lines = append(lines, strings.Repeat("#", clampHierarchyMarkdownLevel(level))+" "+trimmedTitle)
	}
	for _, field := range section.Fields {
		name := strings.TrimSpace(field.Name)
		value := strings.TrimSpace(field.Value)
		if name == "" || value == "" {
			continue
		}
		lines = append(lines, name+": "+value)
	}
	if len(lines) > 0 {
		*blocks = append(*blocks, strings.Join(lines, "\n"))
	}

	childLevel := level
	if strings.TrimSpace(section.Title) != "" {
		childLevel = clampHierarchyMarkdownLevel(level + 1)
	}
	for _, child := range section.Children {
		collectHierarchyMarkdownBlocks(child, childLevel, blocks)
	}
}

func clampHierarchyMarkdownLevel(level int) int {
	switch {
	case level < 1:
		return 1
	case level > maxHierarchyMarkdownLevel:
		return maxHierarchyMarkdownLevel
	default:
		return level
	}
}
