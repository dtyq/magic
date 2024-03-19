<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\DTO;

/**
 * AI能力详情DTO.
 */
class AiAbilityDetailDTO
{
    public function __construct(
        public int $id,
        public string $code,
        public string $name,
        public string $description,
        public string $icon,
        public int $sortOrder,
        public int $status,
        public array $config,
    ) {
    }

    public function toArray(): array
    {
        return [
            'id' => $this->id,
            'code' => $this->code,
            'name' => $this->name,
            'description' => $this->description,
            'icon' => $this->icon,
            'sort_order' => $this->sortOrder,
            'status' => $this->status,
            'config' => $this->config,
        ];
    }
}
