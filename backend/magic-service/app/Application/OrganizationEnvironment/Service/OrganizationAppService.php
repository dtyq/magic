<?php

declare(strict_types=1);

namespace App\Application\OrganizationEnvironment\Service;

use App\Domain\OrganizationEnvironment\Service\OrganizationDomainService;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\Di\Annotation\Inject;

class OrganizationAppService
{
    #[Inject]
    protected OrganizationDomainService $organizationDomainService;

    /**
     * @return array{total: int, list: array}
     */
    public function queries(Page $page, ?array $filters = null): array
    {
        return $this->organizationDomainService->queries($page, $filters);
    }
}


