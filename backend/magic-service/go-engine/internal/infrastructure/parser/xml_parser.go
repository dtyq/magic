package docparser

import (
	"bytes"
	"context"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

// XMLParser 解析 XML 文档。
type XMLParser struct{}

const defaultStructuredParserCapacity = 8

// NewXMLParser 创建 XML 解析器。
func NewXMLParser() *XMLParser {
	return &XMLParser{}
}

// Parse 解析 XML 文件。
func (p *XMLParser) Parse(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, documentdomain.DefaultParseOptions())
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseWithOptions 按解析选项解析 XML 文件。
func (p *XMLParser) ParseWithOptions(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
	options documentdomain.ParseOptions,
) (string, error) {
	parsed, err := p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, options)
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ParseDocument 解析 XML 文件并返回结构化结果。
func (p *XMLParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
) (*documentdomain.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, documentdomain.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析 XML 文件并返回结构化结果。
func (p *XMLParser) ParseDocumentWithOptions(
	_ context.Context,
	_ string,
	fileReader io.Reader,
	fileType string,
	_ documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	content, err := readAndNormalizeParserSource(fileReader, fileType)
	if err != nil {
		return nil, err
	}
	if strings.TrimSpace(string(content)) == "" {
		return documentdomain.NewPlainTextParsedDocument(fileType, ""), nil
	}
	root, err := parseXMLDocument(content)
	if err != nil {
		return nil, fmt.Errorf("parse xml failed: %w", err)
	}

	rendered := hierarchyMarkdownRenderer{}.Render(buildXMLHierarchySection(root, root.Name))
	return documentdomain.NewPlainTextParsedDocument(fileType, rendered), nil
}

// Supports 检查是否支持该文件类型。
func (p *XMLParser) Supports(fileType string) bool {
	return strings.ToLower(strings.TrimSpace(fileType)) == "xml"
}

// NeedsResolvedURL XML 解析只依赖文件流。
func (p *XMLParser) NeedsResolvedURL() bool {
	return false
}

type parsedXMLAttribute struct {
	Name  string
	Value string
}

type parsedXMLNode struct {
	Name          string
	Attributes    []parsedXMLAttribute
	Children      []*parsedXMLNode
	TextFragments []string
}

func parseXMLDocument(content []byte) (*parsedXMLNode, error) {
	decoder := xml.NewDecoder(bytes.NewReader(content))
	stack := make([]*parsedXMLNode, 0, defaultStructuredParserCapacity)
	var root *parsedXMLNode

	for {
		token, err := decoder.Token()
		if err != nil {
			if errors.Is(err, io.EOF) {
				break
			}
			return nil, fmt.Errorf("read xml token: %w", err)
		}

		switch typed := token.(type) {
		case xml.StartElement:
			node := &parsedXMLNode{
				Name:       xmlTokenName(typed.Name),
				Attributes: buildXMLAttributes(typed.Attr),
			}
			if len(stack) > 0 {
				parent := stack[len(stack)-1]
				parent.Children = append(parent.Children, node)
			} else if root == nil {
				root = node
			}
			stack = append(stack, node)
		case xml.EndElement:
			if len(stack) > 0 {
				stack = stack[:len(stack)-1]
			}
		case xml.CharData:
			if len(stack) == 0 {
				continue
			}
			if text := strings.TrimSpace(string([]byte(typed))); text != "" {
				stack[len(stack)-1].TextFragments = append(stack[len(stack)-1].TextFragments, text)
			}
		case xml.Comment, xml.ProcInst, xml.Directive:
			continue
		}
	}
	return root, nil
}

func buildXMLAttributes(attrs []xml.Attr) []parsedXMLAttribute {
	result := make([]parsedXMLAttribute, 0, len(attrs))
	for _, attr := range attrs {
		if strings.EqualFold(strings.TrimSpace(attr.Name.Space), "xmlns") || strings.EqualFold(strings.TrimSpace(attr.Name.Local), "xmlns") {
			continue
		}
		name := xmlTokenName(attr.Name)
		value := strings.TrimSpace(attr.Value)
		if name == "" || value == "" {
			continue
		}
		result = append(result, parsedXMLAttribute{
			Name:  name,
			Value: value,
		})
	}
	return result
}

func xmlTokenName(name xml.Name) string {
	if trimmed := strings.TrimSpace(name.Local); trimmed != "" {
		return trimmed
	}
	return strings.TrimSpace(name.Space)
}

func buildXMLHierarchySection(node *parsedXMLNode, title string) *hierarchyMarkdownSection {
	if node == nil {
		return nil
	}

	section := &hierarchyMarkdownSection{
		Title:  title,
		Fields: make([]hierarchyMarkdownField, 0, len(node.Attributes)+1),
	}
	for _, attr := range node.Attributes {
		section.Fields = append(section.Fields, hierarchyMarkdownField{
			Name:  "属性." + attr.Name,
			Value: attr.Value,
		})
	}
	if text := strings.TrimSpace(strings.Join(node.TextFragments, " ")); text != "" {
		section.Fields = append(section.Fields, hierarchyMarkdownField{Name: "内容", Value: text})
	}

	childNameCounts := make(map[string]int, len(node.Children))
	for _, child := range node.Children {
		childNameCounts[child.Name]++
	}
	childSeen := make(map[string]int, len(childNameCounts))
	section.Children = make([]*hierarchyMarkdownSection, 0, len(node.Children))
	for _, child := range node.Children {
		if child == nil || strings.TrimSpace(child.Name) == "" {
			continue
		}
		childSeen[child.Name]++
		displayName := child.Name
		if childNameCounts[child.Name] > 1 {
			displayName = fmt.Sprintf("%s[%d]", child.Name, childSeen[child.Name])
		}
		if xmlNodeIsLeaf(child) {
			if text := strings.TrimSpace(strings.Join(child.TextFragments, " ")); text != "" {
				section.Fields = append(section.Fields, hierarchyMarkdownField{Name: displayName, Value: text})
			}
			continue
		}
		section.Children = append(section.Children, buildXMLHierarchySection(child, displayName))
	}
	return section
}

func xmlNodeIsLeaf(node *parsedXMLNode) bool {
	return node != nil && len(node.Attributes) == 0 && len(node.Children) == 0
}
