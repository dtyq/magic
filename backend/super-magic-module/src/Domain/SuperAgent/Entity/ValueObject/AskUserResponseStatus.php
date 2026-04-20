<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * 用户对 ask_user 问题的答复状态（Human-in-the-Loop）.
 *
 * Answered – 用户填写了答案并提交
 * Skipped  – 用户选择跳过，不作答
 */
enum AskUserResponseStatus: string
{
    case Answered = 'answered';
    case Skipped = 'skipped';
}
