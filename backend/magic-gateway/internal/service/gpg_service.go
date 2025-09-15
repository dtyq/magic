package service

import (
	"fmt"
	"strings"

	"github.com/ProtonMail/gopenpgp/v2/crypto"
)

// GPGService handles GPG signing operations
type GPGService struct {
	privateKey *crypto.Key
}

// NewGPGService creates a new GPG service instance
func NewGPGService(privateKeyArmored string) (*GPGService, error) {
	// Validate private key format
	if !strings.Contains(privateKeyArmored, "-----BEGIN PGP PRIVATE KEY-----") {
		return nil, fmt.Errorf("invalid private key format: missing PGP header")
	}

	// Parse private key
	privateKey, err := crypto.NewKeyFromArmored(privateKeyArmored)
	if err != nil {
		return nil, fmt.Errorf("failed to parse private key: %w", err)
	}

	// Check if key is locked and needs to be unlocked
	locked, err := privateKey.IsLocked()
	if err != nil {
		return nil, fmt.Errorf("failed to check key lock status: %w", err)
	}
	if locked {
		// For now, assume unlocked keys. In production, you might need password handling
		return nil, fmt.Errorf("private key is locked and requires a password")
	}

	return &GPGService{
		privateKey: privateKey,
	}, nil
}

// SignData signs the given data and returns an armored signature
func (s *GPGService) SignData(data string) (string, error) {
	if s.privateKey == nil {
		return "", fmt.Errorf("private key not initialized")
	}

	// Create signing key ring
	signingKeyRing, err := crypto.NewKeyRing(s.privateKey)
	if err != nil {
		return "", fmt.Errorf("failed to create signing key ring: %w", err)
	}

	// Sign the data (detached signature)
	signature, err := signingKeyRing.SignDetached(crypto.NewPlainMessage([]byte(data)))
	if err != nil {
		return "", fmt.Errorf("failed to sign data: %w", err)
	}

	// Return armored signature
	armoredSignature, err := signature.GetArmored()
	if err != nil {
		return "", fmt.Errorf("failed to armor signature: %w", err)
	}

	return armoredSignature, nil
}
