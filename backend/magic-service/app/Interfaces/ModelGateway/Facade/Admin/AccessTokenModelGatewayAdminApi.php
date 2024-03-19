<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\ModelGateway\Facade\Admin;

use App\Application\ModelGateway\Service\AccessTokenAppService;
use App\Domain\ModelGateway\Entity\ValueObject\Query\AccessTokenQuery;
use App\Interfaces\ModelGateway\Assembler\AccessTokenAssembler;
use App\Interfaces\ModelGateway\DTO\AccessTokenDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class AccessTokenModelGatewayAdminApi extends AbstractModelGatewayAdminApi
{
    #[Inject]
    protected AccessTokenAppService $accessTokenAppService;

    public function save()
    {
        $authorization = $this->getAuthorization();

        $accessTokenDTO = new AccessTokenDTO($this->request->all());
        $DO = AccessTokenAssembler::createDO($accessTokenDTO);

        $entity = $this->accessTokenAppService->save($authorization, $DO);
        $users = $this->accessTokenAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        return AccessTokenAssembler::createDTO($entity, $users);
    }

    public function show(string $id)
    {
        $entity = $this->accessTokenAppService->show($this->getAuthorization(), (int) $id);
        $users = $this->accessTokenAppService->getUsers($entity->getOrganizationCode(), [$entity->getCreator(), $entity->getModifier()]);
        return AccessTokenAssembler::createDTO($entity, $users);
    }

    public function queries()
    {
        $authorization = $this->getAuthorization();
        $query = new AccessTokenQuery($this->request->all());
        $page = $this->createPage();
        $data = $this->accessTokenAppService->queries($authorization, $query, $page);
        return AccessTokenAssembler::createPageDTO($data, $page);
    }

    public function destroy(string $id)
    {
        $this->accessTokenAppService->destroy($this->getAuthorization(), (int) $id);
    }
}
