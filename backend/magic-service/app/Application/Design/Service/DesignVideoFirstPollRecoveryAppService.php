<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Service;

use App\Application\Design\Event\Message\DesignVideoPollMessage;
use App\Application\Design\Event\Publish\DesignVideoPollDelayPublisher;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use Hyperf\Amqp\Producer;
use Psr\Log\LoggerInterface;
use Throwable;

class DesignVideoFirstPollRecoveryAppService
{
    private const int BATCH_SIZE = 100;

    private const int MAX_BATCHES_PER_RUN = 10;

    public function __construct(
        private readonly DesignGenerationTaskDomainService $domainService,
        private readonly Producer $producer,
        private readonly LoggerInterface $logger,
    ) {
    }

    public function recover(): void
    {
        $cursorId = 0;

        for ($batchIndex = 0; $batchIndex < self::MAX_BATCHES_PER_RUN; ++$batchIndex) {
            $tasks = $this->domainService->findProcessingTasksAfterId($cursorId, self::BATCH_SIZE);
            if ($tasks === []) {
                return;
            }

            foreach ($tasks as $task) {
                $cursorId = max($cursorId, (int) ($task->getId() ?? 0));

                if (! $this->shouldRecoverFirstPoll($task)) {
                    continue;
                }

                $dataIsolation = DesignDataIsolation::create(
                    $task->getOrganizationCode(),
                    $task->getUserId()
                );

                try {
                    $this->producer->produce(new DesignVideoPollDelayPublisher(new DesignVideoPollMessage(
                        $task->getOrganizationCode(),
                        $task->getProjectId(),
                        $task->getGenerationId(),
                    )));
                    $this->domainService->markFirstPollSent($dataIsolation, $task);
                } catch (Throwable $throwable) {
                    $this->domainService->markFirstPollDispatchFailed(
                        $dataIsolation,
                        $task,
                        $throwable->getMessage(),
                        $this->buildNextRetryAt()
                    );
                    $this->logger->error('design video first poll recovery failed', [
                        'generation_id' => $task->getGenerationId(),
                        'project_id' => $task->getProjectId(),
                        'organization_code' => $task->getOrganizationCode(),
                        'error' => $throwable->getMessage(),
                    ]);
                }
            }

            if (count($tasks) < self::BATCH_SIZE) {
                return;
            }
        }
    }

    private function shouldRecoverFirstPoll(DesignGenerationTaskEntity $task): bool
    {
        if ($task->getOperationId() === '' || $task->getLastPolledAt() !== null) {
            return false;
        }

        if (! in_array($task->getFirstPollStatus(), ['pending', 'failed'], true)) {
            return false;
        }

        $deadlineAt = $task->getPollDeadlineAt();
        if ($deadlineAt !== null && strtotime($deadlineAt) !== false && time() > strtotime($deadlineAt)) {
            return false;
        }

        $nextRetryAt = $task->getFirstPollNextRetryAt();
        if ($nextRetryAt === null) {
            return true;
        }

        $nextRetryTimestamp = strtotime($nextRetryAt);
        if ($nextRetryTimestamp === false) {
            return true;
        }

        return $nextRetryTimestamp <= time();
    }

    private function buildNextRetryAt(): string
    {
        return date(DATE_ATOM, time() + 60);
    }
}
