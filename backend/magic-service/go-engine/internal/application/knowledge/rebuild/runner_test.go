package rebuild_test

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"maps"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"testing/synctest"
	"time"

	apprebuild "magic/internal/application/knowledge/rebuild"
	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/constants"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	domainrebuild "magic/internal/domain/knowledge/rebuild"
	shared "magic/internal/domain/knowledge/shared"
	sharedroute "magic/internal/domain/knowledge/shared/route"
	"magic/internal/infrastructure/logging"
)

var (
	errDeleteFailed     = errors.New("delete failed")
	errMockResyncFailed = errors.New("mock resync failed")
	errListFailed       = errors.New("list failed")
)

const testEmbeddingModel = "text-embedding-3-small"

const testFailureDocumentCode = "DOC1"

type mockStore struct {
	meta        sharedroute.CollectionMeta
	resetStats  domainrebuild.MigrationStats
	updateStats domainrebuild.MigrationStats
	batches     [][]domainrebuild.DocumentTask
	listCalls   int
	listErr     error
	listErrCall int

	resetScopes  []domainrebuild.Scope
	updateScopes []domainrebuild.Scope
	listScopes   []domainrebuild.Scope
	upsertedMeta []sharedroute.CollectionMeta
}

func (m *mockStore) ResetSyncStatus(_ context.Context, scope domainrebuild.Scope) (domainrebuild.MigrationStats, error) {
	m.resetScopes = append(m.resetScopes, scope)
	return m.resetStats, nil
}

func (m *mockStore) UpdateModel(_ context.Context, scope domainrebuild.Scope, _ string) (domainrebuild.MigrationStats, error) {
	m.updateScopes = append(m.updateScopes, scope)
	return m.updateStats, nil
}

func (m *mockStore) GetCollectionMeta(context.Context) (sharedroute.CollectionMeta, error) {
	return m.meta, nil
}

func (m *mockStore) UpsertCollectionMeta(_ context.Context, meta sharedroute.CollectionMeta) error {
	m.upsertedMeta = append(m.upsertedMeta, meta)
	return nil
}

func (m *mockStore) ListDocumentsBatch(_ context.Context, scope domainrebuild.Scope, _ int64, _ int) ([]domainrebuild.DocumentTask, error) {
	m.listScopes = append(m.listScopes, scope)
	if m.listErr != nil && m.listCalls == m.listErrCall {
		m.listCalls++
		return nil, m.listErr
	}
	if m.listCalls >= len(m.batches) {
		return []domainrebuild.DocumentTask{}, nil
	}
	batch := m.batches[m.listCalls]
	m.listCalls++
	return batch, nil
}

type mockCoordinator struct {
	mu                 sync.Mutex
	locked             bool
	currentRun         string
	setCurrentRunCalls int
	refreshLockCalls   int
	jobs               map[string]map[string]any
}

func (m *mockCoordinator) AcquireLock(_ context.Context, _ string, _ time.Duration) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.locked {
		return false, nil
	}
	m.locked = true
	return true, nil
}

func (m *mockCoordinator) ReleaseLock(_ context.Context, _ string) error {
	m.mu.Lock()
	m.locked = false
	m.mu.Unlock()
	return nil
}

func (m *mockCoordinator) SetCurrentRun(_ context.Context, runID string) error {
	m.mu.Lock()
	m.currentRun = runID
	m.setCurrentRunCalls++
	m.mu.Unlock()
	return nil
}

func (m *mockCoordinator) ClearCurrentRun(_ context.Context, runID string) error {
	m.mu.Lock()
	if m.currentRun == runID {
		m.currentRun = ""
	}
	m.mu.Unlock()
	return nil
}

func (m *mockCoordinator) RefreshLock(_ context.Context, _ string, _ time.Duration) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.refreshLockCalls++
	return m.locked, nil
}

func (m *mockCoordinator) SaveJob(_ context.Context, runID string, values map[string]any) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.jobs == nil {
		m.jobs = map[string]map[string]any{}
	}
	cp := map[string]any{}
	maps.Copy(cp, values)
	m.jobs[runID] = cp
	return nil
}

func (m *mockCoordinator) IncrMetric(_ context.Context, _, _ string, _ int64) error {
	return nil
}

type mockCollections struct {
	mu                  sync.Mutex
	info                map[string]int64
	points              map[string]int64
	deleteErr           map[string]error
	deleted             []string
	legacy              map[string]bool
	aliasTarget         map[string]string
	ensuredPayloadSpecs map[string][]shared.PayloadIndexSpec
	payloadSchemaKeys   map[string][]string
}

func (m *mockCollections) CreateCollection(_ context.Context, name string, vectorSize int64) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.info == nil {
		m.info = map[string]int64{}
	}
	if m.points == nil {
		m.points = map[string]int64{}
	}
	m.info[name] = vectorSize
	m.points[name] = 0
	return nil
}

func (m *mockCollections) CollectionExists(_ context.Context, name string) (bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	_, ok := m.info[name]
	return ok, nil
}

