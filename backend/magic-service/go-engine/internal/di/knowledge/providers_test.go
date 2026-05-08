package knowledge_test

import (
	"testing"
	"time"

	documentapp "magic/internal/application/knowledge/document/service"
	autoloadcfg "magic/internal/config/autoload"
	knowledge "magic/internal/di/knowledge"
	documentdomain "magic/internal/domain/knowledge/document/service"
	embeddingdomain "magic/internal/domain/knowledge/embedding"
	fragmentdomain "magic/internal/domain/knowledge/fragment/service"
	knowledgebasedomain "magic/internal/domain/knowledge/knowledgebase/service"
	"magic/internal/infrastructure/logging"
	ipcclient "magic/internal/infrastructure/rpc/jsonrpc/client"
	lockpkg "magic/internal/pkg/lock"
)

func TestProvideEmbeddingCacheCleanupServiceAppliesConfig(t *testing.T) {
	t.Parallel()

	svc, err := knowledge.ProvideEmbeddingCacheCleanupService(
		&embeddingdomain.DomainService{},
		autoloadcfg.EmbeddingCacheCleanupConfig{
			AutoCleanupEnabled:    false,
			CleanupIntervalHours:  12,
			CleanupTimeoutMinutes: 5,
			MinAccessCount:        3,
			MaxIdleDurationHours:  48,
			MaxCacheAgeHours:      120,
			BatchSize:             77,
		},
		lockpkg.NewLocalSinglePodJobRunner(),
		logging.New(),
	)
	if err != nil {
		t.Fatalf("provide cleanup service: %v", err)
	}

	cfg := svc.GetCleanupConfig()
	if cfg.CleanupInterval != 12*time.Hour || cfg.CleanupTimeout != 5*time.Minute {
		t.Fatalf("unexpected cleanup timing config: %#v", cfg)
	}
	if cfg.AutoCleanupEnabled {
		t.Fatal("expected auto cleanup disabled")
	}
	if cfg.CleanupCriteria.MinAccessCount != 3 || cfg.CleanupCriteria.BatchSize != 77 {
		t.Fatalf("unexpected cleanup criteria: %#v", cfg.CleanupCriteria)
	}
	if cfg.CleanupCriteria.MaxIdleDuration != 48*time.Hour || cfg.CleanupCriteria.MaxCacheAge != 120*time.Hour {
		t.Fatalf("unexpected cleanup durations: %#v", cfg.CleanupCriteria)
	}
}

func TestProvideServices(t *testing.T) {
	t.Parallel()

	logger := logging.New()

	kbSvc := knowledge.ProvideKnowledgeBaseAppService(
		&knowledgebasedomain.DomainService{},
		knowledge.ProvideKnowledgeBaseDocumentFlowDeps(
			&documentapp.DocumentAppService{},
			&documentdomain.DomainService{},
			&fragmentdomain.FragmentDomainService{},
			&documentdomain.ParseService{},
		),
		knowledge.BaseDeps{},
		nil,
		logger,
		autoloadcfg.EmbeddingDefaultModel("model-kb"),
	)
	if kbSvc == nil {
		t.Fatal("expected knowledge base app service")
	}

	fragmentSvc := knowledge.ProvideFragmentAppService(
		&fragmentdomain.FragmentDomainService{},
		&knowledgebasedomain.DomainService{},
		&documentdomain.DomainService{},
		knowledge.ProvideFragmentAppDeps(
			&documentdomain.ParseService{},
			knowledge.BasePortDeps{},
			knowledge.ProvideThirdPlatformProviderRegistry((*ipcclient.PHPThirdPlatformDocumentRPCClient)(nil), logger),
			knowledge.BaseBindingDeps{},
			knowledge.ProvideFragmentAppRuntimeDeps(
				nil,
				nil,
				autoloadcfg.EmbeddingDefaultModel("model-frag"),
			),
			nil,
		),
		nil,
		logger,
	)
	if fragmentSvc == nil {
		t.Fatal("expected fragment app service")
	}

	embeddingSvc := knowledge.ProvideEmbeddingAppService(&embeddingdomain.DomainService{}, logger, autoloadcfg.EmbeddingDefaultModel("model-embed"))
	if embeddingSvc == nil {
		t.Fatal("expected embedding app service")
	}

	documentSvc := knowledge.ProvideDocumentAppService(
		&documentdomain.DomainService{},
		&knowledgebasedomain.DomainService{},
		&fragmentdomain.FragmentDomainService{},
		knowledge.ProvideDocumentAppDeps(
			&documentdomain.ParseService{},
			knowledge.BasePortDeps{},
			knowledge.ProvideThirdPlatformProviderRegistry((*ipcclient.PHPThirdPlatformDocumentRPCClient)(nil), logger),
			nil,
			nil,
			nil,
		),
		logger,
		knowledge.DocumentAppRuntimeDeps{},
	)
	if documentSvc == nil {
		t.Fatal("expected document app service")
	}
}
