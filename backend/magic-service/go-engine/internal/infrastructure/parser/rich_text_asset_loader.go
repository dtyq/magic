package docparser

import (
	"context"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"mime"
	neturl "net/url"
	"path"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/service"
)

var (
	errInvalidDataURI             = errors.New("invalid data uri")
	errUnsupportedDataURIEncoding = errors.New("unsupported data uri encoding")
)

type richTextAssetLoader struct {
	fileFetcher documentdomain.FileFetcher
}

func newRichTextAssetLoader(fileFetcher documentdomain.FileFetcher) richTextAssetLoader {
	return richTextAssetLoader{fileFetcher: fileFetcher}
}

func (l richTextAssetLoader) resolveReferencedImageText(
	ctx context.Context,
	baseSource string,
	rawRef string,
	ocrHelper *embeddedImageOCRHelper,
) string {
	if ocrHelper == nil {
		return ""
	}
	data, format, err := l.fetchReferencedImage(ctx, baseSource, rawRef)
	if err != nil || len(data) == 0 {
		return ""
	}
	return ocrHelper.recognizeBytes(ctx, data, format)
}

func (l richTextAssetLoader) fetchReferencedImage(ctx context.Context, baseSource, rawRef string) ([]byte, string, error) {
	ref := strings.TrimSpace(rawRef)
	if ref == "" {
		return nil, "", nil
	}
	if strings.HasPrefix(strings.ToLower(ref), "data:") {
		return decodeDataURIImage(ref)
	}
	if l.fileFetcher == nil {
		return nil, "", nil
	}

	target := resolveReferencedAssetLocation(baseSource, ref)
	if strings.TrimSpace(target) == "" {
		return nil, "", nil
	}
	reader, err := l.fileFetcher.Fetch(ctx, target)
	if err != nil {
		return nil, "", fmt.Errorf("fetch referenced image %s: %w", target, err)
	}
	defer func() { _ = reader.Close() }()

	data, err := io.ReadAll(reader)
	if err != nil {
		return nil, "", fmt.Errorf("read referenced image %s: %w", target, err)
	}
	return data, inferReferencedImageFormat(ref), nil
}

func resolveReferencedAssetLocation(baseSource, rawRef string) string {
	ref := strings.TrimSpace(rawRef)
	if ref == "" {
		return ""
	}
	if isHTTPURL(ref) {
		return ref
	}

	base := strings.TrimSpace(baseSource)
	if isHTTPURL(base) {
		baseURL, err := neturl.Parse(base)
		if err != nil {
			return ref
		}
		refURL, refErr := neturl.Parse(ref)
		if refErr != nil {
			return ref
		}
		return baseURL.ResolveReference(refURL).String()
	}

	base = strings.TrimLeft(base, "/")
	if strings.HasPrefix(ref, "/") {
		segments := strings.Split(base, "/")
		if len(segments) > 0 && strings.TrimSpace(segments[0]) != "" {
			return path.Clean(path.Join(segments[0], ref))
		}
	}
	return path.Clean(path.Join(path.Dir(base), ref))
}

func decodeDataURIImage(raw string) ([]byte, string, error) {
	parts := strings.SplitN(raw, ",", 2)
	if len(parts) != 2 {
		return nil, "", errInvalidDataURI
	}
	metadata := strings.ToLower(strings.TrimSpace(parts[0]))
	payload := strings.TrimSpace(parts[1])
	if !strings.Contains(metadata, ";base64") {
		return nil, "", errUnsupportedDataURIEncoding
	}
	data, err := base64.StdEncoding.DecodeString(payload)
	if err != nil {
		return nil, "", fmt.Errorf("decode data uri: %w", err)
	}
	return data, inferDataURIImageFormat(metadata), nil
}

func inferDataURIImageFormat(metadata string) string {
	mediaType := strings.TrimPrefix(strings.SplitN(metadata, ";", 2)[0], "data:")
	switch mediaType {
	case "image/jpg":
		return embeddedOCRFormatJPG
	case "image/jpeg":
		return embeddedOCRFormatJPEG
	case "image/png":
		return embeddedOCRFormatPNG
	case "image/bmp":
		return embeddedOCRFormatBMP
	default:
		extensions, _ := mime.ExtensionsByType(mediaType)
		if len(extensions) == 0 {
			return ""
		}
		return strings.TrimPrefix(extensions[0], ".")
	}
}

func inferReferencedImageFormat(ref string) string {
	parsed, err := neturl.Parse(strings.TrimSpace(ref))
	if err != nil {
		return ""
	}
	return normalizeEmbeddedOCRFormat(path.Ext(parsed.Path))
}
