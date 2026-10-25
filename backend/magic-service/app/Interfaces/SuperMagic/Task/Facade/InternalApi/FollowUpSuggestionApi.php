<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\SuperMagic\Task\Facade\InternalApi;

use App\Application\Chat\Service\FollowUpSuggestionAppService;
use App\Infrastructure\Util\Context\RequestCoContext;
use App\Interfaces\SuperMagic\Common\Support\Facade\AbstractApi;
use Dtyq\ApiResponse\Annotation\ApiResponse;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 沙箱上报追加问题状态。
 */
#[ApiResponse('low_code')]
class FollowUpSuggestionApi extends AbstractApi
{
    public function __construct(
        protected RequestInterface $request,
        private readonly FollowUpSuggestionAppService $followUpSuggestionAppService,
    ) {
        parent::__construct($request);
    }

    /**
     * 写入当前任务的追加问题状态。
     */
    public function report(): array
    {
        return $this->followUpSuggestionAppService->report(
            RequestCoContext::getUserAuthorization(),
            $this->request->all(),
        );
    }
}
