<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\DTO;

use App\Infrastructure\Core\AbstractDTO;

class BatchModelIdentifierMappingGroupsDTO extends AbstractDTO
{
    /**
     * @var string[]
     */
    public array $groupIds = [];

    public ?int $status = null;

    /**
     * 将接口入参转换为批量操作 DTO。
     */
    public static function fromArray(array $input): self
    {
        $dto = new self();
        $dto->groupIds = array_values(array_unique(array_filter(array_map(
            static fn ($id): string => trim((string) $id),
            (array) ($input['group_ids'] ?? [])
        ))));
        $dto->status = array_key_exists('status', $input) ? (int) $input['status'] : null;
        return $dto;
    }
}
