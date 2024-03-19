<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Service;

use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\ErrorCode\ChatErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Interfaces\Chat\Assembler\SeqAssembler;
use Hyperf\Codec\Json;
use Hyperf\DbConnection\Annotation\Transactional;
use Hyperf\DbConnection\Db;
use Throwable;

/**
 * 处理控制消息相关.
 */
class MagicControlDomainService extends AbstractDomainService
{
    /**
     * 返回收件方多条消息最终的阅读状态
     */
    public function getSenderMessageLatestReadStatus(string $senderMessageId, string $senderUserId): ?MagicSeqEntity
    {
        $senderSeqList = $this->magicSeqRepository->getSenderMessagesStatusChange($senderMessageId, $senderUserId);
        // 对于接收方来说,一个 sender_message_id 由于状态变化,可能会有多条记录,此处需要最后的状态
        $userMessagesReadStatus = $this->getMessageLatestStatus([$senderMessageId], $senderSeqList);
        return $userMessagesReadStatus[$senderMessageId] ?? null;
    }

    /**
     * 处理 mq 中分发的消息已读/已查看消息. 这些消息需要操作消息发送者的seq.
     */
    public function handlerMQReceiptSeq(MagicSeqEntity $receiveMagicSeqEntity): void
    {
        $controlMessageType = $receiveMagicSeqEntity->getSeqType();
        // 根据已读回执的发送方,解析出来消息发送方的信息
        $receiveConversationId = $receiveMagicSeqEntity->getConversationId();
        $receiveConversationEntity = $this->magicConversationRepository->getConversationById($receiveConversationId);
        if ($receiveConversationEntity === null) {
            $this->logger->error(sprintf(
                'messageDispatch 收件方的会话不存在 $conversation_id:%s $magicSeqEntity:%s',
                $receiveConversationId,
                Json::encode($receiveMagicSeqEntity->toArray(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            ));
            return;
        }
        // 通过回执发送者引用的消息id,找到发送者的消息id. (不可直接使用接收者的 sender_message_id 字段,这是一个不好的设计,随时取消)
        $senderMessageId = $this->magicSeqRepository->getSeqByMessageId($receiveMagicSeqEntity->getReferMessageId())?->getSenderMessageId();
        if ($senderMessageId === null) {
            $this->logger->error(sprintf(
                'messageDispatch 没有找到发送方的消息id $magicSeqEntity:%s $senderMessageId:%s',
                Json::encode($receiveMagicSeqEntity->toArray(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
                $senderMessageId
            ));
            return;
        }
        // 没有找到发送方的会话id
        $senderConversationId = $this->magicSeqRepository->getSeqByMessageId($senderMessageId)?->getConversationId();
        if ($senderConversationId) {
            $senderConversationEntity = $this->magicConversationRepository->getConversationById($senderConversationId);
        } else {
            $senderConversationEntity = null;
        }
        if ($senderConversationId === null || $senderConversationEntity === null) {
            $this->logger->error(sprintf(
                'messageDispatch 没有找到发送方的会话id $magicSeqEntity:%s',
                Json::encode($receiveMagicSeqEntity->toArray(), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE)
            ));
            return;
        }

        $senderUserId = $senderConversationEntity->getUserId();
        $senderMessageId = $receiveMagicSeqEntity->getSenderMessageId();
        # 这里加一下分布式行锁,防止并发修改消息接收人列表,造成数据覆盖.
        $spinLockKey = 'chat:seq:lock:' . $senderMessageId;
        $spinLockKeyOwner = random_bytes(8);
        try {
            if (! $this->redisLocker->spinLock($spinLockKey, $spinLockKeyOwner)) {
                // 自旋失败
                $this->logger->error(sprintf(
                    'messageDispatch 获取消息接收人列表的自旋锁超时 $spinLockKey:%s $magicSeqEntity:%s',
                    $spinLockKey,
                    Json::encode($receiveMagicSeqEntity->toArray())
                ));
                ExceptionBuilder::throw(ChatErrorCode::DATA_WRITE_FAILED);
            }
            // 获取每条消息的最终状态,解析出来接收人列表,
            $senderLatestSeq = $this->getSenderMessageLatestReadStatus($senderMessageId, $senderUserId);
            $receiveUserEntity = $this->magicUserRepository->getUserByAccountAndOrganization(
                $receiveMagicSeqEntity->getObjectId(),
                $receiveMagicSeqEntity->getOrganizationCode()
            );
            if ($receiveUserEntity === null) {
                $this->logger->error(sprintf(
                    'messageDispatch 回执消息未找到消息发送者 $magicSeqEntity:%s',
                    Json::encode($receiveMagicSeqEntity->toArray())
                ));
                return;
            }
            // 没找到seq,或者消息已被撤回
            if ($senderLatestSeq === null || $senderLatestSeq->getSeqType() === ControlMessageType::RevokeMessage) {
                $this->logger->error(sprintf(
                    'messageDispatch 回执消息没找到 seq,或者消息已被撤回 $senderLatestSeq:%s $magicSeqEntity:%s',
                    Json::encode($senderLatestSeq?->toArray()),
                    Json::encode($receiveMagicSeqEntity->toArray())
                ));
                return;
            }
            $messageStatus = MagicMessageStatus::getMessageStatusByControlMessageType($controlMessageType);

            switch ($controlMessageType) {
                case ControlMessageType::SeenMessages:
                    # 已读回执(扫了一眼消息,对于非文本的复杂类型消息,没有查看详情).
                    $senderReceiveList = $senderLatestSeq->getReceiveList();
                    if ($senderReceiveList === null) {
                        $this->logger->error(sprintf(
                            'messageDispatch 消息接收人列表为空 $magicSeqEntity:%s',
                            Json::encode($receiveMagicSeqEntity->toArray())
                        ));
                        return;
                    }
                    // 1.判断用户是否在未读列表中.
                    $unreadList = $senderReceiveList->getUnreadList();
                    if (! in_array($receiveUserEntity->getUserId(), $unreadList, true)) {
                        $this->logger->error(sprintf(
                            'messageDispatch 用户不在消息未读列表中（可能其他设备已读） $unreadList:%s $magicSeqEntity:%s',
                            Json::encode($unreadList),
                            Json::encode($receiveMagicSeqEntity->toArray())
                        ));
                        return;
                    }
                    // 2. 将已读的用户从未读移到已读
                    $key = array_search($receiveUserEntity->getUserId(), $unreadList, true);
                    if ($key !== false) {
                        unset($unreadList[$key]);
                        $unreadList = array_values($unreadList);
                    }
                    // 更新已读列表
                    $seenList = $senderReceiveList->getSeenList();
                    $seenList[] = $receiveUserEntity->getUserId();
                    $senderReceiveList->setUnreadList($unreadList);
                    $senderReceiveList->setSeenList($seenList);
                    // 为消息发送者生成新的seq,用于更新消息接收人列表
                    $senderLatestSeq->setReceiveList($senderReceiveList);
                    # 更新已读列表结束

                    $senderLatestSeq->setSeqType($controlMessageType);
                    $senderLatestSeq->setStatus($messageStatus);
                    $senderSeqData = $senderLatestSeq->toArray();
                    $senderSeqData['content'] = ['refer_message_ids' => [$senderMessageId]];
                    $senderSeenSeqEntity = SeqAssembler::generateStatusChangeSeqEntity($senderSeqData, $senderMessageId);
                    // 由于存在批量写入的情况,这里只生成entity,不调用create方法
                    $seqData = SeqAssembler::getInsertDataByEntity($senderSeenSeqEntity);
                    $seqData['app_message_id'] = $receiveMagicSeqEntity->getAppMessageId();
                    Db::transaction(function () use ($senderMessageId, $senderReceiveList, $seqData) {
                        // 写数据库,更新消息发送方的已读列表。这是为了复用消息收发通道，通知客户端有新的已读回执。
                        $this->magicSeqRepository->createSequence($seqData);
                        // 更新原始 chat_seq 的消息接收人列表。 避免拉取历史消息时，对方已读的消息还是显示未读。
                        $originalSeq = $this->magicSeqRepository->getSeqByMessageId($senderMessageId);
                        if ($originalSeq !== null) {
                            $originalSeq->setReceiveList($senderReceiveList);
                            $this->magicSeqRepository->updateReceiveList($originalSeq);
                        } else {
                            $this->logger->error(sprintf(
                                'messageDispatch 更新原始 chat_seq 失败，未找到原始消息 $senderMessageId:%s',
                                $senderMessageId
                            ));
                        }
                    });

                    // 3. 异步推送给消息的发送方,有人已读了他发出的消息
                    $this->pushControlSequence($senderSeenSeqEntity);
                    break;
                case ControlMessageType::ReadMessage:
                default:
                    break;
            }
        } finally {
            // 释放锁
            $this->redisLocker->release($spinLockKey, $spinLockKeyOwner);
        }
    }

    /**
     * 处理 mq 中分发的撤回/编辑消息. 这些消息是操作用户自己的seq.
     * @throws Throwable
     */
    public function handlerMQUserSelfMessageChange(MagicSeqEntity $changeMessageStatusSeqEntity): void
    {
        $controlMessageType = $changeMessageStatusSeqEntity->getSeqType();
        // 通过回执发送者引用的消息id,找到发送者的消息id. (不可直接使用接收者的 sender_message_id 字段,这是一个不好的设计,随时取消)
        $needChangeSeqEntity = $this->magicSeqRepository->getSeqByMessageId($changeMessageStatusSeqEntity->getReferMessageId());
        if ($needChangeSeqEntity === null) {
            $this->logger->error(sprintf(
                'messageDispatch 没有找到发送方的消息id $magicSeqEntity:%s',
                Json::encode($changeMessageStatusSeqEntity->toArray())
            ));
            return;
        }
        # 这里加一下分布式行锁,防止并发.
        $revokeMessageId = $needChangeSeqEntity->getSeqId();
        $spinLockKey = 'chat:seq:lock:' . $revokeMessageId;
        try {
            if (! $this->redisLocker->mutexLock($spinLockKey, $revokeMessageId)) {
                // 互斥失败
                $this->logger->error(sprintf(
                    'messageDispatch 撤回或者编辑消息失败 $spinLockKey:%s $magicSeqEntity:%s',
                    $spinLockKey,
                    Json::encode($changeMessageStatusSeqEntity->toArray())
                ));
                ExceptionBuilder::throw(ChatErrorCode::DATA_WRITE_FAILED);
            }
            // 更新原始消息的状态
            $messageStatus = MagicMessageStatus::getMessageStatusByControlMessageType($controlMessageType);
            $this->magicSeqRepository->batchUpdateSeqStatus([$needChangeSeqEntity->getSeqId()], $messageStatus);
            // 根据 magic_message_id 找到所有消息接收者
            $notifyAllReceiveSeqList = $this->batchCreateSeqByRevokeOrEditMessage($needChangeSeqEntity, $controlMessageType);
            // 排除用户自己,因为已经提前
            $this->batchPushControlSeqList($notifyAllReceiveSeqList);
        } finally {
            // 释放锁
            $this->redisLocker->release($spinLockKey, $revokeMessageId);
        }
    }

    /**
     * 分发群聊/私聊中的撤回或者编辑消息.
     * @return MagicSeqEntity[]
     */
    #[Transactional]
    public function batchCreateSeqByRevokeOrEditMessage(MagicSeqEntity $needChangeSeqEntity, ControlMessageType $controlMessageType): array
    {
        // 获取所有收件方的seq
        $receiveSeqList = $this->magicSeqRepository->getBothSeqListByMagicMessageId($needChangeSeqEntity->getMagicMessageId());
        $receiveSeqList = array_column($receiveSeqList, null, 'object_id');
        // 去掉自己,因为需要及时响应,已经单独生成了seq并推送了
        unset($receiveSeqList[$needChangeSeqEntity->getObjectId()]);
        $seqListCreateDTO = [];
        foreach ($receiveSeqList as $receiveSeq) {
            // 撤回的都是收件方自己会话窗口中的消息id
            $revokeMessageId = $receiveSeq['message_id'];
            $receiveSeq['status'] = MagicMessageStatus::Seen;
            $receiveSeq['seq_type'] = $controlMessageType->value;
            $receiveSeq['content'] = [
                'refer_message_id' => $revokeMessageId,
            ];
            $receiveSeq['refer_message_id'] = $revokeMessageId;
            $receiveSeq['receive_list'] = null;
            $seqListCreateDTO[] = SeqAssembler::generateStatusChangeSeqEntity(
                $receiveSeq,
                $revokeMessageId
            );
        }
        return $this->magicSeqRepository->batchCreateSeq($seqListCreateDTO);
    }
}
