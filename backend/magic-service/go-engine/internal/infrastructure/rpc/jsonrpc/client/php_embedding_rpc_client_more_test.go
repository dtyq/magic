package client_test

import (
	"context"
	"errors"
	"slices"
	"strconv"
	"strings"
	"testing"

	client "magic/internal/infrastructure/rpc/jsonrpc/client"
	"magic/internal/infrastructure/transport/ipc/unixsocket"
	"magic/internal/pkg/ctxmeta"
)

var errTokenProviderBoom = errors.New("token provider boom")

func TestPHPEmbeddingRPCClientGetEmbeddingVariants(t *testing.T) {
	t.Parallel()

	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, nil)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })
	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		setEmbeddingComputeSuccess(t, out, []float64{0.1, 0.2})
		return nil
	})

	vector, err := embeddingClient.GetEmbedding(context.Background(), "hello", "text-embedding-3-small", nil)
	if err != nil {
		t.Fatalf("GetEmbedding() error = %v", err)
	}
	if len(vector) != 2 || vector[0] != 0.1 {
		t.Fatalf("unexpected vector: %#v", vector)
	}

	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		*requireEmbeddingComputeResult(t, out) = client.RPCResultForTest[client.EmbeddingResultForTest]{Code: 0, Message: "ok"}
		return nil
	})
	vector, err = embeddingClient.GetEmbedding(context.Background(), "hello", "text-embedding-3-small", nil)
	if err != nil {
		t.Fatalf("GetEmbedding(empty) error = %v", err)
	}
	if len(vector) != 0 {
		t.Fatalf("expected empty vector, got %#v", vector)
	}
}

func TestPHPEmbeddingRPCClientGetEmbeddingRetriesOnceOnNetworkError(t *testing.T) {
	t.Parallel()

	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, nil)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	callCount := 0
	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		callCount++
		if callCount == 1 {
			*requireEmbeddingComputeResult(t, out) = client.RPCResultForTest[client.EmbeddingResultForTest]{
				Code:      500,
				Message:   "network timeout",
				ErrorCode: 4020,
			}
			return nil
		}

		setEmbeddingComputeSuccess(t, out, []float64{0.3, 0.4})
		return nil
	})

	vector, err := embeddingClient.GetEmbedding(context.Background(), "hello", "text-embedding-3-small", nil)
	if err != nil {
		t.Fatalf("GetEmbedding() error = %v", err)
	}
	if callCount != 2 {
		t.Fatalf("expected 2 rpc calls, got %d", callCount)
	}
	if len(vector) != 2 || vector[0] != 0.3 || vector[1] != 0.4 {
		t.Fatalf("unexpected vector: %#v", vector)
	}
}

func TestPHPEmbeddingRPCClientGetEmbeddingReturnsNetworkErrorAfterRetryFailure(t *testing.T) {
	t.Parallel()
	assertEmbeddingRPCClientGetEmbeddingError(t, 4020, "network timeout", 2)
}

func TestPHPEmbeddingRPCClientGetEmbeddingDoesNotRetryWhenErrorCodeIsNotNetwork(t *testing.T) {
	t.Parallel()
	assertEmbeddingRPCClientGetEmbeddingError(t, 4999, "internal", 1)
}

func TestPHPEmbeddingRPCClientBatchEmbeddingsWithoutAccessToken(t *testing.T) {
	t.Parallel()

	provider := &fakeRefreshableTokenProvider{getErr: errTokenProviderBoom}
	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, provider)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	called := false
	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		if _, exists := params["access_token"]; exists {
			t.Fatalf("access_token should be omitted when provider fails: %#v", params)
		}
		assertHelloInput(t, params)
		called = true
		setEmbeddingComputeSuccess(t, out, []float64{1})
		return nil
	})

	businessParams := ctxmeta.BusinessParams{
		OrganizationCode: "org-1",
		UserID:           "user-1",
		BusinessID:       "biz-1",
	}
	embeddings, err := embeddingClient.GetBatchEmbeddings(context.Background(), []string{"hello"}, "m", &businessParams)
	if err != nil {
		t.Fatalf("GetBatchEmbeddings() error = %v", err)
	}
	if !called || len(embeddings) != 1 || len(embeddings[0]) != 1 || embeddings[0][0] != 1 {
		t.Fatalf("unexpected embeddings: %#v", embeddings)
	}
}

func TestPHPEmbeddingRPCClientGetBatchEmbeddingsRetriesOnceOnNetworkError(t *testing.T) {
	t.Parallel()

	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, nil)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	callCount := 0
	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		callCount++
		assertHelloInput(t, params)
		if callCount == 1 {
			*requireEmbeddingComputeResult(t, out) = client.RPCResultForTest[client.EmbeddingResultForTest]{
				Code:      500,
				Message:   "network timeout",
				ErrorCode: 4020,
			}
			return nil
		}

		setEmbeddingComputeSuccess(t, out, []float64{0.3, 0.4})
		return nil
	})

	embeddings, err := embeddingClient.GetBatchEmbeddings(context.Background(), []string{"hello"}, "m", nil)
	if err != nil {
		t.Fatalf("GetBatchEmbeddings() error = %v", err)
	}
	if callCount != 2 {
		t.Fatalf("expected 2 rpc calls, got %d", callCount)
	}
	if len(embeddings) != 1 || len(embeddings[0]) != 2 || embeddings[0][0] != 0.3 || embeddings[0][1] != 0.4 {
		t.Fatalf("unexpected embeddings: %#v", embeddings)
	}
}

