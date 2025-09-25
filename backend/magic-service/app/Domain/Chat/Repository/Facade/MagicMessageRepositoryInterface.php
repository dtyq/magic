<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\Repository\Facade;

use App\Domain\Chat\Entity\MagicMessageEntity;
use App\Domain\Chat\Entity\MagicMessageVersionEntity;

interface MagicMessageRepositoryInterface
{
    public function createMessage(array $message): void;

    public function getMessages(array $magicMessageIds, ?array $rangMessageTypes = null): array;

    public function getMessageByMagicMessageId(string $magicMessageId): ?MagicMessageEntity;

    public function deleteByMagicMessageIds(array $magicMessageIds);

    public function updateMessageContent(string $magicMessageId, array $messageContent): void;

    public function updateMessageContentAndVersionId(MagicMessageEntity $messageEntity, MagicMessageVersionEntity $magicMessageVersionEntity): void;

    /**
     * Get messages by magic message IDs.
     * @param array $magicMessageIds Magic message ID数组
     * @return MagicMessageEntity[] 消息实体数组
     */
    public function getMessagesByMagicMessageIds(array $magicMessageIds): array;

    /**
     * Batch create messages.
     * @param array $messagesData 消息数据数组
     * @return bool 是否创建成功
     */
    public function batchCreateMessages(array $messagesData): bool;
}
