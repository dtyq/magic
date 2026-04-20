package tokenizer_test

import (
	"testing"

	"magic/internal/pkg/tokenizer"
)

func TestOfflineLoaderInstalled(t *testing.T) {
	t.Parallel()

	svc := tokenizer.NewService()
	if svc == nil {
		t.Fatal("expected tokenizer service")
	}

	encoder, err := svc.EncoderForModel("text-embedding-3-small")
	if err != nil {
		t.Fatalf("resolve encoder failed: %v", err)
	}
	if encoder == nil {
		t.Fatal("expected encoder")
	}
	count := encoder.CountTokens("hello world")
	if count <= 0 {
		t.Fatalf("expected positive token count, got %d", count)
	}
}

func TestUnknownModelFallsBackToCl100kBase(t *testing.T) {
	t.Parallel()

	svc := tokenizer.NewService()
	encoder, err := svc.EncoderForModel("custom-unknown-embedding-model")
	if err != nil {
		t.Fatalf("resolve encoder failed: %v", err)
	}

	if !encoder.UsesFallback() {
		t.Fatal("expected fallback for unknown model")
	}
	if encoder.EncodingName() != tokenizer.DefaultEncoding {
		t.Fatalf("expected fallback encoding %q, got %q", tokenizer.DefaultEncoding, encoder.EncodingName())
	}
	if encoder.ResolvedModel() != tokenizer.DefaultEncoding {
		t.Fatalf("expected resolved model %q, got %q", tokenizer.DefaultEncoding, encoder.ResolvedModel())
	}
}

func TestModelEncoderCached(t *testing.T) {
	t.Parallel()

	svc := tokenizer.NewService()
	first, err := svc.EncoderForModel("text-embedding-3-large")
	if err != nil {
		t.Fatalf("first resolve failed: %v", err)
	}
	second, err := svc.EncoderForModel("text-embedding-3-large")
	if err != nil {
		t.Fatalf("second resolve failed: %v", err)
	}
	if first != second {
		t.Fatal("expected cached encoder instance")
	}
}
