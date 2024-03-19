<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Facade;

use App\Domain\Chat\DTO\ConversationListQueryDTO;
use App\Domain\Chat\DTO\PageResponseDTO\ConversationsPageResponseDTO;
use App\Domain\Chat\Entity\MagicConversationEntity;
use App\Domain\Chat\Entity\ValueObject\ConversationStatus;
use App\Domain\Chat\Entity\ValueObject\ConversationType;

interface MagicChatConversationRepositoryInterface
{
    public function getConversationsByUserIds(MagicConversationEntity $conversation, ConversationListQueryDTO $queryDTO, array $userIds): ConversationsPageResponseDTO;

    public function getConversationByUserIdAndReceiveId(MagicConversationEntity $conversation): ?MagicConversationEntity;

    public function getConversationById(string $conversationId): ?MagicConversationEntity;

    /**
     * @return MagicConversationEntity[]
     */
    public function getConversationByIds(array $conversationIds): array;

    public function addConversation(MagicConversationEntity $conversation): MagicConversationEntity;

    /**
     * (分组织)获取用户与指定用户的会话窗口信息.
     * @return array<MagicConversationEntity>
     */
    public function getConversationsByReceiveIds(string $userId, array $receiveIds, ?string $userOrganizationCode = null): array;

    public function getReceiveConversationBySenderConversationId(string $senderConversationId): ?MagicConversationEntity;

    public function batchAddConversation(array $conversations): bool;

    /**
     * @return MagicConversationEntity[]
     */
    public function batchGetConversations(array $userIds, string $receiveId, ConversationType $receiveType): array;

    // 批量移除会话窗口
    public function batchRemoveConversations(array $userIds, string $receiveId, ConversationType $receiveType): int;

    // 批量更新会话窗口
    public function batchUpdateConversations(array $conversationIds, array $updateData): int;

    public function getAllConversationList(): array;

    public function saveInstructs(string $conversationId, array $instructs): void;

    /**
     * @return MagicConversationEntity[]
     */
    public function getRelatedConversationsWithInstructByUserId(array $userIds): array;

    public function batchUpdateInstructs(array $updateData): void;

    public function updateConversationById(string $id, array $data): int;

    public function updateConversationStatusByIds(array $ids, ConversationStatus $status): int;
}
