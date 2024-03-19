<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Chat\DTO\PageResponseDTO;

use App\Domain\Contact\Entity\MagicDepartmentUserEntity;

/**
 * 分页响应DTO.
 */
class DepartmentUsersPageResponseDTO extends PageResponseDTO
{
    /**
     * @var MagicDepartmentUserEntity[]
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
