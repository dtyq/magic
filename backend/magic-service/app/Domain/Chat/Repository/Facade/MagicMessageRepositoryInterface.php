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
     * Check if message exists by app_message_id and optional message_type.
     */
    public function isMessageExistsByAppMessageId(string $appMessageId, string $messageType = ''): bool;
}
