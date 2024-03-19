<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Interfaces\Share\Facade;

use Dtyq\ApiResponse\Annotation\ApiResponse;
use Dtyq\SuperMagic\Application\Share\Service\InternalShareAppService;

/**
 * Internal share API.
 */
#[ApiResponse('low_code')]
class InternalShareApi extends AbstractApi
{
    public function __construct(
        protected InternalShareAppService $internalShareAppService
    ) {
    }

    /**
     * Get share title by resource ID.
     *
     * @param string $resource_id Resource ID
     * @return array Share title data
     */
    public function getShareTitle(string $resource_id): array
    {
        $dto = $this->internalShareAppService->getShareTitle($resource_id);
        return $dto->toArray();
    }
}
