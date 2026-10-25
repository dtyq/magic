<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\SuperMagic\Project\Entity\ValueObject;

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
    case CHAT = 'chat';         // 对话模式
    case MICRO_APP = 'micro-app'; // 微应用开发模式
    case PERSONA_RESEARCH = 'persona_research'; // AI 研究模式（每个用户一个的特殊项目）

    /**
     * AI 画布模式：项目位于 ai-canvas 专属工作区，打开后只展示一个画布和对话。
     * 只用于识别项目和跳转专属页面，对话实际使用的 Agent 由话题模式决定（默认 design）。
     * 不使用 canvas 这个值：Python 运行时的 AgentMode.CANVAS 对应另一个 canvas.agent，
     * 避免项目模式被误当作 Agent 模式时切换到别的 Agent。
     */
    case AI_CANVAS = 'ai-canvas';

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
            self::CHAT->value,
            self::MICRO_APP->value,
            self::AI_CANVAS->value,
        ];
    }

    /**
     * 普通项目查询需要排除的模式。
     * AI_CANVAS 不在其中：AI 画布首页按工作区查询项目列表，最近项目和搜索也需要照常展示它。
     */
    public static function getQueryFilterModes(): array
    {
        return [
            self::AUDIO->value,
            self::AGENT_CREATOR->value,
            self::SKILL_CREATOR->value,
            self::MAGICLAW->value,
            self::CHAT->value,
            self::MICRO_APP->value,
            // 研究项目没有项目工作区入口，由「AI 研究」页通过特殊项目接口按 key 读取，不进入项目列表。
            self::PERSONA_RESEARCH->value,
        ];
    }

    /**
     * 最近项目列表允许展示、且能定位到具体资源入口的特殊模式。
     * 音频和对话项目没有对应的资源工作区，继续沿用普通列表过滤规则。
     *
     * @return string[]
     */
    public static function getRecentListSpecialModes(): array
    {
        return [
            self::AGENT_CREATOR->value,
            self::SKILL_CREATOR->value,
            self::MAGICLAW->value,
            self::MICRO_APP->value,
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
            self::CHAT => '对话模式',
            self::MICRO_APP => '微应用开发模式',
            self::AI_CANVAS => 'AI 画布模式',
            self::PERSONA_RESEARCH => 'AI 研究模式',
        };
    }
}
