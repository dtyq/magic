package service

import (
	"context"
	"fmt"

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
	return fmt.Errorf("%w", mapped)
}
