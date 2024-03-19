<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\DTO\Request;

use App\Infrastructure\Core\AbstractDTO;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareFilterType;
use Dtyq\SuperMagic\Domain\Share\Constant\ShareUserType;
use Hyperf\HttpServer\Contract\RequestInterface;

class GetShareCopyLogsRequestDTO extends AbstractDTO
{
    /**
     * 资源ID.
     */
    public string $resourceId = '';

    /**
     * 开始日期（格式：Y-m-d）.
     */
    public ?string $startDate = null;

    /**
     * 结束日期（格式：Y-m-d）.
     */
    public ?string $endDate = null;

    /**
     * 页码.
     */
    public int $page = 1;

    /**
     * 每页条数.
     */
    public int $pageSize = 20;

    /**
     * 用户类型（guest/team_member）.
     * 注意：复制记录中不会有匿名用户，因为 user_id 和 user_organization_code 都是 NOT NULL.
     */
    public ?string $userType = null;

    /**
     * 筛选类型（active/expired/cancelled/all）.
     * 用于区分用户从哪个筛选状态点进来的，决定是否过滤已删除项目的复制记录.
     */
    public ?string $filterType = null;

    /**
     * 从请求中创建DTO.
     */
    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $dto->resourceId = (string) $request->input('resource_id', '');
        $dto->startDate = $request->has('start_date') ? (string) $request->input('start_date') : null;
        $dto->endDate = $request->has('end_date') ? (string) $request->input('end_date') : null;
        $dto->page = (int) $request->input('page', 1);
        $dto->pageSize = (int) $request->input('page_size', 20);
        $dto->userType = $request->has('user_type') ? (string) $request->input('user_type') : null;
        $dto->filterType = $request->has('filter_type') ? (string) $request->input('filter_type') : null;

        return $dto;
    }

    /**
     * 获取资源ID.
     */
    public function getResourceId(): string
    {
        return $this->resourceId;
    }

    /**
     * 获取开始日期.
     */
    public function getStartDate(): ?string
    {
        return $this->startDate;
    }

    /**
     * 获取结束日期.
     */
    public function getEndDate(): ?string
    {
        return $this->endDate;
    }

    /**
     * 获取页码.
     */
    public function getPage(): int
    {
        return $this->page;
    }

    /**
     * 获取每页条数.
     */
    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    /**
     * 获取用户类型.
     */
    public function getUserType(): ?string
    {
        return $this->userType;
    }

    /**
     * 获取筛选类型.
     */
    public function getFilterType(): ?string
    {
        return $this->filterType;
    }

    /**
     * 构建验证规则.
     */
    public function rules(): array
    {
        return [
            'resource_id' => 'required|string|max:64',
            'start_date' => 'nullable|date_format:Y-m-d',
            'end_date' => 'nullable|date_format:Y-m-d|after_or_equal:start_date',
            'page' => 'integer|min:1',
            'page_size' => 'integer|min:1|max:500',
            'user_type' => 'nullable|string|in:' . implode(',', ShareUserType::copyLogValues()),
            'filter_type' => 'nullable|string|in:' . implode(',', ShareFilterType::values()),
        ];
    }

    /**
     * 获取验证错误消息.
     */
    public function messages(): array
    {
        return [
            'resource_id.required' => '资源ID不能为空',
            'start_date.date_format' => '开始日期格式不正确，应为 Y-m-d',
            'end_date.date_format' => '结束日期格式不正确，应为 Y-m-d',
            'end_date.after_or_equal' => '结束日期必须大于等于开始日期',
            'page.integer' => '页码必须是整数',
            'page.min' => '页码最小为1',
            'page_size.integer' => '每页条数必须是整数',
            'page_size.min' => '每页条数最小为1',
            'page_size.max' => '每页条数最大为500',
            'user_type.in' => '用户类型必须是 guest 或 team_member',
            'filter_type.in' => '筛选类型必须是 active、expired、cancelled 或 all',
        ];
    }

    /**
     * 属性名称.
     */
    public function attributes(): array
    {
        return [
            'resource_id' => '资源ID',
            'start_date' => '开始日期',
            'end_date' => '结束日期',
            'page' => '页码',
            'page_size' => '每页条数',
            'user_type' => '用户类型',
            'filter_type' => '筛选类型',
        ];
    }
}
