<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Admin\Entity;

use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Entity\ValueObject\Extra\AssistantCreateExtra;
use App\Domain\Admin\Entity\ValueObject\Extra\DefaultFriendExtra;
use App\Domain\Admin\Entity\ValueObject\Extra\SettingExtraInterface;
use App\Domain\Admin\Entity\ValueObject\Extra\ThirdPartyPublishExtra;
use App\Domain\Contact\Entity\AbstractEntity;
use Hyperf\Codec\Json;

class AdminGlobalSettingsEntity extends AbstractEntity
{
    protected int $id;

    protected AdminGlobalSettingsType $type;

    protected AdminGlobalSettingsStatus $status = AdminGlobalSettingsStatus::DISABLED;

    protected ?SettingExtraInterface $extra = null;

    protected string $organization;

    protected string $createdAt;

    protected string $updatedAt;

    public function getId(): int
    {
        return $this->id;
    }

    public function setId(int $id): self
    {
        $this->id = $id;
        return $this;
    }

    public function getType(): AdminGlobalSettingsType
    {
        return $this->type;
    }

    public function setType(AdminGlobalSettingsType|int $type): self
    {
        $this->type = is_int($type) ? AdminGlobalSettingsType::from($type) : $type;
        return $this;
    }

    public function getStatus(): AdminGlobalSettingsStatus
    {
        return $this->status;
    }

    public function setStatus(AdminGlobalSettingsStatus|int $status): self
    {
        $this->status = is_int($status) ? AdminGlobalSettingsStatus::from($status) : $status;
        return $this;
    }

    public function getExtra(): ?SettingExtraInterface
    {
        return $this->extra;
    }

    public function setExtra(null|SettingExtraInterface|string $extra): self
    {
        if (is_string($extra)) {
            $extra = Json::decode($extra);
            // 根据 type 来决定使用哪个具体的 Extra 类
            $extraClass = $this->getExtraClassByType($this->getType()->value);
            if ($extraClass) {
                $extra = new $extraClass($extra);
            }
        }
        $this->extra = $extra;
        return $this;
    }

    public function getOrganization(): string
    {
        return $this->organization;
    }

    public function setOrganization(string $organization): self
    {
        $this->organization = $organization;
        return $this;
    }

    public function getCreatedAt(): string
    {
        return $this->createdAt;
    }

    public function setCreatedAt(string $createdAt): self
    {
        $this->createdAt = $createdAt;
        return $this;
    }

    public function getUpdatedAt(): string
    {
        return $this->updatedAt;
    }

    public function setUpdatedAt(string $updatedAt): self
    {
        $this->updatedAt = $updatedAt;
        return $this;
    }

    private function getExtraClassByType(?int $type): ?string
    {
        if ($type === null) {
            return null;
        }

        $settingsType = AdminGlobalSettingsType::from($type);

        return match ($settingsType) {
            AdminGlobalSettingsType::DEFAULT_FRIEND => DefaultFriendExtra::class,
            AdminGlobalSettingsType::ASSISTANT_CREATE => AssistantCreateExtra::class,
            AdminGlobalSettingsType::THIRD_PARTY_PUBLISH => ThirdPartyPublishExtra::class,
            // 添加其他类型的映射...
            default => null,
        };
    }
}
