<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Facade;

use App\Domain\Chat\DTO\MessagesQueryDTO;
use App\Domain\Chat\DTO\Response\ClientSequenceResponse;
use App\Domain\Chat\Entity\MagicTopicEntity;
use App\Domain\Chat\Entity\MagicTopicMessageEntity;

interface MagicChatTopicRepositoryInterface
{
    // 创建话题
    public function createTopic(MagicTopicEntity $magicTopicEntity): MagicTopicEntity;

    // 更新话题
    public function updateTopic(MagicTopicEntity $magicTopicEntity): MagicTopicEntity;

    // 删除话题
    public function deleteTopic(MagicTopicEntity $magicTopicDTO): int;

    /**
     * 获取会话的会话列表.
     * @param string[] $topicIds
     * @return array<MagicTopicEntity>
     */
    public function getTopicsByConversationId(string $conversationId, array $topicIds): array;

    public function getTopicEntity(MagicTopicEntity $magicTopicDTO): ?MagicTopicEntity;

    public function createTopicMessage(MagicTopicMessageEntity $topicMessageDTO): MagicTopicMessageEntity;

    public function createTopicMessages(array $data): bool;

    /**
     * @return array<MagicTopicMessageEntity>
     */
    public function getTopicMessageByMessageIds(array $messageIds): array;

    public function getPrivateChatReceiveTopicEntity(string $senderTopicId, string $senderConversationId): ?MagicTopicEntity;

    public function getTopicByName(string $conversationId, string $topicName): ?MagicTopicEntity;

    /**
     * @return array<MagicTopicMessageEntity>
     */
    public function getTopicMessagesByConversationId(string $conversationId): array;

    /**
     * 按时间范围获取会话下某个话题的消息.
     * @return ClientSequenceResponse[]
     */
    public function getTopicMessages(MessagesQueryDTO $messagesQueryDTO): array;

    public function deleteTopicByIds(array $ids);

    /**
     * Get topics by topic ID.
     * @param string $topicId 话题ID
     * @return MagicTopicEntity[] 话题实体数组
     */
    public function getTopicsByTopicId(string $topicId): array;

    /**
     * Get topic messages by conversation ID, topic ID and max seq ID.
     * @param string $conversationId 会话ID
     * @param string $topicId 话题ID
     * @param int $maxSeqId 最大序列ID（包含该ID）
     * @return MagicTopicMessageEntity[] 话题消息实体数组
     */
    public function getTopicMessagesBySeqId(string $conversationId, string $topicId, int $maxSeqId): array;
}
