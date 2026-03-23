<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Audit\ModelCall\Entity\ValueObject;

enum AuditType: string
{
    case TEXT = 'TEXT';           // 文本生成
    case EMBEDDING = 'EMBEDDING'; // 向量化
    case IMAGE = 'IMAGE';         // 图片生成
    case SEARCH = 'SEARCH';       // 搜索
    case WEB_SCRAPE = 'WEB_SCRAPE'; // 网页抓取

    public function label(): string
    {
        return match ($this) {
            self::TEXT => '文本生成',
            self::EMBEDDING => '向量化',
            self::IMAGE => '图片生成',
            self::SEARCH => '搜索',
            self::WEB_SCRAPE => '网页抓取',
        };
    }

    /**
     * 是否为模型类(需要记录token).
     */
    public function isModel(): bool
    {
        return in_array($this, [self::TEXT, self::EMBEDDING, self::IMAGE], true);
    }

    /**
     * 是否为工具类(记录调用次数).
     */
    public function isTool(): bool
    {
        return in_array($this, [self::SEARCH, self::WEB_SCRAPE], true);
    }
}
