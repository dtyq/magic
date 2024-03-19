<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\DTO;

use App\Infrastructure\Core\AbstractDTO;

class MagicUserOrganizationListDTO extends AbstractDTO
{
    /**
     * @var MagicUserOrganizationItemDTO[]
     */
    protected array $items = [];

    /**
     * @return MagicUserOrganizationItemDTO[]
     */
    public function getItems(): array
    {
        return $this->items;
    }

    /**
     * @param MagicUserOrganizationItemDTO[] $items
     */
    public function setItems(array $items): void
    {
        $this->items = $items;
    }

    public function addItem(MagicUserOrganizationItemDTO $item): void
    {
        $this->items[] = $item;
    }
}
