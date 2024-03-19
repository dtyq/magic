<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Audit\DTO;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 操作日志查询请求 DTO.
 */
class AdminOperationLogListRequestDTO extends AbstractDTO
{
    public ?string $startDate = null; // 开始日期，格式: 2026-01-27

    public ?string $endDate = null; // 结束日期，格式: 2026-01-27

    public ?string $resourceCode = null; // 资源代码筛选

    public ?string $operationCode = null; // 操作代码筛选

    public ?string $userId = null; // 管理员ID（操作人用户ID）

    public ?string $userName = null; // 操作人姓名（支持模糊查询）

    public int $page = 1;

    public int $pageSize = 10;

    /**
     * 转换为仓储过滤条件.
     */
    public function toFilters(): array
    {
        $filters = [];

        if (! empty($this->userId)) {
            $filters['user_id'] = $this->userId;
        }

        if (! empty($this->userName)) {
            $filters['user_name_like'] = $this->userName;
        }

        if (! empty($this->resourceCode)) {
            $filters['resource_code'] = $this->resourceCode;
        }

        if (! empty($this->operationCode)) {
            $filters['operation_code'] = $this->operationCode;
        }

        if (! empty($this->startDate)) {
            $filters['start_time'] = $this->startDate . ' 00:00:00';
        }

        if (! empty($this->endDate)) {
            $filters['end_time'] = $this->endDate . ' 23:59:59';
        }

        return $filters;
    }

    /**
     * 从请求创建 DTO.
     * @param mixed $request
     */
    public static function fromRequest($request): self
    {
        $dto = new self();
        $dto->startDate = $request->input('start_date');
        $dto->endDate = $request->input('end_date');
        $dto->resourceCode = $request->input('resource_code');
        $dto->operationCode = $request->input('operation_code');
        $dto->userId = $request->input('user_id');
        $dto->userName = $request->input('user_name');
        $dto->page = (int) $request->input('page', 1);
        $dto->pageSize = (int) $request->input('page_size', 10);

        return $dto;
    }
}
