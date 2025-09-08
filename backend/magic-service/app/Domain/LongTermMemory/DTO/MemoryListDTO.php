<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 记忆列表查询 DTO.
 */
class MemoryListDTO extends AbstractDTO
{
    public string $orgId = '';

    public string $appId = '';

    public string $userId = '';

    public string $filterType = 'all'; // all, type, tags, search

    public string $filterValue = '';

    public int $page = 1;

    public int $pageSize = 20;

    public string $orderBy = 'created_at';

    public string $orderDirection = 'desc';

    public function __construct(?array $data = [])
    {
        parent::__construct($data);
    }
}
