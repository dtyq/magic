# Easy DingTalk 📱

<p align="center">
  <a href="https://packagist.org/packages/dtyq/easy-dingtalk"><img src="https://img.shields.io/packagist/v/dtyq/easy-dingtalk.svg" alt="Latest Stable Version"></a>
  <a href="https://packagist.org/packages/dtyq/easy-dingtalk"><img src="https://img.shields.io/packagist/dt/dtyq/easy-dingtalk.svg" alt="Total Downloads"></a>
  <a href="https://github.com/lihq1403/easy-dingtalk/actions"><img src="https://github.com/lihq1403/easy-dingtalk/workflows/CI/badge.svg" alt="Build Status"></a>
</p>

Easy DingTalk è un SDK semplice e facile da usare per la piattaforma aperta DingTalk, supporta PHP 8.1+. Fornisce interfacce flessibili per interagire con la piattaforma aperta DingTalk, permettendo agli sviluppatori di costruire facilmente applicazioni DingTalk.

## ✨ Caratteristiche

- Supporta PHP 8.1+
- Sviluppato basato sugli standard PSR
- Supporta integrazione con framework Hyperf
- Meccanismo flessibile di assemblaggio richieste
- Test unitari completi
- Supporta le principali interfacce della piattaforma aperta DingTalk

## 📦 Installazione

```bash
composer require dtyq/easy-dingtalk -vvv
```

## 🚀 Avvio Rapido

### Uso Base

```php
use Dtyq\EasyDingTalk\OpenDevFactory;

$factory = new OpenDevFactory([
    'app_key' => 'your_app_key',
    'app_secret' => 'your_app_secret',
]);

// Ottieni token di accesso
$accessToken = $factory->getAccessToken();

// Usa altre interfacce...
```

### Integrazione Hyperf

Aggiungi in `config/autoload/dependencies.php`:

```php
return [
    Dtyq\EasyDingTalk\OpenDevFactory::class => function (ContainerInterface $container) {
        return new Dtyq\EasyDingTalk\OpenDevFactory([
            'app_key' => config('dingtalk.app_key'),
            'app_secret' => config('dingtalk.app_secret'),
        ]);
    },
];
```

## 🛠️ Sviluppo

### Eseguire Test

```bash
composer test
```

### Controllo Stile Codice

```bash
composer cs-fix
```

### Analisi Statica

```bash
composer analyse
```

## 🤝 Contributi

Benvenuti a sottomettere Pull Request o creare Issue.

## 📄 Licenza

MIT

---

# Easy DingTalk

<p align="center">
  <a href="https://packagist.org/packages/dtyq/easy-dingtalk"><img src="https://img.shields.io/packagist/v/dtyq/easy-dingtalk.svg" alt="Latest Stable Version"></a>
  <a href="https://packagist.org/packages/dtyq/easy-dingtalk"><img src="https://img.shields.io/packagist/dt/dtyq/easy-dingtalk.svg" alt="Total Downloads"></a>
  <a href="https://github.com/lihq1403/easy-dingtalk/actions"><img src="https://github.com/lihq1403/easy-dingtalk/workflows/CI/badge.svg" alt="Build Status"></a>
</p>

Easy DingTalk 是一个简单易用的钉钉开放平台 SDK，支持 PHP 8.1+。它提供了灵活的接口来与钉钉开放平台进行交互，让开发者能够轻松地构建钉钉应用。

## 特性

- 支持 PHP 8.1+
- 基于 PSR 标准开发
- 支持 Hyperf 框架集成
- 灵活的请求组装机制
- 完善的单元测试
- 支持钉钉开放平台主要接口

## 安装

```bash
composer require dtyq/easy-dingtalk -vvv
```

## 快速开始

### 基础使用

```php
use Dtyq\EasyDingTalk\OpenDevFactory;

$factory = new OpenDevFactory([
    'app_key' => 'your_app_key',
    'app_secret' => 'your_app_secret',
]);

// 获取访问令牌
$accessToken = $factory->getAccessToken();

// 使用其他接口...
```

### Hyperf 集成

在 `config/autoload/dependencies.php` 中添加：

```php
return [
    Dtyq\EasyDingTalk\OpenDevFactory::class => function (ContainerInterface $container) {
        return new Dtyq\EasyDingTalk\OpenDevFactory([
            'app_key' => config('dingtalk.app_key'),
            'app_secret' => config('dingtalk.app_secret'),
        ]);
    },
];
```

## 开发

### 运行测试

```bash
composer test
```

### 代码风格检查

```bash
composer cs-fix
```

### 静态分析

```bash
composer analyse
```

## 贡献

欢迎提交 Pull Request 或创建 Issue。

## 许可证

MIT