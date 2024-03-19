<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\Test\OpenDev\Provider\Oauth2;

use Dtyq\EasyDingTalk\Test\OpenDev\OpenDevEndpointBaseTestCase;

/**
 * @internal
 * @coversNothing
 */
class AccessTokenEndpointTestEndpoint extends OpenDevEndpointBaseTestCase
{
    public function testGet()
    {
        $openDev = $this->createOpenDevFactory('first');
        $accessToken = $openDev->accessTokenEndpoint->get();
        $this->assertIsString($accessToken);
    }

    public function testGetCorp()
    {
        $openDev = $this->createOpenDevFactory('crop');
        $accessToken = $openDev->accessTokenEndpoint->getCorp($this->getCorpId(), $this->getSuitTicket());
        $this->assertIsString($accessToken);
    }
}
