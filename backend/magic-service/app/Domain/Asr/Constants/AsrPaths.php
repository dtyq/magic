<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asr\Constants;

/**
 * ASR 路径常量
 * 统一管理 ASR 相关的目录和文件路径.
 */
class AsrPaths
{
    /**
     * 工作区目录名.
     */
    public const WORKSPACE_DIR = '.workspace';

    /**
     * 隐藏录音目录前缀.
     */
    public const HIDDEN_DIR_PREFIX = '.asr_recordings';

    /**
     * 隐藏状态目录名称.
     */
    public const STATES_DIR = '.asr_states';

    /**
     * 生成隐藏目录相对路径.
     *
     * @param string $taskKey 任务键
     * @return string 格式：.asr_recordings/{task_key}
     */
    public static function getHiddenDirPath(string $taskKey): string
    {
        return sprintf('%s/%s', self::HIDDEN_DIR_PREFIX, $taskKey);
    }

    /**
     * 获取状态目录相对路径.
     *
     * @return string 格式：.asr_states
     */
    public static function getStatesDirPath(): string
    {
        return self::STATES_DIR;
    }

    /**
     * 获取录音目录相对路径（父目录）.
     *
     * @return string 格式：.asr_recordings
     */
    public static function getRecordingsDirPath(): string
    {
        return self::HIDDEN_DIR_PREFIX;
    }
}
