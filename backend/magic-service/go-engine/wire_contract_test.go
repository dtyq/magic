package main

import (
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestWireDefinitionsDoNotUseStructInjection(t *testing.T) {
	t.Parallel()
	rootDir := "."
	forbiddenPattern := "wire." + "Struct("
	paths := make([]string, 0, 16)

	err := filepath.WalkDir(rootDir, func(path string, d fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if d.IsDir() {
			switch d.Name() {
			case ".git", ".cache", "tmp", "vendor":
				return filepath.SkipDir
			}
			return nil
		}
		if !strings.HasSuffix(path, ".go") || strings.HasSuffix(path, "wire_gen.go") {
			return nil
		}
		paths = append(paths, path)
		return nil
	})
	if err != nil {
		t.Fatalf("walk source tree: %v", err)
	}

	root, err := os.OpenRoot(rootDir)
	if err != nil {
		t.Fatalf("open project root: %v", err)
	}
	defer func() {
		_ = root.Close()
	}()

	for _, path := range paths {
		file, err := root.Open(path)
		if err != nil {
			t.Fatalf("open %s: %v", path, fmt.Errorf("open source file: %w", err))
		}
		content, err := io.ReadAll(file)
		_ = file.Close()
		if err != nil {
			t.Fatalf("read %s: %v", path, fmt.Errorf("read source file: %w", err))
		}
		if strings.Contains(string(content), forbiddenPattern) {
			t.Errorf("found forbidden wire.Struct injection in %s", path)
		}
	}
}
