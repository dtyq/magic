<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Domain\Chat\GlobalSearch;

use App\Domain\GlobalSearch\Entity\ValueObject\GlobalSearchQueryVo;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use GlobalSearchApplicationAppService;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class GlobalSearchApplicationDomainServiceTest extends BaseTest
{
    public function testGlobalSearch()
    {
        $userAuthorization = (new MagicUserAuthorization())->setId('')->setOrganizationCode('DT001');
        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($userAuthorization);
        $queryVo = (new GlobalSearchQueryVo())->setKeyWord('供应链');
        $res = $this->getGlobalSearchApplicationDomainService()->globalSearch($requestContext, $queryVo);
        $res = array_map(fn ($item) => $item->toArray(), $res->getData());
        $this->assertCount(1, $res);
        $first = $res[0];
        $this->assertArrayHasKey('id', $first);
        $this->assertArrayHasKey('name', $first);
        $this->assertArrayHasKey('app_id', $first);
        $this->assertArrayHasKey('logo', $first);
    }

    private function getGlobalSearchApplicationDomainService(): GlobalSearchApplicationAppService
    {
        return di(GlobalSearchApplicationAppService::class);
    }
}
