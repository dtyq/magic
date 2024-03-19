<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Assembler;

use App\Domain\Flow\Entity\MagicFlowExecuteLogEntity;
use App\Interfaces\Flow\DTO\MagicFowExecuteResultDTO;

class MagicFlowExecuteLogAssembler
{
    public function createExecuteResultDTO(MagicFlowExecuteLogEntity $magicFlowExecuteLogEntity): MagicFowExecuteResultDTO
    {
        $executeResultDTO = new MagicFowExecuteResultDTO();
        $executeResultDTO->setTaskId((string) $magicFlowExecuteLogEntity->getId());
        $executeResultDTO->setStatus($magicFlowExecuteLogEntity->getStatus()->value);
        $executeResultDTO->setStatusLabel($magicFlowExecuteLogEntity->getStatus()->name);
        $executeResultDTO->setResult($magicFlowExecuteLogEntity->getResult());
        $executeResultDTO->setCreatedAt($magicFlowExecuteLogEntity->getCreatedAt()->format('Y-m-d H:i:s'));
        return $executeResultDTO;
    }
}
