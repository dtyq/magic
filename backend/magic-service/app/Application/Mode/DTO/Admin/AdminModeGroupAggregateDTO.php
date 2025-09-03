<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO\Admin;

use App\Application\Mode\DTO\ModeGroupModelDTO;
use App\Infrastructure\Core\AbstractDTO;

class AdminModeGroupAggregateDTO extends AbstractDTO
{
    protected ?AdminModeGroupDTO $group = null;

    /**
     * @var ModeGroupModelDTO[] 该分组对应的模型详细信息数组
     */
    protected array $models = [];

    public function __construct(null|AdminModeGroupDTO|array $group = null, array $models = [])
    {
        if (! is_null($group)) {
            $this->group = $group instanceof AdminModeGroupDTO ? $group : new AdminModeGroupDTO($group);
        }
        $this->models = $models;
    }

    public function getGroup(): ?AdminModeGroupDTO
    {
        return $this->group;
    }

    public function setGroup(AdminModeGroupDTO|array $group): void
    {
        $this->group = $group instanceof AdminModeGroupDTO ? $group : new AdminModeGroupDTO($group);
    }

    /**
     * @return array[]|ModeGroupModelDTO[]
     */
    public function getModels(): array
    {
        return $this->models;
    }

    public function setModels(array $models): void
    {
        $modelData = [];
        foreach ($models as $model) {
            $modelData[] = $model instanceof ModeGroupModelDTO ? $model : new ModeGroupModelDTO($model);
        }

        $this->models = $modelData;
    }
}
