package handler

import (
	"encoding/json"
	"log"
	"net/http"

	"api-gateway/internal/model"
)

// UserHandler handles user info operations
type UserHandler struct {
	logger *log.Logger
}

// NewUserHandler creates a new user handler
func NewUserHandler(logger *log.Logger) *UserHandler {
	return &UserHandler{
		logger: logger,
	}
}

// GetUserInfo handles user info requests
func (h *UserHandler) GetUserInfo(w http.ResponseWriter, r *http.Request) {
	// Set response headers
	w.Header().Set("Content-Type", "application/json")

	// Only allow GET method
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	// Get user information from withAuth middleware
	// The withAuth middleware sets these headers after JWT validation
	userID := r.Header.Get("magic-user-id")
	orgCode := r.Header.Get("magic-organization-code")

	h.logger.Printf("User info request from user: %s, organization: %s", userID, orgCode)

	// Return user information
	response := model.UserInfoResponse{
		UserID:           userID,
		OrganizationCode: orgCode,
	}

	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}
