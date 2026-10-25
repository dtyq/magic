<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Provider\DTO;

use App\Infrastructure\Core\AbstractDTO;

class SaveModelIdentifierMappingGroupDTO extends AbstractDTO
{
    public string $groupName = '';

    /**
     * @var string[]
     */
    public array $sourceModelIds = [];

    public string $targetModelId = '';

    /**
     * 将接口入参转换为应用层使用的标准 DTO。
     */
    public static function fromArray(array $input): self
    {
        $dto = new self();
        $dto->groupName = trim((string) ($input['group_name'] ?? $input['name'] ?? ''));
        $dto->sourceModelIds = array_values(array_unique(array_filter(array_map(
            static fn ($id): string => trim((string) $id),
            (array) ($input['source_model_ids'] ?? [])
        ))));
        $dto->targetModelId = trim((string) ($input['target_model_id'] ?? ''));
        return $dto;
    }
}
