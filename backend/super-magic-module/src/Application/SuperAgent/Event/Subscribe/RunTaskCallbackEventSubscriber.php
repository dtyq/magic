<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Domain\Chat\Entity\ValueObject\SocketEventType;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\SocketIO\SocketIOUtil;
use Dtyq\AsyncEvent\Kernel\Annotation\AsyncListener;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\ProjectMode;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Event\RunTaskCallbackEvent;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * RunTaskCallbackEvent事件监听器 - 录音总结完成检测.
 */
#[AsyncListener]
#[Listener]
class RunTaskCallbackEventSubscriber implements ListenerInterface
{
    private LoggerInterface $logger;

    public function __construct(
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(static::class);
    }

    /**
     * Listen to events.
     *
     * @return array Array of event classes to listen to
     */
    public function listen(): array
    {
        return [
            RunTaskCallbackEvent::class,
        ];
    }

    /**
     * Process the event.
     *
     * @param object $event Event object
     */
    public function process(object $event): void
    {
        // Type check
        if (! $event instanceof RunTaskCallbackEvent) {
            return;
        }

        // Check recording summary completion
        $this->checkRecordingSummaryCompletion($event);
    }

    /**
     * Check recording summary completion and send notification.
     * 检测录音总结是否完成，如果完成则推送通知.
     */
    private function checkRecordingSummaryCompletion(RunTaskCallbackEvent $event): void
    {
        try {
            // 获取话题信息
            $topicDomainService = di(TopicDomainService::class);
            $topicEntity = $topicDomainService->getTopicById($event->getTopicId());
            if ($topicEntity === null) {
                $this->logger->warning('checkRecordingSummary Topic not found for recording summary check', [
                    'topic_id' => $event->getTopicId(),
                    'task_id' => $event->getTaskId(),
                ]);
                return;
            }

            // 检查话题模式是否为 summary
            if ($topicEntity->getTopicMode() !== ProjectMode::SUMMARY->value) {
                return;
            }

            $status = $event->getTaskMessage()->getPayload()->getStatus();
            $taskStatus = TaskStatus::tryFrom($status);
            if ($taskStatus === null) {
                $this->logger->warning('checkRecordingSummary Task status not found for recording summary check', [
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                    'status' => $status,
                ]);
                return;
            }
            // 检查任务状态是否为 ERROR 或 FINISHED
            if ($taskStatus !== TaskStatus::ERROR && $taskStatus !== TaskStatus::FINISHED) {
                return;
            }

            // 获取用户信息
            $userId = $event->getUserId();
            $magicUserDomainService = di(MagicUserDomainService::class);
            $userEntity = $magicUserDomainService->getUserById($userId);

            if ($userEntity === null) {
                $this->logger->warning('checkRecordingSummary User not found for recording summary notification', [
                    'user_id' => $userId,
                    'task_id' => $event->getTaskId(),
                    'topic_id' => $event->getTopicId(),
                ]);
                return;
            }

            // 准备推送数据
            $pushData = [
                'type' => 'recording_summary_result',
                'recording_summary_result' => [
                    'workspace_id' => $topicEntity->getWorkspaceId(),
                    'project_id' => $topicEntity->getProjectId(),
                    'topic_id' => $topicEntity->getId(),
                    'organization_code' => $event->getOrganizationCode(),
                    'success' => $taskStatus === TaskStatus::FINISHED,
                    'timestamp' => time(),
                ],
            ];

            // 推送消息给客户端
            SocketIOUtil::sendIntermediate(
                SocketEventType::Intermediate,
                $userEntity->getMagicId(),
                $pushData
            );

            $this->logger->info('checkRecordingSummary 录音总结完成通知已推送', [
                'user_id' => $userId,
                'magic_id' => $userEntity->getMagicId(),
                'topic_id' => $topicEntity->getId(),
                'task_id' => $event->getTaskId(),
                'status' => $taskStatus->value,
                'success' => $taskStatus === TaskStatus::FINISHED,
            ]);
        } catch (Throwable $e) {
            $this->logger->error('checkRecordingSummary Failed to send recording summary completion notification', [
                'task_id' => $event->getTaskId(),
                'topic_id' => $event->getTopicId(),
                'user_id' => $event->getUserId(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);
        }
    }
}
