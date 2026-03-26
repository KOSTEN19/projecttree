package handlers

import (
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"project-drevo/internal/db"
	"project-drevo/internal/middleware"
	"project-drevo/internal/models"

	"github.com/gin-gonic/gin"
	"go.mongodb.org/mongo-driver/v2/bson"
)

const maxPhotoBytes = 5 << 20

var allowedPhotoTypes = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

func uploadDir() string {
	if d := strings.TrimSpace(os.Getenv("UPLOAD_DIR")); d != "" {
		return d
	}
	return filepath.Join("data", "uploads")
}

// UploadPersonPhoto multipart field "file"; сохраняет файл и выставляет person.photoUrl.
func UploadPersonPhoto(c *gin.Context) {
	personIDHex := c.Param("id")
	personOID, err := bson.ObjectIDFromHex(personIDHex)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_id"})
		return
	}

	ctx := reqCtx(c)
	uid, ok := userOID(c)
	if !ok {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "not_authorized"})
		return
	}

	var existing models.Person
	if err := db.Persons.FindOne(ctx, bson.M{"_id": personOID, "userId": uid}).Decode(&existing); err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	fh, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "no_file"})
		return
	}
	if fh.Size > maxPhotoBytes {
		c.JSON(http.StatusBadRequest, gin.H{"error": "file_too_large"})
		return
	}

	src, err := fh.Open()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_file"})
		return
	}
	defer src.Close()

	buf := make([]byte, 512)
	n, err := src.Read(buf)
	if err != nil && err != io.EOF {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_file"})
		return
	}
	mime := http.DetectContentType(buf[:n])
	ext, ok := allowedPhotoTypes[mime]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{"error": "unsupported_type"})
		return
	}
	if _, err := src.Seek(0, 0); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	userHex := middleware.GetUserID(c)
	dir := filepath.Join(uploadDir(), userHex)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	fname := personIDHex + ext
	fpath := filepath.Join(dir, fname)

	dst, err := os.Create(fpath)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}
	defer dst.Close()

	if _, err := io.Copy(dst, src); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "server_error"})
		return
	}

	photoURL := fmt.Sprintf("/api/files/%s/%s", userHex, fname)
	now := time.Now()
	_, _ = db.Persons.UpdateOne(ctx, bson.M{"_id": personOID, "userId": uid}, bson.M{
		"$set": bson.M{"photoUrl": photoURL, "updatedAt": now},
	})

	var updated models.Person
	_ = db.Persons.FindOne(ctx, bson.M{"_id": personOID, "userId": uid}).Decode(&updated)
	c.JSON(http.StatusOK, updated.ToClient())
}

// ServePersonPhoto отдаёт загруженный файл; доступ только владельцу userId в пути.
func ServePersonPhoto(c *gin.Context) {
	userHex := c.Param("userId")
	fname := c.Param("filename")
	if userHex == "" || fname == "" || strings.Contains(fname, "..") || strings.Contains(fname, string(os.PathSeparator)) {
		c.JSON(http.StatusBadRequest, gin.H{"error": "bad_path"})
		return
	}
	if middleware.GetUserID(c) != userHex {
		c.JSON(http.StatusForbidden, gin.H{"error": "forbidden"})
		return
	}

	fpath := filepath.Join(uploadDir(), userHex, fname)
	st, err := os.Stat(fpath)
	if err != nil || st.IsDir() {
		c.JSON(http.StatusNotFound, gin.H{"error": "not_found"})
		return
	}

	c.File(fpath)
}
