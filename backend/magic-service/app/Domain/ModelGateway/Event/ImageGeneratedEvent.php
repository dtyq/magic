<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Event;

use App\Domain\ImageGenerate\ValueObject\ImageGenerateSourceEnum;
use App\Infrastructure\Core\AbstractEvent;
use App\Infrastructure\Util\IdGenerator\IdGenerator;
use DateTime;
use Hyperf\Odin\Api\Response\Usage;

class ImageGeneratedEvent extends AbstractEvent
{
    /**
     * 图片模型返回的 token 用量。
     * 有些生图 provider 按 token 计费，返回 usage 时通过该字段传递给审计/计费链路。
     */
    public ?Usage $usage = null;

    protected ?string $eventId = null;

    protected string $organizationCode;

    protected string $userId;

    protected string $model;

    protected int $imageCount;

    /**
     * 请求中参考图数量，用于审计和计费.
     */
    protected int $referenceImageCount = 0;

    protected ?string $topicId = null;

    protected ?string $taskId = null;

    protected DateTime $createdAt;

    protected ?string $sourceId = null;

    protected ImageGenerateSourceEnum $sourceType;

    /**
     * service_provider_models.id 模型ID.
     */
    protected string $providerModelId = '';

    /**
     * 原始 model_id（目前用于识别是否动态模型），用于计费和日志.
     */
    protected ?string $originalModelId = null;

    /**
     * 访问令牌实体Id.
     */
    protected ?int $accessTokenId = null;

    /**
     * 访问令牌实体名称.
     */
    protected ?string $accessTokenName = null;

    /**
     * 当前配置版本，用于计价
     * service_provider_models_config_versions.id.
     */
    protected ?int $priceId = null;

    /**
     * 调用时间.
     */
    protected ?string $callTime = null;

    /**
     * 响应时间.
     */
    protected ?int $responseTime = null;

    /**
     * 分辨率：1k，2k，4k.
     */
    protected ?string $resolution = null;

    /**
     * 图片尺寸，原始 size 参数，如 1024x1024.
     */
    protected ?string $imageSize = null;

    protected array $businessParams = [];

    /**
     * @var array<int, array{url: string}>
     */
    protected array $generatedImages = [];

    public function __construct(?string $eventId = null)
    {
        $this->eventId = $eventId ?: (string) IdGenerator::getSnowId();
    }

    public function getEventId(): string
    {
        return $this->eventId ??= (string) ($this->businessParams['event_id'] ?? IdGenerator::getSnowId());
    }

    /**
     * @return array<int, array{url: string}>
     */
    public function getGeneratedImages(): array
    {
        return $this->generatedImages;
    }

    public function setGeneratedImages(array $generatedImages): void
    {
        $this->generatedImages = [];
        foreach ($generatedImages as $image) {
            $url = is_string($image) ? $image : ($image['url'] ?? '');
            if (! is_string($url) || $url === '' || str_starts_with($url, 'data:')) {
                continue;
            }

            $this->generatedImages[] = ['url' => $url];
        }
    }

    public function getProviderModelId(): string
    {
        return $this->providerModelId;
    }

    public function setProviderModelId(string $providerModelId): void
    {
        $this->providerModelId = $providerModelId;
    }

    public function getOriginalModelId(): ?string
    {
        return $this->originalModelId;
    }

    public function setOriginalModelId(?string $originalModelId): void
    {
        $this->originalModelId = $originalModelId;
    }

    public function getAccessTokenId(): ?int
    {
        return $this->accessTokenId;
    }

    public function setAccessTokenId(?int $accessTokenId): void
    {
        $this->accessTokenId = $accessTokenId;
    }

    public function getAccessTokenName(): ?string
    {
        return $this->accessTokenName;
    }

    public function setAccessTokenName(?string $accessTokenName): void
    {
        $this->accessTokenName = $accessTokenName;
    }

    public function getPriceId(): ?int
    {
        return $this->priceId;
    }

    public function setPriceId(?int $priceId): void
    {
        $this->priceId = $priceId;
    }

    public function getCallTime(): ?string
    {
        return $this->callTime;
    }

    public function setCallTime(?string $callTime): void
    {
        $this->callTime = $callTime;
    }

    public function getResponseTime(): ?int
    {
        return $this->responseTime;
    }

    public function setResponseTime(?int $responseTime): void
    {
        $this->responseTime = $responseTime;
    }

    public function getResolution(): ?string
    {
        return $this->resolution;
    }

    public function setResolution(?string $resolution): void
    {
        $this->resolution = $resolution;
    }

    public function getImageSize(): ?string
    {
        return $this->imageSize;
    }

    public function setImageSize(?string $imageSize): void
    {
        $this->imageSize = $imageSize;
    }

    public function getBusinessParams(): array
    {
        return $this->businessParams;
    }

    public function setBusinessParams(array $businessParams): void
    {
        $this->businessParams = $businessParams;
        if (! empty($businessParams['event_id'])) {
            $this->eventId = (string) $businessParams['event_id'];
        }
    }

    public function getUsage(): ?Usage
    {
        return $this->usage;
    }

    public function setUsage(?Usage $usage): void
    {
        $this->usage = $usage;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function setUserId(string $userId): void
    {
        $this->userId = $userId;
    }

    public function getModel(): string
    {
        return $this->model;
    }

    public function setModel(string $model): void
    {
        $this->model = $model;
    }

    public function getImageCount(): int
    {
        return $this->imageCount;
    }

    public function setImageCount(int $imageCount): void
    {
        $this->imageCount = $imageCount;
    }

    public function getReferenceImageCount(): int
    {
        return $this->referenceImageCount;
    }

    public function setReferenceImageCount(int $referenceImageCount): void
    {
        $this->referenceImageCount = max(0, $referenceImageCount);
    }

    public function getTopicId(): ?string
    {
        return $this->topicId;
    }

    public function setTopicId(?string $topicId): void
    {
        $this->topicId = $topicId;
    }

    public function getTaskId(): ?string
    {
        return $this->taskId;
    }

    public function setTaskId(?string $taskId): void
    {
        $this->taskId = $taskId;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(DateTime $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getSourceId(): ?string
    {
        return $this->sourceId;
    }

    public function setSourceId(?string $sourceId): void
    {
        $this->sourceId = $sourceId;
    }

    public function getSourceType(): ImageGenerateSourceEnum
    {
        return $this->sourceType;
    }

    public function setSourceType(ImageGenerateSourceEnum $sourceType): void
    {
        $this->sourceType = $sourceType;
    }
}
