package service_test

import (
	"context"
	"encoding/json"
	"errors"
	"testing"

	embeddto "magic/internal/application/knowledge/embedding/dto"
	embeddingapp "magic/internal/application/knowledge/embedding/service"
	"magic/internal/infrastructure/logging"
	"magic/internal/interfaces/rpc/jsonrpc/knowledge/dto"
	knowledgesvc "magic/internal/interfaces/rpc/jsonrpc/knowledge/service"
	"magic/internal/pkg/ctxmeta"
	jsonrpc "magic/internal/pkg/jsonrpc"
)

var errEmbeddingBoom = embeddingapp.ErrEmbeddingComputeFailed

type mockEmbeddingAppService struct {
	computeResp       *embeddto.ComputeEmbeddingOutput
	computeErr        error
	computeBatchResp  *embeddto.ComputeBatchEmbeddingOutput
	computeBatchErr   error
	listProvidersResp any
	listProvidersErr  error

	lastComputeInput      *embeddto.ComputeEmbeddingInput
	lastComputeBatchInput *embeddto.ComputeBatchEmbeddingInput
	lastBusinessParams    *ctxmeta.BusinessParams
}

func (m *mockEmbeddingAppService) Compute(_ context.Context, input *embeddto.ComputeEmbeddingInput) (*embeddto.ComputeEmbeddingOutput, error) {
	m.lastComputeInput = input
	if m.computeErr != nil {
		return nil, m.computeErr
	}
	if m.computeResp != nil {
		return m.computeResp, nil
	}
	return &embeddto.ComputeEmbeddingOutput{Embedding: []float64{1}}, nil
}

func (m *mockEmbeddingAppService) ComputeBatch(_ context.Context, input *embeddto.ComputeBatchEmbeddingInput) (*embeddto.ComputeBatchEmbeddingOutput, error) {
	m.lastComputeBatchInput = input
	if m.computeBatchErr != nil {
		return nil, m.computeBatchErr
	}
	if m.computeBatchResp != nil {
		return m.computeBatchResp, nil
	}
	return &embeddto.ComputeBatchEmbeddingOutput{Embeddings: [][]float64{{1}}}, nil
}

func (m *mockEmbeddingAppService) ListProviders(_ context.Context, businessParams *ctxmeta.BusinessParams) (any, error) {
	m.lastBusinessParams = businessParams
	if m.listProvidersErr != nil {
		return nil, m.listProvidersErr
	}
	return m.listProvidersResp, nil
}

