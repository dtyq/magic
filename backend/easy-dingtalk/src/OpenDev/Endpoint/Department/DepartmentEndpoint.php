<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\Department;

use Dtyq\EasyDingTalk\Kernel\Exceptions\BadRequestException;
use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidParameterException;
use Dtyq\EasyDingTalk\OpenDev\Api\Department\DepartmentListSubApi;
use Dtyq\EasyDingTalk\OpenDev\Api\Department\GetAllParentDepartmentByUserApi;
use Dtyq\EasyDingTalk\OpenDev\Api\Department\GetDeptByIdApi;
use Dtyq\EasyDingTalk\OpenDev\Endpoint\OpenDevEndpoint;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Department\GetAllParentDepartmentByUserParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Department\GetDeptByIdParameter;
use Dtyq\EasyDingTalk\OpenDev\Parameter\Department\GetSubParameter;
use Dtyq\EasyDingTalk\OpenDev\Result\Department\DeptResult;
use GuzzleHttp\RequestOptions;

class DepartmentEndpoint extends OpenDevEndpoint
{
    /**
     * 获取部门列表.
     * @see https://open.dingtalk.com/document/orgapp/obtain-the-department-list-v2
     * @return DeptResult[]
     * @throws BadRequestException
     * @throws InvalidParameterException
     */
    public function getSub(GetSubParameter $parameter): array
    {
        $parameter->validate();

        $api = new DepartmentListSubApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'dept_id' => $parameter->getDeptId(),
                'language' => $parameter->getLanguage(),
            ],
        ]);

        $result = $this->getResult($api);
        $list = [];
        foreach ($result as $rawData) {
            $deptResult = DepartmentFactory::createDeptResultByResult($rawData);
            $list[$deptResult->getDeptId()] = $deptResult;
        }
        return $list;
    }

    public function getAllParentDepartmentByUser(GetAllParentDepartmentByUserParameter $parameter): array
    {
        $parameter->validate();

        $api = new GetAllParentDepartmentByUserApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'userid' => $parameter->getUserId(),
            ],
        ]);

        $result = $this->getResult($api);
        $list = [];
        foreach ($result['parent_list'] as $rawData) {
            $result = DepartmentFactory::createAllParentDepartmentResult($rawData);
            // 最后一个数当前数据
            if ($deptId = $result->currentDeptId()) {
                $list[$deptId] = $result;
            }
        }
        return $list;
    }

    public function getDeptById(GetDeptByIdParameter $parameter): DeptResult
    {
        $parameter->validate();

        $api = new GetDeptByIdApi();
        $api->setOptions([
            RequestOptions::QUERY => [
                'access_token' => $parameter->getAccessToken(),
            ],
            RequestOptions::JSON => [
                'dept_id' => $parameter->getDeptId(),
            ],
        ]);

        $result = $this->getResult($api);
        return DepartmentFactory::createDeptResultByResult($result);
    }
}
