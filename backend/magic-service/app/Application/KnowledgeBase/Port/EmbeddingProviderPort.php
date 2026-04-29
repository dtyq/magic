<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\KnowledgeBase\Port;

use App\Application\ModelGateway\DTO\Common\BusinessParamsDTO;

interface EmbeddingProviderPort
{
    public function listProviders(BusinessParamsDTO $businessParams): array;
}