func (m *mockCollections) GetCollectionInfo(_ context.Context, name string) (*domainrebuild.VectorCollectionInfo, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	size, ok := m.info[name]
	if !ok {
		return &domainrebuild.VectorCollectionInfo{Name: name, VectorSize: 0}, nil
	}
	legacy := m.legacy[name]
	points, ok := m.points[name]
	if !ok {
		points = 1
	}
	return &domainrebuild.VectorCollectionInfo{
		Name:                name,
		VectorSize:          size,
		Points:              points,
		HasNamedDenseVector: !legacy,
		HasSparseVector:     !legacy,
		PayloadSchemaKeys:   append([]string(nil), m.payloadSchemaKeys[name]...),
	}, nil
}

func (m *mockCollections) EnsurePayloadIndexes(_ context.Context, name string, specs []shared.PayloadIndexSpec) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.ensuredPayloadSpecs == nil {
		m.ensuredPayloadSpecs = map[string][]shared.PayloadIndexSpec{}
	}
	if m.payloadSchemaKeys == nil {
		m.payloadSchemaKeys = map[string][]string{}
	}
	clonedSpecs := append([]shared.PayloadIndexSpec(nil), specs...)
	m.ensuredPayloadSpecs[name] = clonedSpecs
	keys := make([]string, 0, len(clonedSpecs))
	for _, spec := range clonedSpecs {
		keys = append(keys, spec.FieldName)
	}
	m.payloadSchemaKeys[name] = keys
	return nil
}

func (m *mockCollections) GetAliasTarget(_ context.Context, alias string) (string, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	target, ok := m.aliasTarget[alias]
	return target, ok, nil
}

func (m *mockCollections) EnsureAlias(_ context.Context, alias, target string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.aliasTarget == nil {
		m.aliasTarget = map[string]string{}
	}
	m.aliasTarget[alias] = target
	return nil
}

func (m *mockCollections) SwapAliasAtomically(_ context.Context, alias, oldTarget, newTarget string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	_ = oldTarget
	if m.aliasTarget == nil {
		m.aliasTarget = map[string]string{}
	}
	m.aliasTarget[alias] = newTarget
	return nil
}

func (m *mockCollections) DeleteAlias(_ context.Context, alias string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.aliasTarget, alias)
	return nil
}

func (m *mockCollections) ListCollections(_ context.Context) ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	collections := make([]string, 0, len(m.info))
	for name := range m.info {
		collections = append(collections, name)
	}
	return collections, nil
}

func (m *mockCollections) DeleteCollection(_ context.Context, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if err := m.deleteErr[name]; err != nil {
		return err
	}
	m.deleted = append(m.deleted, name)
	delete(m.info, name)
	delete(m.points, name)
	return nil
}

func (m *mockCollections) DeletePointsByFilter(_ context.Context, name string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if m.points == nil {
		m.points = map[string]int64{}
	}
	if _, exists := m.info[name]; exists {
		m.points[name] = 0
	}
	return nil
}

type mockResyncer struct {
	mu          sync.Mutex
	tasks       []domainrebuild.DocumentTask
	errByDoc    map[string]error
	onResync    func(task domainrebuild.DocumentTask) error
	collections *mockCollections
}

func (m *mockResyncer) Resync(_ context.Context, task domainrebuild.DocumentTask) error {
	if m.onResync != nil {
		if err := m.onResync(task); err != nil {
			return err
		}
	}
	if err, ok := m.errByDoc[task.DocumentCode]; ok {
		return err
	}
	if m.collections != nil {
		m.collections.mu.Lock()
		if m.collections.points == nil {
			m.collections.points = map[string]int64{}
		}
		m.collections.points[task.TargetCollection] = 1
		if m.collections.info == nil {
			m.collections.info = map[string]int64{}
		}
		if _, exists := m.collections.info[task.TargetCollection]; !exists {
			m.collections.info[task.TargetCollection] = 1
		}
		m.collections.mu.Unlock()
	}
	m.mu.Lock()
	m.tasks = append(m.tasks, task)
	m.mu.Unlock()
	return nil
}

type mockDimensionResolver struct {
	dimension int64
	err       error
}

func (m *mockDimensionResolver) ResolveDimension(context.Context, string) (int64, error) {
	if m.err != nil {
		return 0, m.err
	}
	return m.dimension, nil
}

func newRunnerForTest(
	store *mockStore,
	coordinator *mockCoordinator,
	collections *mockCollections,
	resyncer *mockResyncer,
	resolver *mockDimensionResolver,
) *apprebuild.Runner {
	if resyncer != nil {
		resyncer.collections = collections
	}
	return apprebuild.NewRunner(store, coordinator, collections, resyncer, resolver, apprebuild.RunnerConfig{
		Logger:         logging.New(),
		IsLocalDev:     false,
		MaxConcurrency: 8,
	})
}

func captureJSONLogger(t *testing.T) (*logging.SugaredLogger, func() string) {
	t.Helper()

	reader, writer, err := os.Pipe()
	if err != nil {
		t.Fatalf("os.Pipe(): %v", err)
	}

	logger := logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
		Level:  autoloadcfg.LogLevel("debug"),
		Format: autoloadcfg.LogFormatJSON,
	}, writer)

	var (
		once   sync.Once
		output string
	)
	return logger, func() string {
		t.Helper()
		once.Do(func() {
			_ = writer.Close()
			data, readErr := io.ReadAll(reader)
			if readErr != nil {
				t.Fatalf("io.ReadAll(): %v", readErr)
			}
			_ = reader.Close()
			output = string(data)
		})
		return output
	}
}

