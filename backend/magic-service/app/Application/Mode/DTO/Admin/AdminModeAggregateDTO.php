<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\DTO\Admin;

use App\Infrastructure\Core\AbstractDTO;

class AdminModeAggregateDTO extends AbstractDTO
{
    protected AdminModeDTO $mode;

    /**
     * @var AdminModeGroupAggregateDTO[] 分组聚合根数组
     */
    protected array $groups = [];

    public function getMode(): AdminModeDTO
    {
        return $this->mode;
    }

    public function setMode(AdminModeDTO|array $mode): void
    {
        $this->mode = $mode instanceof AdminModeDTO ? $mode : new AdminModeDTO($mode);
    }

    /**
     * @return AdminModeGroupAggregateDTO[]
     */
    public function getGroups(): array
    {
        return $this->groups;
    }

    public function setGroups(array $groups): void
    {
        $groupData = [];
        foreach ($groups as $group) {
            if ($group instanceof AdminModeGroupAggregateDTO) {
                $groupData[] = $group;
                continue;
            }

            if (isset($group['group'])) {
                $groupData[] = new AdminModeGroupAggregateDTO(
                    $group['group'],
                    $group['models'] ?? [],
                    $group['imageModels'] ?? $group['image_models'] ?? [],
                    $group['videoModels'] ?? $group['video_models'] ?? [],
                    $group['textModels'] ?? $group['text_models'] ?? [],
                );
            }
        }

        $this->groups = $groupData;
    }
}
