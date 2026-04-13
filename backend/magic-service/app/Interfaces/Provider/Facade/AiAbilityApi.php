<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\ModelGateway\Service\AiAbilityConnectivityTestAppService;
use App\Application\Provider\Service\AiAbilityAppService;
use App\Domain\ModelGateway\Entity\Dto\AiAbilityConnectivityTestRequestDTO;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use App\Infrastructure\Util\RequestUtil;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use App\Interfaces\Provider\Assembler\AiAbilityAssembler;
use App\Interfaces\Provider\DTO\UpdateAiAbilityRequest;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;
use Hyperf\HttpServer\Contract\RequestInterface;

#[ApiResponse('low_code')]
class AiAbilityApi extends AbstractApi
{
    #[Inject]
    protected AiAbilityAppService $aiAbilityAppService;

    #[Inject]
    protected AiAbilityConnectivityTestAppService $aiAbilityConnectivityTestAppService;

    /**
     * 获取所有AI能力列表.
     */
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_ABILITY], MagicOperationEnum::QUERY)]
    public function queries(): array
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();

        $list = $this->aiAbilityAppService->queries($authorization);

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

    /**
     * Ability connectivity test endpoint.
     *
     * Management endpoint for testing AI ability connectivity.
     *
     * Request Body (JSON):
     * - ai_ability: Ability code or alias (required)
     *
     * @return array Unified connectivity test response
     */
    #[CheckPermission([MagicResourceEnum::ADMIN_AI_ABILITY], MagicOperationEnum::QUERY)]
    public function connectivityTest(RequestInterface $request)
    {
        /** @var MagicUserAuthorization $authorization */
        $authorization = $this->getAuthorization();
        $requestData = $request->all();

        $connectivityTestRequestDTO = AiAbilityConnectivityTestRequestDTO::createDTO($requestData);
        if (defined('MAGIC_ACCESS_TOKEN')) {
            $connectivityTestRequestDTO->setAccessToken(MAGIC_ACCESS_TOKEN);
        }
        $connectivityTestRequestDTO->setHeaderConfigs(RequestUtil::normalizeHeaders($request->getHeaders()));
        $connectivityTestRequestDTO->setBusinessParams([
            'organization_id' => $authorization->getOrganizationCode(),
            'organization_code' => $authorization->getOrganizationCode(),
            'user_id' => $authorization->getId(),
            'source_id' => 'ai_ability_connectivity_test',
        ]);

        return $this->aiAbilityConnectivityTestAppService->connectivityTest($connectivityTestRequestDTO);
    }
}
