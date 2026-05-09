<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class SidebarTopicListResponseDTO extends AbstractDTO
{
    protected array $list = [];

    protected int $total = 0;

    public static function fromResult(array $result): self
    {
        $dto = new self();
        $dto->total = (int) ($result['total'] ?? 0);
        $dto->list = array_map(
            static fn (array $item) => SidebarTopicItemDTO::fromArray($item)->toArray(),
            $result['list'] ?? []
        );
        return $dto;
    }

    public function toArray(): array
    {
        return [
            'total' => $this->total,
            'list' => $this->list,
        ];
    }
}
