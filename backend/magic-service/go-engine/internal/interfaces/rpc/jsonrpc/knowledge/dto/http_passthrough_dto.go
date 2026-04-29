package dto

// HTTPPassthroughResponse 承载已编码好的最终 HTTP 响应元数据和 body。
type HTTPPassthroughResponse struct {
	StatusCode      int    `json:"status_code"`
	ContentType     string `json:"content_type"`
	ContentEncoding string `json:"content_encoding"`
	Vary            string `json:"vary"`
	BodyBase64      string `json:"body_base64"`
	BodyBytes       int    `json:"body_bytes"`
}
