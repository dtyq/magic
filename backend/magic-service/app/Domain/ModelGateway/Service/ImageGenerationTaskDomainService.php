<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\Dto\TextGenerateImageDTO;
use App\Domain\ModelGateway\Entity\ImageGenerationTaskEntity;
use App\Domain\ModelGateway\Entity\ValueObject\Code;
use App\Domain\ModelGateway\Entity\ValueObject\ImageGenerationTaskStatus;
use App\Domain\ModelGateway\Entity\ValueObject\ModelGatewayDataIsolation;
use App\Domain\ModelGateway\Repository\ImageGenerationTaskRepositoryInterface;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

use function Hyperf\Translation\__;

readonly class ImageGenerationTaskDomainService
{
    public function __construct(
        private ImageGenerationTaskRepositoryInterface $repository,
        private ImageGenerationPayloadSanitizer $payloadSanitizer,
    ) {
    }

    public function createTask(
        ModelGatewayDataIsolation $dataIsolation,
        TextGenerateImageDTO $requestDTO,
        array $requestPayload,
    ): ImageGenerationTaskEntity {
        $now = date('Y-m-d H:i:s');
        $task = new ImageGenerationTaskEntity(
            id: $this->createTaskId(),
            organizationCode: $dataIsolation->getCurrentOrganizationCode(),
            userId: $dataIsolation->getCurrentUserId(),
            accessTokenId: (string) $dataIsolation->getAccessToken()->getId(),
            environment: $dataIsolation->getEnvironment(),
            model: $requestDTO->getModel(),
            requestPayload: $this->sanitizeRequestPayload($requestPayload),
            status: ImageGenerationTaskStatus::RUNNING,
            createdAt: $now,
            startedAt: $now,
            updatedAt: $now,
        );

        $this->repository->save($task);
        return $task;
    }

    public function getOwnedTask(ModelGatewayDataIsolation $dataIsolation, string $taskId): ImageGenerationTaskEntity
    {
        $task = $this->repository->getById($taskId);
        if (
            ! $task instanceof ImageGenerationTaskEntity
            || $task->getOrganizationCode() !== $dataIsolation->getCurrentOrganizationCode()
            || $task->getUserId() !== $dataIsolation->getCurrentUserId()
            || $task->getEnvironment() !== $dataIsolation->getEnvironment()
        ) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'image generation task not found');
        }

        return $task;
    }

    public function finishSucceeded(ImageGenerationTaskEntity $task, array $responsePayload): void
    {
        $task->markSucceeded($this->payloadSanitizer->sanitize($responsePayload));
        $this->repository->save($task);
    }

    public function finishFailed(ImageGenerationTaskEntity $task, null|int|string $errorCode, string $errorMessage): void
    {
        $task->markFailed($errorCode, $errorMessage);
        $this->repository->save($task);
    }

    public function markTimedOutIfNeeded(ImageGenerationTaskEntity $task): bool
    {
        // 查询侧的懒判定阈值：任务创建后 12 分钟仍未结束，读取时即视为失败。
        if (! $task->markTimedOutIfRunning(720, null, $this->getFailureMessage())) {
            return false;
        }

        $this->repository->save($task);
        return true;
    }

    /**
     * 清扫长时间未完成的生图任务：把创建时间早于阈值、且仍处于执行中的任务批量置为失败。
     *
     * 生图链路存在三类「僵尸任务」——sandbox 代码片段超时、Pod 重启丢失协程、
     * 用户重新发消息后 Agent 放弃原任务。这些任务的协程已经不存在，
     * 只能靠定时任务兜底置为失败，否则用户侧会一直停留在「生成中」。
     *
     * @param int $batchSize 单批更新行数，避免一次锁住过多数据
     * @param int $maxBatches 单次最多执行的批次数，防止长时间占用 Worker
     * @return int 本次实际置为失败的任务数
     */
    public function sweepTimedOutTasks(
        int $batchSize = 500,
        int $maxBatches = 20
    ): int {
        // 30 分钟：远大于正常生图耗时，只用于兜底，不与查询接口的 12 分钟懒判定统一。
        $createdBefore = date('Y-m-d H:i:s', time() - 1800);
        $errorMessage = $this->getFailureMessage();

        $total = 0;
        for ($batch = 0; $batch < $maxBatches; ++$batch) {
            $affected = $this->repository->markTimedOutBatch(
                $createdBefore,
                'IMAGE_GENERATION_FAILED',
                $errorMessage,
                $batchSize
            );
            $total += $affected;

            // 未跑满一批，说明已经清扫干净，无需继续。
            if ($affected < $batchSize) {
                break;
            }
        }

        return $total;
    }

    /**
     * 对用户不说「超时」（容易被理解成系统不稳定），统一用可重试的友好文案。
     */
    private function getFailureMessage(): string
    {
        return (string) __('image_generate.task_failed_retry');
    }

    private function createTaskId(): string
    {
        return Code::ImageGenerationTask->gen();
    }

    private function sanitizeRequestPayload(array $requestPayload): array
    {
        unset($requestPayload['api_key']);
        return $this->payloadSanitizer->sanitize($requestPayload);
    }
}
