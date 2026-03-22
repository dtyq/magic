<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\Skill\Entity\ValueObject;

/**
 * 审核状态枚举.
 */
enum ReviewStatus: string
{
    /**
     * 待审核.
     */
    case PENDING = 'PENDING';

    /**
     * 审核中.
     */
    case UNDER_REVIEW = 'UNDER_REVIEW';

    /**
     * 审核通过.
     */
    case APPROVED = 'APPROVED';

    /**
     * 审核拒绝.
     */
    case REJECTED = 'REJECTED';

    /**
     * Invalidated (superseded): e.g. user submitted a newer publish; older PENDING/UNDER_REVIEW rows are batch-updated — not an admin REJECTED.
     */
    case INVALIDATED = 'INVALIDATED';

    /**
     * 判断是否为待审核状态.
     */
    public function isPending(): bool
    {
        return $this === self::PENDING;
    }

    /**
     * 判断是否为审核中状态.
     */
    public function isUnderReview(): bool
    {
        return $this === self::UNDER_REVIEW;
    }

    /**
     * 判断是否为审核通过状态.
     */
    public function isApproved(): bool
    {
        return $this === self::APPROVED;
    }

    /**
     * 判断是否为审核拒绝状态.
     */
    public function isRejected(): bool
    {
        return $this === self::REJECTED;
    }

    public function isInvalidated(): bool
    {
        return $this === self::INVALIDATED;
    }
}
