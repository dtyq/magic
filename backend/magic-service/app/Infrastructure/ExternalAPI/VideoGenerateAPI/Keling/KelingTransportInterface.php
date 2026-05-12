<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Keling;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;

interface KelingTransportInterface
{
    public function submitOmniVideo(QueueExecutorConfig $config, array $payload, array $logContext = []): array;

    public function queryOmniVideo(QueueExecutorConfig $config, string $taskId, array $logContext = []): array;

    public function submitV3Video(QueueExecutorConfig $config, array $payload, bool $hasImageInput, array $logContext = []): array;

    public function queryV3Video(QueueExecutorConfig $config, string $taskId, bool $hasImageInput, array $logContext = []): array;
}
