<?php

declare(strict_types=1);

namespace App\Interfaces\OrganizationEnvironment\DTO;

use App\Infrastructure\Core\AbstractDTO;

class OrganizationListResponseDTO extends AbstractDTO
{
    /**
     * @var OrganizationResponseDTO[]
     */
    public array $list = [];

    public int $total = 0;

    public int $page = 1;

    public int $pageSize = 10;

    /**
     * @param OrganizationResponseDTO[] $list
     */
    public function setList(array $list): void
    {
        $this->list = $list;
    }

    public function setTotal(int $total): void
    {
        $this->total = $total;
    }

    public function setPage(int $page): void
    {
        $this->page = $page;
    }

    public function setPageSize(int $pageSize): void
    {
        $this->pageSize = $pageSize;
    }
}


