<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use JsonSerializable;

class LatestPublishedSkillVersionsResponseDTO implements JsonSerializable
{
    /**
     * @param LatestPublishedSkillVersionItemDTO[] $list
     */
    public function __construct(
        private readonly array $list,
        private readonly int $page,
        private readonly int $pageSize,
        private readonly int $total,
    ) {
    }

    public function jsonSerialize(): array
    {
        return [
            'list' => array_map(
                static fn (LatestPublishedSkillVersionItemDTO $item) => $item->jsonSerialize(),
                $this->list
            ),
            'page' => $this->page,
            'page_size' => $this->pageSize,
            'total' => $this->total,
        ];
    }
}
