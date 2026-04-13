<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\SuperMagic\Domain\SuperAgent\Entity\ValueObject;

/**
 * ask_user 问题状态（沙盒下发，Human-in-the-Loop）.
 *
 * pending  – 问题等待用户作答，后端应暂停任务并推送给前端
 * timeout  – 问题已超时，沙盒自行继续，后端无需额外处理
 */
enum AskUserStatus: string
{
    case Pending = 'pending';
    case Timeout = 'timeout';
}
