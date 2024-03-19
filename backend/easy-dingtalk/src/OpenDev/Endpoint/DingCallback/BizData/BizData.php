<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace Dtyq\EasyDingTalk\OpenDev\Endpoint\DingCallback\BizData;

class BizData
{
    private int $bizType;

    private string $corpId;

    private string $subscribeId;

    private string $bizId;

    private array $bizData;

    private array $rawData;

    public static function createByRawData(array $rawData): ?self
    {
        if (empty($rawData['biz_type'])
            || empty($rawData['corp_id'])
            || empty($rawData['subscribe_id'])
            || empty($rawData['biz_id'])
            || empty($rawData['biz_data'])
        ) {
            return null;
        }
        $bizData = new self();
        $bizData->rawData = $rawData;
        $bizData->bizType = $rawData['biz_type'];
        $bizData->corpId = $rawData['corp_id'];
        $bizData->subscribeId = $rawData['subscribe_id'];
        $bizData->bizId = $rawData['biz_id'];
        $bizData->bizData = json_decode($rawData['biz_data'], true);
        return $bizData;
    }

    public function getBizType(): int
    {
        return $this->bizType;
    }

    public function getCorpId(): string
    {
        return $this->corpId;
    }

    public function getSubscribeId(): string
    {
        return $this->subscribeId;
    }

    public function getBizId(): string
    {
        return $this->bizId;
    }

    public function getBizData(): array
    {
        return $this->bizData;
    }

    public function getRawData(): array
    {
        return $this->rawData;
    }
}
