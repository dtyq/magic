<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Chat\Event\Subscribe\MessageDispatch;

use App\Application\Chat\Event\Subscribe\AbstractSeqConsumer;
use App\Domain\Chat\Entity\ValueObject\AmqpTopicType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ChatMessageType;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Chat\Event\Seq\SeqCreatedEvent;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Util\Locker\LockerInterface;
use Hyperf\Amqp\Result;
use Hyperf\Codec\Json;
use PhpAmqpLib\Message\AMQPMessage;
use Throwable;

use function Hyperf\Support\retry;

/**
 * 消息分发模块.
 * 处理不同优先级消息的消费者,用于写收件方的seq.
 */
abstract class AbstractMessageDispatchSubscriber extends AbstractSeqConsumer
{
    protected AmqpTopicType $topic = AmqpTopicType::Message;

    /**
     * 1.本地开发时不启动,避免消费了测试环境的数据,导致测试环境的用户收不到消息
     * 2.如果本地开发时想调试,请自行在本地搭建前端环境,更换mq的host. 或者申请一个dev环境,隔离mq.
     */
    public function isEnable(): bool
    {
        return config('amqp.enable_chat_message');
    }

    /**
     * 根据消息优先级.将收件方的消息生成序列号.
     * @param SeqCreatedEvent $data
     */
    public function consumeMessage($data, AMQPMessage $message): Result
    {
        $seqIds = (array) $data['seqIds'];
        if ($seqIds[0] === ControlMessageType::Ping->value) {
            return Result::ACK;
        }
        $conversationId = $data['conversationId'] ?? null;
        // 生成收件方的seq
        $this->logger->info(sprintf('messageDispatch 收到消息 data:%s', Json::encode($data)));
        $lock = di(LockerInterface::class);
        try {
            if ($conversationId) {
                $lockKey = sprintf('messageDispatch:lock:%s', $conversationId);
                $owner = uniqid('', true);
                $lock->spinLock($lockKey, $owner);
            }
            foreach ($seqIds as $seqId) {
                $seqId = (string) $seqId;
                // 用redis检测seq是否已经尝试多次,如果超过 n 次,则不再推送
                $seqRetryKey = sprintf('messageDispatch:seqRetry:%s', $seqId);
                $seqRetryCount = $this->redis->get($seqRetryKey);
                if ($seqRetryCount >= 3) {
                    $this->logger->error(sprintf('messageDispatch  $seqRetryKey:%s $seqRetryCount:%d', $seqRetryKey, $seqRetryCount));
                    return Result::ACK;
                }
                $this->addSeqRetryNumber($seqRetryKey);
                $userSeqEntity = null;
                // 查seq,失败延迟后重试3次
                retry(3, function () use ($seqId, &$userSeqEntity) {
                    $userSeqEntity = $this->magicChatSeqRepository->getSeqByMessageId($seqId);
                    if ($userSeqEntity === null) {
                        // 可能是事务还未提交,mq已经消费,延迟重试
                        ExceptionBuilder::throw(ChatErrorCode::SEQ_NOT_FOUND);
                    }
                }, 100);
                // 发送方的seq
                if ($userSeqEntity === null) {
                    $this->logger->error('messageDispatch seq not found:{seq_id} ', ['seq_id' => $seqId]);
                    $this->setSeqCanNotRetry($seqRetryKey);
                }
                $this->setRequestId($userSeqEntity->getAppMessageId());
                $this->logger->info(sprintf('messageDispatch 开始分发消息 seq:%s seqEntity:%s ', $seqId, Json::encode($userSeqEntity->toArray())));
                // 如果是控制消息,检查是否是需要分发的控制消息
                if ($userSeqEntity->getSeqType() instanceof ControlMessageType) {
                    $this->magicControlMessageAppService->dispatchMQControlMessage($userSeqEntity);
                    $this->setSeqCanNotRetry($seqRetryKey);
                    if ($userSeqEntity->canTriggerFlow()) {
                        $dataIsolation = new DataIsolation();
                        $dataIsolation->setCurrentOrganizationCode($userSeqEntity->getOrganizationCode());
                        $userEntity = $this->magicUserRepository->getUserByMagicId($dataIsolation, $userSeqEntity->getObjectId());
                        if ($userEntity === null) {
                            $this->logger->error('messageDispatch user not found: seqId:' . $seqId);
                            return Result::ACK;
                        }
                        $this->magicSeqDomainService->pushControlSeq($userSeqEntity, $userEntity);
                    }
                }
                if ($userSeqEntity->getSeqType() instanceof ChatMessageType) {
                    // 聊天消息分发
                    $this->magicChatMessageAppService->asyncHandlerChatMessage($userSeqEntity);
                }
                // seq 处理成功
                $this->setSeqCanNotRetry($seqRetryKey);
            }
        } catch (Throwable $exception) {
            $this->logger->error(sprintf(
                'messageDispatch error: %s file:%s line:%d trace: %s',
                $exception->getMessage(),
                $exception->getFile(),
                $exception->getLine(),
                $exception->getTraceAsString()
            ));
            // todo 调用消息质量保证模块,如果是服务器压力大导致的失败,则放入延迟重试队列,并指数级延长重试时间间隔
            return Result::REQUEUE;
        } finally {
            if (isset($lockKey, $owner)) {
                $lock->release($lockKey, $owner);
            }
        }
        return Result::ACK;
    }
}
