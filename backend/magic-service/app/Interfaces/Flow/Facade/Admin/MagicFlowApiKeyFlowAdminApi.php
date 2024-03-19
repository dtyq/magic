<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Flow\Facade\Admin;

use App\Application\Flow\Service\MagicFlowApiKeyAppService;
use App\Domain\Flow\Entity\ValueObject\ApiKeyType;
use App\Domain\Flow\Entity\ValueObject\Query\MagicFlowApiKeyQuery;
use App\Interfaces\Flow\Assembler\ApiKey\MagicFlowApiKeyAssembler;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class MagicFlowApiKeyFlowAdminApi extends AbstractFlowAdminApi
{
    #[Inject]
    protected MagicFlowApiKeyAppService $magicFlowApiKeyAppService;

    public function save(string $flowId)
    {
        $authorization = $this->getAuthorization();

        $DTO = MagicFlowApiKeyAssembler::createFlowApiKeyDTOByMixed($this->request->all());
        $DTO->setFlowCode($flowId);

        $DO = MagicFlowApiKeyAssembler::createDO($DTO);
        $entity = $this->magicFlowApiKeyAppService->save($authorization, $DO);
        return MagicFlowApiKeyAssembler::createDTO($entity);
    }

    public function queries(string $flowId)
    {
        $authorization = $this->getAuthorization();

        // 获取我创建的个人密钥
        $query = new MagicFlowApiKeyQuery();
        $query->setFlowCode($flowId);
        $query->setType(ApiKeyType::Personal->value);
        $query->setCreator($authorization->getId());
        $query->setOrder(['id' => 'desc']);

        $page = $this->createPage();
        $result = $this->magicFlowApiKeyAppService->queries($authorization, $query, $page);
        return MagicFlowApiKeyAssembler::createPageListDTO($result['total'], $result['list'], $page);
    }

    public function show(string $flowId, string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->magicFlowApiKeyAppService->getByCode($authorization, $flowId, $code);
        return MagicFlowApiKeyAssembler::createDTO($entity);
    }

    public function changeSecretKey(string $flowId, string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->magicFlowApiKeyAppService->changeSecretKey($authorization, $flowId, $code);
        return MagicFlowApiKeyAssembler::createDTO($entity);
    }

    public function destroy(string $flowId, string $code)
    {
        $authorization = $this->getAuthorization();
        $this->magicFlowApiKeyAppService->destroy($authorization, $code);
    }
}
