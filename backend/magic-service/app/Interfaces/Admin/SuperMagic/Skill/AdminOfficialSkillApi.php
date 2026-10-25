<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Admin\SuperMagic\Skill;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\SuperMagic\Skill\Service\AdminOfficialSkillAppService;
use App\Infrastructure\Util\Context\RequestContext;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ImportOfficialSkillRequestDTO;
use App\Interfaces\SuperMagic\Skill\DTO\Request\ParseOfficialSkillImportRequestDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class AdminOfficialSkillApi extends AbstractApi
{
    #[Inject]
    protected AdminOfficialSkillAppService $officialSkillAppService;

    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function parseImport(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $requestDTO = ParseOfficialSkillImportRequestDTO::fromRequest($this->request);

        return $this->officialSkillAppService
            ->parseImport($requestContext, $requestDTO->getFileKey())
            ->jsonSerialize();
    }

    #[CheckPermission(MagicResourceEnum::PLATFORM_SKILL_MARKET, MagicOperationEnum::EDIT)]
    public function import(RequestContext $requestContext): array
    {
        $requestContext->setUserAuthorization($this->getAuthorization());
        $requestDTO = ImportOfficialSkillRequestDTO::fromRequest($this->request);

        return $this->officialSkillAppService
            ->import($requestContext, $requestDTO)
            ->jsonSerialize();
    }
}
