// Package qdrant 提供与 Qdrant 向量数据库交互的客户端。
package qdrant

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"maps"
	"net/http"
	"net/url"
	"slices"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	pb "github.com/qdrant/go-client/qdrant"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/status"

	fragmodel "magic/internal/domain/knowledge/fragment/model"
	shared "magic/internal/domain/knowledge/shared"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/logkey"
	"magic/pkg/convert"
)

// SimilarityResult 表示相似度搜索结果
type SimilarityResult struct {
	ID       string         `json:"id"`
	Score    float64        `json:"score"`
	Payload  map[string]any `json:"payload"`
	PointID  string         `json:"point_id"`
	Content  string         `json:"content"`
	Metadata map[string]any `json:"metadata"`
}

// ErrInvalidInput 表示参数无效
var ErrInvalidInput = errors.New("invalid input")

// ErrCollectionNotFound 表示集合不存在
var ErrCollectionNotFound = errors.New("collection not found")

// ErrIntegerOverflow 表示整数溢出
var ErrIntegerOverflow = errors.New("integer overflow")

const (
	defaultMaxConcurrentWrites = 4
	defaultLogSlowThresholdMs  = 100
	qdrantTimingBaseFieldCount = 8
	qdrantStartBaseFieldCount  = 4
	qdrantLogPrefix            = "qdrant"
	qdrantAssumedVersionGTE112 = ">=1.12.2"
	qdrantNativeBM25MinVersion = "1.15.2"
	qdrantCapabilityStatus     = "assumed_gte_1_12_2"
	qdrantSparseModeNone       = "none"
	qdrantSparseModeDocument   = "document"
	qdrantSparseModeVector     = "vector"
	qdrantSparseAPILegacy      = "legacy_search"
	qdrantSparseAPIQuery       = "query_points"
	defaultProbeBodyLimitBytes = 1 << 20
)

const defaultProbeHTTPTimeout = 3 * time.Second

var (
	errQdrantQueryUnsupported       = errors.New("qdrant Points.Query is unsupported")
	errQdrantBaseURIInvalid         = errors.New("invalid qdrant base_uri")
	errCollectionInfoFallbackStatus = errors.New("unexpected collection info fallback status")
	errRESTPointUpsertStatus        = errors.New("unexpected rest point upsert status")
)

type capabilitySnapshot struct {
	Version           string
	QuerySupported    bool
	SelectedSparseAPI string
	ProbeStatus       string
	LastProbeAt       time.Time
}

type sparseSearchLogMeta struct {
	SelectedAPI           string
	CompatibilityStrategy string
}

// Client 是 Qdrant gRPC 客户端
type Client struct {
	conn        *grpc.ClientConn
	collections pb.CollectionsClient
	points      pb.PointsClient
	apiKey      string
	baseURI     string
	grpcHost    string
	grpcPort    int
	httpClient  *http.Client
	logger      *logging.SugaredLogger
	schemaMu    sync.Mutex
	writeSem    chan struct{}
	logTiming   bool
	slowLogMs   int
	capability  atomic.Pointer[capabilitySnapshot]
}

// Config 是 Qdrant 客户端配置
type Config struct {
	Host                string
	Port                int
	BaseURI             string
	Credential          string
	MaxConcurrentWrites int
	LogTimingEnabled    bool
	LogSlowThresholdMs  int
}

// NewClient 创建一个新的 Qdrant 客户端
func NewClient(cfg *Config, logger *logging.SugaredLogger) (*Client, error) {
	addr := fmt.Sprintf("%s:%d", cfg.Host, cfg.Port)

	opts := []grpc.DialOption{
		grpc.WithTransportCredentials(insecure.NewCredentials()),
	}

	conn, err := grpc.NewClient(addr, opts...)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Qdrant: %w", err)
	}

	client := &Client{
		conn:        conn,
		collections: pb.NewCollectionsClient(conn),
		points:      pb.NewPointsClient(conn),
		apiKey:      strings.TrimSpace(cfg.Credential),
		baseURI:     strings.TrimSpace(cfg.BaseURI),
		grpcHost:    strings.TrimSpace(cfg.Host),
		grpcPort:    cfg.Port,
		httpClient:  &http.Client{Timeout: defaultProbeHTTPTimeout},
		logger:      logger,
		writeSem:    make(chan struct{}, normalizeMaxConcurrentWrites(cfg.MaxConcurrentWrites)),
		logTiming:   cfg.LogTimingEnabled,
		slowLogMs:   normalizeLogSlowThresholdMs(cfg.LogSlowThresholdMs),
	}
	client.initializeCapabilitySnapshot()
	return client, nil
}

func normalizeMaxConcurrentWrites(limit int) int {
	if limit <= 0 {
		return defaultMaxConcurrentWrites
	}
	return limit
}

func normalizeLogSlowThresholdMs(threshold int) int {
	if threshold <= 0 {
		return defaultLogSlowThresholdMs
	}
	return threshold
}

func newDefaultCapabilitySnapshot() *capabilitySnapshot {
	return &capabilitySnapshot{
		Version:           qdrantAssumedVersionGTE112,
		QuerySupported:    true,
		SelectedSparseAPI: qdrantSparseAPIQuery,
		ProbeStatus:       qdrantCapabilityStatus,
	}
}

func (c *Client) initializeCapabilitySnapshot() {
	if c == nil {
		return
	}
	c.capability.CompareAndSwap(nil, newDefaultCapabilitySnapshot())
}

func (c *Client) capabilitySnapshot() capabilitySnapshot {
	if c == nil {
		return *newDefaultCapabilitySnapshot()
	}
	c.initializeCapabilitySnapshot()
	current := c.capability.Load()
	if current == nil {
		return *newDefaultCapabilitySnapshot()
	}
	return *current
}

// DefaultSparseBackend 根据当前 Qdrant 能力返回默认 sparse backend。
func (c *Client) DefaultSparseBackend() shared.SparseBackendSelection {
	return c.selectSparseBackend("")
}

// SelectSparseBackend 根据当前 Qdrant 能力返回显式请求的有效 sparse backend。
func (c *Client) SelectSparseBackend(requested string) shared.SparseBackendSelection {
	return c.selectSparseBackend(requested)
}

func (c *Client) storeCapabilitySnapshot(snapshot capabilitySnapshot) {
	if c == nil {
		return
	}
	snapshotCopy := snapshot
	c.capability.Store(&snapshotCopy)
}

func (c *Client) selectSparseBackend(requested string) shared.SparseBackendSelection {
	return c.compatibilityStrategy().SelectSparseBackend(requested)
}

func (c *Client) acquireWritePermit(ctx context.Context) (func(), error) {
	if ctx == nil {
		return nil, fmt.Errorf("%w: context is nil", ErrInvalidInput)
	}
	if c == nil || c.writeSem == nil {
		return func() {}, nil
	}

	select {
	case c.writeSem <- struct{}{}:
		return func() {
			<-c.writeSem
		}, nil
	case <-ctx.Done():
		return nil, fmt.Errorf("acquire write permit: %w", ctx.Err())
	}
}

func (c *Client) authContext(ctx context.Context) context.Context {
	if ctx == nil {
		ctx = context.Background()
	}
	if c.apiKey == "" {
		return ctx
	}
	return metadata.AppendToOutgoingContext(ctx, "api-key", c.apiKey)
}

// Close 关闭 gRPC 连接
func (c *Client) Close() error {
	if c.conn != nil {
		if err := c.conn.Close(); err != nil {
			return fmt.Errorf("failed to close gRPC connection: %w", err)
		}
	}
	return nil
}

func (c *Client) logOperationTiming(ctx context.Context, operation string, startedAt time.Time, err error, keysAndValues ...any) {
	if c == nil || c.logger == nil || !c.logTiming {
		return
	}

	duration := time.Since(startedAt)
	durationMs := duration.Milliseconds()
	message := buildQdrantLogMessage(duration, operation, keysAndValues...)
	fields := make([]any, 0, len(keysAndValues)+qdrantTimingBaseFieldCount)
	fields = append(fields,
		"component", "qdrant",
		"operation", operation,
		"duration_ms", durationMs,
	)
	fields = append(fields, keysAndValues...)
	if err != nil {
		fields = append(fields, "error", err.Error())
		c.logger.KnowledgeWarnContext(ctx, message, fields...)
		return
	}
	if durationMs >= int64(c.slowLogMs) {
		fields = append(fields, logkey.SlowQdrantThresholdMS, logkey.DurationToMS(time.Duration(c.slowLogMs)*time.Millisecond))
		c.logger.KnowledgeWarnContext(ctx, message, fields...)
		return
	}
	c.logger.DebugContext(ctx, message, fields...)
}

func (c *Client) logOperationStarted(ctx context.Context, operation string, keysAndValues ...any) {
	if c == nil || c.logger == nil || !c.logTiming {
		return
	}

	fields := make([]any, 0, len(keysAndValues)+qdrantStartBaseFieldCount)
	fields = append(fields, "component", "qdrant", "operation", operation)
	fields = append(fields, keysAndValues...)
	c.logger.InfoContext(ctx, "Qdrant operation started", fields...)
}

