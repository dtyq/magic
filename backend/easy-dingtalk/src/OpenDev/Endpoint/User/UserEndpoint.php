<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\User;

use Dtyq\EasyDingTalk\Kernel\Exceptions\BadRequestException;
use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Api\User\AdminListApi;
use Dtyq\EasyDingTalk\OpenDev\Api\User\UserInfoByCodeApi;
use Dtyq\EasyDingTalk\OpenDev\Api\User\UserInfoByMobileApi;
use Dtyq\EasyDingTalk\OpenDev\Api\User\UserInfoByUserIdApi;
use Dtyq\EasyDingTalk\OpenDev\Api\User\UserListApi;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\OpenDevEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Parameter\User\GetListAdminByParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\User\GetListByDeptIdParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\User\GetUserInfoByCodeParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\User\GetUserInfoByMobileParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\User\GetUserInfoByUserIdParameter;
use Dtyq\EasyDingTalk\OpenDev\Result\User\AdminResult;
use Dtyq\EasyDingTalk\OpenDev\Result\User\UserByCodeResult;
use Dtyq\EasyDingTalk\OpenDev\Result\User\UserByMobileResult;
use Dtyq\EasyDingTalk\OpenDev\Result\User\UserListResult;
use Dtyq\EasyDingTalk\OpenDev\Result\User\UserResult;
use GuzzleHttp\RequestOptions;

class UserEndpoint extends OpenDevEndpoint
{
    /**
     * 根据免登授权码获取用户信息.
     * @see https://open.dingtalk.com/document/isvapp/obtain-the-user-information-based-on-the-sso-token
     * @throws BadRequestException
     * @throws InvalidParameterException
     */
    public function getUserInfoByCode(GetUserInfoByCodeParameter $parameter): UserByCodeResult
    {
        $parameter->validate();

        $api = new UserInfoByCodeApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'code' => $parameter->getCode(),
            ],
        ]);
        $result = $this->getResult($api);
        return UserFactory::createUserByCodeResultByRawData($result);
    }

    /**
     * 根据用户id获取用户信息.
     * @throws BadRequestException
     * @throws InvalidParameterException
     */
    public function getUserInfoByUserId(GetUserInfoByUserIdParameter $parameter): UserResult
    {
        $parameter->validate();

        $api = new UserInfoByUserIdApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'userid' => $parameter->getUserId(),
            ],
        ]);
        $result = $this->getResult($api);
        return UserFactory::createUserResultByRawData($result);
    }

    /**
     * 获取部门下的用户信息.
     * @see https://open.dingtalk.com/document/isvapp/queries-the-complete-information-of-a-department-user
     * @throws BadRequestException
     * @throws InvalidParameterException
     */
    public function getListByDeptId(GetListByDeptIdParameter $parameter): UserListResult
    {
        $parameter->validate();

        $api = new UserListApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'dept_id' => $parameter->getDeptId(),
                'cursor' => $parameter->getCursor(),
                'size' => $parameter->getSize(),
            ],
        ]);
        $result = $this->getResult($api);
        return UserFactory::createUserListResultByRawData($result);
    }

    /**
     * 获取管理员列表.
     * @return AdminResult[]
     * @throws BadRequestException
     * @throws InvalidParameterException
     */
    public function getListAdmin(GetListAdminByParameter $parameter): array
    {
        $parameter->validate();
        $api = new AdminListApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
        ]);
        $result = $this->getResult($api);
        $list = [];
        foreach ($result as $rawData) {
            $admin = UserFactory::createAdminResultByRawData($rawData);
            $list[$admin->getUserId()] = $admin;
        }
        return $list;
    }

    /**
     * 根据手机号获取用户信息.
     * @see https://open.dingtalk.com/document/orgapp/query-users-by-phone-number
     * @throws BadRequestException
     * @throws InvalidParameterException
     */
    public function getUserIdByMobile(GetUserInfoByMobileParameter $parameter): UserByMobileResult
    {
        $parameter->validate();

        $api = new UserInfoByMobileApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'mobile' => $parameter->getMobile(),
            ],
        ]);
        $result = $this->getResult($api);
        return UserFactory::createUserResultByMobileRawData($result);
    }
}
