<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * Audio marker list response DTO.
 */
class AudioMarkerListResponseDTO
{
    public array $list = [];

    public int $total = 0;

    public static function fromResult(array $result): self
    {
        $dto = new self();
        $dto->total = $result['total'] ?? 0;

        foreach ($result['list'] ?? [] as $entity) {
            $dto->list[] = AudioMarkerItemDTO::fromEntity($entity);
        }

        return $dto;
    }

    public function toArray(): array
    {
        return [
            'list' => array_map(fn ($item) => $item->toArray(), $this->list),
            'total' => $this->total,
        ];
    }
}
