// Package filetype 提供与 PHP FileType::getType 行为对齐的扩展名解析能力。
package filetype

import (
	"context"
	"errors"
	"fmt"
	"io"
	"mime"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

const sniffBytes = 512

var (
	errResolveExtension      = errors.New("resolve extension failed")
	errEmptyPathOrURL        = errors.New("empty path or url")
	errLocalPathIsDirectory  = errors.New("path is directory")
	errContentTypeMissing    = errors.New("content-type missing")
	errUnsupportedMIMEType   = errors.New("unsupported mime type")
	errInvalidRemoteURL      = errors.New("invalid remote url")
	errUnexpectedHTTPStatus  = errors.New("unexpected http status")
	errResolveHeaderFailed   = errors.New("resolve from headers failed")
	errResolveLocalFailed    = errors.New("resolve from local file failed")
	errResolveDownloadFailed = errors.New("resolve from download failed")
)

type fileContentFetcher interface {
	Fetch(ctx context.Context, path string) (io.ReadCloser, error)
}

// NormalizeExtension 归一化扩展名（小写、去掉前导点和空白）。
func NormalizeExtension(raw string) string {
	normalized := strings.ToLower(strings.TrimSpace(raw))
	return strings.TrimPrefix(normalized, ".")
}

// ExtractExtension 从文件名/路径/URL 中提取扩展名。
func ExtractExtension(rawPathOrURL string) string {
	cleaned := strings.TrimSpace(rawPathOrURL)
	if cleaned == "" {
		return ""
	}

	if parsed, err := url.Parse(cleaned); err == nil && parsed.Path != "" {
		if ext := NormalizeExtension(filepath.Ext(parsed.Path)); ext != "" {
			return ext
		}
	}

	if idx := strings.IndexAny(cleaned, "?#"); idx >= 0 {
		cleaned = cleaned[:idx]
	}

	return NormalizeExtension(filepath.Ext(cleaned))
}

// ResolveByPHPCompatibleStrategy 以接近 PHP FileType::getType 的优先级解析扩展名。
func ResolveByPHPCompatibleStrategy(ctx context.Context, rawPathOrURL string, fetcher fileContentFetcher) (string, error) {
	target := strings.TrimSpace(rawPathOrURL)
	if target == "" {
		return "", errEmptyPathOrURL
	}

	if ext := ExtractExtension(target); ext != "" {
		return ext, nil
	}

	var stageErrors []string

	localExt, localErr := resolveFromLocalFile(target)
	if localErr == nil {
		return localExt, nil
	}
	stageErrors = append(stageErrors, localErr.Error())

	if isHTTPURL(target) {
		headerExt, headerErr := resolveFromHeaders(ctx, target)
		if headerErr == nil {
			return headerExt, nil
		}
		stageErrors = append(stageErrors, headerErr.Error())
	}

	if fetcher != nil {
		downloadExt, downloadErr := resolveFromDownload(ctx, target, fetcher)
		if downloadErr == nil {
			return downloadExt, nil
		}
		stageErrors = append(stageErrors, downloadErr.Error())
	}

	if len(stageErrors) == 0 {
		return "", fmt.Errorf("%w: target=%q", errResolveExtension, target)
	}
	return "", fmt.Errorf("%w: target=%q, stages=[%s]", errResolveExtension, target, strings.Join(stageErrors, "; "))
}

func resolveFromLocalFile(path string) (string, error) {
	info, err := os.Stat(path)
	if err != nil {
		return "", fmt.Errorf("%w: stat path: %w", errResolveLocalFailed, err)
	}
	if info.IsDir() {
		return "", errors.Join(errResolveLocalFailed, errLocalPathIsDirectory)
	}
	file, err := os.Open(filepath.Clean(path))
	if err != nil {
		return "", fmt.Errorf("%w: open file: %w", errResolveLocalFailed, err)
	}
	defer func() { _ = file.Close() }()

	buffer := make([]byte, sniffBytes)
	n, err := io.ReadFull(file, buffer)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		return "", fmt.Errorf("%w: read local file: %w", errResolveLocalFailed, err)
	}
	ext, err := extensionFromMIME(http.DetectContentType(buffer[:n]))
	if err != nil {
		return "", fmt.Errorf("%w: detect local mime: %w", errResolveLocalFailed, err)
	}
	return ext, nil
}

