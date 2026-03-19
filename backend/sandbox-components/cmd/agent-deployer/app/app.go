package app

import (
	"context"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/sirupsen/logrus"
	"github.com/spf13/cobra"

	agentdeployer "github.com/dtyq/sandbox-components/pkg/agent-deployer"
)

func NewAgentDeployerCommand(sigCh <-chan os.Signal) *cobra.Command {
	rootCmd := &cobra.Command{
		Use:          "agent-deployer",
		Short:        "Sandbox Components Agent Deployer",
		Long:         `Agent Deployer for sandbox components, creating or updating agent DaemonSets. Runs as a long-lived service.`,
		SilenceUsage: true,
		RunE: func(cmd *cobra.Command, args []string) error {
			return Run(sigCh)
		},
	}

	return rootCmd
}

func Run(sigCh <-chan os.Signal) error {
	logrus.Info("Starting Agent Deployer")

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGTERM, syscall.SIGINT)
	defer stop()

	_, err := RunAgentDeployer()
	if err != nil {
		logrus.Errorf("Failed to run Agent Deployer: %v", err)
		return err
	}

	logrus.Info("Agent deployment completed successfully")

	<-ctx.Done()
	logrus.Info("Received shutdown signal, exiting...")

	return nil
}

func RunAgentDeployer() (*agentdeployer.AgentDeployer, error) {
	deployer, err := agentdeployer.NewAgentDeployer()
	if err != nil {
		logrus.Errorf("Failed to create Agent Deployer: %v", err)
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()

	if err := deployer.Deploy(ctx); err != nil {
		logrus.Errorf("Failed to deploy agent: %v", err)
		return nil, err
	}

	cfg := deployer.GetConfig()
	logrus.Infof("Agent deployed successfully: %s in namespace %s",
		cfg.GetFullImageName(), cfg.AgentNamespace)
	return deployer, nil
}

func Execute(sigCh <-chan os.Signal) error {
	return NewAgentDeployerCommand(sigCh).Execute()
}
