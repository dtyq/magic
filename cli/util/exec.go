package util

import (
	"context"
	"fmt"
	"io"
	"os/exec"
	"syscall"
	"time"

	"github.com/apparentlymart/go-shquot/shquot"
	"github.com/dtyq/magicrew-cli/i18n"
)

type Command struct {
	DryRun bool

	Args       []string
	Env        map[string]string
	Dir        string
	Stdout     io.Writer
	Stderr     io.Writer
	StopSignal syscall.Signal
	WaitDelay  time.Duration

	cmd *exec.Cmd
}

func (c *Command) prepareCommand(ctx context.Context) {
	cmd := exec.CommandContext(ctx, c.Args[0], c.Args[1:]...)
	for key, value := range c.Env {
		cmd.Env = append(cmd.Env, fmt.Sprintf("%s=%s", key, value))
	}
	cmd.Dir = c.Dir
	cmd.Stdout = c.Stdout
	cmd.Stderr = c.Stderr
	if c.WaitDelay > 0 {
		cmd.Cancel = func() error {
			// try sigterm first
			return cmd.Process.Signal(c.StopSignal)
		}
		cmd.WaitDelay = c.WaitDelay
	}
	c.cmd = cmd
}

func (c *Command) logCommand(ctx context.Context) {
	loggerGroup, ok := ctx.Value(ContextTypeLoggerGroup{}).(LoggerGroup)
	if ok {
		// maybe TODO: support other shell types
		quoted := shquot.POSIXShell(c.cmd.Args)
		loggerGroup.Logd("exec", "%s", i18n.L("runningCommand", quoted))
	}
}

func (c *Command) Run(ctx context.Context) error {
	c.prepareCommand(ctx)
	c.logCommand(ctx)
	if c.DryRun {
		return nil
	}
	return c.cmd.Run()
}

func (c *Command) Start(ctx context.Context) error {
	c.prepareCommand(ctx)
	c.logCommand(ctx)
	if c.DryRun {
		return nil
	}
	return c.cmd.Start()
}

func (c *Command) Wait(ctx context.Context) error {
	if c.DryRun {
		return nil
	}
	if c.cmd == nil {
		return fmt.Errorf("command not started")
	}
	return c.cmd.Wait()
}
