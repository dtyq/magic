<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Facade;

use App\Domain\Chat\DTO\MessagesQueryDTO;
use App\Domain\Chat\DTO\Response\ClientSequenceResponse;
use App\Domain\Chat\Entity\Items\SeqExtra;
use App\Domain\Chat\Entity\MagicSeqEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationType;
use App\Domain\Chat\Entity\ValueObject\MagicMessageStatus;
use App\Domain\Chat\Entity\ValueObject\MessageType\ControlMessageType;
use App\Domain\Contact\Entity\MagicUserEntity;
use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\Core\Constants\Order;

interface MagicChatSeqRepositoryInterface
{
    public function createSequence(array $message): MagicSeqEntity;

    /**
     * @param MagicSeqEntity[] $seqList
     * @return MagicSeqEntity[]
     */
    public function batchCreateSeq(array $seqList): array;

    /**
     * 返回 $userLocalMaxSeqId 之后的 $limit 条消息.
     * @return ClientSequenceResponse[]
     */
    public function getAccountSeqListByMagicId(DataIsolation $dataIsolation, int $userLocalMaxSeqId, int $limit): array;

    /**
     * 根据 app_message_id 拉取消息.
     * @return ClientSequenceResponse[]
     */
    public function getAccountSeqListByAppMessageId(DataIsolation $dataIsolation, string $appMessageId, string $pageToken, int $pageSize): array;

    /**
     * 返回最大消息的倒数 n 条序列.
     * @return ClientSequenceResponse[]
     */
    public function pullRecentMessage(DataIsolation $dataIsolation, int $userLocalMaxSeqId, int $limit): array;

    public function getSeqByMessageId(string $messageId): ?MagicSeqEntity;

    /**
     * @return ClientSequenceResponse[]
     */
    public function getConversationChatMessages(MessagesQueryDTO $messagesQueryDTO): array;

    /**
     * @return ClientSequenceResponse[]
     * @todo 挪到 magic_chat_topic_messages 处理
     * 会话窗口滚动加载历史记录.
     * message_id= seq表的主键id,因此不需要单独对 message_id 加索引.
     */
    public function getConversationsChatMessages(MessagesQueryDTO $messagesQueryDTO, array $conversationIds): array;

    /**
     * 分组获取会话下最新的几条消息.
     */
    public function getConversationsMessagesGroupById(MessagesQueryDTO $messagesQueryDTO, array $conversationIds): array;

    /**
     * 获取收件方消息的状态变更流.
     * @return MagicSeqEntity[]
     */
    public function getReceiveMessagesStatusChange(array $referMessageIds, string $userId): array;

    /**
     * 获取发件方消息的状态变更流.
     * @return MagicSeqEntity[]
     */
    public function getSenderMessagesStatusChange(string $senderMessageId, string $userId): array;

    /**
     * @return ClientSequenceResponse[]
     */
    public function getConversationMessagesBySeqIds(array $messageIds, Order $order): array;

    public function getMessageReceiveList(string $messageId, string $magicId, ConversationType $userType): ?array;

    /**
     * Retrieve the sequence (seq) lists of both the sender and the receiver based on the $magicMessageId (generally used in the message editing scenario).
     */
    public function getBothSeqListByMagicMessageId(string $magicMessageId): array;

    /**
     * Optimized version: Group by object_id at MySQL level and return only the minimum seq_id record for each user.
     */
    public function getMinSeqListByMagicMessageId(string $magicMessageId): array;

    /**
     * 获取消息的撤回 seq.
     */
    public function getMessageRevokedSeq(string $messageId, MagicUserEntity $userEntity, ControlMessageType $controlMessageType): ?MagicSeqEntity;

    // 按类型获取会话中的seq
    public function getConversationSeqByType(string $magicId, string $conversationId, ControlMessageType $seqType): ?MagicSeqEntity;

    /**
     * @return MagicSeqEntity[]
     */
    public function batchGetSeqByMessageIds(array $messageIds): array;

    public function getSeqMessageByIds(array $ids);

    public function deleteSeqMessageByIds(array $seqIds): int;

    // 为了移除脏数据写的方法
    public function getSeqByMagicId(string $magicId, int $limit): array;

    // 为了移除脏数据写的方法
    public function getHasTrashMessageUsers(): array;

    public function updateSeqExtra(string $seqId, SeqExtra $seqExtra): bool;

    public function batchUpdateSeqStatus(array $seqIds, MagicMessageStatus $status): int;

    public function updateSeqRelation(MagicSeqEntity $seqEntity): bool;

    /**
     * 更新消息接收人列表.
     */
    public function updateReceiveList(MagicSeqEntity $seqEntity): bool;
}
