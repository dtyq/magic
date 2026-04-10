<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\AiAbilityConnectivity;

use App\Domain\ModelGateway\Entity\Dto\AiAbilityConnectivityTestRequestDTO;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;

interface AiAbilityConnectivityTesterInterface
{
    public function supports(AiAbilityCode $aiAbilityCode): bool;

    /**
     * @return array{provider:string,message:string,duration_ms:int}
     */
    public function test(AiAbilityConnectivityTestRequestDTO $requestDTO): array;
}
