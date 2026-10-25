<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini;

use App\Domain\ModelGateway\Entity\ValueObject\QueueExecutorConfig;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Transport\ApiKeyGeminiTransport;
use App\Infrastructure\ExternalAPI\VideoGenerateAPI\Gemini\Transport\VertexGeminiTransport;

final class GeminiTransportRouter implements GeminiTransportInterface
{
    public function __construct(
        private readonly ApiKeyGeminiTransport $apiKeyTransport,
        private readonly VertexGeminiTransport $vertexTransport,
    ) {
    }

    public function createInteraction(QueueExecutorConfig $config, array $payload, array $logContext = []): array
    {
        return $this->transport($config)->createInteraction($config, $payload, $logContext);
    }

    public function getInteraction(QueueExecutorConfig $config, string $interactionId, array $logContext = []): array
    {
        return $this->transport($config)->getInteraction($config, $interactionId, $logContext);
    }

    private function transport(QueueExecutorConfig $config): GeminiTransportInterface
    {
        $extraConfig = $config->getExtraConfig();

        return strtolower((string) ($extraConfig['auth_type'] ?? 'api_key')) === 'service_account'
            ? $this->vertexTransport
            : $this->apiKeyTransport;
    }
}
