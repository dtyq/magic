<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Mock;

use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Agent\Constant\WorkspaceStatus;
use Dtyq\SuperMagic\Infrastructure\ExternalAPI\SandboxOS\Gateway\Constant\SandboxStatus;
use Hyperf\HttpServer\Contract\RequestInterface;
use Hyperf\Logger\LoggerFactory;
use Psr\Container\ContainerExceptionInterface;
use Psr\Container\ContainerInterface;
use Psr\Container\NotFoundExceptionInterface;
use Psr\Log\LoggerInterface;

/**
 * 沙箱管理 Mock 服务
 * 模拟沙箱的创建、状态查询、工作区状态等管理接口.
 */
class SandboxApi
{
    private LoggerInterface $logger;

    public function __construct(ContainerInterface $container)
    {
        try {
            $this->logger = $container->get(LoggerFactory::class)->get('MockSandboxApi');
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
        return [
            'code' => 1000,
            'message' => 'Success',
            'data' => [
                'sandbox_id' => $sandboxId,
                'status' => SandboxStatus::RUNNING,
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
        return [
            'code' => 1000,
            'message' => 'Sandbox created successfully',
            'data' => [
                'sandbox_id' => $sandboxId,
                'status' => SandboxStatus::RUNNING,
                'project_id' => $projectId,
                'project_oss_path' => $projectOssPath,
                'created_at' => date('Y-m-d H:i:s'),
            ],
        ];
    }

    /**
     * 获取工作区状态
     * GET /api/v1/sandboxes/{sandboxId}/proxy/api/v1/workspace/status.
     */
    public function getWorkspaceStatus(RequestInterface $request): array
    {
        $sandboxId = $request->route('sandboxId');

        $this->logger->info('[Mock Sandbox] Get workspace status', [
            'sandbox_id' => $sandboxId,
        ]);

        // 模拟工作区就绪状态
        // 注意：status 必须返回整数类型，对应 WorkspaceStatus 常量
        return [
            'code' => 1000,
            'message' => 'success',
            'data' => [
                'status' => WorkspaceStatus::READY, // 初始化完成，工作区完全可用
                'sandbox_id' => $sandboxId,
                'workspace_path' => '/workspace',
                'is_ready' => true,
            ],
        ];
    }

    /**
     * 初始化 Agent
     * POST /api/v1/sandboxes/{sandboxId}/proxy/api/v1/messages/chat.
     */
    public function initAgent(RequestInterface $request): array
    {
        $sandboxId = $request->route('sandboxId');
        $userId = $request->input('user_id', '');
        $taskMode = $request->input('task_mode', '');
        $agentMode = $request->input('agent_mode', '');
        $modelId = $request->input('model_id', '');

        $this->logger->info('[Mock Sandbox Agent] Initialize agent called', [
            'sandbox_id' => $sandboxId,
            'user_id' => $userId,
            'task_mode' => $taskMode,
            'agent_mode' => $agentMode,
            'model_id' => $modelId,
        ]);

        return [
            'code' => 1000,
            'message' => 'success',
            'data' => [
                'agent_id' => 'mock_agent_' . uniqid(),
                'status' => 'initialized',
                'message_id' => 'mock_msg_' . uniqid(),
                'sandbox_id' => $sandboxId,
            ],
        ];
    }

    /**
     * 初始化沙箱（简化版，用于 ASR 等无聊天消息场景）
     * POST /api/v1/sandboxes/{sandboxId}/proxy/v1/messages/chat.
     *
     * 请求体示例：
     * {
     *   "message_id": "asr_init_sandbox_001_1234567890",
     *   "type": "init",
     *   "metadata": {
     *     "sandbox_id": "sandbox_001",
     *     "user_id": "user_123",
     *     "organization_code": "org_001",
     *     "super_magic_task_id": "",
     *     "language": "zh_CN"
     *   }
     * }
     */
    public function initSandbox(RequestInterface $request): array
    {
        $sandboxId = $request->route('sandboxId');
        $messageId = $request->input('message_id', '');
        $type = $request->input('type', '');
        $metadata = $request->input('metadata', []);

        $this->logger->info('[Mock Sandbox] Initialize sandbox called', [
            'sandbox_id' => $sandboxId,
            'message_id' => $messageId,
            'type' => $type,
            'metadata' => $metadata,
        ]);

        // 验证必传参数
        if (empty($type) || $type !== 'init') {
            return [
                'code' => 4000,
                'message' => 'Invalid type, must be "init"',
                'data' => null,
            ];
        }

        if (empty($metadata['sandbox_id']) || empty($metadata['user_id']) || empty($metadata['organization_code'])) {
            return [
                'code' => 4000,
                'message' => 'Missing required metadata fields: sandbox_id, user_id, organization_code',
                'data' => null,
            ];
        }

        // 模拟沙箱初始化成功响应
        return [
            'code' => 1000,
            'message' => '工作区初始化成功',
            'data' => null,
        ];
    }
}
