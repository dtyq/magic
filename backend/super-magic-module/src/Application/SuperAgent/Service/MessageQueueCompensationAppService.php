<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Service;

use App\Application\Chat\Service\MagicChatMessageAppService;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use App\Interfaces\Chat\Assembler\MessageAssembler;
use Carbon\Carbon;
use Dtyq\SuperMagic\Domain\SuperAgent\Constant\AgentConstant;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\MessageQueueEntity;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\MessageQueueStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject\TaskStatus;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\MessageQueueDomainService;
use Dtyq\SuperMagic\Domain\SuperAgent\Service\TopicDomainService;
use Hyperf\Logger\LoggerFactory;
use Psr\Log\LoggerInterface;
use Throwable;

/**
 * Message Queue Compensation Application Service.
 * 消息队列补偿应用服务 - 负责编排补偿流程和锁控制.
 */
class MessageQueueCompensationAppService extends AbstractAppService
{
    // Lock strategy constants (应用层定义)
    private const GLOBAL_LOCK_KEY = 'msg_queue_compensation:global';

    // Fixed configuration constants (固定技术参数)
    private const BATCH_SIZE = 50;              // 每批处理话题数量

    private const GLOBAL_LOCK_EXPIRE = 30;      // 全局锁过期时间(秒)

    private const TOPIC_LOCK_EXPIRE = 300;      // 话题锁过期时间(秒) - 传递给 DomainService

    private const DELAY_MINUTES = 5;            // 延迟时间(分钟)

    protected LoggerInterface $logger;

    public function __construct(
        private readonly MagicChatMessageAppService $chatMessageAppService,
        private readonly MessageQueueDomainService $messageQueueDomainService,
        private readonly TopicDomainService $topicDomainService,
        private readonly MagicUserDomainService $userDomainService,
        private readonly LockerInterface $locker,
        LoggerFactory $loggerFactory
    ) {
        $this->logger = $loggerFactory->get(self::class);
    }

    /**
     * Execute compensation for pending message queues.
     * 执行消息队列补偿处理.
     */
    public function executeCompensation(): array
    {
        $stats = ['processed' => 0, 'success' => 0, 'failed' => 0, 'skipped' => 0];

        // Check if compensation is enabled
        $enabled = config('super-magic.user_message_queue.enabled', true);
        if (! $enabled) {
            return $stats;
        }

        // Global lock protection for entire compensation process
        $globalLockOwner = IdGenerator::getUniqueId32();
        $lockAcquired = $this->locker->spinLock(self::GLOBAL_LOCK_KEY, $globalLockOwner, self::GLOBAL_LOCK_EXPIRE);

        if (! $lockAcquired) {
            $this->logger->info('Unable to acquire global lock, skip compensation execution');
            return $stats;
        }

        try {
            // Phase 1: Query topics (no additional global lock needed)
            $topicIds = $this->getTopicIds();

            if (empty($topicIds)) {
                return $stats;
            }

            // Phase 2: Process each topic with topic lock protection and status check optimization
            foreach ($topicIds as $topicId) {
                $result = $this->processTopicWithLock($topicId);
                $this->updateStats($stats, $result);
            }

            return $stats;
        } finally {
            $this->locker->release(self::GLOBAL_LOCK_KEY, $globalLockOwner);
        }
    }

    /**
     * Get topic IDs for compensation processing.
     * 获取待处理话题ID.
     */
    private function getTopicIds(): array
    {
        // Application layer → Domain layer → Repository layer (only get topic IDs)
        $whitelist = config('super-magic.user_message_queue.whitelist', []);

        // Apply organization code filter based on whitelist
        $topicIds = $this->messageQueueDomainService->getCompensationTopics(self::BATCH_SIZE, $whitelist);

        $this->logger->info('Found topics for compensation', [
            'count' => count($topicIds),
            'organization_filter' => empty($whitelist) ? 'all' : 'whitelist',
            'whitelist_size' => count($whitelist),
        ]);

        return $topicIds;
    }

    /**
     * Process single topic with lock protection.
     * 使用统一的话题锁保护处理单个话题.
     */
    private function processTopicWithLock(int $topicId): string
    {
        // Acquire topic mutex lock from MessageQueueDomainService
        $lockOwner = $this->messageQueueDomainService->acquireTopicLock($topicId, self::TOPIC_LOCK_EXPIRE);

        if ($lockOwner === null) {
            $this->logger->info('Unable to acquire topic lock, skip processing', ['topic_id' => $topicId]);
            return 'skipped';
        }

        try {
            // Process topic with lock protection
            return $this->processTopicInternal($topicId);
        } finally {
            // Always release the lock
            $this->messageQueueDomainService->releaseTopicLock($topicId, $lockOwner);
        }
    }

