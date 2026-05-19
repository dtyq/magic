package dto

import (
	"encoding/json"
	"fmt"
)

const (
	agentCodeField  = "agent_code"
	agentCodesField = "agent_codes"
)

func unmarshalWithAgentCodesCompat(data []byte, target any, setAgentCodes func([]string)) error {
	if err := json.Unmarshal(data, target); err != nil {
		return fmt.Errorf("unmarshal request: %w", err)
	}

	agentCode, ok, err := resolveLegacyAgentCode(data)
	if err != nil {
		return err
	}
	if ok {
		setAgentCodes([]string{agentCode})
	}
	return nil
}

func resolveLegacyAgentCode(data []byte) (string, bool, error) {
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		return "", false, fmt.Errorf("unmarshal request fields: %w", err)
	}
	if _, ok := fields[agentCodesField]; ok {
		return "", false, nil
	}

	rawAgentCode, ok := fields[agentCodeField]
	if !ok {
		return "", false, nil
	}

	var agentCode string
	if err := json.Unmarshal(rawAgentCode, &agentCode); err != nil {
		return "", false, fmt.Errorf("unmarshal agent_code: %w", err)
	}
	return agentCode, true, nil
}
