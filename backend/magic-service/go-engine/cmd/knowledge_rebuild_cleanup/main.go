// Package main 提供知识库重建残留集合的安全收敛命令。
package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"strings"
	"time"

	"github.com/redis/go-redis/v9"

	apprebuild "magic/internal/application/knowledge/rebuild"
	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	configloader "magic/internal/config"
	autoloadcfg "magic/internal/config/autoload"
	"magic/internal/di/infra"
	"magic/internal/infrastructure/logging"
	"magic/internal/infrastructure/persistence/mysql"
	"magic/internal/infrastructure/vectordb/qdrant"
)

type cleanupRunner interface {
	Cleanup(context.Context, *rebuilddto.CleanupInput) (*rebuilddto.CleanupResult, error)
}

func main() {
	apply := flag.Bool("apply", false, "apply safe cleanup instead of dry-run")
	forceDeleteNonEmpty := flag.Bool("force-delete-non-empty", false, "allow deleting non-empty candidate collections")
	flag.Parse()

	if err := run(context.Background(), *apply, *forceDeleteNonEmpty); err != nil {
		_, _ = fmt.Fprintf(os.Stderr, "knowledge rebuild cleanup failed: %v\n", err)
		os.Exit(1)
	}
}

func run(ctx context.Context, apply, forceDeleteNonEmpty bool) error {
	cfg := configloader.New()
	logger := infra.ProvideLogger(cfg)

	mysqlClient, mysqlCleanup, err := openMySQLClient(ctx, &cfg.MySQL, logger)
	if err != nil {
		return fmt.Errorf("open mysql client: %w", err)
	}
	defer mysqlCleanup()

	redisClient, redisCleanup, err := openRedisClient(ctx, &cfg.Redis)
	if err != nil {
		return fmt.Errorf("open redis client: %w", err)
	}
	defer redisCleanup()

	qdrantClient, qdrantCleanup, err := openQdrantClient(&cfg.Qdrant, logger)
	if err != nil {
		return fmt.Errorf("open qdrant client: %w", err)
	}
	defer qdrantCleanup()

	collectionRepo := infra.ProvideVectorDBManagementRepository(qdrantClient)
	store := infra.ProvideKnowledgeRebuildStore(mysqlClient, redisClient, logger)
	coordinator := infra.ProvideVectorRebuildCoordinator(redisClient, logger)
	service := apprebuild.NewCleanupService(store, coordinator, collectionRepo, nil, logger.Named("knowledge.domainrebuild.CleanupService"))

	return runWithService(ctx, service, apply, forceDeleteNonEmpty, os.Stdout)
}

func runWithService(ctx context.Context, service cleanupRunner, apply, forceDeleteNonEmpty bool, out io.Writer) error {
	report, err := service.Cleanup(ctx, &rebuilddto.CleanupInput{
		Apply:               apply,
		ForceDeleteNonEmpty: forceDeleteNonEmpty,
	})
	if err != nil {
		return fmt.Errorf("run cleanup service: %w", err)
	}

	output, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		return fmt.Errorf("marshal cleanup report: %w", err)
	}
	_, _ = out.Write(append(output, '\n'))
	return nil
}

func openMySQLClient(ctx context.Context, cfg *autoloadcfg.MySQLConfig, logger *logging.SugaredLogger) (*mysql.SQLCClient, func(), error) {
	params := cfg.Params
	if params == "" {
		params = "charset=utf8mb4&parseTime=True&loc=Local"
	}
	dsn := fmt.Sprintf("%s:%s@tcp(%s:%d)/%s?%s",
		cfg.Username, cfg.AuthValue, cfg.Host, cfg.Port, cfg.Database, params)

	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, nil, fmt.Errorf("open mysql: %w", err)
	}
	db.SetMaxOpenConns(cfg.MaxOpenConns)
	db.SetMaxIdleConns(cfg.MaxIdleConns)
	db.SetConnMaxLifetime(time.Duration(cfg.ConnMaxLifetime) * time.Second)

	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, nil, fmt.Errorf("ping mysql: %w", err)
	}

	client := mysql.NewSQLCClientWithDB(db, logger.Named("mysql.cleanup"), cfg.LogSql)
	return client, func() { _ = client.Close() }, nil
}

func openRedisClient(ctx context.Context, cfg *autoloadcfg.RedisConfig) (*redis.Client, func(), error) {
	client := redis.NewClient(&redis.Options{
		Addr:            fmt.Sprintf("%s:%d", cfg.Host, cfg.Port),
		Username:        cfg.Username,
		Password:        cfg.AuthValue,
		DB:              cfg.DB,
		PoolSize:        cfg.PoolSize,
		MinIdleConns:    cfg.MinIdleConns,
		ConnMaxIdleTime: time.Duration(cfg.ConnMaxIdleTime) * time.Second,
		ConnMaxLifetime: time.Duration(cfg.ConnMaxLifetime) * time.Second,
		PoolTimeout:     time.Duration(cfg.PoolTimeout) * time.Second,
	})
	if err := client.Ping(ctx).Err(); err != nil {
		_ = client.Close()
		return nil, nil, fmt.Errorf("ping redis: %w", err)
	}
	return client, func() { _ = client.Close() }, nil
}

func openQdrantClient(cfg *autoloadcfg.QdrantConfig, logger *logging.SugaredLogger) (*qdrant.Client, func(), error) {
	apiKey := strings.TrimSpace(cfg.AuthValue)
	if apiKey == "" {
		apiKey = strings.TrimSpace(os.Getenv("QDRANT_API_KEY"))
	}
	client, err := qdrant.NewClient(&qdrant.Config{
		Host:       cfg.EffectiveHost(),
		Port:       cfg.Port,
		Credential: apiKey,
	}, logger.Named("qdrant.cleanup"))
	if err != nil {
		return nil, nil, fmt.Errorf("connect qdrant: %w", err)
	}
	return client, func() { _ = client.Close() }, nil
}
