package service

import (
	"fmt"

	jsonrpc "magic/internal/pkg/jsonrpc"
)

// mapBusinessError 将应用层错误统一映射为对外业务错误码。
func mapBusinessError(err error) error {
	mapped := jsonrpc.MapBusinessError(err)
	if mapped == nil {
		return nil
	}
	return fmt.Errorf("%w", mapped)
}
