<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Asset\DTO\Response;

use App\Domain\Asset\Entity\ProviderAssetEntity;
use App\Domain\Asset\Entity\ValueObject\ProviderAssetStatus;
use App\Domain\Asset\Entity\ValueObject\ProviderReviewMode;
use App\Infrastructure\Core\AbstractDTO;

class AssetComplianceDTO extends AbstractDTO
{
    public string $assetId;

    public string $complianceStatus;

    public ?string $complianceFailedReason;

    /** 合规结论来源：VOLCENGINE / NO_PERSON / REUSED。 */
    public string $complianceReviewMode;

    public function __construct(int|string $assetId, ?ProviderAssetEntity $providerAsset)
    {
        $complianceStatus = $providerAsset?->getProviderStatus() ?? ProviderAssetStatus::UNVERIFIED;
        $this->assetId = (string) $assetId;
        $this->complianceStatus = $complianceStatus->value;
        // 只有 FAILED 才带原因：状态被重新写成通过或审核中之后，上一轮的失败原因不能再透给前端。
        $this->complianceFailedReason = $complianceStatus === ProviderAssetStatus::FAILED
            ? $providerAsset?->getProviderFailedReason()
            : null;
        $this->complianceReviewMode = ($providerAsset?->getProviderReviewMode() ?? ProviderReviewMode::VOLCENGINE)->value;
        parent::__construct();
    }
}
