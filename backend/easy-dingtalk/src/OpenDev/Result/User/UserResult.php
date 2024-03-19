<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Result\User;

use Dtyq\EasyDingTalk\Kernel\Exceptions\InvalidResultException;
use Dtyq\EasyDingTalk\OpenDev\Result\AbstractResult;

class UserResult extends AbstractResult
{
    private string $userId;

    private string $unionid;

    /**
     * 通讯录加密的情况下，该值获取不到，默认空字符串.
     */
    private string $name;

    private string $avatar;

    /**
     * 通讯录加密的情况下，该值获取不到，默认空字符串.
     */
    private string $title;

    private string $jobNumber;

    private string $mobile;

    private array $deptIdList;

    private int $sysLevel;

    public function getSysLevel(): int
    {
        return $this->sysLevel;
    }

    public function setSysLevel(int $sysLevel): void
    {
        $this->sysLevel = $sysLevel;
    }

    public function buildByRawData(array $rawData): void
    {
        if (empty($rawData['userid'])) {
            throw new InvalidResultException('userid 不能为空');
        }
        if (empty($rawData['unionid'])) {
            throw new InvalidResultException('unionid 不能为空');
        }

        $this->userId = $rawData['userid'];
        $this->unionid = $rawData['unionid'];
        $this->name = $rawData['name'] ?? '';
        $this->avatar = $rawData['avatar'] ?? '';
        $this->title = $rawData['title'] ?? '';
        $this->jobNumber = $rawData['job_number'] ?? '';
        $this->mobile = $rawData['mobile'] ?? '';
        $this->deptIdList = $rawData['dept_id_list'] ?? [];
    }

    public function getUserId(): string
    {
        return $this->userId;
    }

    public function getUnionid(): string
    {
        return $this->unionid;
    }

    public function getName(): string
    {
        return $this->name;
    }

    public function getAvatar(): string
    {
        return $this->avatar;
    }

    public function getTitle(): string
    {
        return $this->title;
    }

    public function getMobile(): string
    {
        return $this->mobile;
    }

    public function getDeptIdList(): array
    {
        return $this->deptIdList;
    }

    public function getJobNumber(): string
    {
        return $this->jobNumber;
    }
}
