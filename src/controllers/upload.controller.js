export async function uploadOne(req, res) {
    const url = `/uploads/${req.file.filename}`;
    res.status(201).json({ url });
}
