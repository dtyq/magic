<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\SuperMagic\Common\RecycleBin\DTO;

use App\Domain\SuperMagic\Common\RecycleBin\Entity\RecycleBinEntity;

class RecycleBinListResponseDTO
{
    private ?int $total;

    private array $list;

    public function __construct(?int $total, array $list, array $userMap = [], private ?array $pagination = null)
    {
        $this->total = $total;
        $this->list = array_map(
            function (RecycleBinEntity $entity) use ($userMap) {
                $deletedByUser = $userMap[$entity->getDeletedBy()] ?? null;

                return RecycleBinItemDTO::fromEntity($entity, $deletedByUser)->toArray();
            },
            $list
        );
    }

    public function toArray(): array
    {
        $result = ['list' => $this->list];
        if ($this->total !== null) {
            $result['total'] = $this->total;
        }
        return array_merge($result, $this->pagination ?? []);
    }

    public static function fromResult(array $result): self
    {
        return new self(
            $result['total'] ?? null,
            $result['list'],
            $result['user_map'] ?? [],
            array_key_exists('has_more', $result) ? [
                'has_more' => $result['has_more'],
                'next_cursor' => $result['next_cursor'],
                'search_limits' => $result['search_limits'],
            ] : null
        );
    }
}
