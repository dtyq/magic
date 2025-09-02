<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

enum BuiltinAgent: string
{
    /** 通用模式 */
    case General = 'general';

    /** 聊天模式 */
    case Chat = 'chat';

    /** 数据分析 */
    case DataAnalysis = 'data_analysis';

    /** PPT */
    case PPT = 'ppt';

    /** 研报模式 */
    case Report = 'report';

    /** 录音总结 */
    case Summary = 'summary';

    /**
     * 获取内置智能体名称.
     */
    public function getName(): string
    {
        return match ($this) {
            self::General => '通用模式',
            self::Chat => '聊天模式',
            self::DataAnalysis => '数据分析',
            self::PPT => 'PPT',
            self::Report => '研报模式',
            self::Summary => '录音总结',
        };
    }

    /**
     * 获取内置智能体描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::General => '适用于各种通用场景的智能助手',
            self::Chat => '专注于对话交流的智能助手',
            self::DataAnalysis => '专业的数据分析和处理助手',
            self::PPT => '专业的PPT制作和演示助手',
            self::Report => '专业的研究报告撰写助手',
            self::Summary => '专业的录音内容总结助手',
        };
    }

    /**
     * 获取内置智能体图标.
     */
    public function getIcon(): array
    {
        return match ($this) {
            self::General => ['type' => 'general', 'color' => ''],
            self::Chat => ['type' => 'IconMessages', 'color' => ''],
            self::DataAnalysis => ['type' => 'IconChartBarPopular', 'color' => ''],
            self::PPT => ['type' => 'IconPresentation', 'color' => ''],
            self::Report => ['type' => 'report', 'color' => ''],
            self::Summary => ['type' => 'IconFileDescription', 'color' => ''],
        };
    }

    /**
     * 获取内置智能体提示词.
     */
    public function getPrompt(): array
    {
        return [];
    }

    /**
     * 获取所有内置智能体.
     * @return array<BuiltinAgent>
     */
    public static function getAllBuiltinAgents(): array
    {
        return [
            self::General,
            self::Chat,
            self::DataAnalysis,
            self::PPT,
            self::Summary,
        ];
    }
}
