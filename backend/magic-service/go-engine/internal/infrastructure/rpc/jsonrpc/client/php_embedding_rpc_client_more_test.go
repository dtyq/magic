package client_test

import (
	"context"
	"errors"
	"strings"
	"sync/atomic"
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

func TestPHPEmbeddingRPCClientGetBatchEmbeddingsLimitsConcurrencyToThree(t *testing.T) {
	t.Parallel()

	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, nil)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	inputs := []string{"0", "1", "2", "3", "4"}
	started := make(chan string, len(inputs))
	release := make(chan struct{})
	var current atomic.Int32
	var maxConcurrent atomic.Int32

	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		input, ok := params["input"].(string)
		if !ok {
			t.Fatalf("expected single string input, got %#v", params["input"])
		}

		concurrent := current.Add(1)
		updateMaxInt32(&maxConcurrent, concurrent)
		started <- input
		defer current.Add(-1)

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-release:
		}

		setEmbeddingComputeSuccess(t, out, []float64{float64(input[0] - '0')})
		return nil
	})

	type batchResult struct {
		embeddings [][]float64
		err        error
	}
	resultCh := make(chan batchResult, 1)
	go func() {
		embeddings, err := embeddingClient.GetBatchEmbeddings(context.Background(), inputs, "m", nil)
		resultCh <- batchResult{embeddings: embeddings, err: err}
	}()

	for range 3 {
		<-started
	}
	if got := current.Load(); got != 3 {
		t.Fatalf("expected 3 in-flight rpc calls, got %d", got)
	}

	close(release)

	result := <-resultCh
	if result.err != nil {
		t.Fatalf("GetBatchEmbeddings() error = %v", result.err)
	}
	if got := maxConcurrent.Load(); got != 3 {
		t.Fatalf("expected max concurrency 3, got %d", got)
	}
	if len(result.embeddings) != len(inputs) {
		t.Fatalf("expected %d embeddings, got %d", len(inputs), len(result.embeddings))
	}
	for i := range inputs {
		if len(result.embeddings[i]) != 1 || result.embeddings[i][0] != float64(i) {
			t.Fatalf("embedding at index %d mismatch: %#v", i, result.embeddings)
		}
	}
}

func TestPHPEmbeddingRPCClientGetBatchEmbeddingsPreservesInputOrder(t *testing.T) {
	t.Parallel()

	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, nil)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	inputs := []string{"first", "second", "third"}
	values := map[string]float64{
		"first":  1,
		"second": 2,
		"third":  3,
	}
	releaseByInput := map[string]chan struct{}{
		"first":  make(chan struct{}),
		"second": make(chan struct{}),
		"third":  make(chan struct{}),
	}
	started := make(chan string, len(inputs))

	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		input, ok := params["input"].(string)
		if !ok {
			t.Fatalf("expected single string input, got %#v", params["input"])
		}
		started <- input

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-releaseByInput[input]:
		}

		setEmbeddingComputeSuccess(t, out, []float64{values[input]})
		return nil
	})

	type batchResult struct {
		embeddings [][]float64
		err        error
	}
	resultCh := make(chan batchResult, 1)
	go func() {
		embeddings, err := embeddingClient.GetBatchEmbeddings(context.Background(), inputs, "m", nil)
		resultCh <- batchResult{embeddings: embeddings, err: err}
	}()

	startedInputs := make(map[string]struct{}, len(inputs))
	for range inputs {
		startedInputs[<-started] = struct{}{}
	}
	for _, input := range inputs {
		if _, ok := startedInputs[input]; !ok {
			t.Fatalf("expected input %q to start, got %#v", input, startedInputs)
		}
	}

	close(releaseByInput["third"])
	close(releaseByInput["second"])
	close(releaseByInput["first"])

	result := <-resultCh
	if result.err != nil {
		t.Fatalf("GetBatchEmbeddings() error = %v", result.err)
	}
	if len(result.embeddings) != len(inputs) {
		t.Fatalf("expected %d embeddings, got %d", len(inputs), len(result.embeddings))
	}
	for i, input := range inputs {
		if len(result.embeddings[i]) != 1 || result.embeddings[i][0] != values[input] {
			t.Fatalf("embedding at index %d mismatch: %#v", i, result.embeddings)
		}
	}
}

func TestPHPEmbeddingRPCClientGetBatchEmbeddingsReturnsIndexedErrorAndCancelsPeers(t *testing.T) {
	t.Parallel()

	embeddingClient := client.NewPHPEmbeddingRPCClient(nil, nil, nil)
	embeddingClient.SetClientReadyFuncForTest(func() bool { return true })

	inputs := []string{"first", "second", "third", "fourth"}
	started := make(chan string, 3)
	errorGate := make(chan struct{})
	release := make(chan struct{})
	var canceledCount atomic.Int32

	embeddingClient.SetCallEmbeddingComputeRPCForTest(func(ctx context.Context, server *unixsocket.Server, params map[string]any, out any) error {
		input, ok := params["input"].(string)
		if !ok {
			t.Fatalf("expected single string input, got %#v", params["input"])
		}
		started <- input

		if input == "second" {
			<-errorGate
			*requireEmbeddingComputeResult(t, out) = client.RPCResultForTest[client.EmbeddingResultForTest]{
				Code:      500,
				Message:   "boom",
				ErrorCode: 4999,
			}
			return nil
		}

		select {
		case <-ctx.Done():
			canceledCount.Add(1)
			return ctx.Err()
		case <-release:
		}

		setEmbeddingComputeSuccess(t, out, []float64{1})
		return nil
	})

	errCh := make(chan error, 1)
	go func() {
		_, err := embeddingClient.GetBatchEmbeddings(context.Background(), inputs, "m", nil)
		errCh <- err
	}()

	startedInputs := make(map[string]struct{}, 3)
	for range 3 {
		startedInputs[<-started] = struct{}{}
	}
	for _, input := range []string{"first", "second", "third"} {
		if _, ok := startedInputs[input]; !ok {
			t.Fatalf("expected input %q to start before error, got %#v", input, startedInputs)
		}
	}

	close(errorGate)

	err := <-errCh
	if err == nil {
		t.Fatal("expected error")
	}
	if !strings.Contains(err.Error(), "index 1") || !strings.Contains(err.Error(), "error_code=4999") {
		t.Fatalf("unexpected error: %v", err)
	}
	if got := canceledCount.Load(); got < 2 {
		t.Fatalf("expected at least 2 canceled peer calls, got %d", got)
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
			Data: []client.EmbeddingDataForTest{{Index: 0, Embedding: embedding}},
		},
	}
}

func updateMaxInt32(target *atomic.Int32, candidate int32) {
	for {
		current := target.Load()
		if candidate <= current {
			return
		}
		if target.CompareAndSwap(current, candidate) {
			return
		}
	}
}
