<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

class CheckParentResponseDTO
{
    /**
     * @var ParentNotFoundItemDTO[] 需要移动的项列表
     */
    private array $itemsNeedMove = [];

    /**
     * @var ParentNotFoundItemDTO[] 不需要移动（可恢复原位置）的项列表
     */
    private array $itemsNoNeedMove = [];

    public function __construct(array $itemsNeedMove, array $itemsNoNeedMove = [])
    {
        $this->itemsNeedMove = $itemsNeedMove;
        $this->itemsNoNeedMove = $itemsNoNeedMove;
    }

    public function toArray(): array
    {
        return [
            'items_need_move' => array_map(
                fn (ParentNotFoundItemDTO $item) => $item->toArray(),
                $this->itemsNeedMove
            ),
            'items_no_need_move' => array_map(
                fn (ParentNotFoundItemDTO $item) => $item->toArray(),
                $this->itemsNoNeedMove
            ),
        ];
    }
}