func TestPHPEmbeddingRPCClientGetBatchEmbeddingsPreservesInputOrder(t *testing.T) {
	t.Parallel()

	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, nil)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	inputs := []string{"first", "second", "third"}
	values := map[string][]float64{
		"first":  {1},
		"second": {2},
		"third":  {3},
	}
	calledInputs := make([]string, 0, len(inputs))

	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		input := requireSingleInput(t, params)
		calledInputs = append(calledInputs, input)
		setEmbeddingComputeSuccess(t, out, values[input])
		return nil
	})

	embeddings, err := embeddingClient.GetBatchEmbeddings(context.Background(), inputs, "m", nil)
	if err != nil {
		t.Fatalf("GetBatchEmbeddings() error = %v", err)
	}
	if !slices.Equal(calledInputs, inputs) {
		t.Fatalf("unexpected call order: got %v want %v", calledInputs, inputs)
	}
	if len(embeddings) != len(inputs) {
		t.Fatalf("expected %d embeddings, got %d", len(inputs), len(embeddings))
	}
	for i, input := range inputs {
		if !slices.Equal(embeddings[i], values[input]) {
			t.Fatalf("embedding at index %d mismatch: got %v want %v", i, embeddings[i], values[input])
		}
	}
}

func TestPHPEmbeddingRPCClientGetBatchEmbeddingsReturnsIndexedError(t *testing.T) {
	t.Parallel()

	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, nil)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	callCount := 0
	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		callCount++
		input := requireSingleInput(t, params)
		switch input {
		case "first":
			setEmbeddingComputeSuccess(t, out, []float64{1})
		case "second":
			*requireEmbeddingComputeResult(t, out) = client.RPCResultForTest[client.EmbeddingResultForTest]{
				Code:      500,
				Message:   "boom",
				ErrorCode: 4999,
			}
		default:
			t.Fatalf("unexpected input: %s", input)
		}
		return nil
	})

	_, err := embeddingClient.GetBatchEmbeddings(context.Background(), []string{"first", "second", "third"}, "m", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if callCount != 2 {
		t.Fatalf("expected 2 rpc calls before failure, got %d", callCount)
	}
	if !strings.Contains(err.Error(), "index 1") || !strings.Contains(err.Error(), "error_code=4999") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func assertEmbeddingRPCClientGetEmbeddingError(
	t *testing.T,
	errorCode int,
	message string,
	wantCallCount int,
) {
	t.Helper()

	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, nil)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	callCount := 0
	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		callCount++
		*requireEmbeddingComputeResult(t, out) = client.RPCResultForTest[client.EmbeddingResultForTest]{
			Code:      500,
			Message:   message,
			ErrorCode: errorCode,
		}
		return nil
	})

	_, err := embeddingClient.GetEmbedding(context.Background(), "hello", "text-embedding-3-small", nil)
	if err == nil {
		t.Fatal("expected error")
	}
	if callCount != wantCallCount {
		t.Fatalf("expected %d rpc calls, got %d", wantCallCount, callCount)
	}
	if !strings.Contains(err.Error(), "error_code="+strconv.Itoa(errorCode)) {
		t.Fatalf("unexpected error: %v", err)
	}
}

func requireEmbeddingComputeResult(t *testing.T, out any) *client.RPCResultForTest[client.EmbeddingResultForTest] {
	t.Helper()

	result, ok := out.(*client.RPCResultForTest[client.EmbeddingResultForTest])
	if !ok {
		t.Fatalf("unexpected compute result type %T", out)
	}
	return result
}

func setEmbeddingComputeSuccess(t *testing.T, out any, embedding []float64) {
	t.Helper()

	*requireEmbeddingComputeResult(t, out) = client.RPCResultForTest[client.EmbeddingResultForTest]{
		Code:    0,
		Message: "ok",
		Data: client.EmbeddingResultForTest{
			Data: []client.EmbeddingDataForTest{
				{Index: 0, Embedding: append([]float64(nil), embedding...)},
			},
		},
	}
}

func requireSingleInput(t *testing.T, params map[string]any) string {
	t.Helper()

	input, ok := params["input"].(string)
	if !ok {
		t.Fatalf("expected string input, got %#v", params["input"])
	}
	return input
}

func assertHelloInput(t *testing.T, params map[string]any) {
	t.Helper()

	got := requireSingleInput(t, params)
	if got != "hello" {
		t.Fatalf("input mismatch: got %q want %q", got, "hello")
	}
}
