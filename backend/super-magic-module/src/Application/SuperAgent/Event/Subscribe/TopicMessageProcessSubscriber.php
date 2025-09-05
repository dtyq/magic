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
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Result;
use Hyperf\Contract\StdoutLoggerInterface;
use PhpAmqpLib\Message\AMQPMessage;
use Throwable;

/**
 * 话题消息处理订阅者（基于数据库队列）.
 * 消费轻量级的TopicMessageProcessEvent，从数据库按顺序处理消息.
 */
#[Consumer(
    exchange: 'super_magic_topic_message_process',
    routingKey: 'super_magic_topic_message_process',
    queue: 'super_magic_topic_message_process',
    nums: 1
)]
class TopicMessageProcessSubscriber extends ConsumerMessage
{
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
        private readonly HandleAgentMessageAppService $handleAgentMessageAppService,
        protected LockerInterface $locker,
        private readonly StdoutLoggerInterface $logger,
    ) {
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
            // 记录接收到的轻量级事件
            $this->logger->debug(sprintf(
                '接收到话题消息处理事件: %s',
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));

            // 验证事件格式
            $this->validateEventFormat($data);

            // 获取topic_id
            $topicId = (int) ($data['topic_id'] ?? 0);
            $taskId = (int) ($data['task_id'] ?? 0);
            if ($topicId <= 0) {
                $this->logger->warning('无效的topic_id，跳过处理', [
                    'topic_id' => $topicId,
                    'event_data' => $data,
                ]);
                return Result::ACK;
            }

            // 尝试获取话题级别的锁
            $lockKey = 'handle_topic_message_lock:' . $topicId;
            $lockOwner = IdGenerator::getUniqueId32();
            $lockExpireSeconds = 50; // 给批量处理更多时间

            $lockAcquired = $this->acquireLock($lockKey, $lockOwner, $lockExpireSeconds);

            if (! $lockAcquired) {
                $this->logger->info(sprintf(
                    '无法获取topic %d的锁，可能有其他实例正在处理该话题的消息，直接ACK',
                    $topicId
                ));
                return Result::ACK; // 直接ACK，不重试
            }

            $this->logger->info(sprintf(
                '已获取topic %d的锁，持有者: %s，开始批量处理消息',
                $topicId,
                $lockOwner
            ));

            try {
                // 调用批量处理方法
                $processedCount = $this->handleAgentMessageAppService->batchHandleAgentMessage($topicId, 0);

                $this->logger->info(sprintf(
                    'topic %d 批量处理完成，处理消息数量: %d',
                    $topicId,
                    $processedCount
                ));

                return Result::ACK;
            } finally {
                if ($this->releaseLock($lockKey, $lockOwner)) {
                    $this->logger->info(sprintf(
                        '已释放topic %d的锁，持有者: %s',
                        $topicId,
                        $lockOwner
                    ));
                } else {
                    $this->logger->error(sprintf(
                        '释放topic %d的锁失败，持有者: %s，可能需要人工干预',
                        $topicId,
                        $lockOwner
                    ));
                }
            }
        } catch (BusinessException $e) {
            $this->logger->error(sprintf(
                '处理话题消息事件失败，业务异常: %s, 事件内容: %s',
                $e->getMessage(),
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error(sprintf(
                '处理话题消息事件失败，系统异常: %s, 事件内容: %s',
                $e->getMessage(),
                json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            ));
            return Result::ACK;
        }
    }

    /**
     * 获取分布式锁.
     */
    public function acquireLock(string $lockKey, string $lockOwner, int $lockExpireSeconds): bool
    {
        return $this->locker->spinLock($lockKey, $lockOwner, $lockExpireSeconds);
    }

    /**
     * 释放分布式锁.
     */
    private function releaseLock(string $lockKey, string $lockOwner): bool
    {
        return $this->locker->release($lockKey, $lockOwner);
    }

    /**
     * 验证事件格式.
     *
     * @param mixed $data 事件数据
     * @throws BusinessException 如果事件格式不正确则抛出异常
     */
    private function validateEventFormat($data): void
    {
        if (! is_array($data)) {
            throw new BusinessException('事件数据格式错误：必须是数组');
        }

        if (! isset($data['topic_id']) || ! is_numeric($data['topic_id'])) {
            throw new BusinessException('事件数据格式错误：缺少有效的topic_id字段');
        }
    }
}
