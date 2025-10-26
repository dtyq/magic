<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mock;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Hyperf\Redis\Redis;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;
use Psr\Log\LoggerInterface;

/**
 * 沙箱 ASR API Mock 服务
 * 模拟沙箱中的音频合并和 ASR 任务处理.
 */
class SandboxAsrApi
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
            $this->logger = $container->get(LoggerFactory::class)->get('MockSandboxAsrApi');
        } catch (ContainerExceptionInterface|NotFoundExceptionInterface) {
        }
    }

    /**
     * 查询沙箱状态
     * GET /api/v1/sandboxes/{sandboxId}.
     */
    public function getSandboxStatus(RequestInterface $request): array
    {
        $sandboxId = $request->route('sandboxId');

        $this->logger->info('[Mock Sandbox] Get sandbox status', [
            'sandbox_id' => $sandboxId,
        ]);

        // 模拟沙箱已存在且运行中
        // 使用 SandboxStatus 枚举值确保类型安全
        return [
            'code' => 1000,
            'message' => 'Success',
            'data' => [
                'sandbox_id' => $sandboxId,
                'status' => SandboxStatus::RUNNING, // 使用枚举常量
                'project_id' => 'mock_project_id',
                'created_at' => date('Y-m-d H:i:s'),
            ],
        ];
    }

    /**
     * 创建沙箱
     * POST /api/v1/sandboxes.
     */
    public function createSandbox(RequestInterface $request): array
    {
        $projectId = $request->input('project_id', '');
        $sandboxId = $request->input('sandbox_id', '');
        $projectOssPath = $request->input('project_oss_path', '');

        $this->logger->info('[Mock Sandbox] Create sandbox', [
            'project_id' => $projectId,
            'sandbox_id' => $sandboxId,
            'project_oss_path' => $projectOssPath,
        ]);

        // 模拟沙箱创建成功
        // 使用 SandboxStatus 枚举值确保类型安全
        return [
            'code' => 1000,
            'message' => 'Sandbox created successfully',
            'data' => [
                'sandbox_id' => $sandboxId,
                'status' => SandboxStatus::RUNNING, // 使用枚举常量
                'project_id' => $projectId,
                'project_oss_path' => $projectOssPath,
                'created_at' => date('Y-m-d H:i:s'),
            ],
        ];
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

        // 记录调用日志
        $this->logger->info('[Mock Sandbox ASR] Start task called', [
            'sandbox_id' => $sandboxId,
            'task_key' => $taskKey,
            'source_dir' => $sourceDir,
            'workspace_dir' => $workspaceDir,
        ]);

        // 初始化任务状态（重置轮询计数）
        $countKey = sprintf('mock:asr:task:%s:finish_count', $taskKey);
        $this->redis->del($countKey);

        return [
            'code' => 1000,
            'message' => 'ASR task started successfully',
            'data' => [
                'status' => 'running',
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
     * 完成 ASR 任务（支持轮询）
     * POST /api/v1/sandboxes/{sandboxId}/proxy/api/asr/task/finish.
     */
    public function finishTask(RequestInterface $request): array
    {
        $sandboxId = $request->route('sandboxId');
        $taskKey = $request->input('task_key', '');
        $targetDir = $request->input('target_dir', '');
        $outputFilename = $request->input('output_filename', '');
        $sourceDir = $request->input('source_dir');
        $noteFilename = $request->input('note_filename');
        $noteContent = $request->input('note_content');

        // 使用 Redis 计数器模拟轮询进度
        $countKey = sprintf('mock:asr:task:%s:finish_count', $taskKey);
        $count = (int) $this->redis->incr($countKey);
        $this->redis->expire($countKey, 600); // 10分钟过期

        // 记录调用日志
        $this->logger->info('[Mock Sandbox ASR] Finish task called', [
            'sandbox_id' => $sandboxId,
            'task_key' => $taskKey,
            'target_dir' => $targetDir,
            'output_filename' => $outputFilename,
            'source_dir' => $sourceDir ?? 'null',
            'has_note' => ($noteFilename !== null && $noteContent !== null),
            'note_filename' => $noteFilename,
            'call_count' => $count,
        ]);

        // 前 3 次调用返回 finalizing 状态
        if ($count < 4) {
            return [
                'code' => 1000,
                'message' => 'ASR task is being finalized',
                'data' => [
                    'status' => 'finalizing',
                    'task_key' => $taskKey,
                    'target_dir' => $targetDir,
                    'output_filename' => $outputFilename,
                    'file_path' => '',
                    'duration' => 0,
                    'file_size' => 0,
                    'error_message' => '',
                ],
            ];
        }

        // 第 4 次调用返回 finished 状态
        $filePath = sprintf('%s/%s', rtrim($targetDir, '/'), $outputFilename);

        return [
            'code' => 1000,
            'message' => 'ASR task finished successfully',
            'data' => [
                'status' => 'finished',
                'task_key' => $taskKey,
                'target_dir' => $targetDir,
                'output_filename' => $outputFilename,
                'file_path' => $filePath,
                'duration' => 120, // 模拟 2 分钟时长
                'file_size' => 1024000, // 模拟 1MB 文件大小
                'error_message' => '',
            ],
        ];
    }
}
