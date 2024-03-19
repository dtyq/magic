<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\ModelGateway\Event\Subscribe;

use App\Application\ModelGateway\Official\MagicAccessToken;
use Hyperf\Event\Annotation\Listener;
use Hyperf\Event\Contract\ListenerInterface;
use Hyperf\Server\Event\MainCoroutineServerStart;

/**
 * 官方应用check.
 */
#[Listener]
class OfficialAppTokenCheckSubscriber implements ListenerInterface
{
    public function listen(): array
    {
        return [
            MainCoroutineServerStart::class,
        ];
    }

    public function process(object $event): void
    {
        MagicAccessToken::init();
    }
}
