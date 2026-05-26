// Package magicfs 定义 MagicFS 领域共享的错误与常量。
package magicfs

import (
	"errors"
	"fmt"
)

// ErrFileNotFound 表示 MagicFS 文件不存在或已软删除。
var ErrFileNotFound = errors.New("magicfs file not found")

// ErrAuthorizationUnavailable 表示 MagicFS 鉴权服务当前不可用。
var ErrAuthorizationUnavailable = errors.New("magicfs authorization unavailable")

// BusinessError 表示 MagicFS 领域外部服务返回的业务错误。
type BusinessError struct {
	Code    int
	Message string
}

func (e *BusinessError) Error() string {
	if e == nil {
		return ""
	}
	return fmt.Sprintf("magicfs business error: code=%d, message=%s", e.Code, e.Message)
}