func resolveFromHeaders(ctx context.Context, rawURL string) (string, error) {
	normalizedURL, err := normalizeRemoteURL(rawURL)
	if err != nil {
		return "", fmt.Errorf("%w: normalize url: %w", errResolveHeaderFailed, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodHead, normalizedURL, nil)
	if err != nil {
		return "", fmt.Errorf("%w: build request: %w", errResolveHeaderFailed, err)
	}
	resp, err := roundTrip(req)
	if err != nil {
		return "", fmt.Errorf("%w: send request: %w", errResolveHeaderFailed, err)
	}
	defer func() { _ = resp.Body.Close() }()

	if resp.StatusCode < 200 || resp.StatusCode >= 400 {
		return "", fmt.Errorf("%w: %w: status=%d", errResolveHeaderFailed, errUnexpectedHTTPStatus, resp.StatusCode)
	}

	contentType := strings.TrimSpace(resp.Header.Get("Content-Type"))
	if contentType == "" {
		return "", errors.Join(errResolveHeaderFailed, errContentTypeMissing)
	}
	ext, resolveErr := extensionFromMIME(contentType)
	if resolveErr != nil {
		return "", fmt.Errorf("%w: parse header mime: %w", errResolveHeaderFailed, resolveErr)
	}
	return ext, nil
}

func resolveFromDownload(ctx context.Context, target string, fetcher fileContentFetcher) (string, error) {
	reader, err := fetcher.Fetch(ctx, target)
	if err != nil {
		return "", fmt.Errorf("%w: fetch stream: %w", errResolveDownloadFailed, err)
	}
	defer func() { _ = reader.Close() }()

	buffer := make([]byte, sniffBytes)
	n, err := io.ReadFull(reader, buffer)
	if err != nil && !errors.Is(err, io.EOF) && !errors.Is(err, io.ErrUnexpectedEOF) {
		return "", fmt.Errorf("%w: read stream: %w", errResolveDownloadFailed, err)
	}
	ext, resolveErr := extensionFromMIME(http.DetectContentType(buffer[:n]))
	if resolveErr != nil {
		return "", fmt.Errorf("%w: detect mime: %w", errResolveDownloadFailed, resolveErr)
	}
	return ext, nil
}

func extensionFromMIME(rawContentType string) (string, error) {
	contentType := strings.TrimSpace(rawContentType)
	if contentType == "" {
		return "", errContentTypeMissing
	}

	if mediaType, _, err := mime.ParseMediaType(contentType); err == nil && mediaType != "" {
		contentType = mediaType
	}
	contentType = strings.ToLower(contentType)

	if ext := mimeExtensionOverride(contentType); ext != "" {
		return ext, nil
	}

	extensions, err := mime.ExtensionsByType(contentType)
	if err != nil {
		return "", fmt.Errorf("lookup mime extension: %w", err)
	}
	for _, ext := range extensions {
		normalized := NormalizeExtension(ext)
		if normalized != "" {
			return normalized, nil
		}
	}

	return "", fmt.Errorf("%w: %s", errUnsupportedMIMEType, contentType)
}

func isHTTPURL(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil {
		return false
	}
	if parsed.Host == "" {
		return false
	}
	return parsed.Scheme == "http" || parsed.Scheme == "https"
}

func mimeExtensionOverride(contentType string) string {
	switch contentType {
	case "application/json":
		return "json"
	case "application/msword":
		return "doc"
	case "application/pdf":
		return "pdf"
	case "image/jpeg", "image/jpg":
		return "jpg"
	case "image/png":
		return "png"
	case "image/bmp":
		return "bmp"
	case "application/vnd.ms-excel":
		return "xls"
	case "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
		return "xlsx"
	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		return "docx"
	case "application/xml":
		return "xml"
	case "application/zip":
		return "zip"
	case "text/csv":
		return "csv"
	case "text/html":
		return "html"
	case "text/markdown":
		return "md"
	case "text/plain":
		return "txt"
	case "text/xml":
		return "xml"
	default:
		return ""
	}
}

func normalizeRemoteURL(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", errInvalidRemoteURL
	}
	parsed, err := url.ParseRequestURI(trimmed)
	if err != nil {
		return "", fmt.Errorf("%w: parse uri: %w", errInvalidRemoteURL, err)
	}
	if parsed.Scheme != "http" && parsed.Scheme != "https" {
		return "", fmt.Errorf("%w: unsupported scheme", errInvalidRemoteURL)
	}
	if strings.TrimSpace(parsed.Host) == "" {
		return "", fmt.Errorf("%w: missing host", errInvalidRemoteURL)
	}
	return parsed.String(), nil
}

func roundTrip(req *http.Request) (*http.Response, error) {
	resp, err := http.DefaultTransport.RoundTrip(req)
	if err != nil {
		return nil, fmt.Errorf("round trip request: %w", err)
	}
	return resp, nil
}
