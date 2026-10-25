<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Design\Support;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\ValueObject\DesignGenerationStatus;
use App\Domain\Design\Service\DesignGenerationTaskDomainService;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

/**
 * 把样片成片请求里的样片引用解析成方舟样片任务 ID。
 *
 * 调用方只提供样片业务 ID（video_id）或产物工作区相对路径（uri），二者至少其一；
 * 这里统一反查同项目下已完成的视频任务，取出 provider_task_id，并继承样片时长与成片分辨率，
 * 让归一化请求里的计费维度与真实产出保持一致。
 */
final class DesignDraftTaskResolver
{
    /**
     * 样片成片的成片分辨率档位。方舟成片按正式分辨率出片，样片档位不再接受。
     *
     * @var list<string>
     */
    private const array FINAL_RESOLUTIONS = ['1080p'];

    public function __construct(
        private readonly DesignGenerationTaskDomainService $designGenerationTaskDomainService,
    ) {
    }

    /**
     * 解析样片引用并就地改写实体的输入 / 请求快照，供后续提单链路直接下发。
     */
    public function resolve(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        $inputs = $entity->getInputPayload();
        $draftTask = is_array($inputs['draft_task'] ?? null) ? $inputs['draft_task'] : [];
        if ($draftTask === []) {
            return;
        }

        $draftEntity = $this->findDraftTask($dataIsolation, $entity->getProjectId(), $draftTask);
        $providerTaskId = trim((string) ($draftEntity->getProviderPayload()['provider_task_id'] ?? ''));
        if ($providerTaskId === '') {
            ExceptionBuilder::throw(
                DesignErrorCode::InvalidArgument,
                'design.video_generation.draft_task_not_ready',
            );
        }

        $resolvedDraftTask = ['id' => $providerTaskId];
        $inputs['draft_task'] = $resolvedDraftTask;
        $entity->setInputPayload($inputs);

        $requestPayload = $entity->getRequestPayload();
        $requestInputs = is_array($requestPayload['inputs'] ?? null) ? $requestPayload['inputs'] : [];
        $requestInputs['draft_task'] = $resolvedDraftTask;
        $requestPayload['inputs'] = $requestInputs;
        $requestPayload['generation'] = $this->resolveGeneration(
            is_array($requestPayload['generation'] ?? null) ? $requestPayload['generation'] : [],
            $draftEntity,
        );
        $entity->setRequestPayload($requestPayload);
    }

    /**
     * 反查样片任务：video_id 更精确，两者都传时优先用它。
     *
     * @param array<string, mixed> $draftTask
     */
    private function findDraftTask(DesignDataIsolation $dataIsolation, int $projectId, array $draftTask): DesignGenerationTaskEntity
    {
        $videoId = trim((string) ($draftTask['video_id'] ?? ''));
        $relativePath = trim((string) ($draftTask['uri'] ?? ''));

        $draftEntity = $videoId === ''
            ? null
            : $this->designGenerationTaskDomainService->findVideoTask($dataIsolation, $projectId, $videoId);

        if ($draftEntity === null && $relativePath !== '') {
            $draftEntity = $this->designGenerationTaskDomainService->findVideoTaskByOutputFilePath(
                $dataIsolation,
                $projectId,
                $this->normalizeWorkspacePath($relativePath),
            );
        }

        if ($draftEntity === null) {
            ExceptionBuilder::throw(
                DesignErrorCode::InvalidArgument,
                'design.video_generation.draft_task_not_found',
            );
        }

        // 只有出片成功的样片才有可继承的下游任务上下文。
        if ($draftEntity->getStatus() !== DesignGenerationStatus::COMPLETED) {
            ExceptionBuilder::throw(
                DesignErrorCode::InvalidArgument,
                'design.video_generation.draft_task_not_completed',
            );
        }

        return $draftEntity;
    }

    /**
     * 解析成片 generation：分辨率只认成片档位，时长从样片继承。
     *
     * 方舟成片不接受显式下发时长，但模型网关的计费维度读取的是归一化请求里的
     * duration_seconds / resolution，所以这里必须写对，否则会按默认档位计费。
     *
     * @param array<string, mixed> $generation
     * @return array<string, mixed>
     */
    private function resolveGeneration(array $generation, DesignGenerationTaskEntity $draftEntity): array
    {
        $resolution = trim((string) ($generation['resolution'] ?? ''));
        $generation['resolution'] = in_array($resolution, self::FINAL_RESOLUTIONS, true)
            ? $resolution
            : self::FINAL_RESOLUTIONS[0];

        $durationSeconds = $this->resolveDraftDurationSeconds($draftEntity);
        if ($durationSeconds !== null) {
            $generation['duration_seconds'] = $durationSeconds;
        }

        return $generation;
    }

    /**
     * 优先取样片归档后的实际时长，取不到再退回样片下单时请求的时长。
     */
    private function resolveDraftDurationSeconds(DesignGenerationTaskEntity $draftEntity): ?int
    {
        $durationSeconds = (int) ($draftEntity->getOutputPayload()['duration_seconds'] ?? 0);
        if ($durationSeconds > 0) {
            return $durationSeconds;
        }

        $durationSeconds = (int) ($draftEntity->getRequestPayload()['generation']['duration_seconds'] ?? 0);

        return $durationSeconds > 0 ? $durationSeconds : null;
    }

    /**
     * 统一工作区路径格式，与创建链路的规范化保持一致。
     */
    private function normalizeWorkspacePath(string $path): string
    {
        $path = '/' . trim($path, '/');

        return $path === '/' ? $path : rtrim($path, '/');
    }
}
