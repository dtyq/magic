<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Service;

use App\Application\SuperMagic\Task\Service\AgentAppService;
use App\Domain\Contact\Entity\ValueObject\DataIsolation as ContactDataIsolation;
use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\SuperMagic\Project\Service\ProjectDomainService;
use App\Domain\SuperMagic\Topic\Service\TopicDomainService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Gateway\SandboxGatewayInterface;
use InvalidArgumentException;
use Psr\Log\LoggerInterface;
use RuntimeException;

/**
 * 负责把画布合成任务提交到现有项目沙箱中的 Super Magic 运行时。
 *
 * 该服务只处理业务任务协议，不执行媒体处理，也不直接修改画布文件。
 */
readonly class DesignCanvasCompositionSubmissionService
{
    public function __construct(
        private AgentAppService $agentAppService,
        private SandboxGatewayInterface $sandboxGateway,
        private ProjectDomainService $projectDomainService,
        private TopicDomainService $topicDomainService,
        private LoggerInterface $logger,
    ) {
    }

    /** 提交画布合成任务并返回统一轮询快照。 */
    public function submit(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity, ContactDataIsolation $contactIsolation): array
    {
        $requestPayload = $entity->getRequestPayload();
        $composition = is_array($requestPayload['composition'] ?? null) ? $requestPayload['composition'] : [];
        $generation = is_array($requestPayload['generation'] ?? null) ? $requestPayload['generation'] : [];
        if ($contactIsolation->getCurrentOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()
            || $contactIsolation->getCurrentUserId() !== $dataIsolation->getCurrentUserId()) {
            throw new InvalidArgumentException('画布合成必须使用应用层准备的当前用户隔离对象');
        }
        $sandboxId = $this->resolveSandboxId($contactIsolation, $entity);
        $this->logger->info('design video canvas composition sandbox resolved', [
            'video_id' => $entity->getGenerationId(),
            'project_id' => $entity->getProjectId(),
            'organization_code' => $entity->getOrganizationCode(),
            'sandbox_id' => $sandboxId,
            'operation_id' => $entity->getGenerationId(),
        ]);

        $result = $this->sandboxGateway->proxySandboxRequest(
            $contactIsolation,
            $sandboxId,
            'POST',
            'api/sandbox/tasks',
            [
                'task_id' => $entity->getGenerationId(),
                'capability' => 'video_composition',
                // 直接文件合成以 workspace 为根，不依赖 magic.project.js 所在项目目录。
                'project_path' => '.',
                'payload' => [
                    'file_dir' => $entity->getFileDir(),
                    'composition' => $composition,
                    'generation' => $generation,
                    'file_name' => $entity->getFileName(),
                    'output_file_name' => $this->optionalExtension($entity, 'output_file_name'),
                ],
            ],
        );
        if (! $result->isSuccess()) {
            ExceptionBuilder::throw(
                DesignErrorCode::ThirdPartyServiceError,
                'design.video_generation.submit_failed',
                throwable: new RuntimeException($result->getMessage())
            );
        }

        return [
            'provider' => 'super_magic',
            'submit_endpoint' => 'api/sandbox/tasks',
            'operation_id' => $entity->getGenerationId(),
            'sandbox_id' => $sandboxId,
            'submitted_at' => date(DATE_ATOM),
            'poll_attempts' => 0,
            'deadline_at' => date(DATE_ATOM, time() + (int) config('design_generation.video_poll.timeout_seconds', 3600)),
        ];
    }

    /** 查询 Super Magic 合成任务并转换成现有视频轮询协议。 */
    public function query(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity, ContactDataIsolation $contactIsolation): array
    {
        if ($contactIsolation->getCurrentOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()
            || $contactIsolation->getCurrentUserId() !== $dataIsolation->getCurrentUserId()) {
            throw new InvalidArgumentException('画布合成必须使用应用层准备的当前用户隔离对象');
        }
        $sandboxId = (string) ($entity->getProviderPayload()['sandbox_id'] ?? '');
        if ($sandboxId === '') {
            $sandboxId = $this->resolveSandboxId($contactIsolation, $entity);
        }

        $result = $this->sandboxGateway->proxySandboxRequest(
            $contactIsolation,
            $sandboxId,
            'GET',
            'api/sandbox/tasks/' . rawurlencode($entity->getGenerationId()),
        );
        $data = $result->getData();
        $task = is_array($data['data'] ?? null) ? $data['data'] : $data;
        if (! $result->isSuccess() && ! isset($task['status'])) {
            return [
                'status' => 'failed',
                'error' => ['message' => $result->getMessage()],
                'output' => [],
                'provider_result' => $data,
            ];
        }
        $status = (string) ($task['status'] ?? 'queued');
        $output = is_array($task['output'] ?? null) ? $task['output'] : [];

        return [
            'status' => match ($status) {
                'completed' => 'succeeded',
                'failed' => 'failed',
                'cancelled' => 'canceled',
                'preparing', 'running', 'finalizing' => 'running',
                default => 'queued',
            },
            'error' => $status === 'failed' ? ['message' => (string) ($task['error_message'] ?? $result->getMessage())] : null,
            'output' => [
                'video_url' => $output['file_url'] ?? null,
                'video_path' => $output['file_path'] ?? null,
                'duration_seconds' => $output['duration_seconds'] ?? null,
                'resolution' => isset($output['width'], $output['height']) ? $output['width'] . 'x' . $output['height'] : null,
                'has_audio_output' => (bool) ($output['has_audio'] ?? false),
            ],
            'provider_result' => $task,
        ];
    }

    /** 按当前话题初始化或复用其沙箱，避免调用方直接注入任意沙箱 ID。 */
    private function resolveSandboxId(ContactDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): string
    {
        $hiddenTopic = $this->topicDomainService->findHiddenTopicByProjectAndUser(
            $entity->getProjectId(),
            $dataIsolation->getCurrentUserId(),
        );
        $project = $this->projectDomainService->getProjectNotUserId($entity->getProjectId());
        $topicId = $hiddenTopic?->getId() ?? $project?->getCurrentTopicId();
        if ($topicId === null || $topicId <= 0) {
            ExceptionBuilder::throw(
                DesignErrorCode::InvalidArgument,
                'common.empty',
                ['label' => 'project.current_topic_id']
            );
        }
        return $this->agentAppService->ensureSandboxInitialized(
            $dataIsolation,
            $topicId,
            skipInitMessages: true,
        );
    }

    private function optionalExtension(DesignGenerationTaskEntity $entity, string $key): string
    {
        $extensions = $entity->getRequestPayload()['extensions'] ?? [];
        return is_array($extensions) && isset($extensions[$key]) ? trim((string) $extensions[$key]) : '';
    }
}
