<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 目标可见性DTO.
 */
class TargetVisibilityDTO extends AbstractDTO
{
    /**
     * 主体类型：1-用户, 2-部门, 3-组织.
     */
    public int $principalType = 0;

    /**
     * 主体ID.
     */
    public string $principalId = '';

    public function getPrincipalType(): int
    {
        return $this->principalType;
    }

    public function setPrincipalType(int $principalType): void
    {
        $this->principalType = $principalType;
    }

    public function getPrincipalId(): string
    {
        return $this->principalId;
    }

    public function setPrincipalId(string $principalId): void
    {
        $this->principalId = $principalId;
    }
}
