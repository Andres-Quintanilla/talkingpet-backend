// src/controllers/upload.controller.js
export async function uploadOne(req, res, next) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ error: 'No se recibió ningún archivo en el campo "file".' });
    }

    // OJO: en index.js sirves /uploads desde la carpeta raíz del proyecto
    // app.use("/uploads", express.static(path.join(__dirname, "..", "uploads")));
    const url = `/uploads/${req.file.filename}`;

    res.status(201).json({
      url,                        // ruta relativa que sirve el backend
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      mimetype: req.file.mimetype,
    });
  } catch (err) {
    next(err);
  }
}
