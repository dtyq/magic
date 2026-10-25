<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Domain\Asset\Entity\ValueObject;

/**
 * 素材（及其标签）的业务类型。
 *
 * 业务类型决定素材属于哪个使用场景：GENERAL 是画布素材库里的通用素材；
 * 其它场景使用各自的类型，素材和标签都带同一个类型，用户侧默认只看 GENERAL。
 * 数据库里存的是字符串，新增场景只需新增一个常量，不需要改表。
 */
final class AssetBusinessType
{
    public const GENERAL = 'GENERAL';

    /** AI 人设研究使用的头像库，由平台统一管理，不在素材库界面展示。 */
    public const PERSONA_AVATAR = 'PERSONA_AVATAR';
}
