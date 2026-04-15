<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Design\Contract;

use App\Domain\Design\Entity\DesignGenerationTaskEntity;

interface VideoGatewayPayloadBuilderInterface
{
    /**
     * @return array<string, mixed>
     */
    public function build(DesignGenerationTaskEntity $entity): array;
}