func buildQdrantLogMessage(duration time.Duration, operation string, keysAndValues ...any) string {
	return fmt.Sprintf("[%s:%.2fms] %s", qdrantLogPrefix, logkey.DurationToMS(duration), summarizeQdrantOperationForLog(operation, keysAndValues...))
}

func summarizeQdrantOperationForLog(operation string, keysAndValues ...any) string {
	operation = strings.TrimSpace(operation)
	if operation == "" {
		operation = "unknown_operation"
	}

	parts := []string{operation}
	if collection, ok := qdrantSummaryFieldValue(keysAndValues, "collection"); ok {
		parts = append(parts, "collection="+collection)
	}
	for _, key := range [...]string{"point_id", "point_count", "result_count", "top_k", "transport", "selected_sparse_api"} {
		if value, ok := qdrantSummaryFieldValue(keysAndValues, key); ok {
			parts = append(parts, key+"="+value)
		}
	}
	return strings.Join(parts, " ")
}

func qdrantSummaryFieldValue(keysAndValues []any, target string) (string, bool) {
	lastKeyIndex := len(keysAndValues) - 2
	if len(keysAndValues)%2 != 0 {
		lastKeyIndex = len(keysAndValues) - 3
	}
	for i := lastKeyIndex; i >= 0; i -= 2 {
		key, ok := keysAndValues[i].(string)
		if !ok || key != target {
			continue
		}
		return formatQdrantSummaryValue(keysAndValues[i+1])
	}
	return "", false
}

func formatQdrantSummaryValue(value any) (string, bool) {
	if value == nil {
		return "", false
	}

	switch typed := value.(type) {
	case string:
		typed = strings.TrimSpace(typed)
		if typed == "" {
			return "", false
		}
		return typed, true
	case fmt.Stringer:
		text := strings.TrimSpace(typed.String())
		if text == "" {
			return "", false
		}
		return text, true
	default:
		return fmt.Sprint(value), true
	}
}

func qdrantSparseMode(input *fragmodel.SparseInput) string {
	if input == nil {
		return qdrantSparseModeNone
	}
	document, vector, err := normalizeSparseInput(input)
	if err != nil {
		return "invalid"
	}
	switch {
	case document != nil:
		return qdrantSparseModeDocument
	case vector != nil:
		return qdrantSparseModeVector
	default:
		return qdrantSparseModeNone
	}
}

func qdrantSparseQueryMode(document *fragmodel.SparseDocument, vector *fragmodel.SparseVector) string {
	switch {
	case buildQdrantDocument(document) != nil:
		return qdrantSparseModeDocument
	case vector != nil && len(vector.Indices) > 0 && len(vector.Values) > 0:
		return qdrantSparseModeVector
	default:
		return qdrantSparseModeNone
	}
}

func batchSparseMode(inputs []*fragmodel.SparseInput) string {
	if len(inputs) == 0 {
		return qdrantSparseModeNone
	}
	mode := qdrantSparseModeNone
	for _, input := range inputs {
		current := qdrantSparseMode(input)
		if current == qdrantSparseModeNone {
			continue
		}
		if mode == qdrantSparseModeNone {
			mode = current
			continue
		}
		if mode != current {
			return "mixed"
		}
	}
	return mode
}

func batchDenseDim(vectors [][]float64) int {
	for _, vector := range vectors {
		if len(vector) > 0 {
			return len(vector)
		}
	}
	return 0
}

func sparseQueryTermCount(vector *fragmodel.SparseVector) int {
	if vector == nil {
		return 0
	}
	return len(vector.Indices)
}

func sparseDocumentModel(document *fragmodel.SparseDocument) string {
	if document == nil {
		return ""
	}
	model := strings.TrimSpace(document.Model)
	if model == "" {
		return fragmodel.DefaultSparseModelName
	}
	return model
}

func qdrantSearchLimit(topK int) (uint64, error) {
	limit, err := convert.SafeIntToUint64(topK, "topK")
	if err != nil {
		return 0, fmt.Errorf("convert topK to uint64: %w", err)
	}
	return limit, nil
}

// EnsurePayloadIndexes 确保集合具备指定 payload 索引。
func (c *Client) EnsurePayloadIndexes(ctx context.Context, collection string, specs []shared.PayloadIndexSpec) error {
	startedAt := time.Now()
	normalizedSpecs, err := normalizePayloadIndexSpecs(specs)
	if err != nil {
		return err
	}
	if len(normalizedSpecs) == 0 {
		return nil
	}

	c.schemaMu.Lock()
	defer c.schemaMu.Unlock()

	resp, err := c.collections.Get(c.authContext(ctx), &pb.GetCollectionInfoRequest{CollectionName: collection})
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return ErrCollectionNotFound
		}
		err = fmt.Errorf("failed to load collection schema %s: %w", collection, err)
		c.logOperationTiming(ctx, "ensure_payload_indexes", startedAt, err,
			"collection", collection,
			"requested_count", len(normalizedSpecs),
		)
		return err
	}

	existing := payloadSchemaKeySet(resp.GetResult())
	createdFields := make([]string, 0, len(normalizedSpecs))
	for _, spec := range normalizedSpecs {
		if _, ok := existing[spec.FieldName]; ok {
			continue
		}
		request, buildErr := buildCreateFieldIndexRequest(collection, spec)
		if buildErr != nil {
			return buildErr
		}
		if _, createErr := c.points.CreateFieldIndex(c.authContext(ctx), request); createErr != nil {
			if status.Code(createErr) == codes.AlreadyExists {
				existing[spec.FieldName] = struct{}{}
				continue
			}
			err = fmt.Errorf("create payload index %s on %s: %w", spec.FieldName, collection, createErr)
			c.logOperationTiming(ctx, "ensure_payload_indexes", startedAt, err,
				"collection", collection,
				"requested_count", len(normalizedSpecs),
				"existing_count", len(existing),
				"created_count", len(createdFields),
			)
			return err
		}
		existing[spec.FieldName] = struct{}{}
		createdFields = append(createdFields, spec.FieldName)
	}

	c.logOperationTiming(ctx, "ensure_payload_indexes", startedAt, nil,
		"collection", collection,
		"requested_count", len(normalizedSpecs),
		"existing_count", len(existing)-len(createdFields),
		"created_count", len(createdFields),
	)
	return nil
}

// CreateCollection 创建一个新的向量集合
func (c *Client) CreateCollection(ctx context.Context, name string, vectorSize int64) error {
	c.schemaMu.Lock()
	defer c.schemaMu.Unlock()

	if vectorSize <= 0 {
		return fmt.Errorf("%w: vector size must be positive", ErrInvalidInput)
	}

	_, err := c.collections.Create(c.authContext(ctx), &pb.CreateCollection{
		CollectionName: name,
		VectorsConfig: &pb.VectorsConfig{
			Config: &pb.VectorsConfig_ParamsMap{
				ParamsMap: &pb.VectorParamsMap{
					Map: map[string]*pb.VectorParams{
						fragmodel.DefaultDenseVectorName: {
							Size:     uint64(vectorSize),
							Distance: pb.Distance_Cosine,
						},
					},
				},
			},
		},
		SparseVectorsConfig: &pb.SparseVectorConfig{
			Map: map[string]*pb.SparseVectorParams{
				fragmodel.DefaultSparseVectorName: {
					Modifier: pb.Modifier_Idf.Enum(),
				},
			},
		},
	})
	if err != nil {
		return fmt.Errorf("failed to create collection %s: %w", name, err)
	}

	c.logger.InfoContext(ctx, "Created Qdrant collection", "name", name, "vectorSize", vectorSize)
	return nil
}

func normalizePayloadIndexSpecs(specs []shared.PayloadIndexSpec) ([]shared.PayloadIndexSpec, error) {
	if len(specs) == 0 {
		return nil, nil
	}

	seen := make(map[string]struct{}, len(specs))
	normalized := make([]shared.PayloadIndexSpec, 0, len(specs))
	for _, spec := range specs {
		spec = spec.Normalize()
		if !spec.Valid() {
			return nil, fmt.Errorf("%w: invalid payload index spec %+v", ErrInvalidInput, spec)
		}
		if _, ok := seen[spec.FieldName]; ok {
			continue
		}
		seen[spec.FieldName] = struct{}{}
		normalized = append(normalized, spec)
	}
	return normalized, nil
}

func payloadSchemaKeySet(info *pb.CollectionInfo) map[string]struct{} {
	keys := make(map[string]struct{})
	if info == nil {
		return keys
	}
	for key := range info.GetPayloadSchema() {
		trimmed := strings.TrimSpace(key)
		if trimmed == "" {
			continue
		}
		keys[trimmed] = struct{}{}
	}
	return keys
}

