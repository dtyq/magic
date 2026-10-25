<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrMarkerFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrNoteFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrTranscriptFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Response\AsrRecorderResponse;

/**
 * ASR 录音服务接口.
 *
 * Every method takes a DataIsolation as its FIRST parameter so the
 * sandbox-gateway call underneath forwards User-Authorization to
 * the in-pod super-magic agent's AuthMiddleware. Required, not
 * optional: passing null here would break the auth contract.
 */
interface AsrRecorderInterface
{
    /**
     * 启动 ASR 录音任务
     * 对应沙箱 POST /api/asr/task/start.
     *
     * @param DataIsolation $dataIsolation Per-call user identity
     * @param string $sandboxId 沙箱ID
     * @param string $taskKey 任务键
     * @param string $sourceDir 音频分片目录（相对路径）
     * @param string $workspaceDir 工作区目录，默认 .workspace
     * @param null|AsrNoteFileConfig $noteFileConfig 笔记文件配置对象（可选）
     * @param null|AsrTranscriptFileConfig $transcriptFileConfig 流式识别配置对象（可选）
     * @param null|AsrMarkerFileConfig $markerFileConfig 标记文件配置对象（可选）
     * @return AsrRecorderResponse 响应结果
     */
    public function startTask(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskKey,
        string $sourceDir,
        string $workspaceDir = '.workspace',
        ?AsrNoteFileConfig $noteFileConfig = null,
        ?AsrTranscriptFileConfig $transcriptFileConfig = null,
        ?AsrMarkerFileConfig $markerFileConfig = null
    ): AsrRecorderResponse;

    /**
     * 完成 ASR 录音任务并合并 (V2 结构化版本)
     * 对应沙箱 POST /api/asr/task/finish
     * 支持轮询查询状态（多次调用相同参数）.
     *
     * @param DataIsolation $dataIsolation Per-call user identity
     * @param string $sandboxId 沙箱ID
     * @param string $taskKey 任务键
     * @param string $workspaceDir 工作区目录
     * @param AsrAudioConfig $audioConfig 音频配置对象
     * @param null|AsrNoteFileConfig $noteFileConfig 笔记文件配置对象
     * @param null|AsrTranscriptFileConfig $transcriptFileConfig 流式识别配置对象
     * @param null|AsrMarkerFileConfig $markerFileConfig 标记文件配置对象
     * @param bool $forceReset 是否强制重置沙箱侧重试计数（手动重新合并场景）
     * @return AsrRecorderResponse 响应结果
     */
    public function finishTask(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskKey,
        string $workspaceDir,
        AsrAudioConfig $audioConfig,
        ?AsrNoteFileConfig $noteFileConfig = null,
        ?AsrTranscriptFileConfig $transcriptFileConfig = null,
        ?AsrMarkerFileConfig $markerFileConfig = null,
        bool $forceReset = false
    ): AsrRecorderResponse;

    /**
     * 查询 ASR 录音任务状态
     * 对应沙箱 POST /api/asr/task/query.
     *
     * @param DataIsolation $dataIsolation Per-call user identity
     * @param string $sandboxId 沙箱ID
     * @param string $taskKey 任务键
     * @param string $workspaceDir 工作区目录，默认 .workspace
     * @return AsrRecorderResponse 响应结果
     */
    public function queryTask(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskKey,
        string $workspaceDir = '.workspace'
    ): AsrRecorderResponse;

    /**
     * 取消 ASR 录音任务
     * 对应沙箱 POST /api/asr/task/cancel.
     *
     * @param DataIsolation $dataIsolation Per-call user identity
     * @param string $sandboxId 沙箱ID
     * @param string $taskKey 任务键
     * @param string $workspaceDir 工作区目录，默认 .workspace
     * @return AsrRecorderResponse 响应结果
     */
    public function cancelTask(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskKey,
        string $workspaceDir = '.workspace'
    ): AsrRecorderResponse;
}
