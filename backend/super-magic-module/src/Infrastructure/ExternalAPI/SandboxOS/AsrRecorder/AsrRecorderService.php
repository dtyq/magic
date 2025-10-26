<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AbstractSandboxOS;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\AsrRecorder\Response\AsrRecorderResponse;
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
        string $workspaceDir = '.workspace'
    ): AsrRecorderResponse {
        $requestData = [
            'task_key' => $taskKey,
            'source_dir' => $sourceDir,
            'workspace_dir' => $workspaceDir,
        ];

        try {
            $this->logger->info('ASR Recorder: Starting task', [
                'sandbox_id' => $sandboxId,
                'task_key' => $taskKey,
                'source_dir' => $sourceDir,
                'workspace_dir' => $workspaceDir,
            ]);

            // 调用沙箱 API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/asr/task/start',
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
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
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
        string $targetDir,
        string $outputFilename,
        ?string $sourceDir = null,
        string $workspaceDir = '.workspace',
        ?string $noteFilename = null,
        ?string $noteContent = null
    ): AsrRecorderResponse {
        $requestData = [
            'task_key' => $taskKey,
            'target_dir' => $targetDir,
            'output_filename' => $outputFilename,
            'workspace_dir' => $workspaceDir,
        ];

        // 如果提供了 source_dir，添加到请求中
        if ($sourceDir !== null) {
            $requestData['source_dir'] = $sourceDir;
        }

        // 如果提供了笔记信息，添加到请求中
        if ($noteFilename !== null && $noteContent !== null) {
            $requestData['note_filename'] = $noteFilename;
            $requestData['note_content'] = $noteContent;
        }

        try {
            $this->logger->info('ASR Recorder: Finishing task', [
                'sandbox_id' => $sandboxId,
                'task_key' => $taskKey,
                'target_dir' => $targetDir,
                'output_filename' => $outputFilename,  // 不含扩展名，沙箱会根据音频格式添加
                'source_dir' => $sourceDir,
                'has_note' => ($noteFilename !== null && $noteContent !== null),
                'note_filename' => $noteFilename,
            ]);

            // 调用沙箱 API
            $result = $this->gateway->proxySandboxRequest(
                $sandboxId,
                'POST',
                'api/asr/task/finish',
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
                    'code' => $response->getCode(),
                    'message' => $response->getMessage(),
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
