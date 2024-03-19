<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback\BizData;

/**
 * https://open.dingtalk.com/document/isvapp/authorization-event-1.
 */
class BizType
{
    /**
     * 数据为第三方企业应用票据suiteTicket最新状态
     */
    public const SuiteTicket = 2;

    /**
     * 数据为企业授权.
     */
    public const CorpAuthorization = 4;
}
