// Package thirdplatformsource 负责将第三方 resolve 结果统一路由到 Go 解析器。
package thirdplatformsource

import (
	"context"
	"errors"
	"fmt"
	"io"
	"strings"

	docentity "magic/internal/domain/knowledge/document/entity"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
	parseddocument "magic/internal/domain/knowledge/shared/parseddocument"
	"magic/internal/pkg/thirdplatform"
)

// ErrUnsupportedSourceKind 表示 resolve 返回了当前 Go 链路无法识别的 source kind。
var ErrUnsupportedSourceKind = errors.New("unsupported third-platform source kind")

type parseService interface {
	ParseDocumentWithOptions(
		ctx context.Context,
		rawURL, ext string,
		options documentdomain.ParseOptions,
	) (*parseddocument.ParsedDocument, error)
	ParseDocumentReaderWithOptions(
		ctx context.Context,
		fileURL string,
		file io.Reader,
		fileType string,
		options documentdomain.ParseOptions,
	) (*parseddocument.ParsedDocument, error)
}

// ParseResolvedDocument 解析第三方 resolve 返回的源描述。
func ParseResolvedDocument(
	ctx context.Context,
	parser parseService,
	resolved *thirdplatform.DocumentResolveResult,
	options documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, error) {
	if parser == nil {
		return nil, documentdomain.ErrNoParserFound
	}
	if resolved == nil {
		return nil, shared.ErrDocumentFileEmpty
	}
	file, _ := documentdomain.FileFromPayload(resolved.DocumentFile)
	fileType := documentdomain.ResolveDocumentFileExtension(file, "")
	sourceLabel := resolveSourceLabel(file, "")
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
		parsed, err := parseResolvedDownloadCandidates(
			ctx,
			parser,
			fileType,
			resolved.DownloadURLs,
			resolved.DownloadURL,
			options,
		)
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
	case thirdplatform.SelectDownloadURL("", resolved.DownloadURLs, resolved.DownloadURL) != "":
		return thirdplatform.DocumentSourceKindDownloadURL
	case resolved.Content != "":
		return thirdplatform.DocumentSourceKindRawContent
	default:
		return ""
	}
}

func parseResolvedDownloadCandidates(
	ctx context.Context,
	parser parseService,
	fileType string,
	downloadURLs []string,
	legacyDownloadURL string,
	options documentdomain.ParseOptions,
) (*parseddocument.ParsedDocument, error) {
	// Teamshare 这类第三方源可能为同一个逻辑文件返回多个下载候选，
	// 其中既可能有真实快照，也可能有仅能打开工作簿壳子的空文件。
	// 这里不再根据 URL 形态猜测“哪条像真文件”，而是按上游顺序逐个解析，
	// 以“谁先产出非空 ParsedDocument”为最终真值。
	candidates := orderedDownloadCandidates(downloadURLs, legacyDownloadURL)
	if len(candidates) == 0 {
		return nil, documentdomain.ErrResolvedFileURLEmpty
	}

	parseErrs := make([]error, 0, len(candidates))
	encounteredEmptyResult := false
	for _, candidate := range candidates {
		parsed, err := parser.ParseDocumentWithOptions(ctx, candidate, fileType, options)
		if err != nil {
			parseErrs = append(parseErrs, fmt.Errorf("%s: %w", candidate, err))
			continue
		}
		if parsedDocumentHasContent(parsed) {
			return parsed, nil
		}
		// 候选可下载且可解析，但内容为空时继续探测下一条，
		// 这样能跳过空壳文件，同时保留“所有候选都为空”这一独立失败语义。
		encounteredEmptyResult = true
	}

	if encounteredEmptyResult {
		if len(parseErrs) == 0 {
			return nil, shared.ErrDocumentFileEmpty
		}
		return nil, errors.Join(append([]error{shared.ErrDocumentFileEmpty}, parseErrs...)...)
	}

	lastErr := parseErrs[len(parseErrs)-1]
	return nil, errors.Join(
		fmt.Errorf("all download candidates failed, last error: %w", lastErr),
		errors.Join(parseErrs...),
	)
}

func orderedDownloadCandidates(downloadURLs []string, legacyDownloadURL string) []string {
	candidates := make([]string, 0, len(downloadURLs)+1)
	seen := make(map[string]struct{}, len(downloadURLs)+1)

	appendCandidate := func(candidate string) {
		candidate = strings.TrimSpace(candidate)
		if candidate == "" {
			return
		}
		if _, ok := seen[candidate]; ok {
			return
		}
		seen[candidate] = struct{}{}
		candidates = append(candidates, candidate)
	}

	for _, candidate := range downloadURLs {
		appendCandidate(candidate)
	}
	// 兼容旧协议里的单地址字段，但不打乱 download_urls 的原始顺序，
	// 避免 Go 侧又隐式引入一套与上游不一致的重排规则。
	appendCandidate(legacyDownloadURL)

	return candidates
}

func parsedDocumentHasContent(parsed *parseddocument.ParsedDocument) bool {
	if parsed == nil {
		return false
	}
	if strings.TrimSpace(parsed.BestEffortText()) != "" {
		return true
	}
	return len(parsed.Blocks) > 0
}

func resolveSourceLabel(file *docentity.File, selectedDownloadURL string) string {
	if file != nil {
		if name := strings.TrimSpace(file.Name); name != "" {
			return name
		}
		if thirdID := strings.TrimSpace(file.ThirdID); thirdID != "" {
			return thirdID
		}
	}
	if strings.TrimSpace(selectedDownloadURL) != "" {
		return selectedDownloadURL
	}
	return "third-platform-source"
}