func extractPayloadSchemaKeys(info *pb.CollectionInfo) []string {
	keys := make([]string, 0, len(info.GetPayloadSchema()))
	for key := range payloadSchemaKeySet(info) {
		keys = append(keys, key)
	}
	slices.Sort(keys)
	return keys
}

func buildCreateFieldIndexRequest(collection string, spec shared.PayloadIndexSpec) (*pb.CreateFieldIndexCollection, error) {
	payloadFieldType, params, err := qdrantPayloadIndexDefinition(spec)
	if err != nil {
		return nil, err
	}
	wait := true
	return &pb.CreateFieldIndexCollection{
		CollectionName:   collection,
		Wait:             &wait,
		FieldName:        spec.FieldName,
		FieldType:        &payloadFieldType,
		FieldIndexParams: params,
	}, nil
}

func qdrantPayloadIndexDefinition(spec shared.PayloadIndexSpec) (pb.FieldType, *pb.PayloadIndexParams, error) {
	switch spec.Kind {
	case shared.PayloadIndexKindKeyword:
		return pb.FieldType_FieldTypeKeyword, pb.NewPayloadIndexParamsKeyword(&pb.KeywordIndexParams{}), nil
	case shared.PayloadIndexKindInteger:
		return pb.FieldType_FieldTypeInteger, pb.NewPayloadIndexParamsInt(&pb.IntegerIndexParams{}), nil
	default:
		return pb.FieldType_FieldTypeKeyword, nil, fmt.Errorf("%w: unsupported payload index kind %q", ErrInvalidInput, spec.Kind)
	}
}

// CollectionExists 检查集合是否存在
func (c *Client) CollectionExists(ctx context.Context, name string) (bool, error) {
	collections, err := c.ListCollections(ctx)
	if err != nil {
		return false, err
	}
	if slices.Contains(collections, name) {
		return true, nil
	}
	return false, nil
}

// ListCollections 列出所有物理集合名称。
func (c *Client) ListCollections(ctx context.Context) ([]string, error) {
	resp, err := c.collections.List(c.authContext(ctx), &pb.ListCollectionsRequest{})
	if err != nil {
		return nil, fmt.Errorf("failed to list collections: %w", err)
	}

	collections := make([]string, 0, len(resp.GetCollections()))
	for _, col := range resp.GetCollections() {
		collections = append(collections, col.GetName())
	}
	return collections, nil
}

// GetAliasTarget 查询 alias 当前指向的物理集合。
func (c *Client) GetAliasTarget(ctx context.Context, alias string) (string, bool, error) {
	return c.getAliasTarget(ctx, alias)
}

func (c *Client) getAliasTarget(ctx context.Context, alias string) (string, bool, error) {
	resp, err := c.collections.ListAliases(c.authContext(ctx), &pb.ListAliasesRequest{})
	if err != nil {
		return "", false, fmt.Errorf("failed to list aliases: %w", err)
	}
	for _, item := range resp.GetAliases() {
		if item.GetAliasName() == alias {
			return item.GetCollectionName(), true, nil
		}
	}
	return "", false, nil
}

// EnsureAlias 确保 alias 指向目标物理集合。
func (c *Client) EnsureAlias(ctx context.Context, alias, target string) error {
	c.schemaMu.Lock()
	defer c.schemaMu.Unlock()

	current, exists, err := c.getAliasTarget(ctx, alias)
	if err != nil {
		return err
	}
	if exists && current == target {
		return nil
	}
	return c.swapAliasAtomically(ctx, alias, current, target)
}

// SwapAliasAtomically 原子切换 alias 到新物理集合。
func (c *Client) SwapAliasAtomically(ctx context.Context, alias, oldTarget, newTarget string) error {
	c.schemaMu.Lock()
	defer c.schemaMu.Unlock()

	return c.swapAliasAtomically(ctx, alias, oldTarget, newTarget)
}

func (c *Client) swapAliasAtomically(ctx context.Context, alias, oldTarget, newTarget string) error {
	actions := make([]*pb.AliasOperations, 0, 2)
	if strings.TrimSpace(oldTarget) != "" {
		actions = append(actions, &pb.AliasOperations{
			Action: &pb.AliasOperations_DeleteAlias{
				DeleteAlias: &pb.DeleteAlias{AliasName: alias},
			},
		})
	}
	actions = append(actions, &pb.AliasOperations{
		Action: &pb.AliasOperations_CreateAlias{
			CreateAlias: &pb.CreateAlias{
				CollectionName: newTarget,
				AliasName:      alias,
			},
		},
	})
	if _, err := c.collections.UpdateAliases(c.authContext(ctx), &pb.ChangeAliases{Actions: actions}); err != nil {
		return fmt.Errorf("failed to swap alias %s from %s to %s: %w", alias, oldTarget, newTarget, err)
	}
	return nil
}

// DeleteAlias 删除 alias。
func (c *Client) DeleteAlias(ctx context.Context, alias string) error {
	c.schemaMu.Lock()
	defer c.schemaMu.Unlock()

	if _, err := c.collections.UpdateAliases(c.authContext(ctx), &pb.ChangeAliases{
		Actions: []*pb.AliasOperations{{
			Action: &pb.AliasOperations_DeleteAlias{
				DeleteAlias: &pb.DeleteAlias{AliasName: alias},
			},
		}},
	}); err != nil {
		return fmt.Errorf("failed to delete alias %s: %w", alias, err)
	}
	return nil
}

// GetCollectionInfo 获取集合信息（包含向量维度）
func (c *Client) GetCollectionInfo(ctx context.Context, name string) (*fragmodel.VectorCollectionInfo, error) {
	resp, err := c.collections.Get(c.authContext(ctx), &pb.GetCollectionInfoRequest{CollectionName: name})
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, ErrCollectionNotFound
		}
		return nil, fmt.Errorf("failed to get collection info %s: %w", name, err)
	}

	vectorSize, err := extractVectorSize(resp.GetResult())
	if err != nil {
		return nil, err
	}

	points, err := c.resolveCollectionPointsCount(ctx, name, resp.GetResult())
	if err != nil {
		return nil, err
	}
	return &fragmodel.VectorCollectionInfo{
		Name:                name,
		VectorSize:          vectorSize,
		Points:              points,
		HasNamedDenseVector: hasNamedDenseVector(resp.GetResult()),
		HasSparseVector:     hasSparseVector(resp.GetResult()),
		PayloadSchemaKeys:   extractPayloadSchemaKeys(resp.GetResult()),
	}, nil
}

func (c *Client) resolveCollectionPointsCount(ctx context.Context, name string, info *pb.CollectionInfo) (int64, error) {
	points, err := safeUint64ToInt64(info.GetPointsCount(), "point count")
	if err != nil {
		return 0, err
	}
	strategy := c.compatibilityStrategy()
	if !strategy.ShouldFetchPointsCountViaREST(c.baseURI, points) {
		return points, nil
	}

	restPoints, ok, err := c.fetchCollectionPointsCountViaREST(ctx, name)
	if err != nil {
		if c != nil && c.logger != nil {
			c.logger.KnowledgeWarnContext(
				ctx,
				"Fallback to REST collection points count failed",
				"collection", name,
				"error", err,
			)
		}
		return points, nil
	}
	if ok {
		return restPoints, nil
	}
	return points, nil
}

func safeUint64ToInt64(value uint64, label string) (int64, error) {
	if value > 1<<63-1 {
		return 0, fmt.Errorf("%w: %s %d", ErrIntegerOverflow, label, value)
	}
	return int64(value), nil
}

