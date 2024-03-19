<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\SuperAgent\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetWorkspaceTopicsRequestDTO extends AbstractDTO
{
    /**
     * @var int 工作区ID
     */
    protected int $workspaceId = 0;

    /**
     * @var int 页码
     */
    protected int $page = 1;

    /**
     * @var int 每页数量
     */
    protected int $pageSize = 20;

    /**
     * @var string 排序字段
     */
    protected string $orderBy = 'id';

    /**
     * @var string 排序方向
     */
    protected string $orderDirection = 'desc';

    /**
     * 从请求中创建 DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->setWorkspaceId((int) $request->route('id', 0));
        $dto->setPage((int) $request->input('page', 1));
        $dto->setPageSize((int) $request->input('pageSize', 20));
        $dto->setOrderBy($request->input('orderBy', 'id'));
        $dto->setOrderDirection($request->input('orderDirection', 'desc'));
        return $dto;
    }

    public function getWorkspaceId(): int
    {
        return $this->workspaceId;
    }

    public function setWorkspaceId(int $workspaceId): self
    {
        $this->workspaceId = $workspaceId;
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

    public function getOrderBy(): string
    {
        return $this->orderBy;
    }

    public function setOrderBy(string $orderBy): self
    {
        $this->orderBy = $orderBy;
        return $this;
    }

    public function getOrderDirection(): string
    {
        return $this->orderDirection;
    }

    public function setOrderDirection(string $orderDirection): self
    {
        $this->orderDirection = $orderDirection;
        return $this;
    }
}
