<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Topic Mode Value Object
 * 话题模式值对象
 */
enum TopicMode: string
{
    case GENERAL = 'general';           // 通用
    case PRESENTATION = 'presentation'; // PPT
    case DATA_ANALYSIS = 'data_analysis'; // 数据分析
    case DOCUMENT = 'document';         // 文档

    /**
     * Get all available topic modes.
     */
    public static function getAllModes(): array
    {
        return [
            self::GENERAL->value,
            self::PRESENTATION->value,
            self::DATA_ANALYSIS->value,
            self::DOCUMENT->value,
        ];
    }

    /**
     * Get topic mode description.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::GENERAL => '通用',
            self::PRESENTATION => 'PPT',
            self::DATA_ANALYSIS => '数据分析',
            self::DOCUMENT => '文档',
        };
    }
}
