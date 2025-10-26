<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Response\AsrRecorderResponse;

/**
 * ASR 录音服务接口.
 */
interface AsrRecorderInterface
{
    /**
     * 启动 ASR 录音任务
     * 对应沙箱 POST /api/asr/task/start.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $taskKey 任务键
     * @param string $sourceDir 音频分片目录（相对路径）
     * @param string $workspaceDir 工作区目录，默认 .workspace
     * @return AsrRecorderResponse 响应结果
     */
    public function startTask(
        string $sandboxId,
        string $taskKey,
        string $sourceDir,
        string $workspaceDir = '.workspace'
    ): AsrRecorderResponse;

    /**
     * 完成 ASR 录音任务并合并
     * 对应沙箱 POST /api/asr/task/finish
     * 支持轮询查询状态（多次调用相同参数）.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $taskKey 任务键
     * @param string $targetDir 目标目录（相对路径）
     * @param string $outputFilename 输出文件标题（不含扩展名），沙箱会根据实际音频格式添加扩展名
     * @param null|string $sourceDir 音频分片目录（服务重启恢复时需要）
     * @param string $workspaceDir 工作区目录
     * @param null|string $noteFilename 笔记文件名（如果有笔记）
     * @param null|string $noteContent 笔记内容（如果有笔记）
     * @return AsrRecorderResponse 响应结果
     */
    public function finishTask(
        string $sandboxId,
        string $taskKey,
        string $targetDir,
        string $outputFilename,
        ?string $sourceDir = null,
        string $workspaceDir = '.workspace',
        ?string $noteFilename = null,
        ?string $noteContent = null
    ): AsrRecorderResponse;
}
