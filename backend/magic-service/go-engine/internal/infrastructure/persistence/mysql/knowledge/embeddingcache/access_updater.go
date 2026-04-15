package embeddingcache

import (
	"context"
	"fmt"

	"magic/internal/infrastructure/logging"
	mysqlclient "magic/internal/infrastructure/persistence/mysql"
	appruntime "magic/internal/infrastructure/runtime"
)

const (
	defaultAccessUpdateQueueSize                         = 1024
	accessUpdateExecutorName     appruntime.ExecutorName = "embedding_access_update"
)

type accessUpdater struct {
	executor *appruntime.AsyncExecutor[int64]
}

func newAccessUpdater(client *mysqlclient.SQLCClient, logger *logging.SugaredLogger) *accessUpdater {
	if client == nil {
		return &accessUpdater{}
	}
	return &accessUpdater{
		executor: appruntime.NewAsyncExecutor(appruntime.AsyncExecutorConfig[int64]{
			ExecutorName: accessUpdateExecutorName,
			QueueSize:    defaultAccessUpdateQueueSize,
			Logger:       logger,
			Handler: func(ctx context.Context, id int64) error {
				return client.Q().UpdateAccessByID(ctx, id)
			},
		}),
	}
}

func (u *accessUpdater) Enqueue(ctx context.Context, id int64) bool {
	if u == nil || u.executor == nil || id <= 0 {
		return false
	}
	return u.executor.Enqueue(ctx, id)
}

func (u *accessUpdater) Close(ctx context.Context) error {
	if u == nil || u.executor == nil {
		return nil
	}
	if err := u.executor.Close(ctx); err != nil {
		return fmt.Errorf("close embedding access updater: %w", err)
	}
	return nil
}
