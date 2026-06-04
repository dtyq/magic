// Package webauth 定义 Go 调 PHP WebAuth IPC 时共享的认证类型。
package webauth

import "errors"

var (
	// ErrUnauthorized 表示 Web 登录态无效或缺少必要认证参数。
	ErrUnauthorized = errors.New("web auth unauthorized")
	// ErrUnavailable 表示 PHP WebAuth IPC 当前不可用。
	ErrUnavailable = errors.New("web auth unavailable")
)

// Request 是 Web 登录态鉴权请求。
type Request struct {
	Authorization    string
	OrganizationCode string
}

// User 是 PHP WebAuth 鉴权通过后返回的轻量用户信息。
type User struct {
	UserID           string
	MagicID          string
	OrganizationCode string
	MagicEnvID       int
}
