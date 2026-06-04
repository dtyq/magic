<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Infrastructure\Util\Permission\Annotation;

use Attribute;
use BackedEnum;
use Hyperf\Di\Annotation\AbstractAnnotation;

#[Attribute(Attribute::TARGET_CLASS | Attribute::TARGET_METHOD)]
class CheckProviderModelPermission extends AbstractAnnotation
{
    public const string SCOPE_PLATFORM = 'platform';

    public const string SCOPE_WORKSPACE = 'workspace';

    public const string SOURCE_REQUEST_CATEGORY = 'request_category';

    public const string SOURCE_MODEL_ID = 'model_id';

    public const string SOURCE_PROVIDER_CONFIG_ID = 'provider_config_id';

    public const string SOURCE_PROVIDER_CONFIG_REQUEST = 'provider_config_request';

    public string $scope;

    public string $source;

    public string $operation;

    public function __construct(string $scope, string $source, BackedEnum|string $operation)
    {
        $this->scope = $scope;
        $this->source = $source;
        $this->operation = $operation instanceof BackedEnum ? $operation->value : $operation;
    }
}
