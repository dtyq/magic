<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Response;

/**
 * 项目列表响应DTO.
 */
class ProjectListResponseDTO
{
    public function __construct(
        public readonly array $list,
        public readonly int $total
    ) {
    }

    public static function create(array $projects, int $total = 0): self
    {
        $list = array_map(function ($project) {
            return ProjectItemDTO::fromEntity($project)->toArray();
        }, $projects);

        return new self(
            list: $list,
            total: $total ?: count($projects),
        );
    }

    public static function fromResult(array $result): self
    {
        $projects = $result['list'] ?? $result;
        $total = $result['total'] ?? count($projects);

        $list = array_map(function ($project) {
            return ProjectItemDTO::fromEntity($project)->toArray();
        }, $projects);

        return new self(
            list: $list,
            total: $total,
        );
    }

    public function toArray(): array
    {
        return [
            'list' => $this->list,
            'total' => $this->total,
        ];
    }
}
