<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\SuperMagic\ExternalAPI\SandboxOS\Exception;

use RuntimeException;

/**
 * 用户工具调用对应的问题不存在（已超时被消费或重复提交）.
 *
 * 由 AgentDomainService 在沙箱返回 USER_TOOL_CALL_NOT_FOUND 响应码时抛出，
 * 区别于通用沙箱故障：这是预期的业务边界情况，调用方应转换为温和提醒而非任务错误。
 */
class UserToolCallNotFoundException extends RuntimeException
{
}
