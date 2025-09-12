<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Agent\Entity\ValueObject;

use function Hyperf\Translation\trans;

enum BuiltinToolCategory: string
{
    case FileOperations = 'file_operations';
    case SearchExtraction = 'search_extraction';
    case ContentProcessing = 'content_processing';
    case SystemExecution = 'system_execution';
    case AIAssistance = 'ai_assistance';

    /**
     * 获取分类的显示名称.
     */
    public function getName(): string
    {
        return trans("builtin_tool_categories.names.{$this->value}");
    }

    /**
     * 获取分类的图标.
     */
    public function getIcon(): string
    {
        // 暂时返回空字符串，等待前端提供图标内容
        return '';
    }

    /**
     * 获取分类的描述.
     */
    public function getDescription(): string
    {
        return trans("builtin_tool_categories.descriptions.{$this->value}");
    }
}
