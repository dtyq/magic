<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Service;

use App\Domain\VideoCatalog\Service\OfficialVideoProviderDomainService;
use App\Domain\VideoCatalog\Service\VideoProviderSeedResolver;

readonly class OfficialVideoProviderInitAppService
{
    public function __construct(
        private OfficialVideoProviderDomainService $officialVideoProviderDomainService,
    ) {
    }

    /**
     * @param array<string, mixed>|list<array<string, mixed>> $providers
     * @return array{count: int, skipped: bool, message: string}
     */
    public function initializeWithProviders(
        array $providers,
        bool $skipWhenApiKeyMissing = true,
        bool $wrapTransaction = true,
    ): array {
        $normalizedEndpointSeeds = VideoProviderSeedResolver::normalizeEndpointSeedDataList($providers);

        return $this->officialVideoProviderDomainService->initialize(
            $normalizedEndpointSeeds,
            $skipWhenApiKeyMissing,
            $wrapTransaction,
        );
    }
}
