<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\Contract\Model;

interface RerankInterface
{
    public function rerank($query, $documents): Rerank;

    public function getModelName(): string;
}
