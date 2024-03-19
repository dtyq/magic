<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Agent\DTO\Response;

use App\Infrastructure\Core\AbstractDTO;

/**
 * 分类列表项 DTO.
 */
class CategoryListItemDTO extends AbstractDTO
{
    /**
     * 分类 ID.
     */
    public string $id;

    /**
     * 多语言名称.
     */
    public array $nameI18n;

    /**
     * Logo 图片 URL，null 表示未设置.
     */
    public ?string $logo = null;

    /**
     * 排序权重，数值越大越靠前.
     */
    public int $sortOrder;

    /**
     * 该分类下的员工数量（Crew 数量）.
     */
    public int $crewCount;

    public function __construct(
        int|string $id,
        array $nameI18n,
        ?string $logo,
        int $sortOrder,
        int $crewCount
    ) {
        $this->id = (string) $id;
        $this->nameI18n = $nameI18n;
        $this->logo = $logo;
        $this->sortOrder = $sortOrder;
        $this->crewCount = $crewCount;
    }

    public function toArray(): array
    {
        return [
            'id' => (string) $this->id,
            'name_i18n' => $this->nameI18n,
            'logo' => $this->logo,
            'sort_order' => $this->sortOrder,
            'crew_count' => $this->crewCount,
        ];
    }
}
