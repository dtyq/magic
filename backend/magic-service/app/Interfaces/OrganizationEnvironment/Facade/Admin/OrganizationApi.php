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
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\OrganizationEnvironment\Assembler\OrganizationAssembler;
use App\Interfaces\OrganizationEnvironment\DTO\OrganizationCreatorResponseDTO;
use App\Interfaces\OrganizationEnvironment\DTO\OrganizationListRequestDTO;
use App\Interfaces\OrganizationEnvironment\DTO\OrganizationSearchRequestDTO;
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

    /**
     * 按指定字段搜索组织。
     */
    #[CheckPermission(
        [
            MagicResourceEnum::PLATFORM_USER_LIST,
            MagicResourceEnum::PLATFORM_AI_MODEL_AUDIT_LOG,
            MagicResourceEnum::WORKSPACE_AI_MODEL_AUDIT_LOG,
        ],
        MagicOperationEnum::QUERY
    )]
    public function search(): array
    {
        $organizationCode = (string) $this->getAuthorization()->getOrganizationCode();
        $isOfficialOrganization = OfficialOrganizationUtil::isOfficialOrganization($organizationCode);

        $requestDTO = OrganizationSearchRequestDTO::fromRequest($this->request);
        $page = new Page($requestDTO->page, $requestDTO->pageSize);
        $result = $this->organizationAppService->searchOrganizations(
            $page,
            $requestDTO->searchField,
            $requestDTO->keyword,
            $isOfficialOrganization ? null : $organizationCode
        );

        return OrganizationAssembler::assembleSearchPage($result, $page);
    }
}
