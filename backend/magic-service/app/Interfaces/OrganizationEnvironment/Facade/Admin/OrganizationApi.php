<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\OrganizationEnvironment\Facade\Admin;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\OrganizationEnvironment\Service\OrganizationAppService;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\OrganizationEnvironment\Assembler\OrganizationAssembler;
use App\Interfaces\OrganizationEnvironment\DTO\OrganizationCreatorResponseDTO;
use App\Interfaces\OrganizationEnvironment\DTO\OrganizationListRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class OrganizationApi extends AbstractApi
{
    #[Inject]
    protected OrganizationAppService $organizationAppService;

    #[CheckPermission(MagicResourceEnum::PLATFORM_ORGANIZATION_LIST, MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        $requestDTO = OrganizationListRequestDTO::fromRequest($this->request);
        $pageObject = new Page($requestDTO->page, $requestDTO->pageSize);

        $filters = $requestDTO->toFilters();

        $result = $this->organizationAppService->queries($pageObject, $filters);

        $creatorMap = [];
        if (! empty($result['list'])) {
            $creatorIds = array_values(array_filter(
                array_map(static fn ($entity) => $entity->getCreatorId(), $result['list']),
                static fn ($creatorId) => $creatorId !== null && $creatorId !== ''
            ));
            if ($creatorIds !== []) {
                $creatorSummaries = $this->organizationAppService->getCreators($creatorIds);
                foreach ($creatorSummaries as $userId => $summary) {
                    $creator = new OrganizationCreatorResponseDTO();
                    $creator->setUserId($summary['user_id'] ?? '');
                    $creator->setMagicId($summary['magic_id'] ?? null);
                    $creator->setName($summary['name'] ?? '');
                    $creator->setAvatar($summary['avatar'] ?? '');
                    $creator->setEmail($summary['email'] ?? null);
                    $creator->setPhone($summary['phone'] ?? null);
                    $creatorMap[$userId] = $creator;
                }
            }
        }

        $listDto = OrganizationAssembler::assembleList($result['list'], $creatorMap);
        $listDto->setTotal($result['total']);
        $listDto->setPage($requestDTO->page);
        $listDto->setPageSize($requestDTO->pageSize);
        return $listDto->toArray();
    }
}
