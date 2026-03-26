<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service\AiAbilityConnectivity;

use App\Application\ModelGateway\Service\LLMAppService;
use App\Domain\ModelGateway\Entity\Dto\AiAbilityConnectivityTestRequestDTO;
use App\Domain\ModelGateway\Entity\Dto\WebScrapeRequestDTO;
use App\Domain\Provider\Entity\ValueObject\AiAbilityCode;

class WebScrapeConnectivityTester implements AiAbilityConnectivityTesterInterface
{
    public function supports(AiAbilityCode $aiAbilityCode): bool
    {
        return $aiAbilityCode === AiAbilityCode::WebScrape;
    }

    public function test(AiAbilityConnectivityTestRequestDTO $requestDTO): array
    {
        $webScrapeRequestDTO = WebScrapeRequestDTO::createDTO([
            'url' => 'https://example.com',
            'formats' => ['MARKDOWN'],
            'mode' => 'fast',
            'options' => [],
        ]);
        $webScrapeRequestDTO->setAccessToken($requestDTO->getAccessToken());
        $webScrapeRequestDTO->setIps($requestDTO->getIps());
        $webScrapeRequestDTO->setBusinessParams($requestDTO->getBusinessParams());
        $llmAppService = di(LLMAppService::class);
        $response = $llmAppService->webScrape($webScrapeRequestDTO);

        return [
            'provider' => (string) ($response['data']['provider'] ?? ''),
            'message' => 'connectivity test passed',
            'duration_ms' => (int) ($response['usage']['duration_ms'] ?? 0),
        ];
    }
}
