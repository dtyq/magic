<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class TopicReadProgressResponseDTO extends AbstractDTO
{
    protected string $topicId = '';

    protected ?string $lastReadAt = null;

    protected ?string $lastReadMessageId = null;

    protected bool $hasUnread = false;

    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->topicId = (string) ($data['topic_id'] ?? '');
        $dto->lastReadAt = isset($data['last_read_at']) ? (string) $data['last_read_at'] : null;
        $dto->lastReadMessageId = isset($data['last_read_message_id']) ? (string) $data['last_read_message_id'] : null;
        $dto->hasUnread = (bool) ($data['has_unread'] ?? false);
        return $dto;
    }

    public function toArray(): array
    {
        return [
            'topic_id' => $this->topicId,
            'last_read_at' => $this->lastReadAt,
            'last_read_message_id' => $this->lastReadMessageId,
            'has_unread' => $this->hasUnread,
        ];
    }
}
