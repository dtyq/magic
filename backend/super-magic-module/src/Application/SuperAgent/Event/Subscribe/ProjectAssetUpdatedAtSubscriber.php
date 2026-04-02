<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject\SuperMagicAgentDataIsolation;
use Dtyq\SuperMagic\Domain\Agent\Service\SuperMagicAgentDomainService;
use Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject\SkillDataIsolation;
use Dtyq\SuperMagic\Domain\Skill\Service\SkillDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ProjectEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\DirectoryDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileContentSavedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FilesBatchDeletedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FileUploadedEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\ProjectDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * 项目资产变更事件订阅器。
 *
 * 作用：
 * - 监听文件上传、保存、删除及目录删除等资产变更事件；
 * - 按项目模式（自定义智能体/自定义技能）回写关联资源的 updated_at。
 *
 * 生效方式：
 * - #[Listener] 将该类注册为 Hyperf 事件监听器；
 * - #[AsyncListener] 使事件以异步方式处理，避免阻塞主业务请求。
 */
#[AsyncListener]
#[Listener]
class ProjectAssetUpdatedAtSubscriber implements ListenerInterface
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly ProjectDomainService $projectDomainService,
        private readonly SuperMagicAgentDomainService $superMagicAgentDomainService,
        private readonly SkillDomainService $skillDomainService,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function listen(): array
    {
        // 仅监听会引起项目资产变化的事件，用于回写项目关联资源的更新时间。
        return [
            FileUploadedEvent::class,
            FileContentSavedEvent::class,
            FileDeletedEvent::class,
            DirectoryDeletedEvent::class,
            FilesBatchDeletedEvent::class,
        ];
    }

    public function process(object $event): void
    {
        try {
            $this->logger->info('Start handling project asset updated_at event', [
                'event' => $event::class,
            ]);

            // 统一从不同事件中提取项目上下文，避免在主流程中分支判断过多。
            $context = $this->resolveProjectContext($event);
            if ($context === null || $context['project_id'] <= 0) {
                $this->logger->warning('Skip project asset updated_at: invalid project context', [
                    'event' => $event::class,
                    'context' => $context,
                ]);
                return;
            }

            // 根据 project_id 查询项目实体；查不到时直接忽略，避免无效写操作。
            $project = $this->projectDomainService->getProjectNotUserId($context['project_id']);
            if ($project === null) {
                $this->logger->warning('Skip project asset updated_at: project not found', [
                    'event' => $event::class,
                    'project_id' => $context['project_id'],
                ]);
                return;
            }

            // 事件中优先使用组织编码，缺失时回退到项目归属组织。
            $organizationCode = $context['organization_code'] !== ''
                ? $context['organization_code']
                : $project->getUserOrganizationCode();
            if ($organizationCode === '') {
                $this->logger->warning('Skip project asset updated_at: organization code is empty', [
                    'event' => $event::class,
                    'project_id' => $project->getId(),
                ]);
                return;
            }

            // 操作人优先取事件上下文，再回退到项目更新人，最后回退到项目创建人。
            $userId = $context['user_id'] !== ''
                ? $context['user_id']
                : ($project->getUpdatedUid() !== '' ? $project->getUpdatedUid() : $project->getUserId());

            $this->touchProjectResource($project, $organizationCode, $userId);

            $this->logger->info('Project asset updated_at handled successfully', [
                'event' => $event::class,
                'project_id' => $project->getId(),
                'project_mode' => $project->getProjectMode(),
                'organization_code' => $organizationCode,
                'user_id' => $userId,
            ]);
        } catch (Throwable $throwable) {
            $this->logger->error('Update project asset updated_at failed', [
                'event' => $event::class,
                'error' => $throwable->getMessage(),
                'trace' => $throwable->getTraceAsString(),
            ]);
        }
    }

    /**
     * 将多种文件/目录事件归一化为统一上下文，便于后续处理。
     *
     * @return null|array{project_id:int,user_id:string,organization_code:string}
     */
    private function resolveProjectContext(object $event): ?array
    {
        return match (true) {
            $event instanceof FileUploadedEvent,
            $event instanceof FileContentSavedEvent,
            $event instanceof FileDeletedEvent => [
                'project_id' => $event->getFileEntity()->getProjectId(),
                'user_id' => $event->getUserId(),
                'organization_code' => $event->getOrganizationCode(),
            ],
            $event instanceof DirectoryDeletedEvent => [
                'project_id' => $event->getDirectoryEntity()->getProjectId(),
                'user_id' => $event->getUserAuthorization()->getId(),
                'organization_code' => $event->getUserAuthorization()->getOrganizationCode(),
            ],
            $event instanceof FilesBatchDeletedEvent => [
                'project_id' => $event->getProjectId(),
                'user_id' => $event->getUserAuthorization()->getId(),
                'organization_code' => $event->getUserAuthorization()->getOrganizationCode(),
            ],
            default => null,
        };
    }

    private function touchProjectResource(ProjectEntity $project, string $organizationCode, string $userId): void
    {
        // 按项目模式路由到不同领域服务，仅更新关联资源 updated_at，不做其他副作用。
        match ($project->getProjectMode()) {
            ProjectMode::CUSTOM_AGENT->value => $this->superMagicAgentDomainService->updateUpdatedAtByProjectId(
                SuperMagicAgentDataIsolation::create($organizationCode, $userId),
                $project->getId()
            ),
            ProjectMode::CUSTOM_SKILL->value => $this->skillDomainService->updateUpdatedAtByProjectId(
                SkillDataIsolation::create($organizationCode, $userId),
                $project->getId()
            ),
            default => null,
        };
    }
}
