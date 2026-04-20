// Package document 提供知识库文档领域能力。
package document

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"
	"time"

	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/filetype"
)

// ErrNoParserFound 表示未找到合适解析器的错误。
var ErrNoParserFound = errors.New("no parser found")

// ErrDocumentSourceEmpty 表示文档源为空。
var ErrDocumentSourceEmpty = errors.New("document source is empty")

// ErrResolvedFileURLEmpty 表示要求解析 URL 时未能拿到可访问链接。
var ErrResolvedFileURLEmpty = errors.New("resolved file url is empty")

// ParseService 文档解析领域服务。
type ParseService struct {
	fileFetcher FileFetcher
	parsers     []Parser
	logger      *logging.SugaredLogger
}

// NewParseService 创建文档解析领域服务。
func NewParseService(
	fileFetcher FileFetcher,
	parsers []Parser,
	logger *logging.SugaredLogger,
) *ParseService {
	return &ParseService{
		fileFetcher: fileFetcher,
		parsers:     parsers,
		logger:      logger,
	}
}

// NewParseServiceWithParsers 使用可变参数创建文档解析服务。
func NewParseServiceWithParsers(
	fileFetcher FileFetcher,
	logger *logging.SugaredLogger,
	parsers ...Parser,
) *ParseService {
	return NewParseService(fileFetcher, parsers, logger)
}

// ParseDocument 解析文档并返回统一结构化结果。
func (s *ParseService) ParseDocument(ctx context.Context, fileURL, fileType string) (*ParsedDocument, error) {
	return s.ParseDocumentWithOptions(ctx, fileURL, fileType, DefaultParseOptions())
}

// ParseDocumentWithOptions 按解析选项解析文档并返回统一结构化结果。
func (s *ParseService) ParseDocumentWithOptions(
	ctx context.Context,
	fileURL, fileType string,
	options ParseOptions,
) (*ParsedDocument, error) {
	normalizedFileType, err := s.resolveNormalizedFileType(ctx, fileURL, fileType)
	if err != nil {
		return nil, err
	}

	parser, resolvedURL, reader, err := s.prepareParse(ctx, fileURL, normalizedFileType)
	if err != nil {
		return nil, err
	}
	defer func() { _ = reader.Close() }()

	return s.parseWithReader(ctx, parser, resolveParserSource(fileURL, resolvedURL), reader, normalizedFileType, options)
}

// ParseDocumentReader 解析给定 reader 中的文档并返回统一结构化结果。
func (s *ParseService) ParseDocumentReader(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
) (*ParsedDocument, error) {
	return s.ParseDocumentReaderWithOptions(ctx, fileURL, file, fileType, DefaultParseOptions())
}

// ParseDocumentReaderWithOptions 按解析选项解析给定 reader 中的文档并返回统一结构化结果。
func (s *ParseService) ParseDocumentReaderWithOptions(
	ctx context.Context,
	fileURL string,
	file io.Reader,
	fileType string,
	options ParseOptions,
) (*ParsedDocument, error) {
	normalizedFileType, err := s.resolveNormalizedFileType(ctx, fileURL, fileType)
	if err != nil {
		return nil, err
	}
	parser, err := s.resolveParser(normalizedFileType)
	if err != nil {
		return nil, err
	}
	return s.parseWithReader(ctx, parser, fileURL, file, normalizedFileType, options)
}

// Parse 解析文档纯文本内容。
func (s *ParseService) Parse(ctx context.Context, fileURL, fileType string) (string, error) {
	return s.ParseWithOptions(ctx, fileURL, fileType, DefaultParseOptions())
}

// ParseWithOptions 按解析选项解析文档纯文本内容。
func (s *ParseService) ParseWithOptions(
	ctx context.Context,
	fileURL, fileType string,
	options ParseOptions,
) (string, error) {
	parsed, err := s.ParseDocumentWithOptions(ctx, fileURL, fileType, options)
	if err != nil {
		return "", err
	}
	return parsed.BestEffortText(), nil
}

// ValidateSource 校验文档源是否可达。
func (s *ParseService) ValidateSource(ctx context.Context, filePathOrURL string) error {
	target := strings.TrimSpace(filePathOrURL)
	if target == "" {
		return ErrDocumentSourceEmpty
	}
	if err := s.fileFetcher.Stat(ctx, target); err != nil {
		return fmt.Errorf("document source check failed: %w", err)
	}
	return nil
}

// ResolveFileType 通过 PHP 兼容策略解析文件类型扩展名。
func (s *ParseService) ResolveFileType(ctx context.Context, filePathOrURL string) (string, error) {
	resolved, err := filetype.ResolveByPHPCompatibleStrategy(ctx, filePathOrURL, s.fileFetcher)
	if err != nil {
		return "", fmt.Errorf("resolve file type with php compatible strategy: %w", err)
	}
	return resolved, nil
}

