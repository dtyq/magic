<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Speech\Enum;

/**
 * ASR 目录类型枚举.
 */
enum AsrDirectoryTypeEnum: string
{
    case ASR_HIDDEN_DIR = 'asr_hidden_dir';       // 隐藏目录（存放分片文件，实际目录名称在 ASR_RECORDINGS_DIR/task_key 下）
    case ASR_DISPLAY_DIR = 'asr_display_dir';     // 显示目录（存放流式文本和笔记）
    case ASR_STATES_DIR = 'asr_states_dir';       // 状态目录（存放前端录音状态）
    case ASR_RECORDINGS_DIR = 'asr_recordings_dir'; // 录音目录（.asr_recordings）
}
