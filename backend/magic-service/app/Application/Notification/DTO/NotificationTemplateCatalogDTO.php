<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\DTO;

/**
 * 当前宿主可用的消息模板目录。
 *
 * @phpstan-type TemplateItem array{title_template:string,body_template:string}
 */
final readonly class NotificationTemplateCatalogDTO
{
    /**
     * @param array<string, TemplateItem> $templates
     */
    public function __construct(
        public string $locale,
        public string $catalogVersion,
        public array $templates,
    ) {
    }

    /**
     * @return array{locale:string,catalog_version:string,templates:array<string,TemplateItem>}
     */
    public function toArray(): array
    {
        return [
            'locale' => $this->locale,
            'catalog_version' => $this->catalogVersion,
            'templates' => $this->templates,
        ];
    }
}
