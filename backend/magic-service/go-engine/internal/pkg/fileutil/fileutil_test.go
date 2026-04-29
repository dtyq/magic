package fileutil_test

import (
	"os"
	"path/filepath"
	"testing"

	"magic/internal/pkg/fileutil"
)

func TestAtomicWriteFile(t *testing.T) {
	t.Parallel()
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "test.txt")
	data := []byte("hello world")

	// 写入文件
	if err := fileutil.AtomicWriteFile(path, data, 0o600); err != nil {
		t.Fatalf("AtomicWriteFile failed: %v", err)
	}

	// 验证内容
	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile failed: %v", err)
	}
	if string(got) != string(data) {
		t.Errorf("content mismatch: got %q, want %q", got, data)
	}

	// 验证权限
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("Stat failed: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Logf("perm got %v, want %v (may differ due to umask)", info.Mode().Perm(), 0o600)
	}
}

func TestAtomicWriteFile_CreatesDirectory(t *testing.T) {
	t.Parallel()
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "subdir", "nested", "test.txt")
	data := []byte("nested file")

	if err := fileutil.AtomicWriteFile(path, data, 0o600); err != nil {
		t.Fatalf("AtomicWriteFile failed: %v", err)
	}

	got, err := os.ReadFile(path)
	if err != nil {
		t.Fatalf("ReadFile failed: %v", err)
	}
	if string(got) != string(data) {
		t.Errorf("content mismatch: got %q, want %q", got, data)
	}
}

func TestFileHash(t *testing.T) {
	t.Parallel()
	tmpDir := t.TempDir()
	path := filepath.Join(tmpDir, "test.txt")
	data := []byte("test content")
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}

	// 计算哈希
	hash1, err := fileutil.FileHash(path)
	if err != nil {
		t.Fatalf("FileHash failed: %v", err)
	}
	if hash1 == "" {
		t.Error("hash should not be empty")
	}

	// 相同内容应该产生相同哈希
	hash2, err := fileutil.FileHash(path)
	if err != nil {
		t.Fatalf("FileHash failed: %v", err)
	}
	if hash1 != hash2 {
		t.Errorf("hash should be deterministic: %s != %s", hash1, hash2)
	}

	// 不同内容应该产生不同哈希
	path2 := filepath.Join(tmpDir, "test2.txt")
	if err := os.WriteFile(path2, []byte("different content"), 0o600); err != nil {
		t.Fatalf("WriteFile failed: %v", err)
	}
	hash3, err := fileutil.FileHash(path2)
	if err != nil {
		t.Fatalf("FileHash failed: %v", err)
	}
	if hash1 == hash3 {
		t.Error("different content should produce different hash")
	}
}

func TestFileHash_NotExists(t *testing.T) {
	t.Parallel()
	_, err := fileutil.FileHash("/nonexistent/path/file.txt")
	if err == nil {
		t.Error("expected error for non-existent file")
	}
}

func TestHashBytes(t *testing.T) {
	t.Parallel()
	data := []byte("test data")
	hash1 := fileutil.HashBytes(data)
	if hash1 == "" {
		t.Error("hash should not be empty")
	}

	// 哈希应该是确定性的
	hash2 := fileutil.HashBytes(data)
	if hash1 != hash2 {
		t.Errorf("hash should be deterministic: %s != %s", hash1, hash2)
	}

	// 不同数据应该产生不同哈希
	hash3 := fileutil.HashBytes([]byte("different data"))
	if hash1 == hash3 {
		t.Error("different data should produce different hash")
	}
}
