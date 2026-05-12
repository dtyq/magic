package docparser

import (
	"archive/zip"
	"fmt"
	"io"
	"math"
	"path"
	"strings"

	documentdomain "magic/internal/domain/knowledge/document/metadata"
)

type parserSizeLimitKind int

const (
	parserSizeLimitArchiveEntry parserSizeLimitKind = iota + 1
	parserSizeLimitEmbeddedAsset
)

func checkZipArchiveLimits(files []*zip.File, limits documentdomain.ResourceLimits) error {
	var total uint64
	for _, file := range files {
		if file == nil || file.FileInfo().IsDir() {
			continue
		}
		entrySize := file.UncompressedSize64
		if err := documentdomain.CheckArchiveEntrySize(clampUint64ToInt64(entrySize), limits); err != nil {
			return fmt.Errorf("check archive entry %s: %w", file.Name, err)
		}
		total += entrySize
		if total < entrySize {
			total = math.MaxUint64
		}
		if err := documentdomain.CheckArchiveUncompressedSize(clampUint64ToInt64(total), limits); err != nil {
			return fmt.Errorf("check archive uncompressed size: %w", err)
		}
	}
	return nil
}

func checkOfficeZipArchiveLimits(files []*zip.File, limits documentdomain.ResourceLimits) error {
	if err := checkZipArchiveLimits(files, limits); err != nil {
		return err
	}
	for _, file := range files {
		if file == nil || file.FileInfo().IsDir() || !isOfficeEmbeddedAssetEntry(file.Name) {
			continue
		}
		if err := documentdomain.CheckEmbeddedAssetSize(clampUint64ToInt64(file.UncompressedSize64), limits); err != nil {
			return fmt.Errorf("check embedded asset %s: %w", file.Name, err)
		}
	}
	return nil
}

func isOfficeEmbeddedAssetEntry(name string) bool {
	normalized := strings.ToLower(path.Clean(strings.TrimSpace(name)))
	return strings.Contains(normalized, "/media/")
}

func readZipEntryWithArchiveLimit(files []*zip.File, entryPath string, limits documentdomain.ResourceLimits) ([]byte, error) {
	return readZipEntryWithSizeLimit(files, entryPath, limits, parserSizeLimitArchiveEntry)
}

func readZipEntryWithEmbeddedAssetLimit(files []*zip.File, entryPath string, limits documentdomain.ResourceLimits) ([]byte, error) {
	return readZipEntryWithSizeLimit(files, entryPath, limits, parserSizeLimitEmbeddedAsset)
}

func readZipEntryWithSizeLimit(
	files []*zip.File,
	entryPath string,
	limits documentdomain.ResourceLimits,
	limitKind parserSizeLimitKind,
) ([]byte, error) {
	cleanEntryPath := path.Clean(strings.TrimSpace(entryPath))
	for _, file := range files {
		if file == nil || path.Clean(file.Name) != cleanEntryPath {
			continue
		}
		if err := checkSizeLimit(limitKind, clampUint64ToInt64(file.UncompressedSize64), limits); err != nil {
			return nil, fmt.Errorf("check zip entry %s size: %w", cleanEntryPath, err)
		}
		handle, err := file.Open()
		if err != nil {
			return nil, fmt.Errorf("open zip entry: %w", err)
		}
		defer func() { _ = handle.Close() }()
		return readAllWithLimit(handle, file.UncompressedSize64, limits, limitKind)
	}
	return nil, fmt.Errorf("%w: %s", errZipEntryNotFound, cleanEntryPath)
}

func readAllWithEmbeddedAssetLimit(reader io.Reader, limits documentdomain.ResourceLimits) ([]byte, error) {
	return readAllWithLimit(reader, 0, limits, parserSizeLimitEmbeddedAsset)
}

func readAllWithLimit(
	reader io.Reader,
	expectedSize uint64,
	limits documentdomain.ResourceLimits,
	limitKind parserSizeLimitKind,
) ([]byte, error) {
	if reader == nil {
		return nil, nil
	}
	limit := resolveReadLimit(expectedSize, limits, limitKind)
	data, err := io.ReadAll(io.LimitReader(reader, limit+1))
	if err != nil {
		return nil, fmt.Errorf("read limited data: %w", err)
	}
	if int64(len(data)) > limit {
		if err := checkSizeLimit(limitKind, int64(len(data)), limits); err != nil {
			return nil, err
		}
	}
	return data, nil
}

func resolveReadLimit(
	expectedSize uint64,
	limits documentdomain.ResourceLimits,
	limitKind parserSizeLimitKind,
) int64 {
	normalized := documentdomain.NormalizeResourceLimits(limits)
	switch limitKind {
	case parserSizeLimitEmbeddedAsset:
		return normalized.MaxEmbeddedAssetBytes
	case parserSizeLimitArchiveEntry:
		return normalized.MaxArchiveEntryBytes
	default:
		if expectedSize > 0 {
			return clampUint64ToInt64(expectedSize)
		}
		return normalized.MaxSourceBytes
	}
}

func checkSizeLimit(limitKind parserSizeLimitKind, size int64, limits documentdomain.ResourceLimits) error {
	switch limitKind {
	case parserSizeLimitEmbeddedAsset:
		if err := documentdomain.CheckEmbeddedAssetSize(size, limits); err != nil {
			return fmt.Errorf("check embedded asset size: %w", err)
		}
		return nil
	case parserSizeLimitArchiveEntry:
		if err := documentdomain.CheckArchiveEntrySize(size, limits); err != nil {
			return fmt.Errorf("check archive entry size: %w", err)
		}
		return nil
	default:
		return nil
	}
}

func clampUint64ToInt64(value uint64) int64 {
	if value > math.MaxInt64 {
		return math.MaxInt64
	}
	return int64(value)
}
