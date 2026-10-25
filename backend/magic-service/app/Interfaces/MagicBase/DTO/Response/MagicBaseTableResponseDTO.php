<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\MagicBase\DTO\Response;

use App\Interfaces\MagicBase\DTO\AbstractMagicBaseDTO;

class MagicBaseTableResponseDTO extends AbstractMagicBaseDTO
{
    protected string $id = '';

    protected int|string $projectId = '';

    protected string $tableKey = '';

    protected string $tableName = '';

    protected string $description = '';

    protected string $status = '';

    protected ?array $dynamicPermissions = null;

    protected int|string $createdBy = '';

    protected ?string $createdAt = null;

    protected ?string $updatedAt = null;

    protected array $columns = [];

    public function setId(null|int|string $value): void
    {
        $this->id = $value === null ? '' : (string) $value;
    }
}
