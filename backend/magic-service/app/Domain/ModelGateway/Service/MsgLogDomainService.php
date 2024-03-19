<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Service;

use App\Domain\ModelGateway\Entity\MsgLogEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Repository\Facade\MsgLogRepositoryInterface;

class MsgLogDomainService extends AbstractDomainService
{
    public function __construct(
        private readonly MsgLogRepositoryInterface $msgLogRepository
    ) {
    }

    public function create(LLMDataIsolation $dataIsolation, MsgLogEntity $msgLogEntity): MsgLogEntity
    {
        return $this->msgLogRepository->create($dataIsolation, $msgLogEntity);
    }
}
