<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Event\Subscribe;

use App\Application\Speech\DTO\SummaryRequestDTO;
use App\Application\Speech\Event\AsrSummaryMessage;
use App\Application\Speech\Event\Publish\AsrSummaryRetryPublisher;
use App\Application\Speech\Service\AsrFileAppService;
use App\Domain\Asr\Constants\AsrConfig;
use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Infrastructure\Core\Traits\HasLogger;
use App\Infrastructure\Util\Context\CoContext;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Amqp\Annotation\Consumer;
use Hyperf\Amqp\Message\ConsumerMessage;
use Hyperf\Amqp\Producer;
use Hyperf\Amqp\Result;
use Hyperf\Contract\TranslatorInterface;
use Hyperf\Redis\Redis;
use PhpAmqpLib\Message\AMQPMessage;
use Throwable;

#[Consumer(
    exchange: 'asr.summary',
    routingKey: 'asr.summary',
    queue: 'asr.summary',
    nums: 1
)]
class AsrSummarySubscriber extends ConsumerMessage
{
    use HasLogger;

    public function __construct(
        private readonly AsrFileAppService $asrFileAppService,
        private readonly Redis $redis,
        private readonly LockerInterface $locker,
        private readonly Producer $producer
    ) {
    }

    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $msg = AsrSummaryMessage::fromArray($data);

        if ($msg->taskKey === '' || $msg->userId === '' || $msg->organizationCode === '') {
            $this->logger->error('ASR 总结 MQ 消息缺少必填字段，直接 ACK', [
                'task_key' => $msg->taskKey,
                'user_id' => $msg->userId,
                'organization_code' => $msg->organizationCode,
                'data' => $data,
            ]);
            return Result::ACK;
        }

        // 恢复上下文（与协程方式保持一致）
        di(TranslatorInterface::class)->setLocale($msg->language);
        CoContext::setLanguage($msg->language);
        if ($msg->requestId !== '') {
            CoContext::setRequestId($msg->requestId);
        }

        $lockName = sprintf(AsrRedisKeys::SUMMARY_MQ_RETRY_LOCK, md5($msg->userId . ':' . $msg->taskKey));
        $lockOwner = sprintf('%s:%s:%s', $msg->userId, $msg->taskKey, microtime(true));
        $locked = $this->locker->mutexLock($lockName, $lockOwner, AsrConfig::SUMMARY_MQ_RETRY_LOCK_TTL);
        if (! $locked) {
            // 未进入重试流程，不计数，直接进入死信延迟队列
            $this->producer->produce(new AsrSummaryRetryPublisher($msg));
            return Result::ACK;
        }

        // 重试次数控制：按 user_id + task_key 维度
        $retryKey = sprintf(AsrRedisKeys::SUMMARY_MQ_RETRY, md5($msg->userId . ':' . $msg->taskKey));
        try {
            $retryCount = (int) $this->redis->incr($retryKey);
            if ($retryCount === 1) {
                // 设置 TTL，避免永久占用
                $this->redis->expire($retryKey, AsrConfig::TASK_STATUS_TTL);
            }

            if ($retryCount > AsrConfig::SERVER_SUMMARY_MAX_RETRY) {
                $this->logger->warning('ASR_SUMMARY_RETRY_EXHAUSTED ASR 总结 MQ 重试次数超过上限，ACK 丢弃', [
                    'task_key' => $msg->taskKey,
                    'user_id' => $msg->userId,
                    'retry_count' => $retryCount,
                    'max_retry' => AsrConfig::SERVER_SUMMARY_MAX_RETRY,
                ]);

                // 避免客户端一直被锁死：超过上限时尝试解锁（不影响 ACK）
                try {
                    $taskStatus = $this->asrFileAppService->getTaskStatusFromRedis($msg->taskKey, $msg->userId);
                    if (! $taskStatus->isEmpty() && $taskStatus->hasServerSummaryLock()) {
                        $taskStatus->serverSummaryLocked = false;
                        $this->asrFileAppService->saveTaskStatusToRedis($taskStatus);
                    }
                } catch (Throwable $unlockException) {
                    $this->logger->warning('超过重试上限时解锁任务失败', [
                        'task_key' => $msg->taskKey,
                        'user_id' => $msg->userId,
                        'error' => $unlockException->getMessage(),
                    ]);
                }

                return Result::ACK;
            }

            $summaryRequest = new SummaryRequestDTO(
                $msg->taskKey,
                $msg->projectId,
                $msg->topicId,
                $msg->modelId,
                $msg->fileId,
                null,
                null,
                $msg->generatedTitle
            );

            // 关键：真正的总结逻辑仍复用应用服务（内部含分布式锁+幂等）
            $this->asrFileAppService->handleAsrSummary($summaryRequest, $msg->userId, $msg->organizationCode);

            // 成功则清理重试计数，避免后续重复任务被误判
            $this->redis->del($retryKey);

            return Result::ACK;
        } catch (Throwable $e) {
            $this->logger->error('ASR_SUMMARY_RETRY_FAIL 消费 ASR 总结 MQ 失败，10s 后将通过死信队列重试', [
                'task_key' => $msg->taskKey,
                'user_id' => $msg->userId,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            // 发送到死信延迟队列
            $this->producer->produce(new AsrSummaryRetryPublisher($msg));

            return Result::ACK;
        } finally {
            $this->locker->release($lockName, $lockOwner);
        }
    }
}
