// Package main 提供 Go 侧向量库 bootstrap 工具。
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"

	configloader "magic/internal/config"
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/constants"
	"magic/internal/infrastructure/external"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/vectordb/qdrant"
)

var (
	ErrInvalidAction      = errors.New("invalid action")
	ErrUnknownAction      = errors.New("unknown action")
	ErrUnsupportedAction  = errors.New("action is no longer supported after SQL migrations moved to PHP")
	ErrVectorSizeMismatch = errors.New("knowledge base collection vector size mismatch")
)

// MigrationAction 表示 bootstrap 动作类型。
type MigrationAction string

const (
	ActionUp      MigrationAction = "up"
	ActionDown    MigrationAction = "down"
	ActionVersion MigrationAction = "version"
	ActionForce   MigrationAction = "force"
)

// String 实现 flag.Value。
func (a MigrationAction) String() string { return string(a) }

// Set 实现 flag.Value。
func (a *MigrationAction) Set(s string) error {
	switch s {
	case string(ActionUp), string(ActionDown), string(ActionVersion), string(ActionForce):
		*a = MigrationAction(s)
		return nil
	default:
		return fmt.Errorf("%w: %s", ErrInvalidAction, s)
	}
}

type migrationRunner struct {
	config *autoloadcfg.Config
	logger *logging.SugaredLogger
}

func main() {
	var (
		action = ActionUp
		steps  = flag.Int("steps", -1, "Number of steps to migrate (ignored by Go bootstrap)")
		_      = flag.Int("target", -1, "Target version to migrate to (deprecated)")
	)
	flag.Var(&action, "action", "Bootstrap action: up, version")
	flag.Parse()

	logger := logging.New().Named("cmd.migrate")
	ctx := context.Background()

	runner := newMigrationRunner(configloader.New(), logger)
	var err error

	switch action {
	case ActionUp:
		err = runner.bootstrap(*steps)
	case ActionVersion:
		runner.showStatus()
	case ActionDown, ActionForce:
		err = runner.unsupportedAction(action)
	default:
		err = fmt.Errorf("%w: %s", ErrUnknownAction, action)
	}

	if err != nil {
		logger.KnowledgeErrorContext(ctx, "Bootstrap failed", "error", err)
		return
	}

	logger.InfoContext(ctx, "Bootstrap completed successfully")
}

func newMigrationRunner(cfg *autoloadcfg.Config, logger *logging.SugaredLogger) *migrationRunner {
	return &migrationRunner{
		config: cfg,
		logger: logger,
	}
}

func (r *migrationRunner) bootstrap(steps int) error {
	if steps > 0 {
		r.logger.Infow("Ignoring steps for Go bootstrap", "steps", steps)
	}

	r.logger.Infow(
		"MySQL schema migrations are managed by the PHP service",
		"migration_dir", "../migrations",
	)

	if err := r.ensureKnowledgeBaseCollection(context.Background()); err != nil {
		return fmt.Errorf("bootstrap knowledge base collection: %w", err)
	}

	r.logger.Infow("Go bootstrap completed", "collection", constants.KnowledgeBaseCollectionName)
	return nil
}

func (r *migrationRunner) showStatus() {
	r.logger.Infow(
		"Go side no longer manages SQL migrations",
		"migration_dir", "../migrations",
		"bootstrap_target", constants.KnowledgeBaseCollectionName,
	)
}

func (r *migrationRunner) ensureKnowledgeBaseCollection(ctx context.Context) error {
	vectorSize, err := resolveEmbeddingDimensionForMigration(ctx, r.config)
	if err != nil {
		return err
	}

	client, err := qdrant.NewClient(&qdrant.Config{
		Host:       r.config.Qdrant.EffectiveHost(),
		Port:       r.config.Qdrant.Port,
		Credential: r.config.Qdrant.AuthValue,
	}, r.logger)
	if err != nil {
		return fmt.Errorf("failed to create qdrant client: %w", err)
	}
	defer func() {
		_ = client.Close()
	}()

	collectionName := constants.KnowledgeBaseCollectionName
	exists, err := client.CollectionExists(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("failed to check collection existence: %w", err)
	}
	if !exists {
		if err := client.CreateCollection(ctx, collectionName, vectorSize); err != nil {
			return fmt.Errorf("failed to create collection: %w", err)
		}
		return nil
	}

	info, err := client.GetCollectionInfo(ctx, collectionName)
	if err != nil {
		return fmt.Errorf("failed to get collection info: %w", err)
	}
	if info == nil || info.VectorSize != vectorSize {
		actual := int64(0)
		if info != nil {
			actual = info.VectorSize
		}
		return fmt.Errorf("%w: expected %d, actual %d", ErrVectorSizeMismatch, vectorSize, actual)
	}

	return nil
}

func resolveEmbeddingDimensionForMigration(ctx context.Context, cfg *autoloadcfg.Config) (int64, error) {
	if cfg.Embedding.ClientType == string(external.EmbeddingClientTypePHP) {
		if cfg.Embedding.Dimension > 0 {
			return int64(cfg.Embedding.Dimension), nil
		}
		return 0, fmt.Errorf("embedding.dimension required: %w", external.ErrMissingDimension)
	}

	defaultModel := cfg.MagicModelGateway.DefaultEmbeddingModel
	if defaultModel == "" {
		defaultModel = "text-embedding-3-small"
	}

	client := external.NewOpenAIEmbeddingClient(cfg.MagicModelGateway.BaseURL, nil)
	if cfg.MagicModelGateway.MagicAccessToken != "" {
		client.SetAccessToken(cfg.MagicModelGateway.MagicAccessToken)
	}
	embeddingSvc := external.NewEmbeddingService(client, defaultModel)
	resolver := external.NewEmbeddingDimensionResolver(cfg, embeddingSvc)
	dim, err := resolver.ResolveDimension(ctx, defaultModel)
	if err != nil {
		return 0, fmt.Errorf("resolve dimension: %w", err)
	}
	return dim, nil
}

func (r *migrationRunner) unsupportedAction(action MigrationAction) error {
	return fmt.Errorf("%w: %s", ErrUnsupportedAction, action)
}
