<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\Oauth2;

use Dtyq\EasyDingTalk\OpenDev\Endpoint\OpenDevEndpoint;

class AccessTokenEndpoint extends OpenDevEndpoint
{
    public function get(): string
    {
        return $this->getAccessToken();
    }

    public function getCorp(string $corpId, string $suitTicket): string
    {
        return $this->getCorpAccessToken($corpId, $suitTicket);
    }
}
