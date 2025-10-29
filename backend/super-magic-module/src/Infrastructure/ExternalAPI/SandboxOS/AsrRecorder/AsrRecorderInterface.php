<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrNoteFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrTranscriptFileConfig;
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
     * @param null|AsrNoteFileConfig $noteFileConfig 笔记文件配置对象（可选）
     * @param null|AsrTranscriptFileConfig $transcriptFileConfig 流式识别配置对象（可选）
     * @return AsrRecorderResponse 响应结果
     */
    public function startTask(
        string $sandboxId,
        string $taskKey,
        string $sourceDir,
        string $workspaceDir = '.workspace',
        ?AsrNoteFileConfig $noteFileConfig = null,
        ?AsrTranscriptFileConfig $transcriptFileConfig = null
    ): AsrRecorderResponse;

    /**
     * 完成 ASR 录音任务并合并 (V2 结构化版本)
     * 对应沙箱 POST /api/asr/task/finish
     * 支持轮询查询状态（多次调用相同参数）.
     *
     * @param string $sandboxId 沙箱ID
     * @param string $taskKey 任务键
     * @param string $workspaceDir 工作区目录
     * @param AsrAudioConfig $audioConfig 音频配置对象
     * @param null|AsrNoteFileConfig $noteFileConfig 笔记文件配置对象
     * @param null|AsrTranscriptFileConfig $transcriptFileConfig 流式识别配置对象
     * @return AsrRecorderResponse 响应结果
     */
    public function finishTask(
        string $sandboxId,
        string $taskKey,
        string $workspaceDir,
        AsrAudioConfig $audioConfig,
        ?AsrNoteFileConfig $noteFileConfig = null,
        ?AsrTranscriptFileConfig $transcriptFileConfig = null
    ): AsrRecorderResponse;
}
