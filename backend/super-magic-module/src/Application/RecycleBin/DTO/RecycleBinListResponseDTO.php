<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Application\RecycleBin\DTO;

use Dtyq\SuperMagic\Domain\RecycleBin\Entity\RecycleBinEntity;

class RecycleBinListResponseDTO
{
    private int $total;

    private array $list;

    public function __construct(int $total, array $list, array $userMap = [])
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
        return [
            'total' => $this->total,
            'list' => $this->list,
        ];
    }

    public static function fromResult(array $result): self
    {
        return new self(
            $result['total'],
            $result['list'],
            $result['user_map'] ?? []
        );
    }
}
