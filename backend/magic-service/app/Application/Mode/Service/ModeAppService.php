<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Mode\Service;

use App\Application\Mode\Assembler\ModeAssembler;
use App\Application\Mode\DTO\ModeGroupDetailDTO;
use App\Infrastructure\Core\ValueObject\Page;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;

class ModeAppService extends AbstractModeAppService
{
    public function getModes(MagicUserAuthorization $authorization): array
    {
        $modeDataIsolation = $this->getModeDataIsolation($authorization);
        $modeDataIsolation->disabled();
        $modes = $this->modeDomainService->getModes($modeDataIsolation, new Page(1, 100));

        $modeDTOs = [];
        foreach ($modes['list'] as $mode) {
            $modeDTOs[] = ModeAssembler::modeToDTO($mode);
        }
        $modes['list'] = $modeDTOs;
        return $modes;
    }

    /**
     * @return ModeGroupDetailDTO[]
     */
    public function getModeByIdentifier(MagicUserAuthorization $authorization, string $identifier): array
    {
        $modeDataIsolation = $this->getModeDataIsolation($authorization);
        $modeDataIsolation->disabled();
        $modeAggregate = $this->modeDomainService->getModeDetailByIdentifier($modeDataIsolation, $identifier);

        $providerModels = $this->getModels($modeAggregate);
        $modeGroupDetailDTOS = ModeAssembler::aggregateToFlatGroupsDTO($modeAggregate, $providerModels);

        // 处理图标路径转换为完整URL
        $this->processModeGroupDetailIcons($authorization, $modeGroupDetailDTOS);

        return $modeGroupDetailDTOS;
    }
}
