<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Kernel\Facade;

use App\Application\Kernel\Enum\MagicOperationEnum;
use App\Application\Kernel\Enum\MagicResourceEnum;
use App\Application\Mode\Service\DefaultModelPricePreviewService;
use App\Infrastructure\Core\Traits\MagicUserAuthorizationTrait;
use App\Infrastructure\Util\Permission\Annotation\CheckPermission;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\Contract\TranslatorInterface;

/** 管理端默认文本模型售价预览入口，使用独立倍率查询权限。 */
#[ApiResponse('low_code')]
class ModelBillingPreviewApi
{
    use MagicUserAuthorizationTrait;

    /** 独立注入快照职责，保持现有平台设置保存接口不变。 */
    public function __construct(private readonly DefaultModelPricePreviewService $preview)
    {
    }

    /** 返回一次读取的售价摘要，沿用管理接口的公共响应处理。 */
    #[CheckPermission(MagicResourceEnum::PLATFORM_AI_MODEL_MULTIPLIER, MagicOperationEnum::QUERY)]
    public function show(): array
    {
        return $this->preview->get($this->getAuthorization(), di(TranslatorInterface::class)->getLocale())->toArray();
    }
}
