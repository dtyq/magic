<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Contact\Service;

use App\Domain\Contact\Service\MagicUserDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Di\Annotation\Inject;

class PlatformUserAppService extends AbstractContactAppService
{
    #[Inject]
    protected MagicUserDomainService $magicUserDomainService;

    /**
     * @return array{total: int, list: array<int, array<string, mixed>>}
     */
    public function queries(Page $page, ?array $filters = null): array
    {
        return $this->magicUserDomainService->queriesPlatformUsers($page, $filters);
    }
}
