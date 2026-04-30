package docparser

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

// JSONParser 解析 JSON 文档。
type JSONParser struct{}

var (
	errEmptyJSONDocument       = errors.New("empty json document")
	errUnexpectedJSONTrailing  = errors.New("unexpected trailing json content")
	errUnexpectedJSONObjectKey = errors.New("unexpected json object key token")
	errUnexpectedJSONDelimiter = errors.New("unexpected json delimiter")
	errUnexpectedJSONToken     = errors.New("unexpected json token")
	errReadJSONToken           = errors.New("read json token")
	errReadJSONDelimiterClose  = errors.New("read json closing delimiter")
	errReadJSONObjectKey       = errors.New("read json object key")
)

// NewJSONParser 创建 JSON 解析器。
func NewJSONParser() *JSONParser {
	return &JSONParser{}
}

// Parse 解析 JSON 文件。
func (p *JSONParser) Parse(
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

// ParseWithOptions 按解析选项解析 JSON 文件。
func (p *JSONParser) ParseWithOptions(
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

// ParseDocument 解析 JSON 文件并返回结构化结果。
func (p *JSONParser) ParseDocument(
	ctx context.Context,
	fileURL string,
	fileReader io.Reader,
	fileType string,
) (*documentdomain.ParsedDocument, error) {
	return p.ParseDocumentWithOptions(ctx, fileURL, fileReader, fileType, documentdomain.DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析 JSON 文件并返回结构化结果。
func (p *JSONParser) ParseDocumentWithOptions(
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
	root, err := parseJSONDocument(content)
	if err != nil {
		if errors.Is(err, errEmptyJSONDocument) {
			return documentdomain.NewPlainTextParsedDocument(fileType, ""), nil
		}
		return nil, fmt.Errorf("parse json failed: %w", err)
	}

	rendered := hierarchyMarkdownRenderer{}.Render(buildJSONHierarchySection(root))
	return documentdomain.NewPlainTextParsedDocument(fileType, rendered), nil
}

// Supports 检查是否支持该文件类型。
func (p *JSONParser) Supports(fileType string) bool {
	return strings.ToLower(strings.TrimSpace(fileType)) == "json"
}

// NeedsResolvedURL JSON 解析只依赖文件流。
func (p *JSONParser) NeedsResolvedURL() bool {
	return false
}

type parsedJSONValueKind int

const (
	parsedJSONValueScalar parsedJSONValueKind = iota + 1
	parsedJSONValueObject
	parsedJSONValueArray
)

type parsedJSONMember struct {
	Key   string
	Value *parsedJSONValue
}

type parsedJSONValue struct {
	Kind    parsedJSONValueKind
	Scalar  string
	Members []parsedJSONMember
	Items   []*parsedJSONValue
}

func parseJSONDocument(content []byte) (*parsedJSONValue, error) {
	decoder := json.NewDecoder(strings.NewReader(string(content)))
	decoder.UseNumber()

	root, err := parseJSONValue(decoder)
	if err != nil {
		if errors.Is(err, io.EOF) {
			return nil, errEmptyJSONDocument
		}
		return nil, err
	}
	if _, err := decoder.Token(); err != nil {
		if errors.Is(err, io.EOF) {
			return root, nil
		}
		return nil, fmt.Errorf("%w: %w", errReadJSONToken, err)
	}
	return nil, errUnexpectedJSONTrailing
}

func parseJSONValue(decoder *json.Decoder) (*parsedJSONValue, error) {
	token, err := decoder.Token()
	if err != nil {
		return nil, fmt.Errorf("%w: %w", errReadJSONToken, err)
	}

	switch typed := token.(type) {
	case json.Delim:
		return parseJSONDelimitedValue(decoder, typed)
	case string:
		return &parsedJSONValue{Kind: parsedJSONValueScalar, Scalar: typed}, nil
	case json.Number:
		return &parsedJSONValue{Kind: parsedJSONValueScalar, Scalar: typed.String()}, nil
	case bool:
		if typed {
			return &parsedJSONValue{Kind: parsedJSONValueScalar, Scalar: "true"}, nil
		}
		return &parsedJSONValue{Kind: parsedJSONValueScalar, Scalar: "false"}, nil
	case nil:
		return &parsedJSONValue{Kind: parsedJSONValueScalar, Scalar: "null"}, nil
	default:
		return nil, fmt.Errorf("%w: %T", errUnexpectedJSONToken, token)
	}
}

func parseJSONDelimitedValue(decoder *json.Decoder, delimiter json.Delim) (*parsedJSONValue, error) {
	switch delimiter {
	case '{':
		return parseJSONObject(decoder)
	case '[':
		return parseJSONArray(decoder)
	default:
		return nil, fmt.Errorf("%w: %q", errUnexpectedJSONDelimiter, delimiter)
	}
}

func parseJSONObject(decoder *json.Decoder) (*parsedJSONValue, error) {
	members := make([]parsedJSONMember, 0, defaultStructuredParserCapacity)
	for decoder.More() {
		key, err := readJSONObjectKey(decoder)
		if err != nil {
			return nil, err
		}
		value, err := parseJSONValue(decoder)
		if err != nil {
			return nil, err
		}
		members = append(members, parsedJSONMember{Key: key, Value: value})
	}
	if _, err := decoder.Token(); err != nil {
		return nil, fmt.Errorf("%w: %w", errReadJSONDelimiterClose, err)
	}
	return &parsedJSONValue{Kind: parsedJSONValueObject, Members: members}, nil
}

func parseJSONArray(decoder *json.Decoder) (*parsedJSONValue, error) {
	items := make([]*parsedJSONValue, 0, defaultStructuredParserCapacity)
	for decoder.More() {
		value, err := parseJSONValue(decoder)
		if err != nil {
			return nil, err
		}
		items = append(items, value)
	}
	if _, err := decoder.Token(); err != nil {
		return nil, fmt.Errorf("%w: %w", errReadJSONDelimiterClose, err)
	}
	return &parsedJSONValue{Kind: parsedJSONValueArray, Items: items}, nil
}

func readJSONObjectKey(decoder *json.Decoder) (string, error) {
	keyToken, err := decoder.Token()
	if err != nil {
		return "", fmt.Errorf("%w: %w", errReadJSONObjectKey, err)
	}
	key, ok := keyToken.(string)
	if !ok {
		return "", fmt.Errorf("%w: %T", errUnexpectedJSONObjectKey, keyToken)
	}
	return key, nil
}

func buildJSONHierarchySection(root *parsedJSONValue) *hierarchyMarkdownSection {
	section := &hierarchyMarkdownSection{}
	populateJSONHierarchySection(section, root)
	return section
}

func populateJSONHierarchySection(section *hierarchyMarkdownSection, value *parsedJSONValue) {
	if section == nil || value == nil {
		return
	}

	switch value.Kind {
	case parsedJSONValueObject:
		section.Fields = make([]hierarchyMarkdownField, 0, len(value.Members))
		section.Children = make([]*hierarchyMarkdownSection, 0, len(value.Members))
		for _, member := range value.Members {
			appendNamedJSONValue(section, member.Key, member.Value)
		}
	case parsedJSONValueArray:
		section.Fields = make([]hierarchyMarkdownField, 0, len(value.Items))
		section.Children = make([]*hierarchyMarkdownSection, 0, len(value.Items))
		appendJSONArrayItems(section, "item", value.Items)
	case parsedJSONValueScalar:
		section.Fields = append(section.Fields, hierarchyMarkdownField{Name: "value", Value: value.Scalar})
	}
}

func appendNamedJSONValue(section *hierarchyMarkdownSection, name string, value *parsedJSONValue) {
	if section == nil || strings.TrimSpace(name) == "" || value == nil {
		return
	}

	switch value.Kind {
	case parsedJSONValueScalar:
		section.Fields = append(section.Fields, hierarchyMarkdownField{Name: name, Value: value.Scalar})
	case parsedJSONValueObject:
		child := &hierarchyMarkdownSection{Title: name}
		populateJSONHierarchySection(child, value)
		section.Children = append(section.Children, child)
	case parsedJSONValueArray:
		appendJSONArrayItems(section, name, value.Items)
	}
}

func appendJSONArrayItems(section *hierarchyMarkdownSection, name string, items []*parsedJSONValue) {
	if section == nil {
		return
	}
	for index, item := range items {
		if item == nil {
			continue
		}
		itemName := fmt.Sprintf("%s[%d]", name, index+1)
		switch item.Kind {
		case parsedJSONValueScalar:
			section.Fields = append(section.Fields, hierarchyMarkdownField{Name: itemName, Value: item.Scalar})
		case parsedJSONValueObject, parsedJSONValueArray:
			child := &hierarchyMarkdownSection{Title: itemName}
			populateJSONHierarchySection(child, item)
			section.Children = append(section.Children, child)
		}
	}
}
