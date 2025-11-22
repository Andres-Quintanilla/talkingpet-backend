-- Usuarios de prueba
INSERT INTO usuario (nombre, email, telefono, contrasena, rol)
VALUES
('Admin', 'admin@talkingpet.com', '+59170000001', '$2b$10$9e4aCqf7zM3qXjUX7h1hUu1yXRqkOQ0f0j5lqz8I7xJvBqvXwXw7K', 'admin'),
('Empleado Vet', 'vet@talkingpet.com', '+59170000002', '$2b$10$9e4aCqf7zM3qXjUX7h1hUu1yXRqkOQ0f0j5lqz8I7xJvBqvXwXw7K', 'empleado_veterinario'),
('Cliente Demo', 'cliente@talkingpet.com', '+59170000003', '$2b$10$9e4aCqf7zM3qXjUX7h1hUu1yXRqkOQ0f0j5lqz8I7xJvBqvXwXw7K', 'cliente');

-- Productos
INSERT INTO producto (nombre, descripcion, categoria, precio, stock, imagen_url)
VALUES
('Alimento Premium Perros 15kg','Nutrición completa','alimentos',250,42,'/static/products/alimento-premium-1.webp'),
('Juguete Interactivo','Estimulación mental','accesorios',85,12,'/static/products/juguete-1.webp'),
('Snacks Naturales Salmón','Snacks saludables','snacks',55,24,'/static/products/snack-salmon-1.webp'),
('Cama Ortopédica Memory Foam','Descanso superior','camas-collares',320,5,'/static/products/cama-1.webp');

-- Servicios
INSERT INTO servicio (tipo, descripcion, precio_base, duracion_minutos)
VALUES
('baño','Baño completo y secado',80,60),
('peluqueria','Corte de raza / estilismo',120,90),
('veterinaria','Consulta general y vacunas',150,30),
('adiestramiento','Sesiones personalizadas',200,60);

-- Cursos
INSERT INTO curso (titulo, descripcion, estado, precio, fecha_publicacion, instructor_id)
VALUES
('Tapete con Botones - Básico','Configura tu tapete y primeras palabras','publicado',120,NOW(),1),
('Tapete con Botones - Intermedio','Frases cortas y refuerzos','publicado',180,NOW(),1),
('Tapete con Botones - Avanzado','Conversaciones guiadas','publicado',250,NOW(),1);
