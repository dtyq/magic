<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 管理后台：查询 Agent 版本列表请求 DTO.
 */
class QueryAgentVersionsRequestAdminDTO extends AbstractRequestDTO
{
    public int $page = 1;

    public int $pageSize = 20;

    public ?string $reviewStatus = null;

    public ?string $publishStatus = null;

    public ?string $publishTargetType = null;

    public ?string $version = null;

    public ?string $organizationCode = null;

    /**
     * 按多语言名称模糊筛选，匹配 name_i18n 各语言键.
     */
    public ?string $nameI18n = null;

    public string $orderBy = 'asc';

    public ?string $startTime = null;

    public ?string $endTime = null;

    public function getPage(): int
    {
        return $this->page;
    }

    public function setPage(int|string $value): void
    {
        $this->page = (int) $value;
    }

    public function getPageSize(): int
    {
        return $this->pageSize;
    }

    public function setPageSize(int|string $value): void
    {
        $this->pageSize = (int) $value;
    }

    public function getReviewStatus(): ?string
    {
        return $this->reviewStatus;
    }

    public function getPublishStatus(): ?string
    {
        return $this->publishStatus;
    }

    public function getPublishTargetType(): ?string
    {
        return $this->publishTargetType;
    }

    public function getVersion(): ?string
    {
        return $this->version;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function getNameI18n(): ?string
    {
        return $this->nameI18n;
    }

    public function getOrderBy(): string
    {
        return $this->orderBy;
    }

    public function getStartTime(): ?string
    {
        return $this->startTime;
    }

    public function getEndTime(): ?string
    {
        return $this->endTime;
    }

    protected static function getHyperfValidationRules(): array
    {
        return [
            'page' => 'nullable|integer|min:1',
            'page_size' => 'nullable|integer|min:1|max:100',
            'review_status' => 'nullable|string',
            'publish_status' => 'nullable|string',
            'publish_target_type' => 'nullable|string',
            'version' => 'nullable|string',
            'organization_code' => 'nullable|string|max:128',
            'name_i18n' => 'nullable|string|max:255',
            'order_by' => 'nullable|string|in:asc,desc',
            'start_time' => 'nullable|string',
            'end_time' => 'nullable|string',
        ];
    }

    protected static function getHyperfValidationMessage(): array
    {
        return [
            'page.integer' => __('skill.page_must_be_integer'),
            'page.min' => __('skill.page_must_be_greater_than_zero'),
            'page_size.integer' => __('skill.page_size_must_be_integer'),
            'page_size.min' => __('skill.page_size_must_be_greater_than_zero'),
            'page_size.max' => __('skill.page_size_must_not_exceed_100'),
            'review_status.string' => __('validation.string', ['attribute' => 'review_status']),
            'publish_status.string' => __('validation.string', ['attribute' => 'publish_status']),
            'publish_target_type.string' => __('validation.string', ['attribute' => 'publish_target_type']),
            'version.string' => __('validation.string', ['attribute' => 'version']),
            'organization_code.string' => __('validation.string', ['attribute' => 'organization_code']),
            'organization_code.max' => __('validation.max.string', ['attribute' => 'organization_code', 'max' => 128]),
            'name_i18n.string' => __('validation.string', ['attribute' => 'name_i18n']),
            'name_i18n.max' => __('validation.max.string', ['attribute' => 'name_i18n', 'max' => 255]),
            'order_by.string' => __('validation.string', ['attribute' => 'order_by']),
            'order_by.in' => __('validation.in', ['attribute' => 'order_by']),
            'start_time.string' => __('validation.string', ['attribute' => 'start_time']),
            'end_time.string' => __('validation.string', ['attribute' => 'end_time']),
        ];
    }
}
