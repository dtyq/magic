package rebuild

import (
	"context"
	"fmt"
	"strings"
	"time"

	rebuilddto "magic/internal/application/knowledge/rebuild/dto"
	"magic/internal/infrastructure/logging"
	"magic/internal/pkg/ctxmeta"
)

// NewTriggerService 创建重建触发服务。
func NewTriggerService(
	runner runExecutor,
	stateReader runStateReader,
	logger *logging.SugaredLogger,
) *TriggerService {
	return &TriggerService{
		runner:      runner,
		stateReader: stateReader,
		logger:      logger,
		now:         time.Now,
	}
}

// Trigger 异步触发重建任务；若已有运行中任务则返回 already_running。
func (s *TriggerService) Trigger(ctx context.Context, opts rebuilddto.RunOptions) (*TriggerResult, error) {
	if s.runner == nil {
		return nil, errTriggerRunnerNil
	}
	if s.stateReader == nil {
		return nil, errTriggerRunStateReaderNil
	}

	if runID := s.getPendingRunID(); runID != "" {
		return &TriggerResult{Status: TriggerStatusAlreadyRunning, RunID: runID}, nil
	}

	currentRunID, err := s.stateReader.GetCurrentRun(ctx)
	if err != nil {
		return nil, fmt.Errorf("get current rebuild run: %w", err)
	}
	currentRunID = strings.TrimSpace(currentRunID)
	if currentRunID != "" {
		return &TriggerResult{Status: TriggerStatusAlreadyRunning, RunID: currentRunID}, nil
	}

	runID := strings.TrimSpace(opts.ResumeRunID)
	if runID == "" {
		runID = fmt.Sprintf("r%d", s.now().UnixNano())
	}
	opts.ResumeRunID = runID

	s.setPendingRunID(runID)
	go s.runAsync(ctxmeta.Detach(ctx), opts, runID)

	return &TriggerResult{Status: TriggerStatusTriggered, RunID: runID}, nil
}

func (s *TriggerService) runAsync(ctx context.Context, opts rebuilddto.RunOptions, runID string) {
	defer s.clearPendingRunID(runID)

	if _, err := s.runner.Run(ctx, opts); err != nil && s.logger != nil {
		s.logger.KnowledgeErrorContext(ctx, "Knowledge rebuild run failed", "run_id", runID, "error", err)
	}
}

func (s *TriggerService) getPendingRunID() string {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.pendingRunID
}

func (s *TriggerService) setPendingRunID(runID string) {
	s.mu.Lock()
	s.pendingRunID = runID
	s.mu.Unlock()
}

func (s *TriggerService) clearPendingRunID(runID string) {
	s.mu.Lock()
	if s.pendingRunID == runID {
		s.pendingRunID = ""
	}
	s.mu.Unlock()
}
