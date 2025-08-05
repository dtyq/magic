<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\SuperAgent\Event\Subscribe;

use App\Infrastructure\Core\Exception\BusinessException;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use App\Infrastructure\Util\Locker\LockerInterface;
use Dtyq\SuperMagic\Application\SuperAgent\Service\HandleAgentMessageAppService;
use Dtyq\SuperMagic\Infrastructure\Utils\TaskTerminationUtil;
use Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\TopicTaskMessageDTO;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Contract\StdoutLoggerInterface;
use Hyperf\Redis\Redis;
use PhpAmqpLib\Message\AMQPMessage;
use PhpAmqpLib\Wire\AMQPTable;
use Throwable;

/**
 * 话题任务消息订阅者.
 */
#[Consumer(
    exchange: 'super_magic_topic_task_message',
    routingKey: 'super_magic_topic_task_message',
    queue: 'super_magic_topic_task_message',
    nums: 1
)]
class TopicTaskMessageSubscriber extends ConsumerMessage
{
    /**
     * @var AMQPTable|array 队列参数，用于设置优先级等
     */
    protected AMQPTable|array $queueArguments = [];

    /**
     * @var null|array QoS 配置，用于控制预取数量等
     */
    protected ?array $qos = [
        'prefetch_count' => 1, // 每次只预取1条消息
        'prefetch_size' => 0,
        'global' => false,
    ];

    /**
     * 构造函数.
     */
    public function __construct(
        private readonly HandleAgentMessageAppService $superAgentAppService,
        protected LockerInterface $locker,
        private readonly StdoutLoggerInterface $logger,
        private readonly Redis $redis
    ) {
        // 设置队列优先级参数
        // 注意：AMQPTable 的值需要是 AMQP 规范的类型，例如 ['S', 'value'] for string, ['I', value] for integer
        $this->queueArguments['x-max-priority'] = ['I', 10]; // 设置最高优先级为10
    }

