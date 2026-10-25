<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Service;

use App\Domain\Asset\Entity\AssetEntity;
use App\Domain\Asset\Entity\AssetTagEntity;

final class AssetSearchTextBuilder
{
    /** @param AssetTagEntity[] $tags */
    public function build(AssetEntity $asset, array $tags = []): string
    {
        $values = array_merge(
            $this->values($asset->getNameI18n()),
            $this->values($asset->getDescriptionI18n()),
        );
        foreach ($tags as $tag) {
            $values = array_merge($values, $this->values($tag->getNameI18n()));
        }
        // 去重后拼接：多个语言值相同的字段（例如名称与描述同文案）不必重复占位。
        return implode(' ', array_values(array_unique($values)));
    }

    /**
     * 多语言字典 → 去空、去首尾空白的值列表。
     * @return string[]
     */
    private function values(?array $i18n): array
    {
        $values = [];
        foreach ($i18n ?? [] as $value) {
            if (! is_string($value)) {
                continue;
            }
            $value = trim($value);
            if ($value !== '') {
                $values[] = $value;
            }
        }
        return $values;
    }
}
