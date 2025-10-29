<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mock;

use App\Application\Speech\Enum\SandboxAsrStatusEnum;
use App\Domain\Asr\Constants\AsrRedisKeys;
use App\Domain\Asr\Constants\AsrTimeouts;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;
use Psr\Log\LoggerInterface;

/**
 * ASR 任务 Mock 服务
 * 模拟沙箱中的音频合并和 ASR 任务处理.
 */
class AsrApi
{
    private Redis $redis;

    private LoggerInterface $logger;

    public function __construct(ContainerInterface $container)
    {
        try {
            $this->redis = $container->get(Redis::class);
        } catch (ContainerExceptionInterface|NotFoundExceptionInterface) {
        }
        try {
            $this->logger = $container->get(LoggerFactory::class)->get('MockAsrApi');
        } catch (ContainerExceptionInterface|NotFoundExceptionInterface) {
        }
    }

    /**
     * 启动 ASR 任务
     * POST /api/v1/sandboxes/{sandboxId}/proxy/api/asr/task/start.
     */
    public function startTask(RequestInterface $request): array
    {
        $sandboxId = $request->route('sandboxId');
        $taskKey = $request->input('task_key', '');
        $sourceDir = $request->input('source_dir', '');
        $workspaceDir = $request->input('workspace_dir', '.workspace');
        $noteFileConfig = $request->input('note_file');
        $transcriptFileConfig = $request->input('transcript_file');

        // 记录调用日志
        $this->logger->info('[Mock Sandbox ASR] Start task called', [
            'sandbox_id' => $sandboxId,
            'task_key' => $taskKey,
            'source_dir' => $sourceDir,
            'workspace_dir' => $workspaceDir,
            'note_file_config' => $noteFileConfig,
            'transcript_file_config' => $transcriptFileConfig,
        ]);

        // 初始化任务状态（重置轮询计数）
        $countKey = sprintf(AsrRedisKeys::MOCK_FINISH_COUNT, $taskKey);
        $this->redis->del($countKey);

        return [
            'code' => 1000,
            'message' => 'ASR task started successfully',
            'data' => [
                'status' => SandboxAsrStatusEnum::RUNNING->value,
                'task_key' => $taskKey,
                'source_dir' => $sourceDir,
                'workspace_dir' => $workspaceDir,
                'file_path' => '',
                'duration' => 0,
                'file_size' => 0,
                'error_message' => '',
            ],
        ];
    }

    /**
     * 完成 ASR 任务（支持轮询）- V2 结构化版本
     * POST /api/v1/sandboxes/{sandboxId}/proxy/api/asr/task/finish.
     */
    public function finishTask(RequestInterface $request): array
    {
        $sandboxId = $request->route('sandboxId');
        $taskKey = $request->input('task_key', '');
        $workspaceDir = $request->input('workspace_dir', '.workspace');

        // V2 结构化参数
        $audioConfig = $request->input('audio', []);
        $noteFileConfig = $request->input('note_file');
        $transcriptFileConfig = $request->input('transcript_file');

        // 使用 Redis 计数器模拟轮询进度
        $countKey = sprintf(AsrRedisKeys::MOCK_FINISH_COUNT, $taskKey);
        $count = (int) $this->redis->incr($countKey);
        $this->redis->expire($countKey, AsrTimeouts::MOCK_POLLING_TTL); // 10分钟过期

        // 记录调用日志
        $this->logger->info('[Mock Sandbox ASR] Finish task called (V2)', [
            'sandbox_id' => $sandboxId,
            'task_key' => $taskKey,
            'workspace_dir' => $workspaceDir,
            'audio_config' => $audioConfig,
            'note_file_config' => $noteFileConfig,
            'transcript_file_config' => $transcriptFileConfig,
            'call_count' => $count,
        ]);

        // 前 3 次调用返回 finalizing 状态
        if ($count < 4) {
            return [
                'code' => 1000,
                'message' => 'ASR task is being finalized',
                'data' => [
                    'status' => SandboxAsrStatusEnum::FINALIZING->value,
                    'task_key' => $taskKey,
                ],
            ];
        }

        // 第 4 次调用返回 completed 状态
        $targetDir = $audioConfig['target_dir'] ?? '';
        $outputFilename = $audioConfig['output_filename'] ?? 'audio';

        // 模拟真实沙箱行为：根据 output_filename 重命名目录
        // 提取原目录中的时间戳部分（格式：_YYYYMMDD_HHMMSS）
        $timestamp = '';
        if (preg_match('/_(\d{8}_\d{6})$/', $targetDir, $matches)) {
            $timestamp = '_' . $matches[1];
        }

        // 构建新的目录名：智能标题 + 时间戳
        $renamedDir = $outputFilename . $timestamp;

        // 构建音频文件信息
        $audioFileName = $outputFilename . '.webm';
        $audioPath = rtrim($renamedDir, '/') . '/' . $audioFileName;

        // 构建返回数据 (V2 详细版本)
        $responseData = [
            'status' => SandboxAsrStatusEnum::COMPLETED->value,
            'task_key' => $taskKey,
            'intelligent_title' => $outputFilename, // 使用输出文件名作为智能标题
            'error_message' => null,
            'files' => [
                'audio_file' => [
                    'filename' => $audioFileName,
                    'path' => $audioPath, // 使用重命名后的目录路径
                    'size' => 127569,
                    'duration' => 17.0,
                    'action_performed' => 'merged_and_created',
                    'source_path' => null,
                ],
            ],
            'deleted_files' => [],
            'operations' => [
                'audio_merge' => 'success',
                'note_process' => 'success',
                'transcript_cleanup' => 'success',
            ],
        ];

        // 如果有笔记文件配置，添加到返回中
        if ($noteFileConfig !== null && isset($noteFileConfig['target_path'])) {
            // 笔记文件也要使用重命名后的目录路径
            $noteFilename = $outputFilename . '-笔记.md';
            $noteFilePath = rtrim($renamedDir, '/') . '/' . $noteFilename;

            $responseData['files']['note_file'] = [
                'filename' => $noteFilename,
                'path' => $noteFilePath, // 使用重命名后的目录路径
                'size' => 0,
                'duration' => null,
                'action_performed' => 'renamed_and_moved',
                'source_path' => $noteFileConfig['source_path'] ?? '',
            ];
        }

        // 如果有流式识别文件配置，记录删除操作
        if ($transcriptFileConfig !== null && isset($transcriptFileConfig['source_path'])) {
            $responseData['deleted_files'][] = [
                'path' => $transcriptFileConfig['source_path'],
                'action_performed' => 'deleted',
            ];
        }

        return [
            'code' => 1000,
            'message' => '音频合并已完成',
            'data' => $responseData,
        ];
    }
}
