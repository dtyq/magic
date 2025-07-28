<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\LongTermMemory\Entity\ValueObject;

/**
 * 记忆类型枚举.
 */
enum MemoryType: string
{
    case MANUAL_INPUT = 'manual_input';           // 手动输入
    case CONVERSATION_ANALYSIS = 'conversation_analysis';  // 对话分析
    case USER_NOTE = 'user_note';                // 用户笔记
    case SYSTEM_KNOWLEDGE = 'system_knowledge';  // 系统知识

    /**
     * 获取中文描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::MANUAL_INPUT => '手动输入',
            self::CONVERSATION_ANALYSIS => '对话分析',
            self::USER_NOTE => '用户笔记',
            self::SYSTEM_KNOWLEDGE => '系统知识',
        };
    }

    /**
     * 是否为用户生成的记忆.
     */
    public function isUserGenerated(): bool
    {
        return in_array($this, [
            self::MANUAL_INPUT,
            self::USER_NOTE,
        ]);
    }

    /**
     * 是否为系统生成的记忆.
     */
    public function isSystemGenerated(): bool
    {
        return in_array($this, [
            self::CONVERSATION_ANALYSIS,
            self::SYSTEM_KNOWLEDGE,
        ]);
    }
}
