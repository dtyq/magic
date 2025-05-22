<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Authentication\Facade\Admin;

use App\Application\Authentication\Service\ApiKeyProviderAppService;
use App\Domain\Authentication\Entity\ValueObject\Query\ApiKeyProviderQuery;
use App\Interfaces\Authentication\Assembler\ApiKeyProviderAssembler;
use App\Interfaces\Authentication\DTO\ApiKeyProviderDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse(version: 'low_code')]
class ApiKeyProviderAdminApi extends AbstractAuthenticationAdminApi
{
    #[Inject]
    protected ApiKeyProviderAppService $apiKeyProviderAppService;

    public function save()
    {
        $authorization = $this->getAuthorization();
        $dto = new ApiKeyProviderDTO($this->request->all());
        $entity = ApiKeyProviderAssembler::createDO($dto);

        $result = $this->apiKeyProviderAppService->save($authorization, $entity);
        return ApiKeyProviderAssembler::createDTO($result);
    }

    public function queries()
    {
        $authorization = $this->getAuthorization();
        $query = new ApiKeyProviderQuery($this->request->all());

        $page = $this->createPage();
        $result = $this->apiKeyProviderAppService->queries($authorization, $query, $page);

        return ApiKeyProviderAssembler::createPageListDTO($result['total'], $result['list'], $page);
    }

    public function show(string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->apiKeyProviderAppService->getByCode($authorization, $code);
        return ApiKeyProviderAssembler::createDTO($entity);
    }

    public function changeSecretKey(string $code)
    {
        $authorization = $this->getAuthorization();
        $entity = $this->apiKeyProviderAppService->changeSecretKey($authorization, $code);
        return ApiKeyProviderAssembler::createDTO($entity);
    }

    public function destroy(string $code)
    {
        $authorization = $this->getAuthorization();
        return $this->apiKeyProviderAppService->destroy($authorization, $code);
    }
}
