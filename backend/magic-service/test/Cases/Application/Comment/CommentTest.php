<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace HyperfTest\Cases\Application\Comment;

use App\Domain\Comment\constant\CommentResourceType;
use App\Domain\Comment\constant\CommentType;
use App\Domain\Comment\Entity\CommentEntity;
use App\Domain\Comment\Repository\CommentRepository;
use App\Infrastructure\Util\Context\RequestContext;
use HyperfTest\Cases\BaseTest;

/**
 * @internal
 */
class CommentTest extends BaseTest
{
    public function testInsert()
    {
        $commentR = di()->get(CommentRepository::class);
        $requestContext = new RequestContext();
        $requestContext->setRequestId('usi_b5d7295b98912cdd1f3a4d59d752f2ee');
        $requestContext->setOrganizationCode('DT001');
        $commentEntity = new CommentEntity();
        $commentEntity->setType(CommentType::COMMENT);
        $commentEntity->setResourceId(705457565907976193);
        $commentEntity->setResourceType(CommentResourceType::SCHEDULE);
        $commentEntity->setParentId(0);
        $commentEntity->setMessage(['xhy评论了日程-A']);
        $commentEntity->setOrganizationCode($requestContext->getOrganizationCode());
        $commentEntity->setCreator($requestContext->getUserId());
        $commentEntity->setAttachments(['DT001/588417216353927169/2c17c6393771ee3048ae34d6b380c5ec/672448c5eca2a.png']);
        $commentResult = $commentR->create($requestContext, $commentEntity);
        $parentId = $commentResult->getId();
        $this->assertNotEmpty($commentResult->getId());

        $commentEntity->setType(CommentType::COMMENT);
        $commentEntity->setResourceId(705457565907976193);
        $commentEntity->setResourceType(CommentResourceType::SCHEDULE);
        $commentEntity->setParentId($parentId);
        $commentEntity->setMessage(['xhy回复了评论']);
        $commentEntity->setOrganizationCode($requestContext->getOrganizationCode());
        $commentEntity->setCreator($requestContext->getUserId());
        $commentResult = $commentR->create($requestContext, $commentEntity);
        $this->assertNotEmpty($commentResult->getId());
    }
}
