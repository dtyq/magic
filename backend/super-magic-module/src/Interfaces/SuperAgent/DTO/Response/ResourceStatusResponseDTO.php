<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

class ResourceStatusResponseDTO extends AbstractDTO
{
    protected array $workspaces = [];

    protected array $projects = [];

    public static function fromArray(array $data): self
    {
        $dto = new self();
        $dto->workspaces = self::normalizeStatusItems($data['workspaces'] ?? []);
        $dto->projects = self::normalizeStatusItems($data['projects'] ?? []);

        return $dto;
    }

    public function toArray(): array
    {
        return [
            'workspaces' => $this->workspaces,
            'projects' => $this->projects,
        ];
    }

    private static function normalizeStatusItems(array $items): array
    {
        return array_map(
            static fn (array $item): array => [
                'id' => (string) ($item['id'] ?? ''),
                'status' => (string) ($item['status'] ?? ''),
            ],
            array_values($items)
        );
    }
}
