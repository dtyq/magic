package fileutil

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"hash/fnv"
	"io"
	"strconv"
)

// HashReader 从 Reader 计算 SHA256 哈希值
func HashReader(r io.Reader) (string, error) {
	h := sha256.New()
	if _, err := io.Copy(h, r); err != nil {
		return "", fmt.Errorf("copy to hasher: %w", err)
	}
	return hex.EncodeToString(h.Sum(nil)), nil
}

// HashBytes 使用 FNV-1a 计算字节数组的快速哈希
// FNV-1a 比 SHA256 快约 10 倍，适用于文件变更检测场景
func HashBytes(b []byte) string {
	h := fnv.New64a()
	_, _ = h.Write(b)
	return strconv.FormatUint(h.Sum64(), 16)
}
