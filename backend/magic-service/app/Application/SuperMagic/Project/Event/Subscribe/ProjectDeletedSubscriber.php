<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Project\Event\Subscribe;

use App\Application\SuperMagic\Message\Service\MessageScheduleCleanupAppService;
use App\Domain\SuperMagic\Message\Service\MessageQueueDomainService;
use App\Domain\SuperMagic\Project\Event\ProjectDeletedEvent;
use App\Domain\SuperMagic\Project\Event\ProjectsBatchDeletedEvent;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Task\Service\SandboxKeepAliveDomainService;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Central entry point for resource cleanup after single or batch project deletion.
 */
#[AsyncListener(driver: 'coroutine')]
#[Listener]
class ProjectDeletedSubscriber implements ListenerInterface
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly MessageScheduleCleanupAppService $messageScheduleCleanupAppService,
        private readonly MessageQueueDomainService $messageQueueDomainService,
        private readonly SandboxKeepAliveDomainService $sandboxKeepAliveDomainService,
        private readonly ProjectDomainService $projectDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    public function listen(): array
    {
        return [ProjectDeletedEvent::class, ProjectsBatchDeletedEvent::class];
    }

    public function process(object $event): void
    {
        if ($event instanceof ProjectDeletedEvent) {
            $projectIds = [$event->getProjectEntity()->getId()];
            $updatedUid = $event->getUserAuthorization()->getId();
        } elseif ($event instanceof ProjectsBatchDeletedEvent) {
            $projectIds = $event->getProjectIds();
            $updatedUid = $event->getUserAuthorization()->getId();
        } else {
            return;
        }

        $projectIds = array_values(array_unique(array_filter(array_map('intval', $projectIds), static fn (int $id) => $id > 0)));
        if ($projectIds === []) {
            return;
        }
        // Old events must not clean up resources belonging to restored projects.
        $availableIds = array_map(static fn ($project) => $project->getId(), $this->projectDomainService->getProjectsByIds($projectIds));
        $projectIds = array_values(array_diff($projectIds, $availableIds));
        if ($projectIds === []) {
            return;
        }

        // Add future project resource cleanup here, rather than another subscriber.
        $steps = [
            'message_schedules' => fn () => $this->messageScheduleCleanupAppService->cleanupProjects($projectIds, $updatedUid),
            'message_queues' => fn () => $this->messageQueueDomainService->cascadeDeleteUnfinishedByProjectIds($projectIds, 'Project deleted, message queue cascade cleanup'),
            'sandbox_keep_alive' => fn () => $this->sandboxKeepAliveDomainService->disableByProjectIds($projectIds, 'project deleted'),
        ];
        $failure = null;
        foreach ($steps as $name => $cleanup) {
            try {
                $affected = $cleanup();
                $this->logger->info('项目删除后置清理完成', [
                    'step' => $name,
                    'project_ids' => $projectIds,
                    'affected' => $affected,
                ]);
            } catch (Throwable $exception) {
                $failure ??= $exception;
                $this->logger->error('项目删除后置清理失败', [
                    'step' => $name,
                    'project_ids' => $projectIds,
                    'error' => $exception->getMessage(),
                ]);
            }
        }

        // All steps are idempotent. Keep failed events for async-event retries.
        if ($failure !== null) {
            throw $failure;
        }
    }
}
