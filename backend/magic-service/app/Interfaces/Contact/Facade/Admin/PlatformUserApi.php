<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Contact\Facade\Admin;

use App\Application\Contact\Service\PlatformUserAppService;
use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Infrastructure\Core\AbstractApi;
use App\Infrastructure\Core\ValueObject\Page;
use App\Infrastructure\Util\OfficialOrganizationUtil;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Contact\DTO\PlatformUserListRequestDTO;
use App\Interfaces\Contact\DTO\UserSearchRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class PlatformUserApi extends AbstractApi
{
    #[Inject]
    protected PlatformUserAppService $platformUserAppService;

    #[CheckPermission(MagicResourceEnum::PLATFORM_USER_LIST, MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        $requestDTO = PlatformUserListRequestDTO::fromRequest($this->request);
        $page = new Page($requestDTO->page, $requestDTO->pageSize);
        $result = $this->platformUserAppService->queries($page, $requestDTO->toFilters());

        return [
            'list' => $result['list'],
            'total' => $result['total'],
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
        ];
    }

    /**
     * 按指定字段搜索用户。
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
        $authorization = $this->getAuthorization();
        $organizationCode = (string) $authorization->getOrganizationCode();
        $requestDTO = UserSearchRequestDTO::fromRequest($this->request);
        $page = new Page($requestDTO->page, $requestDTO->pageSize);
        $isOfficialOrganization = OfficialOrganizationUtil::isOfficialOrganization($organizationCode);

        $result = $this->platformUserAppService->searchUsers(
            $page,
            $requestDTO->searchField,
            $requestDTO->keyword,
            $isOfficialOrganization ? null : $organizationCode
        );

        return [
            'page' => $page->getPage(),
            'page_size' => $page->getPageNum(),
            'total' => (string) $result['total'],
            'list' => array_map(static function (array $user): array {
                return [
                    'user_id' => (string) ($user['user_id'] ?? ''),
                    'user_name' => (string) ($user['user_name'] ?? ''),
                    'phone' => (string) ($user['phone'] ?? ''),
                    'organization_code' => (string) ($user['organization_code'] ?? ''),
                    'organization_name' => (string) ($user['organization_name'] ?? ''),
                ];
            }, $result['list']),
        ];
    }
}
