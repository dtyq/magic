<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Enum;

/**
 * ASR 任务状态枚举（内部业务流程）.
 *
 * 【作用域】内部系统 - magic-service 业务层
 * 【用途】表示 ASR 录音总结任务的全生命周期状态
 * 【使用场景】
 * - 任务状态持久化（Redis/数据库）
 * - 业务流程控制和幂等性判断
 * - 整体任务状态追踪（录音 → 合并 → 生成标题 → 发送消息）
 *
 * 【与其他枚举的区别】
 * - AsrRecordingStatusEnum: 前端录音实时状态（录音交互层）
 * - AsrTaskStatusEnum: 内部任务全流程状态（业务管理层）✓ 当前
 * - SandboxAsrStatusEnum: 沙箱合并任务状态（基础设施层）
 *
 * 【状态流转】created → processing → completed | failed
 */
enum AsrTaskStatusEnum: string
{
    case CREATED = 'created';              // 已创建：任务初始化完成，等待处理
    case PROCESSING = 'processing';        // 处理中：正在执行录音、合并或总结
    case COMPLETED = 'completed';          // 已完成：整个 ASR 流程全部完成（包括消息发送）
    case FAILED = 'failed';                // 失败：任务执行失败

    /**
     * 获取状态描述.
     */
    public function getDescription(): string
    {
        return match ($this) {
            self::CREATED => '已创建',
            self::PROCESSING => '处理中',
            self::COMPLETED => '已完成',
            self::FAILED => '失败',
        };
    }

    /**
     * 检查是否为成功状态
     */
    public function isSuccess(): bool
    {
        return $this === self::COMPLETED;
    }

    /**
     * 从字符串创建枚举.
     */
    public static function fromString(string $status): self
    {
        return self::tryFrom($status) ?? self::FAILED;
    }
}
