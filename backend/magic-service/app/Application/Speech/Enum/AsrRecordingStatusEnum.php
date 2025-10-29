<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Enum;

/**
 * ASR 录音状态枚举（前端交互协议）.
 *
 * 【作用域】前端交互层 - 客户端录音状态上报
 * 【用途】表示前端录音过程的实时状态
 * 【使用场景】
 * - 前端录音状态上报接口（status 参数）
 * - 录音心跳保活机制
 * - 控制录音的开始、暂停、继续、停止
 *
 * 【与其他枚举的区别】
 * - AsrRecordingStatusEnum: 前端录音实时状态（录音交互层）✓ 当前
 * - AsrTaskStatusEnum: 内部任务全流程状态（业务管理层）
 * - SandboxAsrStatusEnum: 沙箱合并任务状态（基础设施层）
 *
 * 【状态流转】start → recording ⇄ paused → stopped
 * 【注意】这些状态值由前端定义，与后端内部状态独立
 */
enum AsrRecordingStatusEnum: string
{
    case START = 'start';         // 开始录音：用户首次点击录音按钮
    case RECORDING = 'recording'; // 录音中（心跳）：前端持续上报，保持录音会话活跃
    case PAUSED = 'paused';       // 暂停：用户暂停录音，可以继续
    case STOPPED = 'stopped';     // 终止：用户停止录音，触发音频合并
    case CANCELED = 'canceled';   // 取消：用户取消录音，停止任务并清理数据

    /**
     * 验证状态值是否有效.
     */
    public static function isValid(string $status): bool
    {
        return in_array($status, ['start', 'recording', 'paused', 'stopped', 'canceled'], true);
    }

    /**
     * 从字符串创建枚举.
     */
    public static function tryFromString(string $status): ?self
    {
        return match ($status) {
            'start' => self::START,
            'recording' => self::RECORDING,
            'paused' => self::PAUSED,
            'stopped' => self::STOPPED,
            'canceled' => self::CANCELED,
            default => null,
        };
    }
}
