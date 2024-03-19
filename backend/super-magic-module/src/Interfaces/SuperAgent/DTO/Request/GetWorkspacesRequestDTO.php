<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;

class GetWorkspacesRequestDTO extends AbstractDTO
{
    /**
     * 页码
     */
    private int $page = 1;

    /**
     * 每页数量.
     */
    private int $pageSize = 10;

    public function __construct(array $params = [])
    {
        $this->page = (int) ($params['page'] ?? 1);
        $this->pageSize = (int) ($params['page_size'] ?? 10);
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }
}
