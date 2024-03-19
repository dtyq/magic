<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asr\ValueObject;

/**
 * ASR 目录角色（内部语义化）.
 *
 * 说明：
 * - 这是“角色/用途”维度，与 TaskFileEntity::is_hidden（可见性/阶段状态）正交。
 * - API 对外的 `AsrDirectoryTypeEnum` value 不变（例如仍是 `asr_display_dir`），这里仅用于内部可读性与 metadata 表达。
 */
enum AsrDirectoryRoleEnum: string
{
    /**
     * 纪要/总结目录：存放流式文本、笔记、合并音频等最终产物。
     * （对外历史 type 仍使用 asr_display_dir）.
     */
    case SUMMARY_DIR = 'summary_dir';

    /**
     * 临时工作目录：存放录音分片等中间文件（通常隐藏）。
     * （对外历史 type 仍使用 asr_hidden_dir）.
     */
    case TEMP_WORK_DIR = 'temp_work_dir';

    /**
     * 状态目录：存放前端录音状态（.asr_states，通常隐藏）。
     */
    case STATES_DIR = 'states_dir';

    /**
     * 录音父目录：.asr_recordings（通常隐藏）。
     */
    case RECORDINGS_DIR = 'recordings_dir';

    /**
     * 是否为隐藏目录 (用于 TaskFileEntity::is_hidden).
     */
    public function isHidden(): bool
    {
        // 目前所有 ASR 相关目录初始状态均为隐藏
        // SUMMARY_DIR (display_dir) 初始也是隐藏，总结完成后才显影
        return true;
    }

    /**
     * 获取遗留的类型值 (兼容 AsrDirectoryTypeEnum).
     */
    public function getLegacyTypeValue(): string
    {
        return match ($this) {
            self::SUMMARY_DIR => 'asr_display_dir',
            self::TEMP_WORK_DIR => 'asr_hidden_dir',
            self::STATES_DIR => 'asr_states_dir',
            self::RECORDINGS_DIR => 'asr_recordings_dir',
        };
    }
}
