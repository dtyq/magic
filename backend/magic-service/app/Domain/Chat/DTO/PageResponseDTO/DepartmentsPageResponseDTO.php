<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\PageResponseDTO;

use App\Domain\Contact\Entity\MagicDepartmentEntity;

class DepartmentsPageResponseDTO extends PageResponseDTO
{
    /**
     * @var MagicDepartmentEntity[]
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
