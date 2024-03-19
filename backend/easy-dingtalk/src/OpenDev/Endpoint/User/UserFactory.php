<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\User;

use Dtyq\EasyDingTalk\OpenDev\Result\User\AdminResult;
use Dtyq\EasyDingTalk\OpenDev\Result\User\UserByCodeResult;
use Dtyq\EasyDingTalk\OpenDev\Result\User\UserByMobileResult;
use Dtyq\EasyDingTalk\OpenDev\Result\User\UserListResult;
use Dtyq\EasyDingTalk\OpenDev\Result\User\UserResult;

class UserFactory
{
    public static function createUserListResultByRawData(array $rawData): UserListResult
    {
        return new UserListResult($rawData);
    }

    public static function createUserResultByRawData(array $rawData): UserResult
    {
        return new UserResult($rawData);
    }

    public static function createUserByCodeResultByRawData(array $rawData): UserByCodeResult
    {
        return new UserByCodeResult($rawData);
    }

    public static function createAdminResultByRawData(array $rawData): AdminResult
    {
        return new AdminResult($rawData);
    }

    public static function createUserResultByMobileRawData(array $rawData): UserByMobileResult
    {
        return new UserByMobileResult($rawData);
    }
}
