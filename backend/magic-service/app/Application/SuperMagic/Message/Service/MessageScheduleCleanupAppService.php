<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Message\Service;

use App\Domain\SuperMagic\Message\Entity\MessageScheduleEntity;
use App\Domain\SuperMagic\Message\Service\MessageScheduleDomainService;
use Dtyq\TaskScheduler\Service\TaskSchedulerDomainService;
use Hyperf\DbConnection\Db;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

class MessageScheduleCleanupAppService
{
    private readonly LoggerInterface $logger;

    public function __construct(
        private readonly MessageScheduleDomainService $messageScheduleDomainService,
        private readonly TaskSchedulerDomainService $taskSchedulerDomainService,
        LoggerFactory $loggerFactory,
    ) {
        $this->logger = $loggerFactory->get('message_schedule_cleanup');
    }

    /** @return MessageScheduleEntity[] */
    public function getCandidates(int $afterId = 0, int $limit = 100, ?string $organizationCode = null, array $projectIds = []): array
    {
        return $this->messageScheduleDomainService->getCleanupCandidates($afterId, $limit, $organizationCode, $projectIds);
    }

    /** @param int[] $projectIds */
    public function cleanupProjects(array $projectIds, string $updatedUid): int
    {
        $projectIds = array_values(array_unique(array_filter(array_map('intval', $projectIds), static fn (int $id) => $id > 0)));
        if ($projectIds === []) {
            return 0;
        }

        $afterId = 0;
        $cleaned = 0;
        do {
            $candidates = $this->getCandidates($afterId, 100, projectIds: $projectIds);
            foreach ($candidates as $candidate) {
                $afterId = $candidate->getId();
                if ($this->cleanupSchedule($afterId, $updatedUid)) {
                    ++$cleaned;
                }
            }
        } while (count($candidates) === 100);

        return $cleaned;
    }

    public function cleanupSchedule(int $id, string $updatedUid): bool
    {
        try {
            return Db::transaction(function () use ($id, $updatedUid): bool {
                $schedule = $this->messageScheduleDomainService->getMessageScheduleForCleanup($id);
                if ($schedule === null || $schedule->getProjectId() <= 0) {
                    return false;
                }
                if ($this->messageScheduleDomainService->isProjectAvailableForCleanup($schedule->getProjectId())) {
                    return false;
                }

                // One-time tasks have no crontab ID but still have scheduler plans.
                $this->taskSchedulerDomainService->clearByExternalId('message_schedule_' . $id);
                $this->messageScheduleDomainService->markDeletedForCleanup($id, $updatedUid);
                $this->logger->info('已清理删除项目的定时任务', [
                    'schedule_id' => $id,
                    'project_id' => $schedule->getProjectId(),
                    'organization_code' => $schedule->getOrganizationCode(),
                ]);
                return true;
            });
        } catch (Throwable $exception) {
            $this->logger->error('删除项目的定时任务清理失败', [
                'schedule_id' => $id,
                'error' => $exception->getMessage(),
            ]);
            // Let async-event retain the failed event for its existing retry mechanism.
            throw $exception;
        }
    }
}