func parseJSONLogRecords(t *testing.T, output string) []map[string]any {
	t.Helper()

	lines := strings.Split(strings.TrimSpace(output), "\n")
	records := make([]map[string]any, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		record := map[string]any{}
		if err := json.Unmarshal([]byte(line), &record); err != nil {
			t.Fatalf("json.Unmarshal(%q): %v", line, err)
		}
		records = append(records, record)
	}
	return records
}

func findLogRecordByMessage(records []map[string]any, message string) map[string]any {
	prefixedMessage := logging.PrefixEngineException(message)
	for _, record := range records {
		if msg, _ := record["msg"].(string); msg == message || msg == prefixedMessage {
			return record
		}
	}
	return nil
}

func TestRunnerAutoSelectInplaceByMetaModel(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         constants.KnowledgeBaseCollectionName,
			PhysicalCollectionName: apprebuild.FixedActiveCollectionForTest,
			Model:                  testEmbeddingModel,
			SparseBackend:          fragmodel.SparseBackendQdrantBM25ZHV1,
			VectorDimension:        1536,
		},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: testFailureDocumentCode}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{apprebuild.FixedActiveCollectionForTest: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 1536})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:        rebuilddto.ModeAuto,
		TargetModel: testEmbeddingModel,
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.SelectedMode != rebuilddto.ModeInplace {
		t.Fatalf("expected inplace mode, got %s", result.SelectedMode)
	}
	if len(resyncer.tasks) != 1 {
		t.Fatalf("expected one resync task, got %d", len(resyncer.tasks))
	}
	if resyncer.tasks[0].TargetCollection != constants.KnowledgeBaseCollectionName {
		t.Fatalf("unexpected target collection: %+v", resyncer.tasks[0])
	}
	if resyncer.tasks[0].TargetModel != testEmbeddingModel {
		t.Fatalf("unexpected target model: %+v", resyncer.tasks[0])
	}
	if len(store.resetScopes) != 1 || store.resetScopes[0].Mode != domainrebuild.ScopeModeAll {
		t.Fatalf("expected reset scope all, got %#v", store.resetScopes)
	}
	if len(store.updateScopes) != 1 || store.updateScopes[0].Mode != domainrebuild.ScopeModeAll {
		t.Fatalf("expected scoped model update for all scope, got %#v", store.updateScopes)
	}
	if len(store.upsertedMeta) != 1 || store.upsertedMeta[0].Model != testEmbeddingModel {
		t.Fatalf("unexpected upserted meta: %#v", store.upsertedMeta)
	}
	if len(collections.ensuredPayloadSpecs[apprebuild.FixedActiveCollectionForTest]) == 0 {
		t.Fatalf("expected inplace active collection to ensure payload indexes, got %#v", collections.ensuredPayloadSpecs)
	}
	if result.LegacyPhysicalCollectionDetected {
		t.Fatalf("expected fixed physical collection not to be treated as legacy, got %+v", result)
	}
}

func TestRunnerAutoUsesCollectionMetaModelWhenTargetModelOmitted(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         constants.KnowledgeBaseCollectionName,
			PhysicalCollectionName: apprebuild.FixedActiveCollectionForTest,
			Model:                  testEmbeddingModel,
			SparseBackend:          fragmodel.SparseBackendQdrantBM25ZHV1,
			VectorDimension:        1536,
		},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{apprebuild.FixedActiveCollectionForTest: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 1536})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:        rebuilddto.ModeAuto,
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.SelectedMode != rebuilddto.ModeInplace {
		t.Fatalf("expected inplace mode, got %s", result.SelectedMode)
	}
	if result.TargetModel != testEmbeddingModel {
		t.Fatalf("expected target model from collection meta, got %q", result.TargetModel)
	}
	if len(resyncer.tasks) != 1 || resyncer.tasks[0].TargetModel != testEmbeddingModel {
		t.Fatalf("expected resync task to inherit collection meta model, got %#v", resyncer.tasks)
	}
}

