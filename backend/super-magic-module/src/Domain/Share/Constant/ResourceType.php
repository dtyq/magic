<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Share\Constant;

use RuntimeException;

/**
 * 资源类型枚举.
 */
enum ResourceType: int
{
    // 现有类型
    case BotCode = 1;           // AI 助理
    case SubFlowCode = 2;       // 子流程
    case ToolSet = 3;           // 工具集
    case Knowledge = 4;         // 知识库

    // 新增业务类型
    case Topic = 5;             // 话题
    case Document = 6;          // 文档
    case Schedule = 7;          // 日程
    case MultiTable = 8;        // 多维表格
    case Form = 9;              // 表单
    case MindMap = 10;          // 思维导图
    case Website = 11;          // 网站
    case Project = 12;          // 项目
    case File = 13;             // 文件

    /**
     * 获取资源类型的业务名称.
     */
    public function getBusinessName(): string
    {
        return match ($this) {
            self::BotCode => 'bot',
            self::SubFlowCode => 'subflow',
            self::ToolSet => 'toolset',
            self::Knowledge => 'knowledge',
            self::Topic => 'topic',
            self::Document => 'document',
            self::Schedule => 'schedule',
            self::MultiTable => 'multitable',
            self::Form => 'form',
            self::MindMap => 'mindmap',
            self::Website => 'website',
            self::Project => 'project',
            self::File => 'file',
        };
    }

    /**
     * 根据业务名称获取资源类型枚举.
     *
     * @param string $businessName 业务名称
     * @return ResourceType 资源类型枚举
     * @throws RuntimeException 当找不到对应的资源类型时抛出异常
     */
    public static function fromBusinessName(string $businessName): self
    {
        foreach (self::cases() as $type) {
            if ($type->getBusinessName() === $businessName) {
                return $type;
            }
        }

        throw new RuntimeException("找不到业务名称为 '{$businessName}' 的资源类型");
    }
}