func (s *ParseService) prepareParse(
	ctx context.Context,
	fileURL string,
	normalizedFileType string,
) (Parser, string, io.ReadCloser, error) {
	parser, err := s.resolveParser(normalizedFileType)
	if err != nil {
		return nil, "", nil, err
	}

	s.logger.InfoContext(ctx, "Starting document parsing", "url", fileURL, "type", normalizedFileType)

	resolvedURL := ""
	if parser.NeedsResolvedURL() && fileURL != "" {
		link, err := s.fileFetcher.GetLink(ctx, fileURL, "GET", 10*time.Minute)
		if err != nil {
			s.logger.WarnContext(ctx, "Failed to resolve file URL", "error", err, "url", fileURL)
			return nil, "", nil, fmt.Errorf("failed to resolve file url: %w", err)
		}
		if link == "" {
			return nil, "", nil, ErrResolvedFileURLEmpty
		}
		resolvedURL = link
	}

	reader, err := s.fileFetcher.Fetch(ctx, fileURL)
	if err != nil {
		return nil, "", nil, fmt.Errorf("failed to fetch file: %w", err)
	}
	return parser, resolvedURL, reader, nil
}

func (s *ParseService) resolveParser(normalizedFileType string) (Parser, error) {
	for _, parser := range s.parsers {
		if parser.Supports(normalizedFileType) {
			return parser, nil
		}
	}
	return nil, fmt.Errorf("%w: file type %s", ErrNoParserFound, normalizedFileType)
}

func (s *ParseService) resolveNormalizedFileType(ctx context.Context, fileURL, fileType string) (string, error) {
	normalizedFileType := filetype.NormalizeExtension(fileType)
	if normalizedFileType != "" {
		return normalizedFileType, nil
	}
	resolvedType, err := s.ResolveFileType(ctx, fileURL)
	if err != nil {
		return "", fmt.Errorf("missing or unsupported file type: %w", err)
	}
	return resolvedType, nil
}

func resolveParserSource(fileURL, resolvedURL string) string {
	if strings.TrimSpace(resolvedURL) != "" {
		return resolvedURL
	}
	return fileURL
}

func (s *ParseService) parseWithReader(
	ctx context.Context,
	parser Parser,
	parserSource string,
	reader io.Reader,
	normalizedFileType string,
	options ParseOptions,
) (*ParsedDocument, error) {
	parsed, err := parseDocumentWithParser(ctx, parser, parserSource, reader, normalizedFileType, options)
	if err != nil {
		return nil, err
	}
	return finalizeParsedDocument(parsed, normalizedFileType), nil
}

func parseDocumentWithParser(
	ctx context.Context,
	parser Parser,
	parserSource string,
	reader io.Reader,
	normalizedFileType string,
	options ParseOptions,
) (*ParsedDocument, error) {
	if parsed, handled, err := parseStructuredDocumentWithParser(ctx, parser, parserSource, reader, normalizedFileType, options); handled {
		return parsed, err
	}
	if parsed, handled, err := parsePlainTextDocumentWithOptions(ctx, parser, parserSource, reader, normalizedFileType, options); handled {
		return parsed, err
	}
	return parsePlainTextDocument(ctx, parser, parserSource, reader, normalizedFileType)
}

func parseStructuredDocumentWithParser(
	ctx context.Context,
	parser Parser,
	parserSource string,
	reader io.Reader,
	normalizedFileType string,
	options ParseOptions,
) (*ParsedDocument, bool, error) {
	if configurableParser, ok := parser.(StructuredDocumentParserWithOptions); ok {
		parsed, err := configurableParser.ParseDocumentWithOptions(ctx, parserSource, reader, normalizedFileType, options)
		if err != nil {
			return nil, true, fmt.Errorf("parser failed: %w", err)
		}
		return parsed, true, nil
	}
	structuredParser, ok := parser.(StructuredDocumentParser)
	if !ok {
		return nil, false, nil
	}
	parsed, err := structuredParser.ParseDocument(ctx, parserSource, reader, normalizedFileType)
	if err != nil {
		return nil, true, fmt.Errorf("parser failed: %w", err)
	}
	return parsed, true, nil
}

func parsePlainTextDocumentWithOptions(
	ctx context.Context,
	parser Parser,
	parserSource string,
	reader io.Reader,
	normalizedFileType string,
	options ParseOptions,
) (*ParsedDocument, bool, error) {
	configurableParser, ok := parser.(ParserWithOptions)
	if !ok {
		return nil, false, nil
	}
	content, err := configurableParser.ParseWithOptions(ctx, parserSource, reader, normalizedFileType, options)
	if err != nil {
		return nil, true, fmt.Errorf("parser failed: %w", err)
	}
	return NewPlainTextParsedDocument(normalizedFileType, content), true, nil
}

func parsePlainTextDocument(
	ctx context.Context,
	parser Parser,
	parserSource string,
	reader io.Reader,
	normalizedFileType string,
) (*ParsedDocument, error) {
	content, err := parser.Parse(ctx, parserSource, reader, normalizedFileType)
	if err != nil {
		return nil, fmt.Errorf("parser failed: %w", err)
	}
	return NewPlainTextParsedDocument(normalizedFileType, content), nil
}

func finalizeParsedDocument(parsed *ParsedDocument, normalizedFileType string) *ParsedDocument {
	if parsed == nil {
		return NewPlainTextParsedDocument(normalizedFileType, "")
	}
	if parsed.DocumentMeta == nil {
		parsed.DocumentMeta = map[string]any{}
	}
	if _, ok := parsed.DocumentMeta[ParsedMetaSourceFormat]; !ok {
		parsed.DocumentMeta[ParsedMetaSourceFormat] = normalizedFileType
	}
	return parsed
}
