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
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Contact\DTO\PlatformUserListRequestDTO;
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
}
