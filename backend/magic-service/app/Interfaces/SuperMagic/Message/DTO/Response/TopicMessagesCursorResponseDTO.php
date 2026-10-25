<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Message\DTO\Response;

use JsonSerializable;

class TopicMessagesCursorResponseDTO implements JsonSerializable
{
    public function __construct(
        protected array $list = [],
        protected bool $hasMore = false,
        protected ?string $nextCursor = null,
        protected ?string $projectId = null,
        protected ?string $projectName = null,
    ) {
    }

    public function toArray(): array
    {
        $result = [
            'list' => $this->list,
            'has_more' => $this->hasMore,
            'next_cursor' => $this->nextCursor,
        ];
        if ($this->projectId !== null) {
            $result['project_id'] = $this->projectId;
        }
        if ($this->projectName !== null) {
            $result['project_name'] = $this->projectName;
        }
        return $result;
    }

    public function jsonSerialize(): array
    {
        return $this->toArray();
    }
}