    /**
     * 消费消息.
     *
     * @param mixed $data 消息数据
     * @param AMQPMessage $message 原始消息对象
     * @return Result 处理结果
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        try {
            // 记录接收到的消息内容
            $this->logger->debug(sprintf(
                '接收到话题任务消息: %s',
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));

            // 获取消息属性并检查秒级时间戳
            $messageProperties = $message->get_properties();
            $applicationHeaders = $messageProperties['application_headers'] ?? new AMQPTable([]);
            // 直接从原生数据中获取，如果不存在则为 null
            $originalTimestampFromHeader = $applicationHeaders->getNativeData()['x-original-timestamp'] ?? null;

            $currentTimeForLog = time(); // 当前处理时间，主要用于日志和可能的本地逻辑
            $actualOriginalTimestamp = null; // 初始化变量以避免 linter 警告

            if ($originalTimestampFromHeader !== null) {
                $actualOriginalTimestamp = (int) $originalTimestampFromHeader; // 确保是整数
                $this->logger->info(sprintf('消息已存在原始秒级时间戳: %d (%s), message_id: %s', $actualOriginalTimestamp, date('Y-m-d H:i:s', $actualOriginalTimestamp), $data['payload']['message_id'] ?? 'N/A'));
            } else {
                // 如果生产者没有设置 x-original-timestamp，这通常是一个需要注意的情况。
                $actualOriginalTimestamp = $currentTimeForLog;
                $this->logger->warning(sprintf(
                    '消息未找到 x-original-timestamp 头部，将使用当前时间作为本次处理的原始时间戳参考: %d (%s). 请确保生产者已设置此头部. Message ID: %s',
                    $actualOriginalTimestamp,
                    date('Y-m-d H:i:s', $actualOriginalTimestamp),
                    $data['payload']['message_id'] ?? 'N/A'
                ));
                // 不再尝试修改消息的 application_headers，因为这对于 REQUEUE 后的消息通常无效
            }

            // 验证消息格式
            $this->validateMessageFormat($data);

            // 创建DTO
            $messageDTO = TopicTaskMessageDTO::fromArray($data);

            // Check if task has been terminated before processing
            $taskId = $messageDTO->getMetadata()?->getSuperMagicTaskId();
            if (TaskTerminationUtil::isTaskTerminated($this->redis, $this->logger, $taskId)) {
                $this->logger->info(sprintf('任务 %s 已终止，将直接处理消息', $taskId));
                return Result::ACK;
            }

            // 获取sandboxId用于锁定
            $sandboxId = $messageDTO->getMetadata()?->getSandboxId();
            if (empty($sandboxId)) {
                $this->logger->warning('缺少有效的sandboxId，无法加锁保证消息顺序性，将直接处理消息', [
                    'message_id' => $messageDTO->getPayload()?->getMessageId(),
                    'message' => json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ]);
                return Result::ACK;
            }

            // 尝试获取锁
            $lockKey = 'handle_sandbox_message_lock:' . $sandboxId;
            $lockOwner = IdGenerator::getUniqueId32();
            $lockExpireSeconds = 30;

            $lockAcquired = $this->acquireLock($lockKey, $lockOwner, $lockExpireSeconds);

            if (! $lockAcquired) {
                $this->logger->info(sprintf(
                    '无法获取sandbox %s的锁，该sandbox可能有其他消息正在处理中，将消息重新入队等待处理，原始接收秒级时间: %d (%s), message_id: %s',
                    $sandboxId,
                    $actualOriginalTimestamp, // 使用 actualOriginalTimestamp
                    date('Y-m-d H:i:s', $actualOriginalTimestamp),
                    $messageDTO->getPayload()?->getMessageId()
                ));
                return Result::ACK;
            }

            $this->logger->info(sprintf(
                '已获取sandbox %s的锁，持有者: %s，开始处理消息，原始接收秒级时间: %d (%s), message_id: %s',
                $sandboxId,
                $lockOwner,
                $actualOriginalTimestamp, // 使用 actualOriginalTimestamp
                date('Y-m-d H:i:s', $actualOriginalTimestamp),
                $messageDTO->getPayload()?->getMessageId()
            ));

            try {
                $this->superAgentAppService->handleAgentMessage($messageDTO);
                return Result::ACK;
            } finally {
                if ($this->releaseLock($lockKey, $lockOwner)) {
                    $this->logger->info(sprintf(
                        '已释放sandbox %s的锁，持有者: %s, message_id: %s',
                        $sandboxId,
                        $lockOwner,
                        $messageDTO->getPayload()?->getMessageId()
                    ));
                } else {
                    $this->logger->error(sprintf(
                        '释放sandbox %s的锁失败，持有者: %s，可能需要人工干预, message_id: %s',
                        $sandboxId,
                        $lockOwner,
                        $messageDTO->getPayload()?->getMessageId()
                    ));
                }
            }
        } catch (BusinessException $e) {
            $this->logger->error(sprintf(
                '处理话题任务消息失败，业务异常: %s, 消息内容: %s',
                $e->getMessage(),
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '处理话题任务消息失败，系统异常: %s, 消息内容: %s',
                $e->getMessage(),
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return Result::ACK;
        }
    }

    public function acquireLock(string $lockKey, string $lockOwner, int $lockExpireSeconds): bool
    {
        return $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
    }

    /**
     * 验证消息格式.
     *
     * @param mixed $data 消息数据
     * @throws BusinessException 如果消息格式不正确则抛出异常
     */
    private function validateMessageFormat($data): void
    {
        // 检查是否为新格式消息
        if (isset($data['metadata'], $data['payload'])) {
            // 新格式消息，检查payload中的必要字段
            $payload = $data['payload'];
            $requiredFields = [
                'message_id',
                'type',
                'task_id',
            ];

            foreach ($requiredFields as $field) {
                if (! isset($payload[$field]) || empty($payload[$field])) {
                    $this->logger->warning(sprintf(
                        '消息格式不正确，payload中缺少必要字段: %s, 消息内容: %s',
                        $field,
                        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    ));
                }
            }

            // 检查metadata中的必要字段
            if (! isset($data['metadata']['sandbox_id']) || empty($data['metadata']['sandbox_id'])) {
                $this->logger->warning(sprintf(
                    '消息格式不正确，metadata中缺少sandbox_id字段, 消息内容: %s',
                    json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                ));
            }
        } else {
            // 旧格式消息，检查必要字段
            $requiredFields = [
                'message_id',
                'type',
                'task_id',
                'sandbox_id',
            ];

            foreach ($requiredFields as $field) {
                if (! isset($data[$field]) || empty($data[$field])) {
                    $this->logger->warning(sprintf(
                        '消息格式不正确，缺少必要字段: %s, 消息内容: %s',
                        $field,
                        json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
                    ));
                }
            }
        }
    }

    private function releaseLock(string $lockKey, string $lockOwner): bool
    {
        return $this->locker->release($lockKey, $lockOwner);
    }
}
