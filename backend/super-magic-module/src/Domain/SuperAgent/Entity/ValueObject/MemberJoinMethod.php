<?php

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

enum MemberJoinMethod: string
{
    case INTERNAL = 'internal';  // 团队内邀请

    case LINK = 'link';         // 邀请链接
}
