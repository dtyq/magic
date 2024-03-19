<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Chat;

use App\Application\Chat\Service\MagicChatImageConvertHighAppService;
use App\Domain\Chat\DTO\ImageConvertHigh\Request\MagicChatImageConvertHighReqDTO;
use App\Domain\Contact\Entity\ValueObject\UserType;
use App\Infrastructure\Util\Context\RequestContext;
use App\Interfaces\Authorization\Web\MagicUserAuthorization;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class MagicChatImageConvertHighAppServiceTest extends BaseTest
{
    public function testHandleUserMessage(): void
    {
        $app = di(MagicChatImageConvertHighAppService::class);
        $userAuthorization = new MagicUserAuthorization();
        $userAuthorization->setUserType(UserType::Ai);
        $userAuthorization->setId('usi_bb4c610b060776b1ef67db2553377b46');
        $userAuthorization->setOrganizationCode('DT001');
        $requestContext = new RequestContext();
        $requestContext->setUserAuthorization($userAuthorization);
        $reqDTO = (new MagicChatImageConvertHighReqDTO())
            ->setTopicId('735953094912245760')
            ->setConversationId('735953093226135552')
            ->setAppMessageId('1')
            ->setOriginImageUrl('');
        $app->handleUserMessage($requestContext, $reqDTO);
        $this->assertTrue(true);
    }
}
