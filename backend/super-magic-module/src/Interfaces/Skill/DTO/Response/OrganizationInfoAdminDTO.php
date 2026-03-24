<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 组织信息 Admin DTO - 用于管理后台技能版本列表等场景.
 */
class OrganizationInfoAdminDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $code = '',
        private readonly string $name = '',
    ) {
    }

    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'name' => $this->name,
        ];
    }
}
