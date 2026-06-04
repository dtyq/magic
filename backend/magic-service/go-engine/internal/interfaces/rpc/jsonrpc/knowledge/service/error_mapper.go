package service

import (
	"context"
	"errors"
	"fmt"
	runtimeDebug "runtime/debug"

	"magic/internal/pkg/ctxmeta"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

// mapBusinessError 将应用层错误统一映射为对外业务错误码。
func mapBusinessError(ctx context.Context, err error) error {
	language, _ := ctxmeta.LanguageFromContext(ctx)
	mapped := jsonrpc.MapBusinessErrorWithLanguage(err, language)
	if mapped == nil {
		return nil
	}
	if ctxmeta.DebugErrorDetailsFromContext(ctx) && isMaskedInternalError(mapped) {
		mapped = jsonrpc.NewInternalDebugBusinessError(ctx, err, string(runtimeDebug.Stack()))
	}
	return fmt.Errorf("%w", mapped)
}

func isMaskedInternalError(err error) bool {
	var bizErr *jsonrpc.BusinessError
	return errors.As(err, &bizErr) &&
		bizErr.Code == jsonrpc.ErrCodeInternalError &&
		bizErr.Message == jsonrpc.GetErrorMessage(jsonrpc.ErrCodeInternalError) &&
		bizErr.Data == nil
}
