<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Permission\DTO;

use App\Infrastructure\Core\AbstractDTO;

class OrganizationAdminListResponseDTO extends AbstractDTO
{
    /**
     * @var OrganizationAdminResponseDTO[]
     */
    public array $list = [];

    public int $total = 0;

    public int $page = 1;

    public int $pageSize = 10;

    /**
     * @return OrganizationAdminResponseDTO[]
     */
    public function getList(): array
    {
        return $this->list;
    }

    /**
     * @param OrganizationAdminResponseDTO[] $list
     */
    public function setList(array $list): void
    {
        $this->list = $list;
    }

    public function addOrganizationAdmin(OrganizationAdminResponseDTO $organizationAdmin): void
    {
        $this->list[] = $organizationAdmin;
    }

    public function getTotal(): int
    {
        return $this->total;
    }

    public function setTotal(int $total): void
    {
        $this->total = $total;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int $page): void
    {
        $this->page = $page;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int $pageSize): void
    {
        $this->pageSize = $pageSize;
    }
}
