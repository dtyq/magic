<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Interfaces\Provider\DTO;

use App\Domain\Provider\Entity\ValueObject\ProviderConfigSearchField;
use App\Domain\Provider\Entity\ValueObject\ProviderVirtualIdentity;
use App\ErrorCode\GenericErrorCode;
use App\Infrastructure\Core\AbstractDTO;
use App\Infrastructure\Core\Exception\ExceptionBuilder;
use App\Infrastructure\Core\ValueObject\Page;
use Hyperf\HttpServer\Contract\RequestInterface;

/**
 * 服务商配置搜索请求。
 */
class ProviderConfigSearchRequest extends AbstractDTO
{
    public ProviderConfigSearchField $searchField;

    public string $keyword;

    public int $page = 1;

    /** 单页最多 50 条。 */
    public int $pageSize = 20;

    public static function fromRequest(RequestInterface $request): self
    {
        $dto = new self();
        $searchField = ProviderConfigSearchField::tryFrom(trim((string) $request->input('search_type', '')));
        if ($searchField === null) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => 'search_type']);
        }
        $dto->searchField = $searchField;
        $dto->keyword = trim((string) $request->input('keyword', ''));
        if ($dto->keyword === '') {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.empty', ['label' => 'keyword']);
        }
        if ($searchField === ProviderConfigSearchField::ConfigId
            && ! ctype_digit($dto->keyword)
            && ! ProviderVirtualIdentity::isPlatformOfficialId($dto->keyword)
        ) {
            ExceptionBuilder::throw(GenericErrorCode::ParameterValidationFailed, 'common.invalid', ['label' => 'keyword']);
        }

        $dto->page = max(1, (int) $request->input('page', 1));
        $pageSize = (int) $request->input('page_size', 20);
        $dto->pageSize = $pageSize <= 0 ? 20 : min($pageSize, 50);

        return $dto;
    }

    public function toPage(): Page
    {
        return new Page($this->page, $this->pageSize);
    }
}
