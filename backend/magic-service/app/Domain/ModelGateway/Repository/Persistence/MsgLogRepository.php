<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Repository\Persistence;

use App\Domain\ModelGateway\Entity\MsgLogEntity;
use App\Domain\ModelGateway\Entity\ValueObject\LLMDataIsolation;
use App\Domain\ModelGateway\Repository\Facade\MsgLogRepositoryInterface;
use App\Domain\ModelGateway\Repository\Persistence\Model\MsgLogModel;

class MsgLogRepository extends AbstractRepository implements MsgLogRepositoryInterface
{
    public function create(LLMDataIsolation $dataIsolation, MsgLogEntity $msgLogEntity): MsgLogEntity
    {
        $model = new MsgLogModel();
        $model->fill($this->getAttributes($msgLogEntity));
        $model->save();
        $msgLogEntity->setCreatedAt($model->created_at);
        $msgLogEntity->setId($model->id);
        return $msgLogEntity;
    }
}