func TestRunnerInplaceRequestNormalizesLegacyPhysicalCollection(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         constants.KnowledgeBaseCollectionName,
			PhysicalCollectionName: "magic_knowledge_r_legacy",
			Model:                  testEmbeddingModel,
			VectorDimension:        1536,
		},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{
		info: map[string]int64{
			"magic_knowledge_r_legacy":              1536,
			apprebuild.FixedActiveCollectionForTest: 1536,
			apprebuild.FixedShadowCollectionForTest: 1536,
		},
	}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 1536})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:        rebuilddto.ModeInplace,
		TargetModel: testEmbeddingModel,
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.SelectedMode != rebuilddto.ModeBlueGreen {
		t.Fatalf("expected legacy physical collection to force bluegreen, got %s", result.SelectedMode)
	}
	if !result.LegacyPhysicalCollectionDetected {
		t.Fatalf("expected legacy physical collection detected, got %+v", result)
	}
	if !result.PhysicalNameNormalized {
		t.Fatalf("expected physical name normalized after successful cutover, got %+v", result)
	}
	if result.PreviousCollection != "magic_knowledge_r_legacy" {
		t.Fatalf("expected previous legacy physical collection, got %+v", result)
	}
	if result.ActivePhysicalCollection != apprebuild.FixedActiveCollectionForTest {
		t.Fatalf("expected fixed active collection after normalization, got %+v", result)
	}
	if result.TargetPhysicalCollection != apprebuild.FixedActiveCollectionForTest {
		t.Fatalf("expected target physical collection fixed active, got %+v", result)
	}
	if result.StandbyCollection != apprebuild.FixedShadowCollectionForTest {
		t.Fatalf("expected fixed shadow standby collection, got %+v", result)
	}
	if len(store.upsertedMeta) != 1 || store.upsertedMeta[0].PhysicalCollectionName != apprebuild.FixedActiveCollectionForTest {
		t.Fatalf("expected collection meta normalized to fixed active slot, got %#v", store.upsertedMeta)
	}
}

func TestRunnerAutoSelectBlueGreenWhenActiveCollectionSchemaLegacy(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{
		info:   map[string]int64{constants.KnowledgeBaseCollectionName: 1536},
		legacy: map[string]bool{constants.KnowledgeBaseCollectionName: true},
	}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 1536})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:        rebuilddto.ModeAuto,
		TargetModel: testEmbeddingModel,
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.SelectedMode != rebuilddto.ModeBlueGreen {
		t.Fatalf("expected bluegreen mode, got %s", result.SelectedMode)
	}
	if result.ActiveCollection != constants.KnowledgeBaseCollectionName {
		t.Fatalf("expected fixed active alias, got %s", result.ActiveCollection)
	}
	if result.ShadowCollection != apprebuild.FixedActiveCollectionForTest {
		t.Fatalf("expected migrated target collection %q, got %s", apprebuild.FixedActiveCollectionForTest, result.ShadowCollection)
	}
	if len(store.upsertedMeta) != 1 ||
		store.upsertedMeta[0].CollectionName != result.ActiveCollection ||
		store.upsertedMeta[0].PhysicalCollectionName != result.ShadowCollection {
		t.Fatalf("unexpected upserted meta: %#v", store.upsertedMeta)
	}
	if result.StandbyCollection != apprebuild.FixedShadowCollectionForTest {
		t.Fatalf("expected fixed standby collection %q, got %+v", apprebuild.FixedShadowCollectionForTest, result)
	}
	if !result.LegacyPhysicalCollectionDetected || !result.PhysicalNameNormalized {
		t.Fatalf("expected legacy physical collection normalization flags, got %+v", result)
	}
}

func TestRunnerAutoSelectBlueGreenDeleteFailureKeepsSuccess(t *testing.T) {
	t.Parallel()
	const active = "magic_knowledge_v1"
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: active, Model: testEmbeddingModel, VectorDimension: 1536},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{
		info:      map[string]int64{active: 1536},
		deleteErr: map[string]error{active: errDeleteFailed},
	}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:            rebuilddto.ModeAuto,
		TargetModel:     "text-embedding-3-large",
		TargetDimension: 3072,
		Concurrency:     1,
		BatchSize:       10,
		Retry:           0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.SelectedMode != rebuilddto.ModeBlueGreen {
		t.Fatalf("expected bluegreen mode, got %s", result.SelectedMode)
	}
	if result.ActiveCollection != constants.KnowledgeBaseCollectionName {
		t.Fatalf("expected fixed active alias, got %s", result.ActiveCollection)
	}
	if result.ShadowCollection != apprebuild.FixedActiveCollectionForTest {
		t.Fatalf("unexpected bluegreen target collection: %s", result.ShadowCollection)
	}
	if result.DeletePreviousCollectionWarning == "" {
		t.Fatalf("expected delete warning, got %+v", result)
	}
	if len(store.upsertedMeta) != 1 ||
		store.upsertedMeta[0].CollectionName != result.ActiveCollection ||
		store.upsertedMeta[0].PhysicalCollectionName != result.ShadowCollection {
		t.Fatalf("unexpected upserted meta: %#v", store.upsertedMeta)
	}
	if result.StandbyCollection != apprebuild.FixedShadowCollectionForTest {
		t.Fatalf("expected fixed standby collection %q, got %+v", apprebuild.FixedShadowCollectionForTest, result)
	}
}

