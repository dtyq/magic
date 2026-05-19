<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetSidebarTopicsRequestDTO extends AbstractDTO
{
    protected int $projectId = 0;

    protected string $q = '';

    protected int $page = 1;

    protected int $pageSize = 20;

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->setProjectId((int) $request->route('id', 0));
        $dto->setQ(trim((string) $request->input('q', '')));
        $dto->setPage(max(1, (int) $request->input('page', 1)));
        $dto->setPageSize(max(1, (int) $request->input('page_size', 20)));
        return $dto;
    }

    public function getProjectId(): int
    {
        return $this->projectId;
    }

    public function setProjectId(int $projectId): self
    {
        $this->projectId = $projectId;
        return $this;
    }

    public function getQ(): string
    {
        return $this->q;
    }

    public function setQ(string $q): self
    {
        $this->q = $q;
        return $this;
    }

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int $page): self
    {
        $this->page = $page;
        return $this;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int $pageSize): self
    {
        $this->pageSize = $pageSize;
        return $this;
    }
}
