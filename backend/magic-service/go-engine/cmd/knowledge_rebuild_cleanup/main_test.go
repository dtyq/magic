package main

import (
	"bytes"
	"context"
	"encoding/json"
	"testing"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
)

type cleanupRunnerStub struct {
	lastInput *rebuilddto.CleanupInput
	result    *rebuilddto.CleanupResult
	err       error
}

func (s *cleanupRunnerStub) Cleanup(_ context.Context, input *rebuilddto.CleanupInput) (*rebuilddto.CleanupResult, error) {
	s.lastInput = input
	if s.err != nil {
		return nil, s.err
	}
	return s.result, nil
}

func TestRunWithServiceDryRunOutputsJSON(t *testing.T) {
	t.Parallel()

	runner := &cleanupRunnerStub{
		result: &rebuilddto.CleanupResult{
			Apply:               false,
			ForceDeleteNonEmpty: false,
			CandidatePattern:    "all collections except magic_knowledge / magic_knowledge_active / magic_knowledge_shadow",
			AliasName:           "magic_knowledge",
			SafeToDeleteCollections: []rebuilddto.CleanupCollectionAudit{
				{Name: "magic_knowledge_shadow_r1", Points: 0},
			},
			KeptCollections:  []rebuilddto.CleanupCollectionAudit{{Name: "magic_knowledge_shadow_r2", Points: 3}},
			SkipReason:       map[string]string{"magic_knowledge_shadow_r2": "collection has points"},
			TotalCollections: 7,
		},
	}

	var output bytes.Buffer
	if err := runWithService(context.Background(), runner, false, false, &output); err != nil {
		t.Fatalf("runWithService() error = %v", err)
	}
	if runner.lastInput == nil {
		t.Fatal("expected cleanup input")
	}
	if runner.lastInput.Apply {
		t.Fatal("expected apply=false")
	}
	if runner.lastInput.ForceDeleteNonEmpty {
		t.Fatal("expected force_delete_non_empty=false")
	}

	var got map[string]any
	if err := json.Unmarshal(output.Bytes(), &got); err != nil {
		t.Fatalf("unmarshal output: %v", err)
	}
	if got["apply"] != false {
		t.Fatalf("expected apply=false in output, got %#v", got["apply"])
	}
	if got["total_collections"] != float64(7) {
		t.Fatalf("expected total_collections=7, got %#v", got["total_collections"])
	}
}

func TestRunWithServiceApplyPassesFlagThrough(t *testing.T) {
	t.Parallel()

	runner := &cleanupRunnerStub{
		result: &rebuilddto.CleanupResult{Apply: true, ForceDeleteNonEmpty: true},
	}

	if err := runWithService(context.Background(), runner, true, true, &bytes.Buffer{}); err != nil {
		t.Fatalf("runWithService() error = %v", err)
	}
	if runner.lastInput == nil || !runner.lastInput.Apply || !runner.lastInput.ForceDeleteNonEmpty {
		t.Fatalf("expected apply=true input, got %#v", runner.lastInput)
	}
}
