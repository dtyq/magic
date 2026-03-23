<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Skill\DTO\Request;

use App\Infrastructure\Core\AbstractRequestDTO;

use function Hyperf\Translation\__;

/**
 * 查询 Skill 市场列表请求 Admin DTO.
 */
class QuerySkillMarketsRequestAdminDTO extends AbstractRequestDTO
{
    public int $page = 1;

    public int $pageSize = 20;

    public ?string $publishStatus = null;

    public ?string $organizationCode = null;

    public ?string $nameI18n = null;

    public ?string $publisherType = null;

    public ?string $skillCode = null;

    public ?string $packageName = null;

    public string $orderBy = 'desc';

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

    public function getPublishStatus(): ?string
    {
        return $this->publishStatus;
    }

    public function getOrganizationCode(): ?string
    {
        return $this->organizationCode;
    }

    public function getNameI18n(): ?string
    {
        return $this->nameI18n;
    }

    public function setNameI18n(?string $value): void
    {
        $this->nameI18n = $value;
    }

    public function getPublisherType(): ?string
    {
        return $this->publisherType;
    }

    public function getSkillCode(): ?string
    {
        return $this->skillCode;
    }

    public function getPackageName(): ?string
    {
        return $this->packageName;
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
            'publish_status' => 'nullable|string|max:64',
            'organization_code' => 'nullable|string|max:128',
            'name_i18n' => 'nullable|string|max:255',
            'publisher_type' => 'nullable|string|max:64',
            'skill_code' => 'nullable|string|max:128',
            'package_name' => 'nullable|string|max:255',
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
            'publish_status.string' => __('validation.string', ['attribute' => 'publish_status']),
            'publish_status.max' => __('validation.max.string', ['attribute' => 'publish_status', 'max' => 64]),
            'organization_code.string' => __('validation.string', ['attribute' => 'organization_code']),
            'organization_code.max' => __('validation.max.string', ['attribute' => 'organization_code', 'max' => 128]),
            'name_i18n.string' => __('validation.string', ['attribute' => 'name_i18n']),
            'name_i18n.max' => __('validation.max.string', ['attribute' => 'name_i18n', 'max' => 255]),
            'publisher_type.string' => __('validation.string', ['attribute' => 'publisher_type']),
            'publisher_type.max' => __('validation.max.string', ['attribute' => 'publisher_type', 'max' => 64]),
            'skill_code.string' => __('validation.string', ['attribute' => 'skill_code']),
            'skill_code.max' => __('validation.max.string', ['attribute' => 'skill_code', 'max' => 128]),
            'package_name.string' => __('validation.string', ['attribute' => 'package_name']),
            'package_name.max' => __('validation.max.string', ['attribute' => 'package_name', 'max' => 255]),
            'order_by.string' => __('validation.string', ['attribute' => 'order_by']),
            'order_by.in' => __('validation.in', ['attribute' => 'order_by']),
            'start_time.string' => __('validation.string', ['attribute' => 'start_time']),
            'end_time.string' => __('validation.string', ['attribute' => 'end_time']),
        ];
    }
}
