<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Agent\Facade\Open;

use App\Application\Agent\Service\MagicBotThirdPlatformChatAppService;
use Hyperf\HttpServer\Contract\RequestInterface;
use Psr\Http\Message\ResponseInterface;

readonly class ThirdPlatformChatApi
{
    public function __construct(
        protected RequestInterface $request,
        protected MagicBotThirdPlatformChatAppService $magicBotThirdPlatformChatAppService
    ) {
    }

    public function chat(): ?ResponseInterface
    {
        $key = $this->request->query('key', '');
        $message = $this->magicBotThirdPlatformChatAppService->chat($key, $this->request->all());
        return $message->getResponse();
    }
}