func (c *Client) fetchCollectionPointsCountViaREST(ctx context.Context, name string) (int64, bool, error) {
	endpoint, err := buildCollectionInfoEndpoint(c.baseURI, name)
	if err != nil {
		return 0, false, err
	}
	httpClient := c.httpClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultProbeHTTPTimeout}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return 0, false, fmt.Errorf("build collection info fallback request: %w", err)
	}
	if c.apiKey != "" {
		req.Header.Set("api-key", c.apiKey)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return 0, false, fmt.Errorf("request collection info fallback: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	switch {
	case resp.StatusCode == http.StatusNotFound:
		return 0, false, nil
	case resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices:
		return 0, false, fmt.Errorf("%w: %d", errCollectionInfoFallbackStatus, resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, defaultProbeBodyLimitBytes))
	if err != nil {
		return 0, false, fmt.Errorf("read collection info fallback response: %w", err)
	}

	var payload struct {
		Result struct {
			PointsCount *uint64 `json:"points_count"`
		} `json:"result"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return 0, false, fmt.Errorf("decode collection info fallback response: %w", err)
	}
	if payload.Result.PointsCount == nil {
		return 0, false, nil
	}
	points, err := safeUint64ToInt64(*payload.Result.PointsCount, "rest point count")
	if err != nil {
		return 0, false, err
	}
	return points, true, nil
}

func buildCollectionInfoEndpoint(baseURI, collection string) (string, error) {
	return buildCollectionEndpoint(baseURI, collection)
}

func buildCollectionPointsEndpoint(baseURI, collection string) (string, error) {
	endpoint, err := buildCollectionEndpoint(baseURI, collection)
	if err != nil {
		return "", err
	}
	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("parse collection points endpoint: %w", err)
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/points"
	query := parsed.Query()
	query.Set("wait", "true")
	parsed.RawQuery = query.Encode()
	return parsed.String(), nil
}

func buildCollectionEndpoint(baseURI, collection string) (string, error) {
	trimmedCollection := strings.TrimSpace(collection)
	if trimmedCollection == "" {
		return "", fmt.Errorf("%w: collection name is empty", ErrInvalidInput)
	}

	endpoint, err := normalizeBaseURI(baseURI)
	if err != nil {
		return "", err
	}

	parsed, err := url.Parse(endpoint)
	if err != nil {
		return "", fmt.Errorf("parse collection endpoint: %w", err)
	}
	parsed.Path = strings.TrimRight(parsed.Path, "/") + "/collections/" + url.PathEscape(trimmedCollection)
	return parsed.String(), nil
}

func normalizeBaseURI(raw string) (string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", fmt.Errorf("%w: %q", errQdrantBaseURIInvalid, raw)
	}
	candidates := []string{trimmed}
	if !strings.Contains(trimmed, "://") {
		candidates = append(candidates, "http://"+trimmed)
	}
	for _, candidate := range candidates {
		parsed, err := url.Parse(candidate)
		if err != nil {
			continue
		}
		if parsed.Scheme == "" || parsed.Host == "" {
			continue
		}
		if parsed.Path == "" {
			parsed.Path = "/"
		}
		return parsed.String(), nil
	}
	return "", fmt.Errorf("%w: %q", errQdrantBaseURIInvalid, raw)
}

func extractVectorSize(info *pb.CollectionInfo) (int64, error) {
	if info == nil {
		return 0, fmt.Errorf("%w: collection info is nil", ErrInvalidInput)
	}
	config := info.GetConfig()
	if config == nil || config.GetParams() == nil {
		return 0, fmt.Errorf("%w: collection config is missing", ErrInvalidInput)
	}
	vectorsConfig := config.GetParams().GetVectorsConfig()
	if vectorsConfig == nil {
		return 0, fmt.Errorf("%w: vectors config is missing", ErrInvalidInput)
	}
	if params := vectorsConfig.GetParams(); params != nil {
		return safeVectorSize(params.GetSize())
	}
	if paramsMap := vectorsConfig.GetParamsMap(); paramsMap != nil && len(paramsMap.GetMap()) > 0 {
		return extractNamedVectorSize(paramsMap.GetMap())
	}
	return 0, fmt.Errorf("%w: vector params are missing", ErrInvalidInput)
}

func extractNamedVectorSize(paramsMap map[string]*pb.VectorParams) (int64, error) {
	if len(paramsMap) == 0 {
		return 0, fmt.Errorf("%w: vector params are missing", ErrInvalidInput)
	}
	if params := paramsMap[fragmodel.DefaultDenseVectorName]; params != nil {
		return safeVectorSize(params.GetSize())
	}
	for _, params := range paramsMap {
		if params == nil {
			continue
		}
		return safeVectorSize(params.GetSize())
	}
	return 0, fmt.Errorf("%w: vector params are missing", ErrInvalidInput)
}

func safeVectorSize(size uint64) (int64, error) {
	if size > 1<<63-1 {
		return 0, fmt.Errorf("%w: vector size %d", ErrIntegerOverflow, size)
	}
	return int64(size), nil
}

func hasNamedDenseVector(info *pb.CollectionInfo) bool {
	if info == nil {
		return false
	}
	config := info.GetConfig()
	if config == nil || config.GetParams() == nil {
		return false
	}
	paramsMap := config.GetParams().GetVectorsConfig().GetParamsMap()
	if paramsMap == nil {
		return false
	}
	_, ok := paramsMap.GetMap()[fragmodel.DefaultDenseVectorName]
	return ok
}

func hasSparseVector(info *pb.CollectionInfo) bool {
	if info == nil {
		return false
	}
	config := info.GetConfig()
	if config == nil || config.GetParams() == nil {
		return false
	}
	sparseConfig := config.GetParams().GetSparseVectorsConfig()
	if sparseConfig == nil {
		return false
	}
	_, ok := sparseConfig.GetMap()[fragmodel.DefaultSparseVectorName]
	return ok
}

// DeleteCollection 删除一个向量集合
func (c *Client) DeleteCollection(ctx context.Context, name string) error {
	c.schemaMu.Lock()
	defer c.schemaMu.Unlock()

	_, err := c.collections.Delete(c.authContext(ctx), &pb.DeleteCollection{
		CollectionName: name,
	})
	if err != nil {
		return fmt.Errorf("failed to delete collection %s: %w", name, err)
	}

	c.logger.InfoContext(ctx, "Deleted Qdrant collection", "name", name)
	return nil
}

// StoreHybridPoint 存储一个 dense+sparse 向量点。
func (c *Client) StoreHybridPoint(ctx context.Context, collection, pointID string, denseVector []float64, sparseInput *fragmodel.SparseInput, payload map[string]any) error {
	startedAt := time.Now()
	sparseMode := qdrantSparseMode(sparseInput)
	strategy := c.compatibilityStrategy()
	if strategy.HybridWriteTransport(c.baseURI, sparseMode) == hybridWriteTransportREST {
		err := c.storeHybridPointsViaREST(ctx, hybridPointsWriteRequest{
			Collection:   collection,
			PointIDs:     []string{pointID},
			DenseVectors: [][]float64{denseVector},
			SparseInputs: []*fragmodel.SparseInput{sparseInput},
			Payloads:     []map[string]any{payload},
		})
		if err != nil {
			err = fmt.Errorf("failed to store point via rest: %w", err)
			c.logOperationTiming(ctx, "store_hybrid_point", startedAt, err,
				"collection", collection,
				"point_id", pointID,
				"dense_dim", len(denseVector),
				"sparse_mode", sparseMode,
				"payload_present", len(payload) > 0,
				"transport", "rest",
				"compatibility_strategy", strategy.Name(),
			)
			return err
		}
		c.logOperationTiming(ctx, "store_hybrid_point", startedAt, nil,
			"collection", collection,
			"point_id", pointID,
			"dense_dim", len(denseVector),
			"sparse_mode", sparseMode,
			"payload_present", len(payload) > 0,
			"transport", "rest",
			"compatibility_strategy", strategy.Name(),
		)
		return nil
	}

	vectors, err := buildPointVectors(denseVector, sparseInput)
	if err != nil {
		return err
	}
	release, err := c.acquireWritePermit(ctx)
	if err != nil {
		return err
	}
	defer release()
	qdrantPayload := convertToQdrantPayload(payload)

	_, err = c.points.Upsert(c.authContext(ctx), &pb.UpsertPoints{
		CollectionName: collection,
		Points: []*pb.PointStruct{
			{
				Id:      &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: pointID}},
				Vectors: vectors,
				Payload: qdrantPayload,
			},
		},
	})
	if err != nil {
		err = fmt.Errorf("failed to store point: %w", err)
		c.logOperationTiming(ctx, "store_hybrid_point", startedAt, err,
			"collection", collection,
			"point_id", pointID,
			"dense_dim", len(denseVector),
			"sparse_mode", sparseMode,
			"payload_present", len(payload) > 0,
			"transport", "grpc",
			"compatibility_strategy", strategy.Name(),
		)
		return err
	}
	c.logOperationTiming(ctx, "store_hybrid_point", startedAt, nil,
		"collection", collection,
		"point_id", pointID,
		"dense_dim", len(denseVector),
		"sparse_mode", sparseMode,
		"payload_present", len(payload) > 0,
		"transport", "grpc",
		"compatibility_strategy", strategy.Name(),
	)
	return nil
}

// StoreHybridPoints 批量存储 dense+sparse 向量点。
func (c *Client) StoreHybridPoints(ctx context.Context, collection string, pointIDs []string, denseVectors [][]float64, sparseInputs []*fragmodel.SparseInput, payloads []map[string]any) error {
	startedAt := time.Now()
	if len(pointIDs) != len(denseVectors) || len(pointIDs) != len(payloads) {
		return fmt.Errorf("%w: pointIDs=%d, vectors=%d, payloads=%d", ErrInvalidInput, len(pointIDs), len(denseVectors), len(payloads))
	}
	if len(sparseInputs) > 0 && len(sparseInputs) != len(pointIDs) {
		return fmt.Errorf("%w: sparseInputs=%d, pointIDs=%d", ErrInvalidInput, len(sparseInputs), len(pointIDs))
	}
	sparseMode := batchSparseMode(sparseInputs)
	strategy := c.compatibilityStrategy()
	request := hybridPointsWriteRequest{
		Collection:   collection,
		PointIDs:     pointIDs,
		DenseVectors: denseVectors,
		SparseInputs: sparseInputs,
		Payloads:     payloads,
	}
	logMeta := hybridPointsWriteLogMeta{
		StartedAt:    startedAt,
		SparseMode:   sparseMode,
		Transport:    strategy.HybridWriteTransport(c.baseURI, sparseMode),
		StrategyName: strategy.Name(),
	}
	err := c.storeHybridPointsByTransport(ctx, request, logMeta.Transport)
	c.logHybridPointsTransportResult(ctx, err, request, logMeta)
	return err
}

// SetPayloadByPointIDs 按 point_id 局部更新 payload。
func (c *Client) SetPayloadByPointIDs(
	ctx context.Context,
	collection string,
	updates map[string]map[string]any,
) error {
	startedAt := time.Now()
	pointIDs := make([]string, 0, len(updates))
	for pointID, payload := range updates {
		if strings.TrimSpace(pointID) == "" || len(payload) == 0 {
			continue
		}
		pointIDs = append(pointIDs, pointID)
	}
	if len(pointIDs) == 0 {
		return nil
	}
	slices.Sort(pointIDs)

	release, err := c.acquireWritePermit(ctx)
	if err != nil {
		return err
	}
	defer release()

	wait := true
	var failedPointID string
	for _, pointID := range pointIDs {
		payload := updates[pointID]
		if len(payload) == 0 {
			continue
		}
		failedPointID = pointID
		_, err = c.points.SetPayload(c.authContext(ctx), &pb.SetPayloadPoints{
			CollectionName: collection,
			Wait:           &wait,
			Payload:        convertToQdrantPayload(payload),
			PointsSelector: &pb.PointsSelector{
				PointsSelectorOneOf: &pb.PointsSelector_Points{
					Points: &pb.PointsIdsList{
						Ids: []*pb.PointId{{
							PointIdOptions: &pb.PointId_Uuid{Uuid: pointID},
						}},
					},
				},
			},
		})
		if err != nil {
			err = fmt.Errorf("set payload for point %s: %w", pointID, err)
			c.logOperationTiming(ctx, "set_payload_by_point_ids", startedAt, err,
				"collection", collection,
				"point_count", len(pointIDs),
				"failed_point_id", failedPointID,
			)
			return err
		}
	}

	c.logOperationTiming(ctx, "set_payload_by_point_ids", startedAt, nil,
		"collection", collection,
		"point_count", len(pointIDs),
	)
	return nil
}

func (c *Client) storeHybridPointsByTransport(
	ctx context.Context,
	request hybridPointsWriteRequest,
	transport hybridWriteTransport,
) error {
	if transport == hybridWriteTransportREST {
		if err := c.storeHybridPointsViaREST(ctx, request); err != nil {
			return fmt.Errorf("failed to store points via rest: %w", err)
		}
		return nil
	}
	if err := c.storeHybridPointsViaGRPC(ctx, request); err != nil {
		return fmt.Errorf("failed to store points: %w", err)
	}
	return nil
}

func (c *Client) storeHybridPointsViaGRPC(ctx context.Context, request hybridPointsWriteRequest) error {
	points := make([]*pb.PointStruct, len(request.PointIDs))
	for i := range request.PointIDs {
		var sparseInput *fragmodel.SparseInput
		if len(request.SparseInputs) > 0 {
			sparseInput = request.SparseInputs[i]
		}
		vectors, err := buildPointVectors(request.DenseVectors[i], sparseInput)
		if err != nil {
			return err
		}
		points[i] = &pb.PointStruct{
			Id:      &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: request.PointIDs[i]}},
			Vectors: vectors,
			Payload: convertToQdrantPayload(request.Payloads[i]),
		}
	}
	release, err := c.acquireWritePermit(ctx)
	if err != nil {
		return err
	}
	defer release()

	_, err = c.points.Upsert(c.authContext(ctx), &pb.UpsertPoints{
		CollectionName: request.Collection,
		Points:         points,
	})
	if err != nil {
		return fmt.Errorf("grpc upsert points: %w", err)
	}
	return nil
}

func (c *Client) logHybridPointsTransportResult(
	ctx context.Context,
	err error,
	request hybridPointsWriteRequest,
	meta hybridPointsWriteLogMeta,
) {
	c.logOperationTiming(ctx, "store_hybrid_points", meta.StartedAt, err,
		"collection", request.Collection,
		"point_count", len(request.PointIDs),
		"dense_dim", batchDenseDim(request.DenseVectors),
		"sparse_mode", meta.SparseMode,
		"payload_count", len(request.Payloads),
		"transport", string(meta.Transport),
		"compatibility_strategy", meta.StrategyName,
	)
}

func (c *Client) storeHybridPointsViaREST(ctx context.Context, request hybridPointsWriteRequest) error {
	endpoint, err := buildCollectionPointsEndpoint(c.baseURI, request.Collection)
	if err != nil {
		return err
	}

	points := make([]restPointUpsertRequest, len(request.PointIDs))
	for i := range request.PointIDs {
		var sparseInput *fragmodel.SparseInput
		if len(request.SparseInputs) > 0 {
			sparseInput = request.SparseInputs[i]
		}
		vector, err := buildRESTPointVector(request.DenseVectors[i], sparseInput)
		if err != nil {
			return err
		}
		points[i] = restPointUpsertRequest{
			ID:      request.PointIDs[i],
			Vector:  vector,
			Payload: request.Payloads[i],
		}
	}

	requestBody, err := json.Marshal(restPointsUpsertRequest{Points: points})
	if err != nil {
		return fmt.Errorf("marshal rest point upsert request: %w", err)
	}

	httpClient := c.httpClient
	if httpClient == nil {
		httpClient = &http.Client{Timeout: defaultProbeHTTPTimeout}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPut, endpoint, bytes.NewReader(requestBody))
	if err != nil {
		return fmt.Errorf("build rest point upsert request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if c.apiKey != "" {
		req.Header.Set("api-key", c.apiKey)
	}

	resp, err := httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("request rest point upsert: %w", err)
	}
	defer func() {
		_ = resp.Body.Close()
	}()

	if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
		return nil
	}

	body, readErr := io.ReadAll(io.LimitReader(resp.Body, defaultProbeBodyLimitBytes))
	if readErr != nil {
		return fmt.Errorf("%w: status=%d read body: %w", errRESTPointUpsertStatus, resp.StatusCode, readErr)
	}
	message := strings.TrimSpace(string(body))
	if message == "" {
		return fmt.Errorf("%w: status=%d", errRESTPointUpsertStatus, resp.StatusCode)
	}
	return fmt.Errorf("%w: status=%d body=%s", errRESTPointUpsertStatus, resp.StatusCode, message)
}

// ListExistingPointIDs 批量查询 collection 中已经存在的点 ID。
func (c *Client) ListExistingPointIDs(ctx context.Context, collection string, pointIDs []string) (map[string]struct{}, error) {
	if len(pointIDs) == 0 {
		return map[string]struct{}{}, nil
	}

	uniqueIDs := make(map[string]struct{}, len(pointIDs))
	ids := make([]*pb.PointId, 0, len(pointIDs))
	for _, pointID := range pointIDs {
		trimmed := strings.TrimSpace(pointID)
		if trimmed == "" {
			continue
		}
		if _, exists := uniqueIDs[trimmed]; exists {
			continue
		}
		uniqueIDs[trimmed] = struct{}{}
		ids = append(ids, &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: trimmed}})
	}
	if len(ids) == 0 {
		return map[string]struct{}{}, nil
	}

	resp, err := c.points.Get(c.authContext(ctx), &pb.GetPoints{
		CollectionName: collection,
		Ids:            ids,
		WithPayload:    &pb.WithPayloadSelector{SelectorOptions: &pb.WithPayloadSelector_Enable{Enable: false}},
		WithVectors:    &pb.WithVectorsSelector{SelectorOptions: &pb.WithVectorsSelector_Enable{Enable: false}},
	})
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil, ErrCollectionNotFound
		}
		return nil, fmt.Errorf("failed to get points: %w", err)
	}

	existing := make(map[string]struct{}, len(resp.GetResult()))
	for _, point := range resp.GetResult() {
		if point == nil || point.GetId() == nil {
			continue
		}
		if pointID := strings.TrimSpace(point.GetId().GetUuid()); pointID != "" {
			existing[pointID] = struct{}{}
		}
	}
	return maps.Clone(existing), nil
}

// ListPointIDsByFilter 根据 payload filter 批量枚举 point_id。
func (c *Client) ListPointIDsByFilter(
	ctx context.Context,
	collection string,
	filter *fragmodel.VectorFilter,
	limit int,
) ([]string, error) {
	if strings.TrimSpace(collection) == "" {
		return nil, fmt.Errorf("%w: collection is required", ErrInvalidInput)
	}
	if limit <= 0 {
		limit = 1000
	}
	scrollLimit, err := convert.SafeIntToUint32(limit, "limit")
	if err != nil {
		return nil, fmt.Errorf("normalize scroll limit: %w", err)
	}

	req := &pb.ScrollPoints{
		CollectionName: collection,
		Filter:         buildQdrantFilter(filter),
		Limit:          &scrollLimit,
		WithPayload:    &pb.WithPayloadSelector{SelectorOptions: &pb.WithPayloadSelector_Enable{Enable: false}},
		WithVectors:    &pb.WithVectorsSelector{SelectorOptions: &pb.WithVectorsSelector_Enable{Enable: false}},
	}

	pointIDs := make([]string, 0, limit)
	for {
		resp, err := c.points.Scroll(c.authContext(ctx), req)
		if err != nil {
			return nil, fmt.Errorf("failed to scroll points: %w", err)
		}
		for _, point := range resp.GetResult() {
			if point == nil || point.GetId() == nil {
				continue
			}
			if pointID := pointIDString(point.GetId()); pointID != "" {
				pointIDs = append(pointIDs, pointID)
			}
		}
		nextOffset := resp.GetNextPageOffset()
		if nextOffset == nil || len(resp.GetResult()) == 0 {
			break
		}
		req.Offset = nextOffset
	}
	return pointIDs, nil
}

func pointIDString(pointID *pb.PointId) string {
	if pointID == nil {
		return ""
	}
	switch typed := pointID.PointIdOptions.(type) {
	case *pb.PointId_Uuid:
		return strings.TrimSpace(typed.Uuid)
	case *pb.PointId_Num:
		return fmt.Sprintf("%d", typed.Num)
	default:
		return ""
	}
}

// DeletePoint 删除一个向量点
func (c *Client) DeletePoint(ctx context.Context, collection, pointID string) error {
	return c.DeletePoints(ctx, collection, []string{pointID})
}

// DeletePoints 批量删除向量点。
func (c *Client) DeletePoints(ctx context.Context, collection string, pointIDs []string) error {
	if len(pointIDs) == 0 {
		return nil
	}

	ids := make([]*pb.PointId, 0, len(pointIDs))
	for _, pointID := range pointIDs {
		if pointID == "" {
			continue
		}
		ids = append(ids, &pb.PointId{PointIdOptions: &pb.PointId_Uuid{Uuid: pointID}})
	}
	if len(ids) == 0 {
		return nil
	}
	release, err := c.acquireWritePermit(ctx)
	if err != nil {
		return err
	}
	defer release()

	_, err = c.points.Delete(c.authContext(ctx), &pb.DeletePoints{
		CollectionName: collection,
		Points: &pb.PointsSelector{
			PointsSelectorOneOf: &pb.PointsSelector_Points{
				Points: &pb.PointsIdsList{
					Ids: ids,
				},
			},
		},
	})
	if err != nil {
		if status.Code(err) == codes.NotFound {
			return nil
		}
		return fmt.Errorf("failed to delete points: %w", err)
	}

	return nil
}

// DeletePointsByFilter 根据过滤条件删除向量点
func (c *Client) DeletePointsByFilter(ctx context.Context, collection string, filter *fragmodel.VectorFilter) (err error) {
	startedAt := time.Now()
	filterMustCount := 0
	if filter != nil {
		filterMustCount = len(filter.Must)
	}
	c.logOperationStarted(ctx, "delete_points_by_filter", "collection", collection, "filter_must_count", filterMustCount)
	defer func() {
		c.logOperationTiming(
			ctx,
			"delete_points_by_filter",
			startedAt,
			err,
			"collection", collection,
			"filter_must_count", filterMustCount,
		)
	}()

	qdrantFilter := buildQdrantFilter(filter)
	release, err := c.acquireWritePermit(ctx)
	if err != nil {
		return err
	}
	defer release()

	_, err = c.points.Delete(c.authContext(ctx), &pb.DeletePoints{
		CollectionName: collection,
		Points: &pb.PointsSelector{
			PointsSelectorOneOf: &pb.PointsSelector_Filter{
				Filter: qdrantFilter,
			},
		},
	})
	if err != nil {
		if status.Code(err) == codes.NotFound {
			err = nil
			return nil
		}
		err = fmt.Errorf("failed to delete points by filter: %w", err)
		return err
	}

	return nil
}

// SearchDenseWithFilter 使用命名 dense vector 执行检索。
func (c *Client) SearchDenseWithFilter(ctx context.Context, request fragmodel.DenseSearchRequest) ([]*SimilarityResult, error) {
	startedAt := time.Now()
	threshold := float32(request.ScoreThreshold)
	if request.TopK < 0 {
		return nil, fmt.Errorf("%w: topK must be non-negative", ErrInvalidInput)
	}
	limit, err := qdrantSearchLimit(request.TopK)
	if err != nil {
		return nil, err
	}

	req := &pb.SearchPoints{
		CollectionName: request.Collection,
		Vector:         toFloat32Vector(request.Vector),
		Limit:          limit,
		ScoreThreshold: &threshold,
		WithPayload:    &pb.WithPayloadSelector{SelectorOptions: &pb.WithPayloadSelector_Enable{Enable: true}},
		VectorName:     new(orDefault(request.VectorName, fragmodel.DefaultDenseVectorName)),
	}

	if request.Filter != nil {
		req.Filter = buildQdrantFilter(request.Filter)
	}

	resp, err := c.points.Search(c.authContext(ctx), req)
	if err != nil {
		err = fmt.Errorf("failed to search: %w", err)
		c.logOperationTiming(ctx, "search_dense", startedAt, err,
			"collection", request.Collection,
			"vector_name", orDefault(request.VectorName, fragmodel.DefaultDenseVectorName),
			"top_k", request.TopK,
			"score_threshold", request.ScoreThreshold,
			"filter_applied", request.Filter != nil,
			"query_vector_dim", len(request.Vector),
		)
		return nil, err
	}

	results := make([]*SimilarityResult, len(resp.Result))
	for i, r := range resp.Result {
		payload := extractPayload(r.Payload)
		results[i] = &SimilarityResult{
			ID:       r.Id.GetUuid(),
			Score:    float64(r.Score),
			Payload:  payload,
			PointID:  r.Id.GetUuid(),
			Content:  getStringFromPayload(payload, "content"),
			Metadata: getMapFromPayload(payload, "metadata"),
		}
	}
	c.logOperationTiming(ctx, "search_dense", startedAt, nil,
		"collection", request.Collection,
		"vector_name", orDefault(request.VectorName, fragmodel.DefaultDenseVectorName),
		"top_k", request.TopK,
		"score_threshold", request.ScoreThreshold,
		"filter_applied", request.Filter != nil,
		"result_count", len(results),
		"query_vector_dim", len(request.Vector),
	)
	return results, nil
}

// SearchSparseWithFilter 使用命名 sparse vector 执行检索。
func (c *Client) SearchSparseWithFilter(ctx context.Context, request fragmodel.SparseSearchRequest) ([]*SimilarityResult, error) {
	startedAt := time.Now()
	if request.TopK < 0 {
		return nil, fmt.Errorf("%w: topK must be non-negative", ErrInvalidInput)
	}
	_, ok, err := buildSparseQuery(request.Document, request.Vector)
	if err != nil {
		return nil, err
	}
	if !ok {
		return []*SimilarityResult{}, nil
	}
	mode := qdrantSparseQueryMode(request.Document, request.Vector)
	if mode == qdrantSparseModeNone {
		return []*SimilarityResult{}, nil
	}
	strategy := c.compatibilityStrategy()
	plan := strategy.SparseSearchPlan(mode)
	return c.executeSparseSearchPlan(ctx, request, startedAt, strategy, plan)
}

func (c *Client) executeSparseSearchPlan(
	ctx context.Context,
	request fragmodel.SparseSearchRequest,
	startedAt time.Time,
	strategy compatibilityStrategy,
	plan sparseSearchPlan,
) ([]*SimilarityResult, error) {
	if plan.ImmediateUnsupported {
		err := fmt.Errorf("%w: document sparse search requires Points.Query", errQdrantQueryUnsupported)
		c.logSparseSearchOutcome(ctx, request, startedAt, nil, err, sparseSearchLogMeta{
			SelectedAPI:           plan.LogSelectedAPI,
			CompatibilityStrategy: strategy.Name(),
		})
		return nil, err
	}

	results, err := c.runSparseSearchAPI(ctx, request, plan.Primary)
	c.logSparseSearchOutcome(ctx, request, startedAt, results, err, sparseSearchLogMeta{
		SelectedAPI:           plan.LogSelectedAPI,
		CompatibilityStrategy: strategy.Name(),
	})
	return results, err
}

func (c *Client) runSparseSearchAPI(
	ctx context.Context,
	request fragmodel.SparseSearchRequest,
	api sparseSearchAPI,
) ([]*SimilarityResult, error) {
	if api == sparseSearchAPIQuery {
		return c.searchSparseWithQueryAPI(ctx, request)
	}
	return c.searchSparseWithLegacyAPI(ctx, request)
}

func (c *Client) searchSparseWithQueryAPI(
	ctx context.Context,
	request fragmodel.SparseSearchRequest,
) ([]*SimilarityResult, error) {
	query, ok, err := buildSparseQuery(request.Document, request.Vector)
	if err != nil {
		return nil, err
	}
	if !ok {
		return []*SimilarityResult{}, nil
	}

	threshold := float32(request.ScoreThreshold)
	limit, err := qdrantSearchLimit(request.TopK)
	if err != nil {
		return nil, err
	}
	req := &pb.QueryPoints{
		CollectionName: request.Collection,
		Query:          query,
		Using:          new(orDefault(request.VectorName, fragmodel.DefaultSparseVectorName)),
		Limit:          &limit,
		ScoreThreshold: &threshold,
		WithPayload:    &pb.WithPayloadSelector{SelectorOptions: &pb.WithPayloadSelector_Enable{Enable: true}},
	}
	if request.Filter != nil {
		req.Filter = buildQdrantFilter(request.Filter)
	}

	resp, err := c.points.Query(c.authContext(ctx), req)
	if err != nil {
		return nil, fmt.Errorf("qdrant points query: %w", err)
	}
	return similarityResultsFromScoredPoints(resp.GetResult()), nil
}

// searchSparseWithLegacyAPI 使用旧版 Search + sparse_indices 执行 vector sparse 查询。
func (c *Client) searchSparseWithLegacyAPI(
	ctx context.Context,
	request fragmodel.SparseSearchRequest,
) ([]*SimilarityResult, error) {
	vector, ok, err := normalizeSparseVector(request.Vector)
	if err != nil {
		return nil, err
	}
	if !ok {
		return []*SimilarityResult{}, nil
	}

	threshold := float32(request.ScoreThreshold)
	limit, err := qdrantSearchLimit(request.TopK)
	if err != nil {
		return nil, err
	}
	req := &pb.SearchPoints{
		CollectionName: request.Collection,
		Vector:         slices.Clone(vector.Values),
		SparseIndices:  &pb.SparseIndices{Data: slices.Clone(vector.Indices)},
		Limit:          limit,
		ScoreThreshold: &threshold,
		WithPayload:    &pb.WithPayloadSelector{SelectorOptions: &pb.WithPayloadSelector_Enable{Enable: true}},
		VectorName:     new(orDefault(request.VectorName, fragmodel.DefaultSparseVectorName)),
	}
	if request.Filter != nil {
		req.Filter = buildQdrantFilter(request.Filter)
	}

	resp, err := c.points.Search(c.authContext(ctx), req)
	if err != nil {
		return nil, fmt.Errorf("qdrant points search: %w", err)
	}
	return similarityResultsFromScoredPoints(resp.GetResult()), nil
}

func similarityResultsFromScoredPoints(points []*pb.ScoredPoint) []*SimilarityResult {
	results := make([]*SimilarityResult, len(points))
	for i, point := range points {
		payload := extractPayload(point.Payload)
		results[i] = &SimilarityResult{
			ID:       point.Id.GetUuid(),
			Score:    float64(point.Score),
			Payload:  payload,
			PointID:  point.Id.GetUuid(),
			Content:  getStringFromPayload(payload, "content"),
			Metadata: getMapFromPayload(payload, "metadata"),
		}
	}
	return results
}

func (c *Client) logSparseSearchOutcome(
	ctx context.Context,
	request fragmodel.SparseSearchRequest,
	startedAt time.Time,
	results []*SimilarityResult,
	err error,
	meta sparseSearchLogMeta,
) {
	if err != nil {
		err = fmt.Errorf("failed to search sparse vectors: %w", err)
	}
	fields := []any{
		"collection", request.Collection,
		"vector_name", orDefault(request.VectorName, fragmodel.DefaultSparseVectorName),
		"top_k", request.TopK,
		"score_threshold", request.ScoreThreshold,
		"filter_applied", request.Filter != nil,
		"sparse_mode", qdrantSparseQueryMode(request.Document, request.Vector),
		"query_term_count", sparseQueryTermCount(request.Vector),
		"document_model", sparseDocumentModel(request.Document),
		"selected_sparse_api", meta.SelectedAPI,
		"probe_status", c.capabilitySnapshot().ProbeStatus,
		"compatibility_strategy", meta.CompatibilityStrategy,
	}
	if err == nil {
		fields = append(fields, "result_count", len(results))
	}
	c.logOperationTiming(ctx, "search_sparse", startedAt, err, fields...)
}

func buildPointVectors(denseVector []float64, sparseInput *fragmodel.SparseInput) (*pb.Vectors, error) {
	named := make(map[string]*pb.Vector, 2)
	if len(denseVector) > 0 {
		named[fragmodel.DefaultDenseVectorName] = &pb.Vector{
			Vector: &pb.Vector_Dense{
				Dense: &pb.DenseVector{Data: toFloat32Vector(denseVector)},
			},
		}
	}
	document, vector, err := normalizeSparseInput(sparseInput)
	if err != nil {
		return nil, err
	}
	if document != nil {
		named[fragmodel.DefaultSparseVectorName] = pb.NewVectorDocument(document)
	} else if vector != nil {
		named[fragmodel.DefaultSparseVectorName] = pb.NewVectorSparse(vector.Indices, vector.Values)
	}
	return &pb.Vectors{
		VectorsOptions: &pb.Vectors_Vectors{
			Vectors: &pb.NamedVectors{Vectors: named},
		},
	}, nil
}

type restPointsUpsertRequest struct {
	Points []restPointUpsertRequest `json:"points"`
}

type restPointUpsertRequest struct {
	ID      string         `json:"id"`
	Vector  map[string]any `json:"vector"`
	Payload map[string]any `json:"payload,omitempty"`
}

type hybridPointsWriteRequest struct {
	Collection   string
	PointIDs     []string
	DenseVectors [][]float64
	SparseInputs []*fragmodel.SparseInput
	Payloads     []map[string]any
}

type hybridPointsWriteLogMeta struct {
	StartedAt    time.Time
	SparseMode   string
	Transport    hybridWriteTransport
	StrategyName string
}

func buildRESTPointVector(denseVector []float64, sparseInput *fragmodel.SparseInput) (map[string]any, error) {
	vector := make(map[string]any, 2)
	if len(denseVector) > 0 {
		vector[fragmodel.DefaultDenseVectorName] = denseVector
	}
	document, sparseVector, err := normalizeSparseInput(sparseInput)
	if err != nil {
		return nil, err
	}
	switch {
	case document != nil:
		entry := map[string]any{
			"text":  document.GetText(),
			"model": document.GetModel(),
		}
		if options := qdrantValueMapToNative(document.GetOptions()); len(options) > 0 {
			entry["options"] = options
		}
		vector[fragmodel.DefaultSparseVectorName] = entry
	case sparseVector != nil:
		vector[fragmodel.DefaultSparseVectorName] = map[string]any{
			"indices": sparseVector.Indices,
			"values":  sparseVector.Values,
		}
	}
	return vector, nil
}

func qdrantValueMapToNative(values map[string]*pb.Value) map[string]any {
	if len(values) == 0 {
		return nil
	}
	result := make(map[string]any, len(values))
	for key, value := range values {
		result[key] = qdrantValueToNative(value)
	}
	return result
}

func qdrantValueToNative(value *pb.Value) any {
	if value == nil {
		return nil
	}
	switch current := value.GetKind().(type) {
	case *pb.Value_NullValue:
		return nil
	case *pb.Value_BoolValue:
		return current.BoolValue
	case *pb.Value_IntegerValue:
		return current.IntegerValue
	case *pb.Value_DoubleValue:
		return current.DoubleValue
	case *pb.Value_StringValue:
		return current.StringValue
	case *pb.Value_ListValue:
		items := current.ListValue.GetValues()
		result := make([]any, 0, len(items))
		for _, item := range items {
			result = append(result, qdrantValueToNative(item))
		}
		return result
	case *pb.Value_StructValue:
		return qdrantValueMapToNative(current.StructValue.GetFields())
	default:
		return nil
	}
}

func buildQdrantDocument(document *fragmodel.SparseDocument) *pb.Document {
	if document == nil {
		return nil
	}
	text := strings.TrimSpace(document.Text)
	if text == "" {
		return nil
	}
	model := strings.TrimSpace(document.Model)
	if model == "" {
		model = fragmodel.DefaultSparseModelName
	}
	qdrantDocument := &pb.Document{
		Text:  text,
		Model: model,
	}
	if len(document.Options) > 0 {
		qdrantDocument.Options = pb.NewValueMap(document.Options)
	}
	return qdrantDocument
}

func normalizeSparseInput(input *fragmodel.SparseInput) (*pb.Document, *fragmodel.SparseVector, error) {
	if input == nil {
		return nil, nil, nil
	}
	document := buildQdrantDocument(input.Document)
	vector, vectorOK, err := normalizeSparseVector(input.Vector)
	if err != nil {
		return nil, nil, err
	}
	if document != nil && vectorOK {
		return nil, nil, fmt.Errorf("%w: sparse document and vector cannot both be set", ErrInvalidInput)
	}
	return document, vector, nil
}

func normalizeSparseVector(vector *fragmodel.SparseVector) (*fragmodel.SparseVector, bool, error) {
	if vector == nil || len(vector.Indices) == 0 || len(vector.Values) == 0 {
		return nil, false, nil
	}
	if len(vector.Indices) != len(vector.Values) {
		return nil, false, fmt.Errorf(
			"%w: sparse vector indices and values length mismatch: indices=%d values=%d",
			ErrInvalidInput,
			len(vector.Indices),
			len(vector.Values),
		)
	}
	return vector, true, nil
}

func buildSparseQuery(document *fragmodel.SparseDocument, vector *fragmodel.SparseVector) (*pb.Query, bool, error) {
	qdrantDocument := buildQdrantDocument(document)
	sparseVector, sparseOK, err := normalizeSparseVector(vector)
	if err != nil {
		return nil, false, err
	}
	if qdrantDocument != nil && sparseOK {
		return nil, false, fmt.Errorf("%w: sparse document and vector cannot both be set", ErrInvalidInput)
	}
	if qdrantDocument != nil {
		return pb.NewQueryNearest(pb.NewVectorInputDocument(qdrantDocument)), true, nil
	}
	if sparseOK {
		return pb.NewQuerySparse(sparseVector.Indices, sparseVector.Values), true, nil
	}
	return nil, false, nil
}

func toFloat32Vector(vector []float64) []float32 {
	result := make([]float32, len(vector))
	for i, value := range vector {
		result[i] = float32(value)
	}
	return result
}

func orDefault(value, fallback string) string {
	if strings.TrimSpace(value) == "" {
		return fallback
	}
	return value
}

// convertToQdrantPayload 将 map[string]any 转换为 Qdrant payload 格式
func convertToQdrantPayload(payload map[string]any) map[string]*pb.Value {
	if payload == nil {
		return nil
	}

	result := make(map[string]*pb.Value)
	for k, v := range payload {
		result[k] = toQdrantValue(v)
	}
	return result
}

// toQdrantValue 将值转换为 Qdrant Value
func toQdrantValue(v any) *pb.Value {
	if v == nil {
		return &pb.Value{Kind: &pb.Value_NullValue{}}
	}

	switch val := v.(type) {
	case string:
		return &pb.Value{Kind: &pb.Value_StringValue{StringValue: val}}
	case int:
		return &pb.Value{Kind: &pb.Value_IntegerValue{IntegerValue: int64(val)}}
	case int64:
		return &pb.Value{Kind: &pb.Value_IntegerValue{IntegerValue: val}}
	case float64:
		return &pb.Value{Kind: &pb.Value_DoubleValue{DoubleValue: val}}
	case bool:
		return &pb.Value{Kind: &pb.Value_BoolValue{BoolValue: val}}
	case map[string]any:
		return &pb.Value{Kind: &pb.Value_StructValue{StructValue: &pb.Struct{Fields: convertToQdrantPayload(val)}}}
	case []any:
		list := make([]*pb.Value, len(val))
		for i, item := range val {
			list[i] = toQdrantValue(item)
		}
		return &pb.Value{Kind: &pb.Value_ListValue{ListValue: &pb.ListValue{Values: list}}}
	default:
		return &pb.Value{Kind: &pb.Value_StringValue{StringValue: fmt.Sprintf("%v", v)}}
	}
}

// extractPayload 从 Qdrant payload 提取为 map[string]any
func extractPayload(payload map[string]*pb.Value) map[string]any {
	if payload == nil {
		return nil
	}

	result := make(map[string]any)
	for k, v := range payload {
		result[k] = fromQdrantValue(v)
	}
	return result
}

// fromQdrantValue 将 Qdrant Value 转换为 Go 值
func fromQdrantValue(v *pb.Value) any {
	if v == nil {
		return nil
	}

	switch val := v.Kind.(type) {
	case *pb.Value_StringValue:
		return val.StringValue
	case *pb.Value_IntegerValue:
		return val.IntegerValue
	case *pb.Value_DoubleValue:
		return val.DoubleValue
	case *pb.Value_BoolValue:
		return val.BoolValue
	case *pb.Value_StructValue:
		if val.StructValue != nil {
			return extractPayload(val.StructValue.Fields)
		}
		return nil
	case *pb.Value_ListValue:
		if val.ListValue != nil {
			list := make([]any, len(val.ListValue.Values))
			for i, item := range val.ListValue.Values {
				list[i] = fromQdrantValue(item)
			}
			return list
		}
		return nil
	case *pb.Value_NullValue:
		return nil
	default:
		return nil
	}
}

// buildQdrantFilter 构建 Qdrant 过滤条件
func buildQdrantFilter(filter *fragmodel.VectorFilter) *pb.Filter {
	if filter == nil {
		return nil
	}

	must := buildConditions(filter.Must)
	should := buildConditions(filter.Should)
	mustNot := buildConditions(filter.MustNot)

	if len(must) == 0 && len(should) == 0 && len(mustNot) == 0 {
		return nil
	}

	return &pb.Filter{
		Must:    must,
		Should:  should,
		MustNot: mustNot,
	}
}

func buildConditions(filters []fragmodel.FieldFilter) []*pb.Condition {
	if len(filters) == 0 {
		return nil
	}

	conditions := make([]*pb.Condition, 0, len(filters))
	for _, f := range filters {
		conditions = append(conditions, buildFieldConditions(f)...)
	}
	if len(conditions) == 0 {
		return nil
	}
	return conditions
}

func buildFieldConditions(filter fragmodel.FieldFilter) []*pb.Condition {
	if filter.Key == "" {
		return nil
	}

	match := filter.Match

	if match.Range != nil && !isRangeEmpty(match.Range) {
		return []*pb.Condition{rangeCondition(filter.Key, match.Range)}
	}

	if match.EqString != nil {
		return []*pb.Condition{matchCondition(filter.Key, &pb.Match{MatchValue: &pb.Match_Keyword{Keyword: *match.EqString}})}
	}

	if match.EqBool != nil {
		return []*pb.Condition{matchCondition(filter.Key, &pb.Match{MatchValue: &pb.Match_Boolean{Boolean: *match.EqBool}})}
	}

	if match.EqFloat != nil {
		val := *match.EqFloat
		eqRange := &fragmodel.Range{Gte: &val, Lte: &val}
		return []*pb.Condition{rangeCondition(filter.Key, eqRange)}
	}

	if len(match.InStrings) > 0 {
		return []*pb.Condition{matchCondition(filter.Key, &pb.Match{MatchValue: &pb.Match_Keywords{Keywords: &pb.RepeatedStrings{Strings: match.InStrings}}})}
	}

	if len(match.InFloats) > 0 {
		should := make([]*pb.Condition, 0, len(match.InFloats))
		for _, v := range match.InFloats {
			val := v
			eqRange := &fragmodel.Range{Gte: &val, Lte: &val}
			should = append(should, rangeCondition(filter.Key, eqRange))
		}
		if len(should) == 0 {
			return nil
		}
		return []*pb.Condition{{
			ConditionOneOf: &pb.Condition_Filter{
				Filter: &pb.Filter{Should: should},
			},
		}}
	}

	return nil
}

func matchCondition(key string, match *pb.Match) *pb.Condition {
	if match == nil {
		return nil
	}
	return &pb.Condition{
		ConditionOneOf: &pb.Condition_Field{
			Field: &pb.FieldCondition{
				Key:   key,
				Match: match,
			},
		},
	}
}

func rangeCondition(key string, r *fragmodel.Range) *pb.Condition {
	if r == nil || isRangeEmpty(r) {
		return nil
	}
	return &pb.Condition{
		ConditionOneOf: &pb.Condition_Field{
			Field: &pb.FieldCondition{
				Key:   key,
				Range: &pb.Range{Lt: r.Lt, Gt: r.Gt, Gte: r.Gte, Lte: r.Lte},
			},
		},
	}
}

func isRangeEmpty(r *fragmodel.Range) bool {
	return r == nil || (r.Lt == nil && r.Gt == nil && r.Gte == nil && r.Lte == nil)
}

// getStringFromPayload 从 payload 中获取字符串值
func getStringFromPayload(payload map[string]any, key string) string {
	if v, ok := payload[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

// getMapFromPayload 从 payload 中获取 map 值
func getMapFromPayload(payload map[string]any, key string) map[string]any {
	if v, ok := payload[key]; ok {
		if m, ok := v.(map[string]any); ok {
			return m
		}
	}
	return nil
}
