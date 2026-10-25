<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity;

use App\Domain\ImageGenerate\ValueObject\ImageGenerationExpectedDuration;
use App\Domain\ModelGateway\Entity\ValueObject\ImageGenerationTaskStatus;
use DateTimeImmutable;
use DateTimeInterface;

use function Hyperf\Translation\__;

class ImageGenerationTaskEntity
{
    public function __construct(
        private readonly string $id,
        private readonly string $organizationCode,
        private readonly string $userId,
        private readonly string $accessTokenId,
        private readonly string $environment,
        private readonly string $model,
        private readonly array $requestPayload,
        private ImageGenerationTaskStatus $status,
        private array $responsePayload = [],
        private ?string $errorCode = null,
        private ?string $errorMessage = null,
        private string $createdAt = '',
        private string $startedAt = '',
        private ?string $finishedAt = null,
        private string $updatedAt = '',
    ) {
        $now = date('Y-m-d H:i:s');
        $this->createdAt = $this->createdAt ?: $now;
        $this->startedAt = $this->startedAt ?: $this->createdAt;
        $this->updatedAt = $this->updatedAt ?: $this->createdAt;
    }

    public function getId(): string
    {
        return $this->id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getAccessTokenId(): string
    {
        return $this->accessTokenId;
    }

    public function getEnvironment(): string
    {
        return $this->environment;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function getRequestPayload(): array
    {
        return $this->requestPayload;
    }

    public function getResponsePayload(): array
    {
        return $this->responsePayload;
    }

    public function getStatus(): ImageGenerationTaskStatus
    {
        return $this->status;
    }

    public function getErrorCode(): ?string
    {
        return $this->errorCode;
    }

    public function getErrorMessage(): ?string
    {
        return $this->errorMessage;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function getStartedAt(): string
    {
        return $this->startedAt;
    }

    public function getFinishedAt(): ?string
    {
        return $this->finishedAt;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function markSucceeded(array $responsePayload, ?DateTimeInterface $now = null): void
    {
        if (! $this->status->isRunning()) {
            return;
        }

        $finishedAt = $this->formatTime($now);
        $this->status = ImageGenerationTaskStatus::SUCCEEDED;
        $this->responsePayload = $responsePayload;
        $this->errorCode = null;
        $this->errorMessage = null;
        $this->finishedAt = $finishedAt;
        $this->updatedAt = $finishedAt;
    }

    public function markFailed(null|int|string $errorCode, string $errorMessage, ?DateTimeInterface $now = null): void
    {
        if (! $this->status->isRunning()) {
            return;
        }

        $finishedAt = $this->formatTime($now);
        $this->status = ImageGenerationTaskStatus::FAILED;
        $this->errorCode = $errorCode === null ? null : (string) $errorCode;
        $this->errorMessage = $errorMessage;
        $this->finishedAt = $finishedAt;
        $this->updatedAt = $finishedAt;
    }

    /**
     * 任务创建后超过 $timeoutSeconds 仍未结束，则置为失败。
     *
     * 对用户不说「超时」，文案统一取 image_generate.task_failed_retry；
     * $errorMessage 由调用方按当前语种传入，不传时兜底英文。
     */
    public function markTimedOutIfRunning(
        int $timeoutSeconds,
        ?DateTimeInterface $now = null,
        ?string $errorMessage = null
    ): bool {
        if (! $this->status->isRunning()) {
            return false;
        }

        $now ??= new DateTimeImmutable();
        $createdAt = strtotime($this->createdAt);
        if ($createdAt === false || $now->getTimestamp() - $createdAt <= $timeoutSeconds) {
            return false;
        }

        $this->markFailed(
            'IMAGE_GENERATION_FAILED',
            $errorMessage ?? (string) __('image_generate.task_failed_retry', [], 'en_US'),
            $now
        );
        return true;
    }

    public function toPersistenceArray(): array
    {
        return [
            'id' => $this->id,
            'organization_code' => $this->organizationCode,
            'user_id' => $this->userId,
            'access_token_id' => $this->accessTokenId,
            'environment' => $this->environment,
            'model' => $this->model,
            'request_payload' => $this->requestPayload,
            'response_payload' => $this->responsePayload,
            'status' => $this->status->value,
            'error_code' => $this->errorCode,
            'error_message' => $this->errorMessage,
            'created_at' => $this->createdAt,
            'started_at' => $this->startedAt,
            'finished_at' => $this->finishedAt,
            'updated_at' => $this->updatedAt,
        ];
    }

    public function toResponseArray(): array
    {
        return [
            'id' => $this->id,
            'object' => 'image.generation.task',
            'status' => $this->status->value,
            'created_at' => $this->createdAt,
            'updated_at' => $this->updatedAt,
            'finished_at' => $this->finishedAt,
            'started_at' => $this->getStartedAtIso(),
            'expected_finished_at' => $this->getExpectedFinishedAt(),
            'response' => $this->status === ImageGenerationTaskStatus::SUCCEEDED ? $this->responsePayload : null,
            'error' => $this->status === ImageGenerationTaskStatus::FAILED ? [
                'code' => $this->errorCode,
                'message' => $this->errorMessage,
            ] : null,
        ];
    }

    /** 返回带时区的任务起点，避免浏览器按本机时区解释持久化时间。 */
    private function getStartedAtIso(): string
    {
        return date(DateTimeInterface::ATOM, $this->resolveStartedAtTimestamp());
    }

    /** 按任务起点和分辨率档位返回带时区的预期完成时间。 */
    private function getExpectedFinishedAt(): string
    {
        return date(
            DateTimeInterface::ATOM,
            $this->resolveStartedAtTimestamp() + ImageGenerationExpectedDuration::resolveSeconds(
                $this->requestPayload['resolution'] ?? null,
                $this->requestPayload['size'] ?? null
            )
        );
    }

    private function resolveStartedAtTimestamp(): int
    {
        $startedAt = strtotime($this->startedAt);

        return $startedAt === false ? (strtotime($this->createdAt) ?: time()) : $startedAt;
    }

    private function formatTime(?DateTimeInterface $time): string
    {
        return ($time ?? new DateTimeImmutable())->format('Y-m-d H:i:s');
    }
}
