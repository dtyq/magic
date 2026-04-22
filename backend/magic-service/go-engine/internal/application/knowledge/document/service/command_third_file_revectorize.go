package docapp

import (
	"context"
	"fmt"

	docdto "magic/internal/application/knowledge/document/dto"
	documentdomain "magic/internal/domain/knowledge/document/service"
	"magic/internal/domain/knowledge/shared"
)

// ThirdFileRevectorizeAppService 负责 third-file 重向量化命令流。
type ThirdFileRevectorizeAppService struct {
	support *DocumentAppService
}

// NewThirdFileRevectorizeAppService 创建 third-file 重向量化命令流应用服务。
func NewThirdFileRevectorizeAppService(support *DocumentAppService) *ThirdFileRevectorizeAppService {
	return &ThirdFileRevectorizeAppService{support: support}
}

// ReVectorizedByThirdFileID 按第三方文件调度一次重向量化。
func (s *ThirdFileRevectorizeAppService) ReVectorizedByThirdFileID(
	ctx context.Context,
	input *docdto.ReVectorizedByThirdFileIDInput,
) error {
	if s == nil || s.support == nil || input == nil {
		return nil
	}

	taskInput := documentdomain.NormalizeThirdFileRevectorizeInput(&documentdomain.ThirdFileRevectorizeInput{
		OrganizationCode:  input.OrganizationCode,
		UserID:            input.UserID,
		ThirdPlatformType: input.ThirdPlatformType,
		ThirdFileID:       input.ThirdFileID,
	})
	if taskInput == nil || taskInput.OrganizationCode == "" || taskInput.ThirdPlatformType == "" || taskInput.ThirdFileID == "" {
		return shared.ErrDocumentNotFound
	}

	if s.support.thirdFileScheduler == nil {
		return s.RunThirdFileRevectorize(ctx, taskInput)
	}
	s.support.thirdFileScheduler.Schedule(ctx, taskInput)
	return nil
}

// RunThirdFileRevectorize 执行第三方文件重向量化任务。
func (s *ThirdFileRevectorizeAppService) RunThirdFileRevectorize(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
) error {
	return s.runThirdFileRevectorize(ctx, input, true)
}

func (s *ThirdFileRevectorizeAppService) runThirdFileRevectorize(
	ctx context.Context,
	input *documentdomain.ThirdFileRevectorizeInput,
	async bool,
) error {
	if s == nil || s.support == nil || input == nil {
		return nil
	}

	lifecycle := documentdomain.NewThirdFileRevectorizeLifecycleService(
		s.support.domainService,
		thirdFileProviderGuardFunc(s.support.ensureThirdPlatformProvider),
		thirdFileSourceSnapshotResolverFunc(s.support.resolveThirdPlatformSourceSnapshot),
	)
	plan, err := lifecycle.Plan(ctx, documentdomain.ThirdFileRevectorizeLifecycleInput{
		Task:  input,
		Async: async,
	})
	if err != nil {
		return fmt.Errorf("plan third-file revectorize lifecycle: %w", err)
	}
	documentSyncApp := NewDocumentSyncAppService(s.support)
	for _, request := range plan.Requests {
		if async {
			s.support.ScheduleSync(ctx, request)
			continue
		}
		if err := documentSyncApp.Sync(ctx, request); err != nil {
			return err
		}
	}
	return nil
}
