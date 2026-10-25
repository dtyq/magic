<?php

declare(strict_types=1);
/**
 * Copyright (c) The Magic , Distributed under the software license
 */

namespace App\Application\Notification\Service;

use App\Application\Notification\DTO\NotificationTemplateCatalogDTO;
use App\Application\Notification\Strategy\NotificationCatalogStrategyInterface;
use App\Domain\Notification\Entity\NotificationTemplateEntity;
use App\Domain\Notification\Repository\Facade\NotificationTemplateRepositoryInterface;
use Hyperf\Contract\ConfigInterface;
use JsonException;

/** 提供按语言读取的消息模板目录。 */
final readonly class NotificationTemplateAppService
{
    private const DEFAULT_LOCALE = 'zh-CN';

    public function __construct(
        private NotificationTemplateRepositoryInterface $templates,
        private NotificationCatalogStrategyInterface $catalog,
        private ConfigInterface $config,
    ) {
    }

    public function catalog(?string $locale = null): NotificationTemplateCatalogDTO
    {
        $requestedLocale = $this->normalizeLocale($locale);
        $templates = $this->publicTemplates($this->templates->listCatalog($requestedLocale));
        $actualLocale = $requestedLocale;

        // 缺少请求语言时按契约回退简体中文，同时返回实际使用的语言。
        if ($templates === [] && $requestedLocale !== self::DEFAULT_LOCALE) {
            $actualLocale = self::DEFAULT_LOCALE;
            $templates = $this->publicTemplates($this->templates->listCatalog($actualLocale));
        }

        $items = [];
        $fingerprint = [];
        foreach ($templates as $template) {
            $key = sprintf('%s:%d', $template->getTemplateType(), $template->getVersion());
            $items[$key] = [
                'title_template' => $template->getTitleTemplate(),
                'body_template' => $template->getBodyTemplate(),
            ];
            $fingerprint[] = [
                'template_type' => $template->getTemplateType(),
                'version' => $template->getVersion(),
                'updated_at' => $template->getUpdatedAt(),
                'status' => $template->getStatus()->value,
            ];
        }

        try {
            $catalogVersion = 'sha256:' . hash('sha256', (string) json_encode($fingerprint, JSON_THROW_ON_ERROR));
        } catch (JsonException) {
            // 模板字段均来自数据库基础类型；保留稳定的空目录版本作为最后兜底。
            $catalogVersion = 'sha256:' . hash('sha256', '[]');
        }

        return new NotificationTemplateCatalogDTO($actualLocale, $catalogVersion, $items);
    }

    private function normalizeLocale(?string $locale): string
    {
        $default = $this->config->get('notification.locales.default', self::DEFAULT_LOCALE);
        $default = $this->canonicalLocale(is_string($default) ? $default : self::DEFAULT_LOCALE);
        $value = $this->canonicalLocale($locale ?? $default);
        $supported = $this->config->get('notification.locales.supported', [self::DEFAULT_LOCALE, 'en-US']);
        $supported = is_array($supported) ? array_map(fn (mixed $item): string => $this->canonicalLocale((string) $item), $supported) : [];

        return in_array($value, $supported, true) ? $value : $default;
    }

    private function canonicalLocale(string $locale): string
    {
        return match (strtolower(str_replace('_', '-', trim($locale)))) {
            'en-us' => 'en-US',
            'zh-cn' => 'zh-CN',
            default => self::DEFAULT_LOCALE,
        };
    }

    /**
     * 只向公共目录暴露当前宿主策略支持的消息类型。
     *
     * @param list<NotificationTemplateEntity> $templates
     * @return list<NotificationTemplateEntity>
     */
    private function publicTemplates(array $templates): array
    {
        return array_values(array_filter(
            $templates,
            fn (NotificationTemplateEntity $template): bool => $this->catalog->supportsNotification($template->getTemplateType())
        ));
    }
}
