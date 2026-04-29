// Package selfcheck 提供二进制启动前的自检命令。
package selfcheck

import (
	"errors"
	"fmt"
	"io"
	"strings"

	"magic/internal/pkg/tokenizer"
)

const (
	commandSelfCheck         = "self-check"
	targetTokenizerOffline   = "tokenizer-offline"
	exitCodeSuccess          = 0
	exitCodeExecutionFailure = 1
	exitCodeUsage            = 2
	supportedModel           = "text-embedding-3-small"
	unknownModel             = "unknown-model-for-self-check"
	sampleText               = "offline tokenizer self check"
)

var (
	errSupportedEncoderNil            = errors.New("supported model encoder is nil")
	errSupportedModelUnexpectedlyBack = errors.New("supported model unexpectedly fell back")
	errSupportedModelEmptyTokens      = errors.New("supported model encode returned empty tokens")
	errSupportedModelCountMismatch    = errors.New("supported model count mismatch")
	errFallbackEncoderNil             = errors.New("fallback encoder is nil")
	errUnknownModelNoFallback         = errors.New("unknown model should fallback but did not")
	errFallbackEncodingMismatch       = errors.New("fallback encoding mismatch")
	errFallbackResolvedModelMismatch  = errors.New("fallback resolved model mismatch")
	errFallbackTokenCountInvalid      = errors.New("fallback encoder token count should be positive")
)

// Run 执行命令入口；当返回 handled=false 时表示不是自检命令。
func Run(args []string, stdout, stderr io.Writer) (handled bool, exitCode int) {
	if len(args) == 0 || strings.TrimSpace(args[0]) != commandSelfCheck {
		return false, exitCodeSuccess
	}
	if len(args) < 2 {
		_, _ = fmt.Fprintln(stderr, "usage: magic-go-engine self-check tokenizer-offline")
		return true, exitCodeUsage
	}

	switch strings.TrimSpace(args[1]) {
	case targetTokenizerOffline:
		if err := CheckTokenizerOffline(); err != nil {
			_, _ = fmt.Fprintf(stderr, "self-check tokenizer-offline failed: %v\n", err)
			return true, exitCodeExecutionFailure
		}
		_, _ = fmt.Fprintln(stdout, "self-check tokenizer-offline: ok")
		return true, exitCodeSuccess
	default:
		_, _ = fmt.Fprintf(stderr, "unknown self-check target: %s\n", args[1])
		return true, exitCodeUsage
	}
}

// CheckTokenizerOffline 验证离线 tokenizer 能力。
func CheckTokenizerOffline() error {
	service := tokenizer.NewService()

	encoder, err := service.EncoderForModel(supportedModel)
	if err != nil {
		return fmt.Errorf("resolve supported model encoder failed: %w", err)
	}
	if encoder == nil {
		return errSupportedEncoderNil
	}
	if encoder.UsesFallback() {
		return fmt.Errorf("%w: model=%s encoding=%s", errSupportedModelUnexpectedlyBack, encoder.ResolvedModel(), encoder.EncodingName())
	}

	encoded := encoder.Encode(sampleText)
	if len(encoded) == 0 {
		return errSupportedModelEmptyTokens
	}
	if encoder.CountTokens(sampleText) != len(encoded) {
		return fmt.Errorf("%w: count=%d tokens=%d", errSupportedModelCountMismatch, encoder.CountTokens(sampleText), len(encoded))
	}

	fallbackEncoder, err := service.EncoderForModel(unknownModel)
	if err != nil {
		return fmt.Errorf("resolve unknown model encoder failed: %w", err)
	}
	if fallbackEncoder == nil {
		return errFallbackEncoderNil
	}
	if !fallbackEncoder.UsesFallback() {
		return errUnknownModelNoFallback
	}
	if fallbackEncoder.EncodingName() != tokenizer.DefaultEncoding {
		return fmt.Errorf("%w: got=%s want=%s", errFallbackEncodingMismatch, fallbackEncoder.EncodingName(), tokenizer.DefaultEncoding)
	}
	if fallbackEncoder.ResolvedModel() != tokenizer.DefaultEncoding {
		return fmt.Errorf("%w: got=%s want=%s", errFallbackResolvedModelMismatch, fallbackEncoder.ResolvedModel(), tokenizer.DefaultEncoding)
	}
	if fallbackEncoder.CountTokens(sampleText) <= 0 {
		return errFallbackTokenCountInvalid
	}

	return nil
}
