<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Skill\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class CategoryInfoDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $id,
        private readonly string $name,
    ) {
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'name' => $this->name,
        ];
    }
}