    /**
     * Internal topic processing logic without lock management.
     * 话题处理内部逻辑，不包含锁管理.
     */
    private function processTopicInternal(int $topicId): string
    {
        try {
            // 2.1 First check topic status (Application layer → Domain layer)
            $topicEntity = $this->topicDomainService->getTopicById($topicId);

            if (! $topicEntity) {
                $this->logger->warning('Topic not found, skip processing', ['topic_id' => $topicId]);
                return 'skipped';
            }

            $topicStatus = $topicEntity->getCurrentTaskStatus();

            // If topic is running, delay messages directly without fetching message details
            if ($topicStatus->value === TaskStatus::RUNNING->value) {
                $this->messageQueueDomainService->delayTopicMessages($topicId, self::DELAY_MINUTES);
                $this->logger->info('Topic is running, delayed messages by {delay} minutes', [
                    'topic_id' => $topicId,
                    'delay' => self::DELAY_MINUTES,
                ]);
                return 'delayed';
            }

            // Only process if topic status is finished or suitable for processing
            //            if ($topicStatus?->value !== 'finished') {
            //                $this->logger->warning('Topic status is not suitable for processing, skip', [
            //                    'topic_id' => $topicId,
            //                    'status' => $topicStatus?->value ?? 'unknown'
            //                ]);
            //                return 'skipped';
            //            }

            // 2.2 Topic status OK, get message details (Application layer → Domain layer → Repository layer)
            $message = $this->messageQueueDomainService->getEarliestMessageByTopic($topicId);
            if (! $message) {
                $this->logger->debug('No pending messages for topic', ['topic_id' => $topicId]);
                return 'skipped';
            }

            // 2.3 Convert message content (Application layer directly calls)
            $chatMessageType = ChatMessageType::from($message->getMessageType());
            $messageStruct = MessageAssembler::getChatMessageStruct(
                $chatMessageType,
                $message->getMessageContentAsArray()
            );

            // 2.4 Update status to in progress (Application layer → Domain layer → Repository layer)
            $this->messageQueueDomainService->updateStatus(
                $message->getId(),
                MessageQueueStatus::IN_PROGRESS
            );

            // 2.5 Call send interface (Application layer → Application layer)
            $sendResult = $this->sendMessageToAgent($topicEntity->getChatTopicId(), $message, $messageStruct);

            // 2.6 Update final status (Application layer → Domain layer → Repository layer)
            $finalStatus = $sendResult['success'] ? MessageQueueStatus::COMPLETED : MessageQueueStatus::FAILED;
            $this->messageQueueDomainService->updateStatus(
                $message->getId(),
                $finalStatus,
                $sendResult['error_message']
            );

            $this->logger->info('Message processing completed', [
                'message_id' => $message->getId(),
                'topic_id' => $topicId,
                'success' => $sendResult['success'],
                'error_message' => $sendResult['error_message'],
            ]);

            return $sendResult['success'] ? 'success' : 'failed';
        } catch (Throwable $e) {
            $this->logger->error('Topic processing exception', [
                'topic_id' => $topicId,
                'error' => $e->getMessage(),
            ]);
            return 'failed';
        }
    }

    /**
     * Send message to agent using Chat service.
     * 使用聊天服务发送消息给助理.
     * @param mixed $messageStruct
     */
    private function sendMessageToAgent(
        string $chatTopicId,
        MessageQueueEntity $message,
        $messageStruct
    ): array {
        try {
            // Create MagicSeqEntity based on message content
            $seqEntity = new MagicSeqEntity();
            $seqEntity->setContent($messageStruct);
            $seqEntity->setSeqType(ChatMessageType::from($message->getMessageType()));

            // Set topic ID in extra
            $seqExtra = new SeqExtra();
            $seqExtra->setTopicId($chatTopicId);
            $seqEntity->setExtra($seqExtra);

            // Generate unique app message ID for deduplication
            $appMessageId = IdGenerator::getUniqueId32();

            // get agent user_id
            $dataIsolation = new DataIsolation();
            $dataIsolation->setCurrentOrganizationCode($message->getOrganizationCode());
            $aiUserEntity = $this->userDomainService->getByAiCode($dataIsolation, AgentConstant::SUPER_MAGIC_CODE);

            if (empty($aiUserEntity)) {
                $this->logger->error('Agent user not found, skip processing', ['topic_id' => $message->getTopicId()]);
                return [
                    'success' => false,
                    'error_message' => 'Agent user not found for organization: ' . $message->getOrganizationCode(),
                    'result' => null,
                ];
            }

            // Call userSendMessageToAgent
            $result = $this->chatMessageAppService->userSendMessageToAgent(
                aiSeqDTO: $seqEntity,
                senderUserId: $message->getUserId(),
                receiverId: $aiUserEntity->getUserId(),
                appMessageId: $appMessageId,
                doNotParseReferMessageId: false,
                sendTime: new Carbon(),
                receiverType: ConversationType::Ai,
                topicId: $chatTopicId
            );

            return [
                'success' => ! empty($result),
                'error_message' => null,
                'result' => $result,
            ];
        } catch (Throwable $e) {
            $this->logger->error('Failed to send message to agent', [
                'message_id' => $message->getId(),
                'topic_id' => $message->getTopicId(),
                'error' => $e->getMessage(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);

            return [
                'success' => false,
                'error_message' => $e->getMessage(),
                'result' => null,
            ];
        }
    }

    /**
     * Update statistics based on processing result.
     * 根据处理结果更新统计信息.
     */
    private function updateStats(array &$stats, string $result): void
    {
        ++$stats['processed'];

        match ($result) {
            'success' => $stats['success']++,
            'failed' => $stats['failed']++,
            'skipped', 'delayed' => $stats['skipped']++,
            default => null,
        };
    }
}
