<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder;

use App\Domain\Contact\Entity\ValueObject\DataIsolation;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AbstractSandboxOS;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrAudioConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrMarkerFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrNoteFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Config\AsrTranscriptFileConfig;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\AsrRecorder\Response\AsrRecorderResponse;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Constants\SandboxEndpoints;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use Exception;
use Hyperf\Logger\LoggerFactory;

/**
 * ASR 录音服务实现.
 *
 * Every method takes a DataIsolation as its FIRST parameter so the
 * sandbox-gateway call underneath forwards User-Authorization to
 * the in-pod super-magic agent's AuthMiddleware. The downstream
 * agent's HTTP API requires that header; the request will 401
 * otherwise.
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
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskKey,
        string $sourceDir,
        string $workspaceDir = '.workspace',
        ?AsrNoteFileConfig $noteFileConfig = null,
        ?AsrTranscriptFileConfig $transcriptFileConfig = null,
        ?AsrMarkerFileConfig $markerFileConfig = null
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

        // 添加标记文件配置（start 阶段只传 source_path）
        if ($markerFileConfig !== null) {
            $requestData['marker_file'] = [
                'source_path' => $markerFileConfig->getSourcePath(),
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
                'marker_file_source_path' => $markerFileConfig?->getSourcePath(),
            ]);

            // 调用沙箱 API
            $result = $this->gateway->proxySandboxRequest(
                $dataIsolation,
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
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskKey,
        string $workspaceDir,
        AsrAudioConfig $audioConfig,
        ?AsrNoteFileConfig $noteFileConfig = null,
        ?AsrTranscriptFileConfig $transcriptFileConfig = null,
        ?AsrMarkerFileConfig $markerFileConfig = null,
        bool $forceReset = false
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

        // 添加标记文件配置
        if ($markerFileConfig !== null) {
            $requestData['marker_file'] = $markerFileConfig->toArray();
        }

        // 手动「重新合并」时强制重置沙箱侧重试计数
        if ($forceReset) {
            $requestData['force_reset'] = true;
        }

        try {
            $this->logger->info('ASR Recorder: Finishing task (V2)', [
                'sandbox_id' => $sandboxId,
                'task_key' => $taskKey,
                'workspace_dir' => $workspaceDir,
                'audio_config' => $audioConfig->toArray(),
                'note_file_config' => $noteFileConfig?->toArray(),
                'transcript_file_config' => $transcriptFileConfig?->toArray(),
                'marker_file_config' => $markerFileConfig?->toArray(),
                'force_reset' => $forceReset,
            ]);

            // 调用沙箱 API
            $result = $this->gateway->proxySandboxRequest(
                $dataIsolation,
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

    public function queryTask(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskKey,
        string $workspaceDir = '.workspace'
    ): AsrRecorderResponse {
        $requestData = [
            'task_key' => $taskKey,
            'workspace_dir' => $workspaceDir,
        ];

        try {
            $this->logger->info('ASR Recorder: Querying task', [
                'sandbox_id' => $sandboxId,
                'task_key' => $taskKey,
                'workspace_dir' => $workspaceDir,
            ]);

            $result = $this->gateway->proxySandboxRequest(
                $dataIsolation,
                $sandboxId,
                'POST',
                SandboxEndpoints::ASR_TASK_QUERY,
                $requestData
            );

            $response = AsrRecorderResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('ASR Recorder: Task query request successful', [
                    'sandbox_id' => $sandboxId,
                    'task_key' => $taskKey,
                    'status' => $response->getStatus(),
                    'file_path' => $response->getFilePath(),
                ]);
            } else {
                $this->logger->error('ASR Recorder: Failed to query task', [
                    'sandbox_id' => $sandboxId,
                    'task_key' => $taskKey,
                    'code' => $response->code,
                    'message' => $response->message,
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('ASR Recorder: Unexpected error during query task', [
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

    public function cancelTask(
        DataIsolation $dataIsolation,
        string $sandboxId,
        string $taskKey,
        string $workspaceDir = '.workspace'
    ): AsrRecorderResponse {
        $requestData = [
            'task_key' => $taskKey,
            'workspace_dir' => $workspaceDir,
        ];

        try {
            $this->logger->info('ASR Recorder: Canceling task', [
                'sandbox_id' => $sandboxId,
                'task_key' => $taskKey,
                'workspace_dir' => $workspaceDir,
            ]);

            // 调用沙箱 API
            $result = $this->gateway->proxySandboxRequest(
                $dataIsolation,
                $sandboxId,
                'POST',
                SandboxEndpoints::ASR_TASK_CANCEL,
                $requestData
            );

            $response = AsrRecorderResponse::fromGatewayResult($result);

            if ($response->isSuccess()) {
                $this->logger->info('ASR Recorder: Task canceled successfully', [
                    'sandbox_id' => $sandboxId,
                    'task_key' => $taskKey,
                    'status' => $response->getStatus(),
                ]);
            } else {
                $this->logger->error('ASR Recorder: Failed to cancel task', [
                    'sandbox_id' => $sandboxId,
                    'task_key' => $taskKey,
                    'code' => $response->code,
                    'message' => $response->message,
                ]);
            }

            return $response;
        } catch (Exception $e) {
            $this->logger->error('ASR Recorder: Unexpected error during cancel task', [
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
