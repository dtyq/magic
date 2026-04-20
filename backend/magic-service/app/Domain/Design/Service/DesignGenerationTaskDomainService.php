<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Service;

use App\Domain\Design\Entity\DesignDataIsolation;
use App\Domain\Design\Entity\DesignGenerationTaskEntity;
use App\Domain\Design\Entity\ValueObject\DesignGenerationAssetType;
use App\Domain\Design\Entity\ValueObject\DesignGenerationStatus;
use App\Domain\Design\Repository\Facade\DesignGenerationTaskRepositoryInterface;
use App\ErrorCode\DesignErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;

use function Hyperf\Translation\trans;

readonly class DesignGenerationTaskDomainService
{
    private const string PROVIDER_KEY_FIRST_POLL_STATUS = 'first_poll_status';

    private const string PROVIDER_KEY_FIRST_POLL_ATTEMPTS = 'first_poll_attempts';

    private const string PROVIDER_KEY_FIRST_POLL_LAST_ERROR = 'first_poll_last_error';

    private const string PROVIDER_KEY_FIRST_POLL_ENQUEUED_AT = 'first_poll_enqueued_at';

    private const string PROVIDER_KEY_FIRST_POLL_NEXT_RETRY_AT = 'first_poll_next_retry_at';

    private const string PROVIDER_KEY_POLL_ATTEMPTS = 'poll_attempts';

    private const string PROVIDER_KEY_LAST_POLLED_AT = 'last_polled_at';

    private const string PROVIDER_KEY_LAST_PROVIDER_STATUS = 'last_provider_status';

    private const string PROVIDER_KEY_LAST_PROVIDER_CODE = 'last_provider_code';

    private const string PROVIDER_KEY_LAST_PROVIDER_MESSAGE = 'last_provider_message';

    private const string PROVIDER_KEY_LAST_PROVIDER_RESULT = 'last_provider_result';

    private const string PROVIDER_KEY_LAST_PROVIDER_RESULT_UPDATED_AT = 'last_provider_result_updated_at';

    private const string PROVIDER_KEY_PROVIDER_TASK_ID = 'provider_task_id';

    private const string PROVIDER_KEY_UPSTREAM_TASK_ID = 'upstream_task_id';

    public function __construct(
        private DesignGenerationTaskRepositoryInterface $repository,
    ) {
    }

    public function createTask(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        $entity->setOrganizationCode($dataIsolation->getCurrentOrganizationCode());
        $entity->setUserId($dataIsolation->getCurrentUserId());
        $entity->prepareForCreate();

        $this->assertVideoTaskNotExists($dataIsolation, $entity->getProjectId(), $entity->getGenerationId());

        $this->repository->create($dataIsolation, $entity);
    }

    public function assertVideoTaskNotExists(
        DesignDataIsolation $dataIsolation,
        int $projectId,
        string $generationId
    ): void {
        if ($this->findVideoTask($dataIsolation, $projectId, $generationId) !== null) {
            ExceptionBuilder::throw(DesignErrorCode::InvalidArgument, 'common.exist', ['label' => $generationId]);
        }
    }

    public function findVideoTask(DesignDataIsolation $dataIsolation, int $projectId, string $generationId): ?DesignGenerationTaskEntity
    {
        return $this->repository->findByProjectAndGenerationId(
            $dataIsolation,
            $projectId,
            DesignGenerationAssetType::VIDEO,
            $generationId,
        );
    }

    public function deleteTask(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        $this->repository->delete($dataIsolation, $entity);
    }

    /**
     * @return DesignGenerationTaskEntity[]
     */
    public function findProcessingTasksAfterId(int $cursorId, int $limit): array
    {
        return $this->repository->findProcessingTasksAfterId($cursorId, $limit);
    }

    public function markAsSubmitted(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity, array $providerPayload): void
    {
        $mergedProviderPayload = array_merge($entity->getProviderPayload(), $providerPayload);
        $mergedProviderPayload[self::PROVIDER_KEY_FIRST_POLL_STATUS] = 'pending';
        $mergedProviderPayload[self::PROVIDER_KEY_FIRST_POLL_ATTEMPTS] = 0;
        $mergedProviderPayload[self::PROVIDER_KEY_FIRST_POLL_LAST_ERROR] = '';
        $mergedProviderPayload[self::PROVIDER_KEY_FIRST_POLL_ENQUEUED_AT] = null;
        $mergedProviderPayload[self::PROVIDER_KEY_FIRST_POLL_NEXT_RETRY_AT] = date(DATE_ATOM);

        $entity->setProviderPayload($this->normalizeProviderPayload($mergedProviderPayload));
        $entity->setUpdatedAt(new DateTime());
        $entity->setErrorMessage(null);
        $this->repository->update($dataIsolation, $entity);
    }

    public function markFirstPollSent(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity): void
    {
        $providerPayload = $entity->getProviderPayload();
        $providerPayload[self::PROVIDER_KEY_FIRST_POLL_STATUS] = 'sent';
        $providerPayload[self::PROVIDER_KEY_FIRST_POLL_LAST_ERROR] = '';
        $providerPayload[self::PROVIDER_KEY_FIRST_POLL_ENQUEUED_AT] = date(DATE_ATOM);
        $providerPayload[self::PROVIDER_KEY_FIRST_POLL_NEXT_RETRY_AT] = null;

        $entity->setProviderPayload($this->normalizeProviderPayload($providerPayload));
        $entity->setUpdatedAt(new DateTime());
        $this->repository->update($dataIsolation, $entity);
    }

    public function markFirstPollDispatchFailed(
        DesignDataIsolation $dataIsolation,
        DesignGenerationTaskEntity $entity,
        string $errorMessage,
        string $nextRetryAt,
    ): void {
        $providerPayload = $entity->getProviderPayload();
        $providerPayload[self::PROVIDER_KEY_FIRST_POLL_STATUS] = 'failed';
        $providerPayload[self::PROVIDER_KEY_FIRST_POLL_ATTEMPTS] = (int) ($providerPayload[self::PROVIDER_KEY_FIRST_POLL_ATTEMPTS] ?? 0) + 1;
        $providerPayload[self::PROVIDER_KEY_FIRST_POLL_LAST_ERROR] = mb_substr(trim($errorMessage), 0, 1000);
        $providerPayload[self::PROVIDER_KEY_FIRST_POLL_NEXT_RETRY_AT] = $nextRetryAt;

        $entity->setProviderPayload($this->normalizeProviderPayload($providerPayload));
        $entity->setUpdatedAt(new DateTime());
        $this->repository->update($dataIsolation, $entity);
    }

    /**
     * @param array<string, mixed> $runtimeResult
     */
    public function syncRuntimeSnapshot(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity, array $runtimeResult): void
    {
        $now = date(DATE_ATOM);
        $runtimeStatus = trim((string) ($runtimeResult['status'] ?? ''));
        $providerPayload = $entity->getProviderPayload();
        $providerResult = is_array($runtimeResult['provider_result'] ?? null) ? $runtimeResult['provider_result'] : [];
        $error = is_array($runtimeResult['error'] ?? null) ? $runtimeResult['error'] : [];
        $output = is_array($runtimeResult['output'] ?? null) ? $runtimeResult['output'] : [];

        $providerPayload[self::PROVIDER_KEY_POLL_ATTEMPTS] = (int) ($providerPayload[self::PROVIDER_KEY_POLL_ATTEMPTS] ?? 0) + 1;
        $providerPayload[self::PROVIDER_KEY_LAST_POLLED_AT] = $now;
        $providerPayload[self::PROVIDER_KEY_LAST_PROVIDER_STATUS] = $runtimeStatus;
        $providerPayload[self::PROVIDER_KEY_LAST_PROVIDER_CODE] = $this->resolveProviderCode($providerResult, $error);
        $providerPayload[self::PROVIDER_KEY_LAST_PROVIDER_MESSAGE] = $this->sanitizeProviderMessage(
            $runtimeStatus,
            $this->resolveProviderMessage($providerResult, $error),
        );
        $providerPayload[self::PROVIDER_KEY_LAST_PROVIDER_RESULT] = $providerResult;
        $providerPayload[self::PROVIDER_KEY_LAST_PROVIDER_RESULT_UPDATED_AT] = $providerResult === [] ? ($providerPayload[self::PROVIDER_KEY_LAST_PROVIDER_RESULT_UPDATED_AT] ?? null) : $now;
        $providerPayload[self::PROVIDER_KEY_PROVIDER_TASK_ID] = $this->resolveProviderTaskId($providerPayload, $providerResult, $output);

        $outputPayload = $entity->getOutputPayload();
        $outputPayload['last_operation_output'] = $output;
        $outputPayload['last_output_updated_at'] = $now;

        $entity->setProviderPayload($this->normalizeProviderPayload($providerPayload));
        $entity->setOutputPayload($this->normalizeOutputPayload($outputPayload));
        if (in_array($runtimeStatus, ['queued', 'running', 'processing'], true)) {
            $entity->setStatus(DesignGenerationStatus::PROCESSING);
            $entity->setErrorMessage(null);
        }
        $entity->setUpdatedAt(new DateTime());
        $this->repository->update($dataIsolation, $entity);
    }

    public function markPollQueryFailed(
        DesignDataIsolation $dataIsolation,
        DesignGenerationTaskEntity $entity,
        string $errorMessage,
    ): void {
        $now = date(DATE_ATOM);
        $providerPayload = $entity->getProviderPayload();
        $providerPayload[self::PROVIDER_KEY_POLL_ATTEMPTS] = (int) ($providerPayload[self::PROVIDER_KEY_POLL_ATTEMPTS] ?? 0) + 1;
        $providerPayload[self::PROVIDER_KEY_LAST_POLLED_AT] = $now;
        $providerPayload[self::PROVIDER_KEY_LAST_PROVIDER_STATUS] = 'query_failed';
        $providerPayload[self::PROVIDER_KEY_LAST_PROVIDER_CODE] = '';
        $providerPayload[self::PROVIDER_KEY_LAST_PROVIDER_MESSAGE] = $this->sanitizePublicErrorMessage($errorMessage);

        $entity->setProviderPayload($this->normalizeProviderPayload($providerPayload));
        $entity->setStatus(DesignGenerationStatus::PROCESSING);
        $entity->setErrorMessage(null);
        $entity->setUpdatedAt(new DateTime());
        $this->repository->update($dataIsolation, $entity);
    }

    public function markAsFailed(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity, string $errorMessage): void
    {
        $entity->setStatus(DesignGenerationStatus::FAILED);
        $entity->setErrorMessage($this->sanitizePublicErrorMessage($errorMessage));
        $entity->setUpdatedAt(new DateTime());
        $this->repository->update($dataIsolation, $entity);
    }

    public function markAsCompleted(DesignDataIsolation $dataIsolation, DesignGenerationTaskEntity $entity, array $outputPayload, string $fileName): void
    {
        $entity->setFileName($fileName);
        $entity->setOutputPayload($this->normalizeOutputPayload(array_merge($entity->getOutputPayload(), $outputPayload)));
        $entity->setStatus(DesignGenerationStatus::COMPLETED);
        $entity->setErrorMessage(null);
        $entity->setUpdatedAt(new DateTime());
        $this->repository->update($dataIsolation, $entity);
    }

    public function buildFinalVideoFileName(DesignGenerationTaskEntity $entity, string $videoUrl): string
    {
        $currentFileName = trim($entity->getFileName());
        $extension = $this->detectExtension($videoUrl, 'mp4');
        if ($currentFileName !== '') {
            if (pathinfo($currentFileName, PATHINFO_EXTENSION) !== '') {
                return $currentFileName;
            }

            return $currentFileName . '.' . $extension;
        }

        return sprintf('video_%s.%s', date('Ymd_His'), $extension);
    }

    public function buildPosterFileName(string $videoFileName, string $posterUrl): string
    {
        return sprintf(
            '%s_cover.%s',
            pathinfo($videoFileName, PATHINFO_FILENAME),
            $this->detectExtension($posterUrl, 'png'),
        );
    }

    private function detectExtension(string $url, string $default): string
    {
        $path = parse_url($url, PHP_URL_PATH);
        $extension = is_string($path) ? strtolower(pathinfo($path, PATHINFO_EXTENSION)) : '';

        return $extension !== '' ? $extension : $default;
    }

    private function sanitizeProviderMessage(string $status, string $message): string
    {
        if (! in_array($status, ['failed', 'canceled'], true)) {
            return $message;
        }

        return $this->sanitizePublicErrorMessage($message);
    }

    private function sanitizePublicErrorMessage(?string $message): string
    {
        $message = trim((string) $message);
        if ($message === '') {
            return trans('design.video_generation.failed');
        }

        if ($this->hasPublicVideoGenerationPrefix($message) || in_array($message, $this->publicVideoGenerationMessages(), true)) {
            return $message;
        }

        $normalized = strtolower($message);

        return match (true) {
            str_contains($normalized, 'submit failed') => trans('design.video_generation.submit_failed'),
            str_contains($normalized, 'query failed') => trans('design.video_generation.query_failed'),
            str_contains($normalized, 'timeout') => trans('design.video_generation.timeout'),
            str_contains($normalized, 'invalid status') => trans('design.video_generation.invalid_status'),
            str_contains($normalized, 'operation id missing') => trans('design.video_generation.operation_id_missing'),
            str_contains($normalized, 'video url missing') => trans('design.video_generation.video_url_missing'),
            str_contains($normalized, 'access token not configured') => trans('design.video_generation.gateway_access_token_not_configured'),
            default => trans('design.video_generation.failed'),
        };
    }

    /**
     * @return string[]
     */
    private function publicVideoGenerationMessages(): array
    {
        return [
            trans('design.video_generation.failed'),
            trans('design.video_generation.submit_failed'),
            trans('design.video_generation.query_failed'),
            trans('design.video_generation.gateway_access_token_not_configured'),
            trans('design.video_generation.operation_id_missing'),
            trans('design.video_generation.video_url_missing'),
            trans('design.video_generation.timeout'),
            trans('design.video_generation.invalid_status'),
        ];
    }

    private function hasPublicVideoGenerationPrefix(string $message): bool
    {
        return array_any([
            rtrim(trans('design.video_generation.reference_image_url_missing', ['file_key' => '']), ': '),
            rtrim(trans('design.video_generation.frame_url_missing', ['file_key' => '']), ': '),
            rtrim(trans('design.video_generation.save_project_file_failed', ['file_key' => '']), ': '),
        ], fn ($prefix) => $prefix !== '' && str_starts_with($message, $prefix));
    }

    /**
     * @param array<string, mixed> $providerPayload
     * @param array<string, mixed> $providerResult
     * @param array<string, mixed> $output
     */
    private function resolveProviderTaskId(array $providerPayload, array $providerResult, array $output): string
    {
        $candidates = [
            $output['provider_task_id'] ?? null,
            $providerResult['data']['task_id'] ?? null,
            $providerResult['data']['id'] ?? null,
            $providerPayload[self::PROVIDER_KEY_PROVIDER_TASK_ID] ?? null,
            $providerPayload[self::PROVIDER_KEY_UPSTREAM_TASK_ID] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return '';
    }

    /**
     * @param array<string, mixed> $providerPayload
     * @return array<string, mixed>
     */
    private function normalizeProviderPayload(array $providerPayload): array
    {
        $providerTaskId = $providerPayload[self::PROVIDER_KEY_PROVIDER_TASK_ID] ?? $providerPayload[self::PROVIDER_KEY_UPSTREAM_TASK_ID] ?? null;
        if (is_string($providerTaskId) && trim($providerTaskId) !== '') {
            $providerPayload[self::PROVIDER_KEY_PROVIDER_TASK_ID] = trim($providerTaskId);
        } else {
            $providerPayload[self::PROVIDER_KEY_PROVIDER_TASK_ID] = '';
        }

        unset($providerPayload[self::PROVIDER_KEY_UPSTREAM_TASK_ID]);

        return $providerPayload;
    }

    /**
     * @param array<string, mixed> $outputPayload
     * @return array<string, mixed>
     */
    private function normalizeOutputPayload(array $outputPayload): array
    {
        $providerVideoUrl = $outputPayload['provider_video_url'] ?? $outputPayload['upstream_video_url'] ?? null;
        if (is_string($providerVideoUrl) && trim($providerVideoUrl) !== '') {
            $outputPayload['provider_video_url'] = trim($providerVideoUrl);
        } else {
            $outputPayload['provider_video_url'] = '';
        }

        $providerPosterUrl = $outputPayload['provider_poster_url'] ?? $outputPayload['upstream_poster_url'] ?? null;
        if (is_string($providerPosterUrl) && trim($providerPosterUrl) !== '') {
            $outputPayload['provider_poster_url'] = trim($providerPosterUrl);
        } else {
            $outputPayload['provider_poster_url'] = '';
        }

        unset($outputPayload['upstream_video_url'], $outputPayload['upstream_poster_url']);

        return $outputPayload;
    }

    /**
     * @param array<string, mixed> $providerResult
     * @param array<string, mixed> $error
     */
    private function resolveProviderCode(array $providerResult, array $error): string
    {
        $candidates = [
            $error['provider_code'] ?? null,
            $providerResult['code'] ?? null,
            $error['code'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if ((is_string($candidate) || is_int($candidate)) && trim((string) $candidate) !== '') {
                return trim((string) $candidate);
            }
        }

        return '';
    }

    /**
     * @param array<string, mixed> $providerResult
     * @param array<string, mixed> $error
     */
    private function resolveProviderMessage(array $providerResult, array $error): string
    {
        $candidates = [
            $error['message'] ?? null,
            $providerResult['msg'] ?? null,
            $providerResult['data']['message'] ?? null,
        ];

        foreach ($candidates as $candidate) {
            if (is_string($candidate) && trim($candidate) !== '') {
                return trim($candidate);
            }
        }

        return '';
    }
}
