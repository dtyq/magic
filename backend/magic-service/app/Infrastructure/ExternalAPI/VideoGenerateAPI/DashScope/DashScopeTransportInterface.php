<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\DashScope;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;

interface DashScopeTransportInterface
{
    public function submitVideo(QueueExecutorConfig $config, array $payload, array $logContext = []): array;

    public function queryTask(QueueExecutorConfig $config, string $taskId, array $logContext = []): array;
}
