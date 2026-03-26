<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\AiAbilityConnectivity;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\AiAbilityConnectivityTestRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\SearchRequestDTO;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;

class WebSearchConnectivityTester implements AiAbilityConnectivityTesterInterface
{
    public function supports(AiAbilityCode $aiAbilityCode): bool
    {
        return $aiAbilityCode === AiAbilityCode::WebSearch;
    }

    public function test(AiAbilityConnectivityTestRequestDTO $requestDTO): array
    {
        $searchRequestDTO = SearchRequestDTO::createDTO([
            'query' => 'cat',
            'count' => 1,
            'offset' => 0,
            'mkt' => 'en-US',
            'safe_search' => 'Off',
            'set_lang' => 'en',
        ]);
        $searchRequestDTO->setAccessToken($requestDTO->getAccessToken());
        $searchRequestDTO->setIps($requestDTO->getIps());
        $searchRequestDTO->setBusinessParams($requestDTO->getBusinessParams());
        $llmAppService = di(LLMAppService::class);
        $response = $llmAppService->unifiedSearch($searchRequestDTO);
        $metadata = $response->getMetadata() ?? [];

        return [
            'provider' => (string) ($metadata['engine'] ?? ''),
            'message' => 'connectivity test passed',
            'duration_ms' => (int) ($metadata['responseTime'] ?? 0),
        ];
    }
}
