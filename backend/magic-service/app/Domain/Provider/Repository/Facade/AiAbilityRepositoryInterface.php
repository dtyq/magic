<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Provider\Repository\Facade;

use App\Domain\Provider\Entity\AiAbilityEntity;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;

/**
 * AI 能力仓储接口.
 */
interface AiAbilityRepositoryInterface
{
    /**
     * 根据能力代码获取AI能力实体.
     *
     * @param AiAbilityCode $code 能力代码
     * @return null|AiAbilityEntity AI能力实体
     */
    public function getByCode(AiAbilityCode $code): ?AiAbilityEntity;
}
