// Package thirdplatformsource 负责将第三方 resolve 结果统一路由到 Go 解析器。
package thirdplatformsource

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	"magic/internal/pkg/thirdplatform"
)

// ErrUnsupportedSourceKind 表示 resolve 返回了当前 Go 链路无法识别的 source kind。
var ErrUnsupportedSourceKind = errors.New("unsupported third-platform source kind")

type parseService interface {
	ParseDocumentWithOptions(
		ctx context.Context,
		rawURL, ext string,
		options documentdomain.ParseOptions,
	) (*documentdomain.ParsedDocument, error)
	ParseDocumentReaderWithOptions(
		ctx context.Context,
		fileURL string,
		file io.Reader,
		fileType string,
		options documentdomain.ParseOptions,
	) (*documentdomain.ParsedDocument, error)
}

// ParseResolvedDocument 解析第三方 resolve 返回的源描述。
func ParseResolvedDocument(
	ctx context.Context,
	parser parseService,
	resolved *thirdplatform.DocumentResolveResult,
	options documentdomain.ParseOptions,
) (*documentdomain.ParsedDocument, error) {
	if parser == nil {
		return nil, documentdomain.ErrNoParserFound
	}
	if resolved == nil {
		return nil, shared.ErrDocumentFileEmpty
	}
	file, _ := documentdomain.FileFromPayload(resolved.DocumentFile)
	fileType := documentdomain.ResolveDocumentFileExtension(file, "")
	sourceLabel := resolveSourceLabel(file, resolved)
	rawContent := resolveRawContent(resolved)

	switch normalizeSourceKind(resolved.SourceKind, resolved) {
	case thirdplatform.DocumentSourceKindRawContent:
		if rawContent == "" {
			return nil, shared.ErrDocumentFileEmpty
		}
		parsed, err := parser.ParseDocumentReaderWithOptions(
			ctx,
			sourceLabel,
			strings.NewReader(rawContent),
			fileType,
			options,
		)
		if err != nil {
			return nil, fmt.Errorf("parse raw third-platform content: %w", err)
		}
		return parsed, nil
	case thirdplatform.DocumentSourceKindDownloadURL:
		if strings.TrimSpace(resolved.DownloadURL) == "" {
			return nil, documentdomain.ErrResolvedFileURLEmpty
		}
		parsed, err := parser.ParseDocumentWithOptions(ctx, resolved.DownloadURL, fileType, options)
		if err != nil {
			return nil, fmt.Errorf("parse third-platform download url: %w", err)
		}
		return parsed, nil
	default:
		return nil, fmt.Errorf("%w: %s", ErrUnsupportedSourceKind, resolved.SourceKind)
	}
}

func resolveRawContent(resolved *thirdplatform.DocumentResolveResult) string {
	if resolved == nil {
		return ""
	}
	if strings.TrimSpace(resolved.RawContent) != "" {
		return resolved.RawContent
	}
	return resolved.Content
}

func normalizeSourceKind(sourceKind string, resolved *thirdplatform.DocumentResolveResult) string {
	normalized := strings.ToLower(strings.TrimSpace(sourceKind))
	if normalized != "" {
		return normalized
	}
	switch {
	case resolved == nil:
		return ""
	case resolved.RawContent != "":
		return thirdplatform.DocumentSourceKindRawContent
	case strings.TrimSpace(resolved.DownloadURL) != "":
		return thirdplatform.DocumentSourceKindDownloadURL
	case resolved.Content != "":
		return thirdplatform.DocumentSourceKindRawContent
	default:
		return ""
	}
}

func resolveSourceLabel(file *documentdomain.File, resolved *thirdplatform.DocumentResolveResult) string {
	if file != nil {
		if name := strings.TrimSpace(file.Name); name != "" {
			return name
		}
		if thirdID := strings.TrimSpace(file.ThirdID); thirdID != "" {
			return thirdID
		}
	}
	if resolved == nil {
		return "third-platform-source"
	}
	if link := strings.TrimSpace(resolved.DownloadURL); link != "" {
		return link
	}
	return "third-platform-source"
}