func TestRunnerInplaceDeletesLegacyLogicalCollectionBeforeEnsuringAlias(t *testing.T) {
	t.Parallel()

	store := &mockStore{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         constants.KnowledgeBaseCollectionName,
			PhysicalCollectionName: apprebuild.FixedActiveCollectionForTest,
			Model:                  testEmbeddingModel,
			VectorDimension:        1536,
		},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{
		info: map[string]int64{
			constants.KnowledgeBaseCollectionName:   1536,
			apprebuild.FixedActiveCollectionForTest: 1536,
			apprebuild.FixedShadowCollectionForTest: 1536,
		},
	}
	resyncer := &mockResyncer{collections: collections}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 1536})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:        rebuilddto.ModeAuto,
		TargetModel: testEmbeddingModel,
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.SelectedMode != rebuilddto.ModeInplace {
		t.Fatalf("expected inplace mode, got %s", result.SelectedMode)
	}
	if got := collections.aliasTarget[constants.KnowledgeBaseCollectionName]; got != apprebuild.FixedActiveCollectionForTest {
		t.Fatalf("expected logical alias to target fixed active collection, got %q", got)
	}
	if len(collections.deleted) == 0 || collections.deleted[0] != constants.KnowledgeBaseCollectionName {
		t.Fatalf("expected legacy logical collection delete before alias creation, deleted=%#v", collections.deleted)
	}
}

func TestRunnerBlueGreenUsesRequestTargetModelInsteadOfDocumentHistoryModel(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1", EmbeddingModel: testEmbeddingModel}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:        rebuilddto.ModeAuto,
		TargetModel: "text-embedding-3-large",
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.SelectedMode != rebuilddto.ModeBlueGreen {
		t.Fatalf("expected bluegreen mode, got %s", result.SelectedMode)
	}
	if len(resyncer.tasks) != 1 {
		t.Fatalf("expected one resync task, got %d", len(resyncer.tasks))
	}
	if resyncer.tasks[0].TargetModel != "text-embedding-3-large" {
		t.Fatalf("expected request target model to win, got %+v", resyncer.tasks[0])
	}
	if len(store.updateScopes) != 1 || store.updateScopes[0].Mode != domainrebuild.ScopeModeAll {
		t.Fatalf("expected scoped model metadata update after rebuild, got %#v", store.updateScopes)
	}
}

func TestRunnerBootstrapEscalatesOrganizationScope(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 1536})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Scope: rebuilddto.Scope{
			Mode:             rebuilddto.ScopeModeOrganization,
			OrganizationCode: "ORG1",
		},
		Mode:            rebuilddto.ModeAuto,
		TargetModel:     testEmbeddingModel,
		TargetDimension: 1536,
		Concurrency:     1,
		BatchSize:       10,
		Retry:           0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if !result.Bootstrap {
		t.Fatalf("expected bootstrap run, got %+v", result)
	}
	if result.RequestedScopeMode != rebuilddto.ScopeModeOrganization {
		t.Fatalf("expected requested organization scope, got %+v", result)
	}
	if result.ScopeMode != rebuilddto.ScopeModeAll {
		t.Fatalf("expected effective all scope, got %+v", result)
	}
	if !result.ScopeEscalated || result.ScopeEscalationReason != "bootstrap" {
		t.Fatalf("expected bootstrap scope escalation, got %+v", result)
	}
	if len(store.listScopes) == 0 || store.listScopes[0].Mode != domainrebuild.ScopeModeAll {
		t.Fatalf("expected list scope all, got %#v", store.listScopes)
	}
	if len(store.updateScopes) != 1 || store.updateScopes[0].Mode != domainrebuild.ScopeModeAll {
		t.Fatalf("expected scoped model update for escalated all scope, got %#v", store.updateScopes)
	}
	if len(resyncer.tasks) != 1 {
		t.Fatalf("expected one resync task, got %d", len(resyncer.tasks))
	}
	if resyncer.tasks[0].TargetCollection != apprebuild.FixedShadowCollectionForTest {
		t.Fatalf("unexpected bootstrap target collection: %+v", resyncer.tasks[0])
	}
}

func TestRunnerInplaceRejectsTargetDimensionMismatch(t *testing.T) {
	t.Parallel()
	store := &mockStore{meta: sharedroute.CollectionMeta{
		Exists:                 true,
		CollectionName:         constants.KnowledgeBaseCollectionName,
		PhysicalCollectionName: apprebuild.FixedActiveCollectionForTest,
		Model:                  testEmbeddingModel,
		SparseBackend:          fragmodel.SparseBackendQdrantBM25ZHV1,
		VectorDimension:        1536,
	}}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{apprebuild.FixedActiveCollectionForTest: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	_, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:            rebuilddto.ModeInplace,
		TargetModel:     testEmbeddingModel,
		TargetDimension: 3072,
	})
	if err == nil {
		t.Fatal("expected mismatch error, got nil")
	}
	if !errors.Is(err, apprebuild.ErrInplaceModeMismatchForTest) {
		t.Fatalf("expected inplace mismatch error, got %v", err)
	}
}

func TestRunnerBlueGreenResolvesDimensionWhenTargetDimensionMissing(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:        rebuilddto.ModeBlueGreen,
		TargetModel: "text-embedding-3-large",
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.TargetDimension != 3072 {
		t.Fatalf("expected resolved target dimension 3072, got %d", result.TargetDimension)
	}
	if collections.info[result.ShadowCollection] != 3072 {
		t.Fatalf("expected target collection dimension 3072, got map %#v", collections.info)
	}
	if len(collections.ensuredPayloadSpecs[result.ShadowCollection]) == 0 {
		t.Fatalf("expected bluegreen shadow collection to ensure payload indexes, got %#v", collections.ensuredPayloadSpecs)
	}
}

