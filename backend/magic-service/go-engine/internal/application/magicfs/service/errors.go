package service

import (
	"errors"

	domainmagicfs "magic/internal/domain/magicfs"
)

const (
	// SystemErrorCode 对齐 PHP GenericErrorCode::SystemError。
	SystemErrorCode = 5000
	// FileNotFoundCode 对齐 MagicFSErrorCode::FILE_NOT_FOUND。
	FileNotFoundCode = 51300
)

const (
	// SystemErrorMessage 对齐 PHP system_exception 文案 key。
	SystemErrorMessage = "system_exception"
	// FileNotFoundMessage 对齐 MagicFS 文件不存在文案 key。
	FileNotFoundMessage = "magicfs.file_not_found"
)

var (
	// ErrFileNotFound 表示 MagicFS 文件不存在或已软删除。
	ErrFileNotFound = errors.New("magicfs file not found")
	// ErrAuthorizationUnavailable 表示 MagicFS 鉴权服务当前不可用。
	ErrAuthorizationUnavailable = domainmagicfs.ErrAuthorizationUnavailable
	// ErrServiceNotInitialized 表示 MagicFS 文件版本服务依赖未初始化。
	ErrServiceNotInitialized = errors.New("magicfs file version service is not initialized")
)

// BusinessError 表示 PHP IPC 返回的业务错误，需要透传 low_code code/message。
type BusinessError = domainmagicfs.BusinessError

// APIError 是 handler 可直接写回 low_code 响应的错误信息。
type APIError struct {
	Code    int
	Message string
	System  bool
}

// APIErrorFromError 将应用层错误归类为 low_code 错误。
func APIErrorFromError(err error) APIError {
	var businessError *BusinessError
	switch {
	case errors.As(err, &businessError):
		return APIError{Code: businessError.Code, Message: businessError.Message}
	case errors.Is(err, ErrFileNotFound):
		return APIError{Code: FileNotFoundCode, Message: FileNotFoundMessage}
	case errors.Is(err, ErrAuthorizationUnavailable):
		return APIError{Code: SystemErrorCode, Message: SystemErrorMessage, System: true}
	default:
		return APIError{Code: SystemErrorCode, Message: SystemErrorMessage, System: true}
	}
}
