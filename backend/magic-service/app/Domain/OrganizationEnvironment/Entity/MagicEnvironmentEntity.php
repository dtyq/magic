<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\OrganizationEnvironment\Entity;

use App\Domain\Chat\Entity\AbstractEntity;
use App\Domain\OrganizationEnvironment\Entity\Facade\OpenPlatformConfigInterface;
use App\Domain\OrganizationEnvironment\Entity\Item\MagicEnvironmentExtra;
use App\Domain\OrganizationEnvironment\Entity\ValueObject\DeploymentEnum;
use App\Domain\OrganizationEnvironment\Entity\ValueObject\EnvironmentEnum;
use Hyperf\Codec\Json;

class MagicEnvironmentEntity extends AbstractEntity
{
    protected int $id;

    protected string $environmentCode;

    protected DeploymentEnum $deployment;

    protected EnvironmentEnum $environment;

    protected ?string $thirdPlatformType = null;

    protected ?OpenPlatformConfigInterface $openPlatformConfig = null;

    protected ?array $privateConfig = null;

    protected ?MagicEnvironmentExtra $extra = null;

    protected string $createdAt;

    protected string $updatedAt;

    public function __construct(array $data = [])
    {
        parent::__construct($data);
    }

    public function getExtra(): ?MagicEnvironmentExtra
    {
        return $this->extra;
    }

    public function setExtra(null|array|MagicEnvironmentExtra|string $extra): void
    {
        if (is_string($extra)) {
            $extra = Json::decode($extra);
        }

        if (is_array($extra)) {
            $extra = new MagicEnvironmentExtra($extra);
        }

        $this->extra = $extra;
    }

    public function getEnvironmentCode(): string
    {
        return $this->environmentCode;
    }

    public function setEnvironmentCode(?string $environmentCode): self
    {
        $this->environmentCode = $environmentCode ?? '';
        return $this;
    }

    public function getPrivateConfig(): ?array
    {
        return $this->privateConfig;
    }

    public function setPrivateConfig(?array $privateConfig): void
    {
        $this->privateConfig = $privateConfig;
    }

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): void
    {
        $this->id = $id;
    }

    public function getDeployment(): DeploymentEnum
    {
        return $this->deployment;
    }

    public function setDeployment(DeploymentEnum|string $deployment): void
    {
        if (is_string($deployment)) {
            $this->deployment = DeploymentEnum::tryFrom($deployment) ?? DeploymentEnum::Unknown;
        } else {
            $this->deployment = $deployment;
        }
    }

    public function getEnvironment(): EnvironmentEnum
    {
        return $this->environment;
    }

    public function setEnvironment(EnvironmentEnum|string $environment): void
    {
        if (is_string($environment)) {
            $this->environment = EnvironmentEnum::tryFrom($environment) ?? EnvironmentEnum::Unknown;
        } else {
            $this->environment = $environment;
        }
    }

    public function getOpenPlatformConfig(): ?OpenPlatformConfigInterface
    {
        return $this->openPlatformConfig;
    }

    public function setOpenPlatformConfig(null|array|OpenPlatformConfigInterface|string $openPlatformConfig): void
    {
        if (is_string($openPlatformConfig)) {
            $openPlatformConfig = Json::decode($openPlatformConfig);
        }

        if (is_array($openPlatformConfig)) {
            $openPlatformConfig = make(OpenPlatformConfigInterface::class)->initObject($openPlatformConfig);
        }

        $this->openPlatformConfig = $openPlatformConfig;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): void
    {
        $this->createdAt = $createdAt;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): void
    {
        $this->updatedAt = $updatedAt;
    }

    // 预发布和生产可以看做是一个环境，所以这里存一下关联的环境 ids
    public function getRelationEnvIds(): array
    {
        $relationEnvIds = $this->getExtra()?->getRelationEnvIds();
        if (empty($relationEnvIds)) {
            $relationEnvIds = [$this->getId()];
        } else {
            $relationEnvIds[] = $this->getId();
        }
        // 去重
        return array_values(array_unique($relationEnvIds));
    }

    public function getThirdPlatformType(): ?string
    {
        return $this->thirdPlatformType;
    }

    public function setThirdPlatformType(?string $thirdPlatformType): void
    {
        $this->thirdPlatformType = $thirdPlatformType;
    }
}
