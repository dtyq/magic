<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\AiAbilityConnectivity;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\AiAbilityConnectivityTestRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\ImageSearchRequestDTO;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;

class ImageSearchConnectivityTester implements AiAbilityConnectivityTesterInterface
{
    public function supports(AiAbilityCode $aiAbilityCode): bool
    {
        return $aiAbilityCode === AiAbilityCode::ImageSearch;
    }

    public function test(AiAbilityConnectivityTestRequestDTO $requestDTO): array
    {
        $imageSearchRequestDTO = ImageSearchRequestDTO::createDTO([
            'query' => 'cat',
            'count' => 1,
            'offset' => 0,
        ]);
        $imageSearchRequestDTO->setAccessToken($requestDTO->getAccessToken());
        $imageSearchRequestDTO->setIps($requestDTO->getIps());
        $imageSearchRequestDTO->setBusinessParams($requestDTO->getBusinessParams());
        $llmAppService = di(LLMAppService::class);
        $response = $llmAppService->imageSearch($imageSearchRequestDTO);
        $metadata = $response->getMetadata() ?? [];

        return [
            'provider' => (string) ($metadata['engine'] ?? ''),
            'message' => 'connectivity test passed',
            'duration_ms' => (int) ($metadata['responseTime'] ?? 0),
        ];
    }
}
