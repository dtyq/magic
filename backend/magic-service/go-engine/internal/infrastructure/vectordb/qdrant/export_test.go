package qdrant

import (
	"context"
	"io"
	"log/slog"
	"net/http"
	"time"

	pb "github.com/qdrant/go-client/qdrant"

	autoloadcfg "magic/internal/config/autoload"
	fragmodel "magic/internal/domain/knowledge/fragment/model"
	"magic/internal/infrastructure/logging"
)

func NewClientForTestWithWriteLimit(collections pb.CollectionsClient, points pb.PointsClient, apiKey string, maxConcurrentWrites int) *Client {
	client := &Client{
		collections: collections,
		points:      points,
		apiKey:      apiKey,
		logger:      logging.New(),
		httpClient:  &http.Client{Timeout: defaultProbeHTTPTimeout},
		writeSem:    make(chan struct{}, normalizeMaxConcurrentWrites(maxConcurrentWrites)),
		slowLogMs:   defaultLogSlowThresholdMs,
	}
	client.initializeCapabilitySnapshot()
	return client
}

type TestLoggerConfig struct {
	Writer          io.Writer
	Enabled         bool
	SlowThresholdMs int
}

func NewClientForTestWithLogger(
	collections pb.CollectionsClient,
	points pb.PointsClient,
	apiKey string,
	maxConcurrentWrites int,
	cfg TestLoggerConfig,
) *Client {
	client := &Client{
		collections: collections,
		points:      points,
		apiKey:      apiKey,
		logger: logging.NewFromConfigWithWriter(autoloadcfg.LoggingConfig{
			Level:  autoloadcfg.LogLevel(slog.LevelDebug.String()),
			Format: autoloadcfg.LogFormatJSON,
		}, cfg.Writer),
		httpClient: &http.Client{Timeout: defaultProbeHTTPTimeout},
		writeSem:   make(chan struct{}, normalizeMaxConcurrentWrites(maxConcurrentWrites)),
		logTiming:  cfg.Enabled,
		slowLogMs:  normalizeLogSlowThresholdMs(cfg.SlowThresholdMs),
	}
	client.initializeCapabilitySnapshot()
	return client
}

func EnsureVectorDimensionForTest[T any](ctx context.Context, repo *VectorDBDataRepository[T], collection string, vectors [][]float64) error {
	return repo.ensureVectorDimension(ctx, collection, vectors)
}

func ConvertResultsForTest[T any](results []*SimilarityResult) ([]*VectorSearchResultForTest[T], error) {
	converted, err := convertResults[T](results)
	if err != nil {
		return nil, err
	}
	out := make([]*VectorSearchResultForTest[T], 0, len(converted))
	for _, item := range converted {
		out = append(out, &VectorSearchResultForTest[T]{
			ID:       item.ID,
			Score:    item.Score,
			Payload:  item.Payload,
			Content:  item.Content,
			Metadata: item.Metadata,
		})
	}
	return out, nil
}

type VectorSearchResultForTest[T any] struct {
	ID       string
	Score    float64
	Payload  T
	Content  string
	Metadata map[string]any
}

func ToMapForTest(v any) (map[string]any, error) {
	return toMap(v)
}

func FromMapForTest(m map[string]any, v any) error {
	return fromMap(m, v)
}

func BuildPointVectorsForTest(denseVector []float64, sparseInput *SparseInputForTest) (*pb.Vectors, error) {
	if sparseInput == nil {
		return buildPointVectors(denseVector, nil)
	}
	return buildPointVectors(denseVector, sparseInput.toDomain())
}

type SparseInputForTest struct {
	Document *SparseDocumentForTest
	Vector   *fragmodel.SparseVector
}

func (s *SparseInputForTest) toDomain() *fragmodel.SparseInput {
	if s == nil {
		return nil
	}
	return &fragmodel.SparseInput{
		Document: s.Document.toDomain(),
		Vector:   s.Vector,
	}
}

type SparseDocumentForTest struct {
	Text    string
	Model   string
	Options map[string]any
}

func (s *SparseDocumentForTest) toDomain() *fragmodel.SparseDocument {
	if s == nil {
		return nil
	}
	return &fragmodel.SparseDocument{
		Text:    s.Text,
		Model:   s.Model,
		Options: s.Options,
	}
}

func ToFloat32VectorForTest(vector []float64) []float32 {
	return toFloat32Vector(vector)
}

func OrDefaultForTest(value, fallback string) string {
	return orDefault(value, fallback)
}

type CapabilitySnapshotForTest struct {
	Version           string
	QuerySupported    bool
	SelectedSparseAPI string
	ProbeStatus       string
	LastProbeAt       time.Time
}

func CurrentCapabilityForTest(client *Client) CapabilitySnapshotForTest {
	snapshot := client.capabilitySnapshot()
	return CapabilitySnapshotForTest(snapshot)
}

func SetCapabilityForTest(client *Client, snapshot CapabilitySnapshotForTest) {
	if client == nil {
		return
	}
	client.storeCapabilitySnapshot(capabilitySnapshot(snapshot))
}

func SetProbeBaseURIForTest(client *Client, baseURI string) {
	if client == nil {
		return
	}
	client.baseURI = baseURI
}

func SetHTTPClientForTest(client *Client, httpClient *http.Client) {
	if client == nil {
		return
	}
	client.httpClient = httpClient
}

type SparseSearchPlanForTest struct {
	Primary              string
	LogSelectedAPI       string
	ImmediateUnsupported bool
}

func CurrentCompatibilityStrategyNameForTest(client *Client) string {
	return client.compatibilityStrategy().Name()
}

func CurrentSparseSearchPlanForTest(client *Client, mode string) SparseSearchPlanForTest {
	plan := client.compatibilityStrategy().SparseSearchPlan(mode)
	return SparseSearchPlanForTest{
		Primary:              string(plan.Primary),
		LogSelectedAPI:       plan.LogSelectedAPI,
		ImmediateUnsupported: plan.ImmediateUnsupported,
	}
}

func BuildTimingLogMessageForTest(duration time.Duration, operation string, keysAndValues ...any) string {
	return buildQdrantLogMessage(duration, operation, keysAndValues...)
}
