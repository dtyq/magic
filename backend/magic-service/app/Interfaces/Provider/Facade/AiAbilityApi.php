<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Provider\Service\AiAbilityAppService;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\Assembler\AiAbilityAssembler;
use App\Interfaces\Provider\DTO\UpdateAiAbilityRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class AiAbilityApi extends AbstractApi
{
    #[Inject]
    protected AiAbilityAppService $aiAbilityAppService;

    /**
     * 获取所有AI能力列表.
     */
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_ABILITY], MagicOperationEnum::QUERY)]
    public function list(): array
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();

        $list = $this->aiAbilityAppService->getList($authorization);

        return AiAbilityAssembler::listDTOsToArray($list);
    }

    /**
     * 获取AI能力详情.
     */
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_ABILITY], MagicOperationEnum::QUERY)]
    public function detail(string $code): array
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();

        $detail = $this->aiAbilityAppService->getDetail($authorization, $code);

        return $detail->toArray();
    }

    /**
     * 更新AI能力.
     */
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_ABILITY], MagicOperationEnum::EDIT)]
    public function update(string $code): array
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();

        $requestData = $this->request->all();
        $requestData['code'] = $code;

        $updateRequest = new UpdateAiAbilityRequest($requestData);

        $this->aiAbilityAppService->update($authorization, $updateRequest);

        return [];
    }
}
