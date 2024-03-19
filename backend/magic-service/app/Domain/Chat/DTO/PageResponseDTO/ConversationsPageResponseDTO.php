<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\PageResponseDTO;

use App\Domain\Chat\Entity\MagicConversationEntity;

/**
 * 分页响应DTO.
 */
class ConversationsPageResponseDTO extends PageResponseDTO
{
    /**
     * @var MagicConversationEntity[]
     */
    protected array $items = [];

    public function getItems(): array
    {
        return $this->items;
    }

    public function setItems(array $items): void
    {
        $this->items = $items;
    }
}
