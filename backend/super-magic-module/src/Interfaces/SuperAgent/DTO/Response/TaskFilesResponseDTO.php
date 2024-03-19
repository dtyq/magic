<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

class TaskFilesResponseDTO
{
    private array $list;

    private int $total;

    public function __construct(array $list, int $total)
    {
        $this->list = $list;
        $this->total = $total;
    }

    public static function fromArray(array $data): self
    {
        return new self(
            $data['list'] ?? [],
            $data['total'] ?? 0
        );
    }

    public function getList(): array
    {
        return $this->list;
    }

    public function getTotal(): int
    {
        return $this->total;
    }

    public function toArray(): array
    {
        return [
            'list' => $this->list,
            'total' => $this->total,
        ];
    }
}
