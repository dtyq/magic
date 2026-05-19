// Package fileutil 提供通用的文件操作工具函数
package fileutil

import (
	"fmt"
	"os"
	"path/filepath"
)

// 文件权限常量
const (
	PermDir  os.FileMode = 0o750
	PermFile os.FileMode = 0o600
)

// AtomicWriteFile 原子性地把数据写入文件
// 先写入临时文件，再重命名为目标文件，确保写入的原子性
func AtomicWriteFile(filename string, data []byte, perm os.FileMode) error {
	safeName := filepath.Clean(filename)
	dir := filepath.Dir(safeName)
	if err := os.MkdirAll(dir, PermDir); err != nil {
		return fmt.Errorf("create dir %s: %w", dir, err)
	}

	tmpFile, err := os.CreateTemp(dir, "tmp_*")
	if err != nil {
		return fmt.Errorf("create temp file: %w", err)
	}
	tmpName := tmpFile.Name()
	closed := false

	defer func() {
		if !closed {
			_ = tmpFile.Close()
			_ = os.Remove(tmpName)
		}
	}()

	if _, err := tmpFile.Write(data); err != nil {
		return fmt.Errorf("write temp file: %w", err)
	}
	if err := tmpFile.Chmod(perm); err != nil {
		return fmt.Errorf("chmod temp file: %w", err)
	}
	if err := tmpFile.Close(); err != nil {
		return fmt.Errorf("close temp file: %w", err)
	}
	closed = true

	renamePaths := map[string]string{
		"from": filepath.Clean(tmpName),
		"to":   safeName,
	}
	if err := os.Rename(renamePaths["from"], renamePaths["to"]); err != nil {
		return fmt.Errorf("rename temp file: %w", err)
	}
	return nil
}

// FileHash 计算文件的哈希值
// 对于文件变更检测场景，只需要快速检测文件是否变化即可
func FileHash(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("open file %s: %w", path, err)
	}
	defer func() { _ = f.Close() }() // 读文件场景忽略 Close 错误是安全的

	return HashReader(f)
}
