<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Api\Department;

use Dtyq\EasyDingTalk\OpenDev\Api\OpenDevApiAbstract;
use Dtyq\SdkBase\Kernel\Constant\RequestMethod;

/**
 * 获取指定用户的所有父部门列表.
 * @see https://open.dingtalk.com/document/orgapp/queries-the-list-of-all-parent-departments-of-a-user
 */
class GetAllParentDepartmentByUserApi extends OpenDevApiAbstract
{
    public function getMethod(): RequestMethod
    {
        return RequestMethod::Post;
    }

    public function getUri(): string
    {
        return '/topapi/v2/department/listparentbyuser';
    }
}
