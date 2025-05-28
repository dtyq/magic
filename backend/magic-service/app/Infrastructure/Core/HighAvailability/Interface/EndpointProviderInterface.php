<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Core\HighAvailability\Interface;

use App\Infrastructure\Core\HighAvailability\DTO\EndpointDTO;

/**
 * Endpoint provider interface.
 *
 * Business modules need to implement this interface to provide endpoint lists to the high availability module
 */
interface EndpointProviderInterface
{
    /**
     * Get available endpoint list.
     *
     * Query endpoint list from business side for load balancing and high availability selection
     *`
     * @param string $modelId Model ID
     * @param string $orgCode Organization code
     * @param null|string $provider Service provider config id
     * @param null|string $endpointName Endpoint name (optional), e.g., East US, Japan for Microsoft provider
     * @return EndpointDTO[] Endpoint list
     */
    public function getEndpoints(
        string $modelId,
        string $orgCode,
        ?string $provider = null,
        ?string $endpointName = null
    ): array;
}
