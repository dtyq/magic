package docapp_test

import (
	"os"
	"testing"

	"magic/internal/pkg/tokenizer"
)

// newSharedTokenizerForTest 用于需要大量切片断言的单测。
// 这类测试应在父测试里复用同一个 tokenizer，避免每个 case 重复初始化离线词表，导致慢测抖动。
func newSharedTokenizerForTest(tb testing.TB) *tokenizer.Service {
	tb.Helper()

	svc := tokenizer.NewService()
	if _, err := svc.EncoderForModel("text-embedding-3-small"); err != nil {
		tb.Fatalf("prewarm tokenizer encoder: %v", err)
	}
	return svc
}

func TestMain(m *testing.M) {
	if _, err := tokenizer.NewService().EncoderForModel("text-embedding-3-small"); err != nil {
		_, _ = os.Stderr.WriteString("prewarm tokenizer encoder: " + err.Error() + "\n")
		os.Exit(1)
	}
	os.Exit(m.Run())
}
