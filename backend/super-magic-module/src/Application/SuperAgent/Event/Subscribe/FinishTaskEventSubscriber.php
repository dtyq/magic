<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use Dtyq\SuperMagic\Domain\SuperAgent\Entity\TopicEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\CreationSource;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\FinishTaskEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageScheduleDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

#[Listener]
class FinishTaskEventSubscriber implements ListenerInterface
{
    /**
     * Logger instance.
     */
    private LoggerInterface $logger;

    /**
     * Constructor - 使用构造函数注入依赖.
     */
    public function __construct(
        private readonly TopicDomainService $topicDomainService,
        private readonly MessageScheduleDomainService $messageScheduleDomainService,
        private readonly LoggerFactory $loggerFactory
    ) {
        $this->logger = $this->loggerFactory->get(__CLASS__);
    }

    /**
     * Listen to events.
     */
    public function listen(): array
    {
        return [
            FinishTaskEvent::class,
        ];
    }

    /**
     * Process the event - 编排各种业务处理方法.
     */
    public function process(object $event): void
    {
        if (! $event instanceof FinishTaskEvent) {
            $this->logger->warning('[FinishTaskEventSubscriber] Event is not instance of FinishTaskEvent');
            return;
        }

        $topicId = $event->getTopicId();

        $this->logger->info('[FinishTaskEventSubscriber] 开始处理任务完成事件', [
            'organizationCode' => $event->getOrganizationCode(),
            'userId' => $event->getUserId(),
            'topicId' => $topicId,
            'projectId' => $event->getProjectId(),
            'taskId' => $event->getTaskId(),
        ]);

        try {
            // 1. 获取 TopicEntity
            $topicEntity = $this->topicDomainService->getTopicById($topicId);
            if (! $topicEntity) {
                $this->logger->warning('[FinishTaskEventSubscriber] Topic not found', ['topicId' => $topicId]);
                return;
            }

            // 2. 处理定时任务执行日志更新
            $this->updateScheduledTaskExecutionLog($topicEntity, $event);

            $this->logger->info('[FinishTaskEventSubscriber] 任务完成事件处理成功', [
                'taskId' => $event->getTaskId(),
                'topicId' => $topicId,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('[FinishTaskEventSubscriber] 任务完成事件处理失败', [
                'taskId' => $event->getTaskId(),
                'topicId' => $topicId,
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
        }
    }

    /**
     * 更新定时任务执行日志状态
     * 专门处理定时任务完成后的日志状态更新逻辑.
     */
    private function updateScheduledTaskExecutionLog(TopicEntity $topicEntity, FinishTaskEvent $event): void
    {
        $topicId = $event->getTopicId();
        $taskMessage = $event->getTaskMessage();

        // 1. 检查 source 是否等于定时任务，并且 source_id 不为空
        if ($topicEntity->getSource() !== CreationSource::SCHEDULED_TASK->value || empty($topicEntity->getSourceId())) {
            $this->logger->debug('[FinishTaskEventSubscriber] Topic is not from scheduled task or source_id is empty', [
                'topicId' => $topicId,
                'source' => $topicEntity->getSource(),
                'sourceId' => $topicEntity->getSourceId(),
            ]);
            return;
        }

        // 2. 获取任务状态
        $taskStatus = $taskMessage->getPayload()->getStatus();
        $isFinished = ($taskStatus === 'finished');

        $this->logger->info('[FinishTaskEventSubscriber] 处理定时任务执行日志更新', [
            'topicId' => $topicId,
            'sourceId' => $topicEntity->getSourceId(),
            'taskStatus' => $taskStatus,
            'isFinished' => $isFinished,
        ]);

        // 3. 根据任务状态更新执行日志
        $executionLogId = (int) $topicEntity->getSourceId();

        if ($isFinished) {
            // 任务成功完成，更新日志状态为成功
            $this->messageScheduleDomainService->markLogAsSuccess($executionLogId);

            $this->logger->info('[FinishTaskEventSubscriber] 标记执行日志为成功', [
                'executionLogId' => $executionLogId,
                'topicId' => $topicId,
            ]);
        } else {
            // 任务未正常完成，标记为失败
            $errorMessage = $taskMessage->getPayload()->getContent() ?? 'Task not finished properly';
            $this->messageScheduleDomainService->markLogAsFailed($executionLogId, $errorMessage);

            $this->logger->warning('[FinishTaskEventSubscriber] 标记执行日志为失败', [
                'executionLogId' => $executionLogId,
                'topicId' => $topicId,
                'taskStatus' => $taskStatus,
                'errorMessage' => $errorMessage,
            ]);
        }
    }
}
