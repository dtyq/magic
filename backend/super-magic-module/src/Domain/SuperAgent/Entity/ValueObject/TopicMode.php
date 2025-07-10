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
    case GENERAL = 'general';           // 通用模式
    case PPT = 'ppt';                   // PPT模式
    case DATA_ANALYSIS = 'data_analysis'; // 数据分析模式
    case REPORT = 'report';             // 研报模式
    case MEETING = 'meeting';           // 会议模式

    /**
     * Get all available topic modes.
     */
    public static function getAllModes(): array
    {
        return [
            self::GENERAL->value,
            self::PPT->value,
            self::DATA_ANALYSIS->value,
            self::REPORT->value,
            self::MEETING->value,
        ];
    }

    /**
     * Get topic mode description.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::GENERAL => '通用模式',
            self::PPT => 'PPT模式',
            self::DATA_ANALYSIS => '数据分析模式',
            self::REPORT => '研报模式',
            self::MEETING => '会议模式',
        };
    }
}
