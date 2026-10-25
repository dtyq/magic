<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\SuperMagic\Skill;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\SuperMagic\Skill\Service\AdminSkillCategoryAppService;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\Skill\DTO\Request\CreateSkillCategoryRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\QuerySkillCategoriesRequestAdminDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\UpdateSkillCategoryRequestAdminDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class AdminSkillCategoryApi extends AbstractApi
{
    #[Inject]
    protected AdminSkillCategoryAppService $categoryAppService;

    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        return ['list' => $this->categoryAppService->query(QuerySkillCategoriesRequestAdminDTO::fromRequest($this->request))];
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::QUERY)]
    public function show(int $id): array
    {
        return $this->categoryAppService->getDetail($id);
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function create(): array
    {
        return $this->categoryAppService->create($this->getAuthorization(), CreateSkillCategoryRequestAdminDTO::fromRequest($this->request));
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function update(int $id): array
    {
        return $this->categoryAppService->update($this->getAuthorization(), $id, UpdateSkillCategoryRequestAdminDTO::fromRequest($this->request));
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function delete(int $id): array
    {
        $this->categoryAppService->delete($id);
        return [];
    }
}
