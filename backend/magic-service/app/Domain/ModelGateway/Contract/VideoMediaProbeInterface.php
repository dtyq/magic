<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\ModelGateway\Contract;

use App\Domain\ModelGateway\Entity\ValueObject\VideoMediaMetadata;

interface VideoMediaProbeInterface
{
    public function probe(string $filePath): VideoMediaMetadata;
}
