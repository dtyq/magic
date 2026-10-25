# 数据隔离与延迟授权测试

使用独立配置执行，不启动应用，不连接数据库或真实沙箱：

```bash
vendor/bin/phpunit -c phpunit.data-isolation.xml
```

在 `backend/magic-service` 中执行。依赖位于隔离验证目录时，可设置 `MAGIC_UNIT_AUTOLOAD` 指向该目录的 `vendor/autoload.php`，并使用该目录的 `vendor/bin/phpunit`。bootstrap 优先加载当前 worktree 的源码。

本套件不会被 `phpunit.unit.xml` 或默认 `phpunit.xml` 自动发现。CI 或验证脚本需要显式执行上面的命令；不要以只运行共享配置作为本套件已通过的证据。
