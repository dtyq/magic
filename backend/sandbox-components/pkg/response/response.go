package response

import (
	"net/http"

	"github.com/gin-gonic/gin"
	apierrors "k8s.io/apimachinery/pkg/api/errors"
)

const (
	CodeSuccess         = 1000
	CodeFailure         = 2000
	CodeNotFound        = 4004
	CodeVersionConflict = 4009
)

type Response struct {
	Code    int         `json:"code"`    // Status code, 1000 means success, 2000 means failure
	Message string      `json:"message"` // Status message
	Data    interface{} `json:"data"`    // Response data
}

func NewSuccessResponse(message string, data interface{}) *Response {
	return &Response{
		Code:    CodeSuccess,
		Message: message,
		Data:    data,
	}
}

func NewErrorResponse(message string, err error) *Response {
	response := &Response{
		Code:    CodeFailure,
		Message: message,
		Data:    nil,
	}

	if err != nil {
		if apierrors.IsNotFound(err) {
			response.Code = CodeNotFound
			response.Message = err.Error()
		} else if apierrors.IsConflict(err) {
			response.Code = CodeVersionConflict
			response.Message = err.Error()
		} else {
			response.Code = CodeFailure
			response.Message = err.Error()
		}
	}

	return response
}

func ResponseJSON(c *gin.Context, httpStatus int, resp *Response) {
	c.JSON(httpStatus, resp)
}

func SuccessResponse(c *gin.Context, message string, data interface{}) {
	ResponseJSON(c, http.StatusOK, NewSuccessResponse(message, data))
}

func ErrorResponse(c *gin.Context, message string, err error) {
	ResponseJSON(c, http.StatusOK, NewErrorResponse(message, err))
}
