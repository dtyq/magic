// Package smartcache provides helpers for cache-backed incremental tool execution.
package smartcache

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"slices"
	"strings"

	"magic/internal/pkg/fileutil"
)

// FileMeta captures the minimal metadata used for fast change detection.
type FileMeta struct {
	Mtime int64 `json:"mtime"`
	Size  int64 `json:"size"`
}

// TrackedFile describes one tracked input file for an incremental tool.
type TrackedFile struct {
	RelativePath string
	FullPath     string
	Meta         FileMeta
}

// CollectFiles walks the repository root and returns tracked files sorted by path.
func CollectFiles(root string, shouldTrack func(relPath string) bool) ([]TrackedFile, error) {
	tracked := make([]TrackedFile, 0)

	err := filepath.WalkDir(root, func(path string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}

		relPath, err := filepath.Rel(root, path)
		if err != nil {
			return fmt.Errorf("relative path %s: %w", path, err)
		}
		if relPath == "." {
			return nil
		}

		if entry.IsDir() {
			if shouldSkipDir(relPath) {
				return filepath.SkipDir
			}
			return nil
		}
		if !shouldTrack(filepath.ToSlash(relPath)) {
			return nil
		}

		info, err := entry.Info()
		if err != nil {
			return fmt.Errorf("stat %s: %w", path, err)
		}

		tracked = append(tracked, TrackedFile{
			RelativePath: filepath.ToSlash(relPath),
			FullPath:     path,
			Meta: FileMeta{
				Mtime: info.ModTime().UnixNano(),
				Size:  info.Size(),
			},
		})
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk tracked files: %w", err)
	}

	slices.SortFunc(tracked, func(a, b TrackedFile) int {
		return strings.Compare(a.RelativePath, b.RelativePath)
	})

	return tracked, nil
}

// FilesMap converts tracked files into a map keyed by repo-relative path.
func FilesMap(files []TrackedFile) map[string]FileMeta {
	result := make(map[string]FileMeta, len(files))
	for _, file := range files {
		result[file.RelativePath] = file.Meta
	}

	return result
}

// MetadataMatch reports whether both file sets are identical by path, mtime, and size.
func MetadataMatch(previous, current map[string]FileMeta) bool {
	if len(previous) != len(current) {
		return false
	}

	for path, currentMeta := range current {
		previousMeta, ok := previous[path]
		if !ok || previousMeta != currentMeta {
			return false
		}
	}

	return true
}

// HashFiles returns a deterministic content hash for the tracked files.
func HashFiles(files []TrackedFile) (string, error) {
	hasher := sha256.New()

	for _, file := range files {
		if _, err := io.WriteString(hasher, file.RelativePath); err != nil {
			return "", fmt.Errorf("hash path %s: %w", file.RelativePath, err)
		}
		if err := hashFileInto(hasher, file.FullPath); err != nil {
			return "", err
		}
	}

	return hex.EncodeToString(hasher.Sum(nil)), nil
}

// FileHash returns the SHA256 hash of one file.
func FileHash(path string) (string, error) {
	hash, err := fileutil.FileHash(path)
	if err != nil {
		return "", fmt.Errorf("file hash: %w", err)
	}

	return hash, nil
}

// AtomicWriteFile atomically writes data to the target file.
func AtomicWriteFile(filename string, data []byte, perm os.FileMode) error {
	if err := fileutil.AtomicWriteFile(filename, data, perm); err != nil {
		return fmt.Errorf("atomic write: %w", err)
	}

	return nil
}

func shouldSkipDir(relPath string) bool {
	firstSegment := strings.Split(filepath.ToSlash(relPath), "/")[0]
	switch firstSegment {
	case ".cache", "tmp", "bin", ".git":
		return true
	default:
		return false
	}
}

func hashFileInto(writer io.Writer, path string) error {
	file, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open file %s: %w", path, err)
	}
	defer func() { _ = file.Close() }()

	if _, err := io.Copy(writer, file); err != nil {
		return fmt.Errorf("hash file %s: %w", path, err)
	}

	return nil
}
