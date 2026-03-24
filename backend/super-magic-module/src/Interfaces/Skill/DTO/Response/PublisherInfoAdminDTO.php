<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 发布者信息 Admin DTO - 用于管理后台版本列表查询.
 */
class PublisherInfoAdminDTO extends AbstractDTO
{
    public function __construct(
        private readonly string $userId = '',
        private readonly string $nickname = '',
    ) {
    }

    public static function empty(): self
    {
        return new self('', '');
    }

    public function toArray(): array
    {
        return [
            'user_id' => $this->userId,
            'nickname' => $this->nickname,
        ];
    }
}