func TestRunnerBlueGreenRotatesBackToFixedActiveWhenAliasCurrentlyUsesShadow(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{
			Exists:                 true,
			CollectionName:         constants.KnowledgeBaseCollectionName,
			PhysicalCollectionName: apprebuild.FixedShadowCollectionForTest,
			Model:                  testEmbeddingModel,
			VectorDimension:        1536,
		},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{
		info: map[string]int64{
			apprebuild.FixedShadowCollectionForTest: 1536,
			apprebuild.FixedActiveCollectionForTest: 1536,
		},
		aliasTarget: map[string]string{
			constants.KnowledgeBaseCollectionName: apprebuild.FixedShadowCollectionForTest,
		},
	}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:        rebuilddto.ModeBlueGreen,
		TargetModel: "text-embedding-3-large",
		BatchSize:   10,
		Concurrency: 1,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.ShadowCollection != apprebuild.FixedActiveCollectionForTest {
		t.Fatalf("expected target fixed active slot, got %+v", result)
	}
	if result.ActivePhysicalCollection != apprebuild.FixedActiveCollectionForTest {
		t.Fatalf("expected active physical collection switched to fixed active slot, got %+v", result)
	}
	if result.StandbyCollection != apprebuild.FixedShadowCollectionForTest {
		t.Fatalf("expected standby slot reset to fixed shadow, got %+v", result)
	}
}

