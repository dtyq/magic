<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrNoteFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrTranscriptFileConfig;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Response\AsrRecorderResponse;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Constants\SandboxEndpoints;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Exception;
use Hyperf\Logger\LoggerFactory;

/**
 * ASR 录音服务实现.
 */
class AsrRecorderService extends AbstractSandboxOS implements AsrRecorderInterface
{
    public function __construct(
        LoggerFactory $loggerFactory,
        private readonly SandboxGatewayInterface $gateway
    ) {
        parent::__construct($loggerFactory);
    }

    public function startTask(
        string $sandboxId,
        string $taskKey,
        string $sourceDir,
        string $workspaceDir = '.workspace',
        ?AsrNoteFileConfig $noteFileConfig = null,
        ?AsrTranscriptFileConfig $transcriptFileConfig = null
    ): AsrRecorderResponse {
        $requestData = [
            'task_key' => $taskKey,
            'source_dir' => $sourceDir,
            'workspace_dir' => $workspaceDir,
        ];

        // 添加笔记文件配置（start 阶段只传 source_path）
        if ($noteFileConfig !== null) {
            $requestData['note_file'] = [
                'source_path' => $noteFileConfig->getSourcePath(),
            ];
        }

        // 添加流式识别文件配置（start 阶段只传 source_path）
        if ($transcriptFileConfig !== null) {
            $requestData['transcript_file'] = [
                'source_path' => $transcriptFileConfig->getSourcePath(),
            ];
        }

        try {
            $this->logger->info('ASR Recorder: Starting task', [
                'sandbox_id' => $sandboxId,
                'task_key' => $taskKey,
                'source_dir' => $sourceDir,
                'workspace_dir' => $workspaceDir,
                'note_file_source_path' => $noteFileConfig?->getSourcePath(),
                'transcript_file_source_path' => $transcriptFileConfig?->getSourcePath(),
            ]);

            // 调用沙箱 API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                SandboxEndpoints::ASR_TASK_START,
                $requestData
            );

            $response = AsrRecorderResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('ASR Recorder: Task started successfully', [
                    'sandbox_id' => $sandboxId,
                    'task_key' => $taskKey,
                    'status' => $response->getStatus(),
                ]);
            } else {
                $this->logger->error('ASR Recorder: Failed to start task', [
                    'sandbox_id' => $sandboxId,
                    'task_key' => $taskKey,
                    'code' => $response->code,
                    'message' => $response->message,
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('ASR Recorder: Unexpected error during start task', [
                'sandbox_id' => $sandboxId,
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);

            return AsrRecorderResponse::fromApiResponse([
                'code' => -1,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }

    public function finishTask(
        string $sandboxId,
        string $taskKey,
        string $workspaceDir,
        AsrAudioConfig $audioConfig,
        ?AsrNoteFileConfig $noteFileConfig = null,
        ?AsrTranscriptFileConfig $transcriptFileConfig = null
    ): AsrRecorderResponse {
        // 构建请求数据（V2 结构化版本）
        $requestData = [
            'task_key' => $taskKey,
            'workspace_dir' => $workspaceDir,
            'audio' => $audioConfig->toArray(),
        ];

        // 添加笔记文件配置
        if ($noteFileConfig !== null) {
            $requestData['note_file'] = $noteFileConfig->toArray();
        }

        // 添加流式识别文件配置
        if ($transcriptFileConfig !== null) {
            $requestData['transcript_file'] = $transcriptFileConfig->toArray();
        }

        try {
            $this->logger->info('ASR Recorder: Finishing task (V2)', [
                'sandbox_id' => $sandboxId,
                'task_key' => $taskKey,
                'workspace_dir' => $workspaceDir,
                'audio_config' => $audioConfig->toArray(),
                'note_file_config' => $noteFileConfig?->toArray(),
                'transcript_file_config' => $transcriptFileConfig?->toArray(),
            ]);

            // 调用沙箱 API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                SandboxEndpoints::ASR_TASK_FINISH,
                $requestData
            );

            $response = AsrRecorderResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('ASR Recorder: Task finish request successful', [
                    'sandbox_id' => $sandboxId,
                    'task_key' => $taskKey,
                    'status' => $response->getStatus(),
                    'file_path' => $response->getFilePath(),
                ]);
            } else {
                $this->logger->error('ASR Recorder: Failed to finish task', [
                    'sandbox_id' => $sandboxId,
                    'task_key' => $taskKey,
                    'code' => $response->code,
                    'message' => $response->message,
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('ASR Recorder: Unexpected error during finish task', [
                'sandbox_id' => $sandboxId,
                'task_key' => $taskKey,
                'error' => $e->getMessage(),
            ]);

            return AsrRecorderResponse::fromApiResponse([
                'code' => -1,
                'message' => 'Unexpected error: ' . $e->getMessage(),
                'data' => [],
            ]);
        }
    }
}
