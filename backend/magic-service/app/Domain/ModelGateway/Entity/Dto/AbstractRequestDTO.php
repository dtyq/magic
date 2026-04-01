<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Entity\Dto;

use App\Domain\Chat\Entity\AbstractEntity;
use App\ErrorCode\MagicApiErrorCode;
use App\Infrastructure\Core\Exception\ExceptionBuilder;

abstract class AbstractRequestDTO extends AbstractEntity implements ProxyModelRequestInterface
{
    public const string METHOD_CHAT_COMPLETIONS = 'chat_completions';

    public const string METHOD_COMPLETIONS = 'completions';

    public const string METHOD_EMBEDDINGS = 'embeddings';

    /**
     * 业务参数，比如应用版就需要额外的参数.
     */
    protected array $businessParams = [];

    protected string $callMethod = self::METHOD_CHAT_COMPLETIONS;

    protected string $accessToken = '';

    protected string $model = '';

    /**
     * 原始 model_id（目前用于识别是否动态模型）.
     * 用于记录用户实际请求的模型ID，即使系统解析为真实模型后也保留原始值.
     */
    protected ?string $originalModelId = null;

    protected array $ips = [];

    protected array $headerConfigs = [];

    protected bool $enableHighAvailability = true;

    public function getBusinessParam(string $key, bool $checkExists = false): mixed
    {
        $value = $this->businessParams[$key] ?? null;
        if ($checkExists && is_null($value)) {
            ExceptionBuilder::throw(MagicApiErrorCode::ValidateFailed, 'common.empty', ['label' => $key]);
        }
        return $value;
    }

    public function addBusinessParam(string $key, mixed $value): void
    {
        $this->businessParams[$key] = $value;
    }

    public function setBusinessParams(array $businessParams): void
    {
        $this->businessParams = $businessParams;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    public function getCallMethod(): string
    {
        return $this->callMethod;
    }

    public function setCallMethod(string $callMethod): void
    {
        $this->callMethod = $callMethod;
    }

    public function getAccessToken(): string
    {
        return $this->accessToken;
    }

    public function setAccessToken(string $accessToken): void
    {
        $this->accessToken = $accessToken;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(int|string $model): void
    {
        $this->model = (string) $model;
    }

    /**
     * 获取原始 model_id（目前用于识别是否动态模型）.
     */
    public function getOriginalModelId(): ?string
    {
        return $this->originalModelId ?? $this->model;
    }

    /**
     * 设置原始 model_id（目前用于识别是否动态模型）.
     */
    public function setOriginalModelId(?string $originalModelId): void
    {
        $this->originalModelId = $originalModelId;
    }

    public function getIps(): array
    {
        return $this->ips;
    }

    public function setIps(array $ips): void
    {
        $this->ips = $ips;
    }

    public function setHeaderConfigs(array $headerConfigs): void
    {
        $this->headerConfigs = $headerConfigs;
    }

    public function getHeaderConfig(string $key, mixed $default = null): mixed
    {
        $key = strtolower($key);
        return $this->headerConfigs[$key] ?? $default;
    }

    public function getTopicId(): ?string
    {
        return $this->resolveStringFromHeaderOrBusinessParams('magic-topic-id', ['magic_topic_id', 'topic_id']);
    }

    public function getTaskId(): ?string
    {
        return $this->resolveStringFromHeaderOrBusinessParams('magic-task-id', ['magic_task_id', 'task_id']);
    }

    public function getProjectId(): ?int
    {
        $projectId = $this->getBusinessParam('project_id');
        if (is_string($projectId) && is_numeric($projectId)) {
            $projectId = (int) $projectId;
        }

        return is_int($projectId) && $projectId > 0 ? $projectId : null;
    }

    public function getSourceId(): ?string
    {
        return $this->resolveStringBusinessParam(['source_id']);
    }

    public function isEnableHighAvailability(): bool
    {
        return $this->enableHighAvailability;
    }

    public function setEnableHighAvailability(bool $enableHighAvailability): void
    {
        $this->enableHighAvailability = $enableHighAvailability;
    }

    private function resolveStringFromHeaderOrBusinessParams(string $headerKey, array $businessParamKeys): ?string
    {
        $headerValue = $this->getHeaderConfig($headerKey);
        if (is_string($headerValue) && trim($headerValue) !== '') {
            return trim($headerValue);
        }

        return $this->resolveStringBusinessParam($businessParamKeys);
    }

    /**
     * @param list<string> $keys
     */
    private function resolveStringBusinessParam(array $keys): ?string
    {
        foreach ($keys as $key) {
            $value = $this->getBusinessParam($key);
            if (is_string($value) && trim($value) !== '') {
                return trim($value);
            }
        }

        return null;
    }
}
