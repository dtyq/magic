<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Agent\Facade;

use App\Application\Agent\Service\MagicBotThirdPlatformChatAppService;
use App\Domain\Agent\Entity\ValueObject\Query\MagicBotThirdPlatformChatQuery;
use App\Interfaces\Agent\Assembler\MagicBotThirdPlatformChatAssembler;
use App\Interfaces\Agent\DTO\MagicBotThirdPlatformChatDTO;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Di\Annotation\Inject;

#[ApiResponse('low_code')]
class MagicBotThirdPlatformChatApi extends AbstractApi
{
    #[Inject]
    protected MagicBotThirdPlatformChatAppService $magicBotThirdPlatformChatAppService;

    #[Inject]
    protected MagicBotThirdPlatformChatAssembler $magicBotThirdPlatformChatAssembler;

    public function save()
    {
        $authorization = $this->getAuthorization();
        $DTO = new MagicBotThirdPlatformChatDTO($this->request->all());
        $DO = $this->magicBotThirdPlatformChatAssembler->createDO($DTO);
        $entity = $this->magicBotThirdPlatformChatAppService->save($authorization, $DO);
        return $this->magicBotThirdPlatformChatAssembler->createDTO($entity);
    }

    public function listByBotId(string $botId)
    {
        $authorization = $this->getAuthorization();
        $page = $this->createPage();
        $data = $this->magicBotThirdPlatformChatAppService->listByBotId($authorization, $botId, $page);
        return $this->magicBotThirdPlatformChatAssembler->createPageDTO($data['total'], $data['list'], $page, true);
    }

    public function queries(string $botId)
    {
        $authorization = $this->getAuthorization();
        $page = $this->createPage();
        $query = new MagicBotThirdPlatformChatQuery();
        $query->setBotId($botId);
        $data = $this->magicBotThirdPlatformChatAppService->queries($authorization, $query, $page);
        return $this->magicBotThirdPlatformChatAssembler->createPageDTO($data['total'], $data['list'], $page);
    }

    public function destroy(string $id)
    {
        $authorization = $this->getAuthorization();
        $this->magicBotThirdPlatformChatAppService->destroy($authorization, $id);
    }
}
