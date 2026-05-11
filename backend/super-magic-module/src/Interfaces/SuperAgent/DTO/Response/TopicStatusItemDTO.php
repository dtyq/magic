<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class TopicStatusItemDTO extends AbstractDTO
{
    protected string $id = '';

    protected string $status = 'waiting';

    protected bool $hasUnread = false;

    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->id = (string) ($data['id'] ?? '');
        $dto->status = (string) ($data['status'] ?? 'waiting');
        $dto->hasUnread = (bool) ($data['has_unread'] ?? false);
        return $dto;
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'status' => $this->status,
            'has_unread' => $this->hasUnread,
        ];
    }
}