func TestRunnerBlueGreenOrganizationScopeAllowsPartialFailures(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
		batches: [][]domainrebuild.DocumentTask{
			{
				{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"},
				{ID: 2, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC2"},
			},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{
		errByDoc: map[string]error{
			"DOC2": errMockResyncFailed,
		},
	}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Scope: rebuilddto.Scope{
			Mode:             rebuilddto.ScopeModeOrganization,
			OrganizationCode: "ORG1",
		},
		Mode:        rebuilddto.ModeBlueGreen,
		TargetModel: "text-embedding-3-large",
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.FailedDocs != 1 || result.SuccessDocs != 1 {
		t.Fatalf("expected partial failure 1/1, got success=%d failed=%d", result.SuccessDocs, result.FailedDocs)
	}
	if result.ActiveCollection != constants.KnowledgeBaseCollectionName {
		t.Fatalf("expected fixed active alias, got %s", result.ActiveCollection)
	}
	if result.ShadowCollection != apprebuild.FixedActiveCollectionForTest {
		t.Fatalf("expected shadow collection, got %+v", result)
	}
}

func TestRunnerLogsFinalDocumentFailuresAndWritesFailureReportInLocalDev(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
		batches: [][]domainrebuild.DocumentTask{
			{
				{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"},
				{ID: 2, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC2"},
			},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{
		errByDoc: map[string]error{
			testFailureDocumentCode: errMockResyncFailed,
		},
	}
	resyncer.collections = collections
	logger, readLogs := captureJSONLogger(t)
	defer readLogs()
	runner := apprebuild.NewRunner(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072}, apprebuild.RunnerConfig{
		Logger:     logger,
		IsLocalDev: true,
	})
	reportPath := filepath.Join(t.TempDir(), "failures.json")

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Scope: rebuilddto.Scope{
			Mode:             rebuilddto.ScopeModeOrganization,
			OrganizationCode: "ORG1",
		},
		Mode:          rebuilddto.ModeBlueGreen,
		TargetModel:   "text-embedding-3-large",
		Concurrency:   1,
		BatchSize:     10,
		Retry:         2,
		FailureReport: reportPath,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.FailureReport != reportPath {
		t.Fatalf("expected failure report %q, got %q", reportPath, result.FailureReport)
	}

	data, readErr := os.ReadFile(reportPath)
	if readErr != nil {
		t.Fatalf("read failure report: %v", readErr)
	}
	var failures []rebuilddto.FailureRecord
	if unmarshalErr := json.Unmarshal(data, &failures); unmarshalErr != nil {
		t.Fatalf("json.Unmarshal(failure report): %v", unmarshalErr)
	}
	if len(failures) != 1 {
		t.Fatalf("expected one failure record, got %#v", failures)
	}
	if failures[0].Attempts != 3 {
		t.Fatalf("expected 3 attempts in failure report, got %+v", failures[0])
	}

	record := findLogRecordByMessage(parseJSONLogRecords(t, readLogs()), "Knowledge rebuild document resync failed")
	if record == nil {
		t.Fatal("expected document failure error log")
	}
	if record["run_id"] != result.RunID || record["document_code"] != testFailureDocumentCode || record["target_model"] != "text-embedding-3-large" {
		t.Fatalf("unexpected failure log fields: %#v", record)
	}
	if got, _ := record["attempts"].(float64); got != 3 {
		t.Fatalf("expected attempts=3 in failure log, got %#v", record["attempts"])
	}
	if errText, _ := record["error"].(string); !strings.Contains(errText, errMockResyncFailed.Error()) {
		t.Fatalf("expected error log to contain %q, got %#v", errMockResyncFailed.Error(), record["error"])
	}
}

func TestRunnerDoesNotWriteFailureReportOutsideLocalDev(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
		batches: [][]domainrebuild.DocumentTask{
			{
				{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: testFailureDocumentCode},
				{ID: 2, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC2"},
			},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{
		errByDoc: map[string]error{
			testFailureDocumentCode: errMockResyncFailed,
		},
	}
	resyncer.collections = collections
	logger, readLogs := captureJSONLogger(t)
	defer readLogs()
	runner := apprebuild.NewRunner(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072}, apprebuild.RunnerConfig{
		Logger:     logger,
		IsLocalDev: false,
	})
	reportPath := filepath.Join(t.TempDir(), "failures.json")

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Scope: rebuilddto.Scope{
			Mode:             rebuilddto.ScopeModeOrganization,
			OrganizationCode: "ORG1",
		},
		Mode:          rebuilddto.ModeBlueGreen,
		TargetModel:   "text-embedding-3-large",
		Concurrency:   1,
		BatchSize:     10,
		Retry:         0,
		FailureReport: reportPath,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.FailureReport != "" {
		t.Fatalf("expected empty failure report outside local dev, got %q", result.FailureReport)
	}
	if _, statErr := os.Stat(reportPath); !errors.Is(statErr, os.ErrNotExist) {
		t.Fatalf("expected no failure report file outside local dev, stat err=%v", statErr)
	}

	record := findLogRecordByMessage(parseJSONLogRecords(t, readLogs()), "Knowledge rebuild document resync failed")
	if record == nil {
		t.Fatal("expected document failure error log outside local dev")
	}
}

func TestRunnerBlueGreenAllScopeBlocksCutoverOnDocumentFailures(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
		batches: [][]domainrebuild.DocumentTask{
			{{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: testFailureDocumentCode}},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{
		errByDoc: map[string]error{
			testFailureDocumentCode: errMockResyncFailed,
		},
	}
	logger, readLogs := captureJSONLogger(t)
	defer readLogs()
	runner := apprebuild.NewRunner(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072}, apprebuild.RunnerConfig{
		Logger:     logger,
		IsLocalDev: false,
	})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Mode:        rebuilddto.ModeBlueGreen,
		TargetModel: "text-embedding-3-large",
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err == nil {
		t.Fatal("expected run failed on all-scope partial failure")
	}
	if !errors.Is(err, apprebuild.ErrResyncFailuresBlockCutoverForTest) {
		t.Fatalf("expected resync failure block error, got %v", err)
	}
	if result == nil {
		t.Fatal("expected partial result on all-scope failure")
	}
	if result.FailureReport != "" {
		t.Fatalf("expected empty failure report outside local dev, got %q", result.FailureReport)
	}
	record := findLogRecordByMessage(parseJSONLogRecords(t, readLogs()), "Knowledge rebuild document resync failed")
	if record == nil {
		t.Fatal("expected document failure error log on all-scope failure")
	}
	if record["document_code"] != testFailureDocumentCode {
		t.Fatalf("unexpected all-scope failure log fields: %#v", record)
	}
}

func TestRunnerDocumentScopeWithoutDocumentsFails(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	_, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Scope: rebuilddto.Scope{
			Mode:              rebuilddto.ScopeModeDocument,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB1",
			DocumentCode:      "DOC1",
		},
		Mode:        rebuilddto.ModeBlueGreen,
		TargetModel: "text-embedding-3-large",
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err == nil {
		t.Fatal("expected no-document error")
	}
	if !errors.Is(err, apprebuild.ErrDocumentScopeNoDocumentsForTest) {
		t.Fatalf("expected document no-documents error, got %v", err)
	}
}

func TestRunnerKnowledgeBaseScopeWithoutDocumentsFails(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	_, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Scope: rebuilddto.Scope{
			Mode:              rebuilddto.ScopeModeKnowledgeBase,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB1",
		},
		Mode:        rebuilddto.ModeBlueGreen,
		TargetModel: "text-embedding-3-large",
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err == nil {
		t.Fatal("expected no-document error")
	}
	if !errors.Is(err, apprebuild.ErrKnowledgeBaseScopeNoDocumentsForTest) {
		t.Fatalf("expected knowledge_base no-documents error, got %v", err)
	}
}

func TestRunnerKnowledgeBaseScopeResyncsAllKnowledgeBaseDocuments(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
		batches: [][]domainrebuild.DocumentTask{
			{
				{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"},
				{ID: 2, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC2"},
			},
		},
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	result, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Scope: rebuilddto.Scope{
			Mode:              rebuilddto.ScopeModeKnowledgeBase,
			OrganizationCode:  "ORG1",
			KnowledgeBaseCode: "KB1",
		},
		Mode:        rebuilddto.ModeBlueGreen,
		TargetModel: "text-embedding-3-large",
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err != nil {
		t.Fatalf("run rebuild: %v", err)
	}
	if result.TotalDocs != 2 || result.SuccessDocs != 2 {
		t.Fatalf("expected resynced 2 docs successfully, got %+v", result)
	}
	if len(store.listScopes) == 0 || store.listScopes[0].Mode != domainrebuild.ScopeModeKnowledgeBase {
		t.Fatalf("expected knowledge_base list scope, got %#v", store.listScopes)
	}
	if len(resyncer.tasks) != 2 {
		t.Fatalf("expected two resync tasks, got %d", len(resyncer.tasks))
	}
	for _, task := range resyncer.tasks {
		if task.KnowledgeBaseCode != "KB1" {
			t.Fatalf("unexpected task: %+v", task)
		}
	}
}

func TestRunnerResyncListErrorAlwaysBlocksCutover(t *testing.T) {
	t.Parallel()
	store := &mockStore{
		meta:        sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
		listErr:     errListFailed,
		listErrCall: 0,
	}
	coordinator := &mockCoordinator{}
	collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
	resyncer := &mockResyncer{}
	runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

	_, err := runner.Run(context.Background(), rebuilddto.RunOptions{
		Scope: rebuilddto.Scope{
			Mode:             rebuilddto.ScopeModeOrganization,
			OrganizationCode: "ORG1",
		},
		Mode:        rebuilddto.ModeBlueGreen,
		TargetModel: "text-embedding-3-large",
		Concurrency: 1,
		BatchSize:   10,
		Retry:       0,
	})
	if err == nil {
		t.Fatal("expected list error to block cutover")
	}
	if !strings.Contains(err.Error(), "list documents batch") {
		t.Fatalf("expected list documents batch error, got %v", err)
	}
}

func TestRunnerAllowsSameKnowledgeBaseAcrossWorkers(t *testing.T) {
	t.Parallel()
	synctest.Test(t, func(t *testing.T) {
		store := &mockStore{
			meta: sharedroute.CollectionMeta{Exists: true, CollectionName: constants.KnowledgeBaseCollectionName, Model: testEmbeddingModel, VectorDimension: 1536},
			batches: [][]domainrebuild.DocumentTask{
				{
					{ID: 1, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC1"},
					{ID: 2, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB1", DocumentCode: "DOC2"},
					{ID: 3, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB2", DocumentCode: "DOC3"},
					{ID: 4, OrganizationCode: "ORG1", KnowledgeBaseCode: "KB2", DocumentCode: "DOC4"},
				},
			},
		}
		coordinator := &mockCoordinator{}
		collections := &mockCollections{info: map[string]int64{constants.KnowledgeBaseCollectionName: 1536}}
		probe := newDocumentConcurrencyProbe()
		resyncer := &mockResyncer{onResync: probe.onResync}
		runner := newRunnerForTest(store, coordinator, collections, resyncer, &mockDimensionResolver{dimension: 3072})

		errCh := make(chan error, 1)
		go func() {
			_, err := runner.Run(context.Background(), rebuilddto.RunOptions{
				Mode:        rebuilddto.ModeBlueGreen,
				TargetModel: "text-embedding-3-large",
				Concurrency: 4,
				BatchSize:   10,
				Retry:       0,
			})
			errCh <- err
		}()

		first := <-probe.started
		second := <-probe.started
		if first == second {
			t.Fatalf("expected different knowledge bases to overlap, got %s and %s", first, second)
		}
		close(probe.release)

		if err := <-errCh; err != nil {
			t.Fatalf("run rebuild: %v", err)
		}
		if !probe.hasSameKnowledgeBaseOverlap() {
			t.Fatalf("expected same knowledge base to overlap, got %#v", probe.maxPerKB)
		}
		if probe.maxOverall < 2 {
			t.Fatalf("expected different knowledge bases to run in parallel, got %d", probe.maxOverall)
		}
		if probe.maxOverall > 4 {
			t.Fatalf("expected overall concurrency not to exceed worker count, got %d", probe.maxOverall)
		}
	})
}

type documentConcurrencyProbe struct {
	mu         sync.Mutex
	inflight   map[string]int
	maxPerKB   map[string]int
	totalRun   int
	maxOverall int
	started    chan string
	release    chan struct{}
}

func newDocumentConcurrencyProbe() *documentConcurrencyProbe {
	return &documentConcurrencyProbe{
		inflight: map[string]int{},
		maxPerKB: map[string]int{},
		started:  make(chan string, 2),
		release:  make(chan struct{}),
	}
}

func (p *documentConcurrencyProbe) hasSameKnowledgeBaseOverlap() bool {
	p.mu.Lock()
	defer p.mu.Unlock()

	for _, maxConcurrent := range p.maxPerKB {
		if maxConcurrent >= 2 {
			return true
		}
	}
	return false
}

func (p *documentConcurrencyProbe) onResync(task domainrebuild.DocumentTask) error {
	kb := task.KnowledgeBaseCode
	p.mu.Lock()
	p.inflight[kb]++
	if p.inflight[kb] > p.maxPerKB[kb] {
		p.maxPerKB[kb] = p.inflight[kb]
	}
	p.totalRun++
	if p.totalRun > p.maxOverall {
		p.maxOverall = p.totalRun
	}
	p.mu.Unlock()

	switch task.DocumentCode {
	case "DOC1", "DOC3":
		p.started <- task.DocumentCode
		<-p.release
	default:
		time.Sleep(10 * time.Millisecond)
	}

	p.mu.Lock()
	p.inflight[kb]--
	p.totalRun--
	p.mu.Unlock()
	return nil
}
