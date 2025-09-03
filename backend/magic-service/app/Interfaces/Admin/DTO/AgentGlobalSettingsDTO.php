<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\DTO;

use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsStatus;
use App\Domain\Admin\Entity\ValueObject\AdminGlobalSettingsType;
use App\Domain\Admin\Entity\ValueObject\Extra\AbstractSettingExtra;
use App\Infrastructure\Core\AbstractDTO;
use App\Interfaces\Admin\DTO\Extra\AbstractSettingExtraDTO;
use App\Interfaces\Admin\DTO\Extra\SettingExtraDTOInterface;
use JsonSerializable;

class AgentGlobalSettingsDTO extends AbstractDTO implements JsonSerializable
{
    private AdminGlobalSettingsType $type;

    private AdminGlobalSettingsStatus $status;

    private ?SettingExtraDTOInterface $extra = null;

    public function setType(AdminGlobalSettingsType|int $type): self
    {
        $this->type = is_int($type) ? AdminGlobalSettingsType::from($type) : $type;
        return $this;
    }

    public function setStatus(AdminGlobalSettingsStatus|int $status): self
    {
        $this->status = is_int($status) ? AdminGlobalSettingsStatus::from($status) : $status;
        return $this;
    }

    public function setExtra(null|AbstractSettingExtra|array|SettingExtraDTOInterface $extra): self
    {
        if (is_array($extra)) {
            $this->extra = AbstractSettingExtraDTO::fromArrayAndType($extra, $this->getType());
        } elseif ($extra instanceof AbstractSettingExtra) {
            $this->extra = AbstractSettingExtraDTO::fromExtra($extra);
        } else {
            $this->extra = $extra;
        }
        return $this;
    }

    public function getType(): AdminGlobalSettingsType
    {
        return $this->type;
    }

    public function getStatus(): AdminGlobalSettingsStatus
    {
        return $this->status;
    }

    public function getExtra(): null|array|SettingExtraDTOInterface
    {
        return $this->extra;
    }

    public function jsonSerialize(): array
    {
        return [
            'type' => $this->type->value,
            'status' => $this->status->value,
            'extra' => $this->extra instanceof AbstractSettingExtraDTO ? $this->extra->jsonSerialize() : $this->extra,
        ];
    }
}