func TestEmbeddingComputeRPCValidatesText(t *testing.T) {
	t.Parallel()

	handler := knowledgesvc.NewEmbeddingRPCServiceWithDependencies(nil, logging.New())
	wrapped := jsonrpc.WrapTyped(handler.ComputeRPC)
	_, err := wrapped(context.Background(), "svc.knowledge.embedding.compute", json.RawMessage(`{
		"business_params": {"organization_code": "ORG1"}
	}`))
	if err == nil {
		t.Fatal("expected error")
	}

	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) || bizErr.Code != jsonrpc.ErrCodeInvalidParams {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestEmbeddingComputeRPCMapsInput(t *testing.T) {
	t.Parallel()

	appSvc := &mockEmbeddingAppService{
		computeResp: &embeddto.ComputeEmbeddingOutput{Embedding: []float64{0.1}, CacheHit: true},
	}
	handler := knowledgesvc.NewEmbeddingRPCServiceWithDependencies(appSvc, logging.New())

	result, err := handler.ComputeRPC(context.Background(), &dto.ComputeEmbeddingRequest{
		Text:  "hello",
		Model: "m1",
		BusinessParams: dto.BusinessParams{
			OrganizationID: "org-old",
			UserID:         "u1",
			BusinessID:     "b1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if result == nil || !result.CacheHit {
		t.Fatalf("unexpected result: %#v", result)
	}
	if appSvc.lastComputeInput == nil || appSvc.lastComputeInput.Text != "hello" || appSvc.lastComputeInput.Model != "m1" {
		t.Fatalf("unexpected input: %#v", appSvc.lastComputeInput)
	}
	if appSvc.lastComputeInput.BusinessParams == nil || appSvc.lastComputeInput.BusinessParams.OrganizationCode != "org-old" {
		t.Fatalf("unexpected business params: %#v", appSvc.lastComputeInput.BusinessParams)
	}
}

func TestEmbeddingComputeBatchRPC(t *testing.T) {
	t.Parallel()

	appSvc := &mockEmbeddingAppService{
		computeBatchResp: &embeddto.ComputeBatchEmbeddingOutput{
			Embeddings: [][]float64{{1}, {2}},
			CacheStats: embeddto.CacheStats{Total: 2, CacheHit: 1},
		},
	}
	handler := knowledgesvc.NewEmbeddingRPCServiceWithDependencies(appSvc, logging.New())

	result, err := handler.ComputeBatchRPC(context.Background(), &dto.ComputeBatchEmbeddingRequest{
		Texts: []string{"a", "b"},
		Model: "m1",
		BusinessParams: dto.BusinessParams{
			OrganizationCode: "org-1",
			UserID:           "u1",
			BusinessID:       "b1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	if len(result.Embeddings) != 2 {
		t.Fatalf("unexpected result: %#v", result)
	}
	if appSvc.lastComputeBatchInput == nil || len(appSvc.lastComputeBatchInput.Texts) != 2 {
		t.Fatalf("unexpected input: %#v", appSvc.lastComputeBatchInput)
	}
}

func TestEmbeddingComputeBatchRPCValidatesTexts(t *testing.T) {
	t.Parallel()

	handler := knowledgesvc.NewEmbeddingRPCServiceWithDependencies(nil, logging.New())
	wrapped := jsonrpc.WrapTyped(handler.ComputeBatchRPC)
	_, err := wrapped(context.Background(), "svc.knowledge.embedding.computeBatch", json.RawMessage(`{
		"business_params": {"organization_code": "ORG1"}
	}`))
	if err == nil {
		t.Fatal("expected error")
	}
}

func TestEmbeddingRPCMapsBusinessError(t *testing.T) {
	t.Parallel()

	appSvc := &mockEmbeddingAppService{computeErr: errEmbeddingBoom}
	handler := knowledgesvc.NewEmbeddingRPCServiceWithDependencies(appSvc, logging.New())

	_, err := handler.ComputeRPC(context.Background(), &dto.ComputeEmbeddingRequest{Text: "hello"})
	if err == nil {
		t.Fatal("expected error")
	}
	var bizErr *jsonrpc.BusinessError
	if !errors.As(err, &bizErr) || bizErr.Code != jsonrpc.ErrCodeEmbeddingFailed {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestEmbeddingComputeBatchAndListProvidersRPCMapErrors(t *testing.T) {
	t.Parallel()

	appSvc := &mockEmbeddingAppService{
		computeBatchErr:  errEmbeddingBoom,
		listProvidersErr: errEmbeddingBoom,
	}
	handler := knowledgesvc.NewEmbeddingRPCServiceWithDependencies(appSvc, logging.New())

	if _, err := handler.ComputeBatchRPC(context.Background(), &dto.ComputeBatchEmbeddingRequest{
		Texts: []string{"a"},
	}); err == nil {
		t.Fatal("expected compute batch error")
	}
	if _, err := handler.ListProvidersRPC(context.Background(), &dto.ListEmbeddingProvidersRequest{}); err == nil {
		t.Fatal("expected list providers error")
	}
}

func TestEmbeddingListProvidersRPC(t *testing.T) {
	t.Parallel()

	appSvc := &mockEmbeddingAppService{
		listProvidersResp: []map[string]string{{"id": "p1"}},
	}
	handler := knowledgesvc.NewEmbeddingRPCServiceWithDependencies(appSvc, logging.New())

	result, err := handler.ListProvidersRPC(context.Background(), &dto.ListEmbeddingProvidersRequest{
		BusinessParams: dto.BusinessParams{
			OrganizationID: "org-legacy",
			UserID:         "u1",
			BusinessID:     "b1",
		},
	})
	if err != nil {
		t.Fatalf("expected nil error, got %v", err)
	}
	providers, ok := result.([]map[string]string)
	if !ok || len(providers) != 1 || providers[0]["id"] != "p1" {
		t.Fatalf("unexpected providers: %#v", result)
	}
	if appSvc.lastBusinessParams == nil || appSvc.lastBusinessParams.OrganizationCode != "org-legacy" {
		t.Fatalf("unexpected business params: %#v", appSvc.lastBusinessParams)
	}
}

func TestNewEmbeddingRPCService(t *testing.T) {
	t.Parallel()

	appSvc := embeddingapp.NewEmbeddingAppService(nil, logging.New(), "m1")
	handler := knowledgesvc.NewEmbeddingRPCService(appSvc, logging.New())
	if handler == nil {
		t.Fatal("expected non-nil handler")
	}
}
