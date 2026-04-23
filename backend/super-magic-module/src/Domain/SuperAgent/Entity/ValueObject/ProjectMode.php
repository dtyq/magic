<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * Project Mode Value Object
 * 项目模式值对象
 */
enum ProjectMode: string
{
    case GENERAL = 'general';           // 通用模式
    case PPT = 'ppt';                  // PPT模式
    case DATA_ANALYSIS = 'data_analysis'; // 数据分析模式
    case REPORT = 'report';            // 研报模式
    case MEETING = 'meeting';          // 会议模式
    case SUMMARY = 'summary';          // 总结模式
    case SUPER_MAGIC = 'super_magic';  // 超级麦吉模式
    case AUDIO = 'audio';              // 音频模式
    case AGENT_CREATOR = 'agent_creator'; // 创建 agent 模式
    case SKILL_CREATOR = 'skill_creator'; // 创建 skill 模式
    case CUSTOM_AGENT = 'custom_agent'; // 自定义 agent 模式
    case CUSTOM_SKILL = 'custom_skill'; // 自定义 skill 模式
    case MAGICLAW = 'magiclaw'; // magic 龙虾模式

    /**
     * Get all available project modes.
     */
    public static function getAllModes(): array
    {
        return [
            self::GENERAL->value,
            self::PPT->value,
            self::DATA_ANALYSIS->value,
            self::REPORT->value,
            self::MEETING->value,
            self::SUMMARY->value,
            self::SUPER_MAGIC->value,
            self::AUDIO->value,
            self::AGENT_CREATOR->value,
            self::SKILL_CREATOR->value,
            self::CUSTOM_AGENT->value,
            self::CUSTOM_SKILL->value,
            self::MAGICLAW->value,
        ];
    }

    public static function getQueryFilterModes(): array
    {
        return [
            self::AUDIO->value,
            self::AGENT_CREATOR->value,
            self::SKILL_CREATOR->value,
            self::MAGICLAW->value,
        ];
    }

    /**
     * Get project mode description.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::GENERAL => '通用模式',
            self::PPT => 'PPT模式',
            self::DATA_ANALYSIS => '数据分析模式',
            self::REPORT => '研报模式',
            self::MEETING => '会议模式',
            self::SUMMARY => '总结模式',
            self::SUPER_MAGIC => '超级麦吉模式',
            self::AUDIO => '音频模式',
            self::AGENT_CREATOR => '创建 agent 模式',
            self::SKILL_CREATOR => '创建 skill 模式',
            self::CUSTOM_AGENT => '自定义 agent 模式',
            self::CUSTOM_SKILL => '自定义 skill 模式',
            self::MAGICLAW => 'magic 龙虾模式',
        };
    }
}
