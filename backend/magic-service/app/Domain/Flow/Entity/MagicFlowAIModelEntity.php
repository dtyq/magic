<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Flow\Entity;

use App\Domain\Flow\Factory\MagicFlowAIModelFactory;
use App\ErrorCode\FlowErrorCode;
use App\Infrastructure\Core\AbstractEntity;
use App\Infrastructure\Core\Contract\Model\RerankInterface;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use DateTime;
use Hyperf\Odin\Contract\Model\EmbeddingInterface;
use Hyperf\Odin\Contract\Model\ModelInterface;

use function Hyperf\Support\env;

class MagicFlowAIModelEntity extends AbstractEntity
{
    protected ?int $id = null;

    protected string $organizationCode;

    protected string $name;

    protected string $label = '';

    protected string $icon = '';

    protected string $modelName = '';

    protected array $tags = [];

    protected array $defaultConfigs = [];

    protected bool $enabled = true;

    protected bool $display = true;

    protected string $implementation;

    protected array $implementationConfig = [];

    protected bool $supportEmbedding = false;

    protected bool $supportMultiModal = true;

    protected int $vectorSize = 0;

    protected int $maxTokens = 0;

    protected string $createdUid;

    protected DateTime $createdAt;

    protected string $updatedUid;

    protected DateTime $updatedAt;

    private ?array $actualImplementationConfig = null;

    public function prepareForSaving(): void
    {
        if (empty($this->name)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.model_name']);
        }
        if (empty($this->implementation)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.implementation']);
        }
        if (class_exists($this->implementation) === false) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.not_found', ['label' => 'flow.fields.implementation']);
        }
        if (empty($this->createdUid)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.creator_uid']);
        }
        if (empty($this->createdAt)) {
            $this->createdAt = new DateTime();
        }
        if (empty($this->organizationCode)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.empty', ['label' => 'flow.fields.organization_code']);
        }
        if ($this->supportEmbedding && ($this->vectorSize <= 0)) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.invalid', ['label' => 'flow.fields.vector_size']);
        }

        $this->updatedUid = $this->createdUid;
        $this->updatedAt = $this->createdAt;
    }

    public function createModel(): ModelInterface
    {
        if ($this->odinModel) {
            return $this->odinModel;
        }
        $this->odinModel = MagicFlowAIModelFactory::createOdinModel($this);
        return $this->odinModel;
    }

    public function createEmbedding(): EmbeddingInterface
    {
        if ($this->odinModel) {
            return $this->odinModel;
        }
        $this->odinModel = MagicFlowAIModelFactory::createOdinModel($this);
        return $this->odinModel;
    }

    public function createRerank(): RerankInterface
    {
        if (! $this->enabled) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'common.disabled', ['label' => 'flow.fields.model_name']);
        }
        $rerankModel = new $this->implementation($this->name, $this->getActualImplementationConfig());
        if (! $rerankModel instanceof RerankInterface) {
            ExceptionBuilder::throw(FlowErrorCode::ValidateFailed, 'flow.model.invalid_implementation_interface', ['interface' => 'RerankInterface']);
        }
        return $rerankModel;
    }

    public function getId(): ?int
    {
        return $this->id;
    }

    public function setId(?int $id): void
    {
        $this->id = $id;
    }

    public function getOrganizationCode(): string
    {
        return $this->organizationCode;
    }

    public function setOrganizationCode(string $organizationCode): void
    {
        $this->organizationCode = $organizationCode;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function setName(string $name): void
    {
        $this->name = $name;
    }

    public function getLabel(): string
    {
        return $this->label;
    }

    public function setLabel(string $label): void
    {
        $this->label = $label;
    }

    public function getTags(): array
    {
        return $this->tags;
    }

    public function setTags(array $tags): void
    {
        $this->tags = $tags;
    }

    public function getDefaultConfigs(): array
    {
        return $this->defaultConfigs;
    }

    public function setDefaultConfigs(array $defaultConfigs): void
    {
        $this->defaultConfigs = $defaultConfigs;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function setEnabled(bool $enabled): void
    {
        $this->enabled = $enabled;
    }

    public function getImplementation(): string
    {
        return $this->implementation;
    }

    public function setImplementation(string $implementation): void
    {
        $this->implementation = $implementation;
    }

    public function getImplementationConfig(): array
    {
        return $this->implementationConfig;
    }

    public function setImplementationConfig(array $implementationConfig): void
    {
        $this->implementationConfig = $implementationConfig;
    }

    public function isSupportEmbedding(): bool
    {
        return $this->supportEmbedding;
    }

    public function setSupportEmbedding(bool $supportEmbedding): void
    {
        $this->supportEmbedding = $supportEmbedding;
    }

    public function getVectorSize(): int
    {
        return $this->vectorSize;
    }

    public function setVectorSize(int $vectorSize): void
    {
        $this->vectorSize = $vectorSize;
    }

    public function getCreatedUid(): string
    {
        return $this->createdUid;
    }

    public function setCreatedUid(string $createdUid): void
    {
        $this->createdUid = $createdUid;
    }

    public function getCreatedAt(): DateTime
    {
        return $this->createdAt;
    }

    public function setCreatedAt(mixed $createdAt): void
    {
        $this->createdAt = $this->createDatetime($createdAt);
    }

    public function getUpdatedUid(): string
    {
        return $this->updatedUid;
    }

    public function setUpdatedUid(string $updatedUid): void
    {
        $this->updatedUid = $updatedUid;
    }

    public function getUpdatedAt(): DateTime
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(mixed $updatedAt): void
    {
        $this->updatedAt = $this->createDatetime($updatedAt);
    }

    public function getModelName(): string
    {
        return $this->modelName;
    }

    public function setModelName(string $modelName): MagicFlowAIModelEntity
    {
        $this->modelName = $modelName;
        return $this;
    }

    public function getActualImplementationConfig(): array
    {
        if (! is_null($this->actualImplementationConfig)) {
            return $this->actualImplementationConfig;
        }
        // 从配置中获取实际的配置
        $configs = [];
        foreach ($this->implementationConfig as $index => $item) {
            $item = explode('|', $item);
            $key = $item[0] ?? '';
            $default = $item[1] ?? null;
            if (empty($key)) {
                continue;
            }
            $value = trim(env($key, $default) ?? '');
            if (empty($value)) {
                $value = $default;
            }
            $configs[$index] = $value;
        }
        return $configs;
    }

    public function getIcon(): string
    {
        return $this->icon;
    }

    public function setIcon(string $icon): void
    {
        $this->icon = $icon;
    }

    public function isDisplay(): bool
    {
        return $this->display;
    }

    public function setDisplay(bool $display): void
    {
        $this->display = $display;
    }

    public function isSupportMultiModal(): bool
    {
        return $this->supportMultiModal;
    }

    public function setSupportMultiModal(bool $supportMultiModal): void
    {
        $this->supportMultiModal = $supportMultiModal;
    }

    public function getMaxTokens(): int
    {
        return $this->maxTokens;
    }

    public function setMaxTokens(int $maxTokens): void
    {
        $this->maxTokens = $maxTokens;
    }

    public function setActualImplementationConfig(?array $actualImplementationConfig): void
    {
        $this->actualImplementationConfig = $actualImplementationConfig;
    }
}
