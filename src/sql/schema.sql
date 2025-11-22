-- ENUMERACIONES DEL SISTEMA
CREATE TYPE rol_usuario AS ENUM ('cliente','admin','empleado_peluquero','empleado_veterinario','empleado_adiestrador');
CREATE TYPE genero_mascota AS ENUM ('macho','hembra');
CREATE TYPE tipo_servicio AS ENUM ('baño','peluqueria','veterinaria','adiestramiento');
CREATE TYPE modalidad_servicio AS ENUM ('local','domicilio','retiro_entrega');
CREATE TYPE estado_cita AS ENUM ('pendiente','confirmada','cancelada','realizada','no_asistio');
CREATE TYPE estado_pedido AS ENUM ('pendiente','pagado','en_proceso','enviado','entregado','cancelado');
CREATE TYPE estado_pago AS ENUM ('pendiente','autorizado','pagado','fallido','reembolsado');
CREATE TYPE metodo_pago AS ENUM ('tarjeta','efectivo','qr','billetera');
CREATE TYPE estado_envio AS ENUM ('pendiente','en_camino','entregado','fallido');
CREATE TYPE tipo_archivo AS ENUM ('imagen','video','pdf');
CREATE TYPE estado_curso AS ENUM ('borrador','publicado','archivado');

-- TABLA USUARIO
CREATE TABLE usuario (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  email VARCHAR(100) NOT NULL UNIQUE,
  telefono VARCHAR(20),
  contrasena TEXT NOT NULL,
  rol rol_usuario NOT NULL DEFAULT 'cliente',
  direccion TEXT,
  fecha_registro TIMESTAMP DEFAULT NOW(),
  activo BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_usuario_email ON usuario (email);

-- TABLA MASCOTA
CREATE TABLE mascota (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  especie VARCHAR(50) NOT NULL,
  raza VARCHAR(50),
  edad INT,
  genero genero_mascota,
  usuario_id INT REFERENCES usuario(id) ON DELETE CASCADE
);
CREATE INDEX idx_mascota_usuario ON mascota(usuario_id);

-- TABLA PRODUCTO
CREATE TABLE producto (
  id SERIAL PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  descripcion TEXT,
  categoria VARCHAR(50),
  precio DECIMAL(10,2) NOT NULL,
  stock INT DEFAULT 0,
  imagen_url TEXT,
  activo BOOLEAN DEFAULT TRUE
);
CREATE INDEX idx_producto_categoria ON producto(categoria);
CREATE INDEX idx_producto_activo ON producto(activo);

-- TABLA CARRITO
CREATE TABLE carrito (
  id SERIAL PRIMARY KEY,
  usuario_id INT REFERENCES usuario(id) ON DELETE CASCADE,
  creado_en TIMESTAMP DEFAULT NOW()
);
CREATE UNIQUE INDEX ux_carrito_usuario ON carrito(usuario_id);

-- ÍTEMS DEL CARRITO
CREATE TABLE carrito_item (
  id SERIAL PRIMARY KEY,
  carrito_id INT REFERENCES carrito(id) ON DELETE CASCADE,
  producto_id INT REFERENCES producto(id),
  cantidad INT DEFAULT 1 CHECK (cantidad > 0),
  precio_unitario DECIMAL(10,2) NOT NULL,
  subtotal DECIMAL(10,2) GENERATED ALWAYS AS (cantidad * precio_unitario) STORED,
  UNIQUE (carrito_id, producto_id)
);
CREATE INDEX idx_carrito_item_carrito ON carrito_item(carrito_id);

-- TABLA PEDIDO
CREATE TABLE pedido (
  id SERIAL PRIMARY KEY,
  usuario_id INT REFERENCES usuario(id) ON DELETE SET NULL,
  total DECIMAL(10,2) NOT NULL,
  estado estado_pedido DEFAULT 'pendiente',
  fecha_pedido TIMESTAMP DEFAULT NOW(),
  direccion_envio TEXT
);
CREATE INDEX idx_pedido_usuario ON pedido(usuario_id);
CREATE INDEX idx_pedido_estado  ON pedido(estado);

-- TABLA PAGO
CREATE TABLE pago (
  id SERIAL PRIMARY KEY,
  pedido_id INT REFERENCES pedido(id) ON DELETE CASCADE,
  monto DECIMAL(10,2) NOT NULL,
  metodo metodo_pago NOT NULL,
  estado estado_pago DEFAULT 'pendiente',
  fecha_pago TIMESTAMP DEFAULT NOW(),
  referencia VARCHAR(100)
);
CREATE INDEX idx_pago_pedido ON pago(pedido_id);

-- TABLA DIRECCION
CREATE TABLE direccion (
  id SERIAL PRIMARY KEY,
  usuario_id INT REFERENCES usuario(id) ON DELETE CASCADE,
  etiqueta VARCHAR(50),
  calle VARCHAR(120),
  numero VARCHAR(20),
  zona_barrio VARCHAR(120),
  ciudad VARCHAR(80) DEFAULT 'Santa Cruz',
  referencias TEXT,
  telefono_alt VARCHAR(30),
  foto_referencia TEXT,
  latitud DECIMAL(10,8),
  longitud DECIMAL(11,8),
  es_predeterminada BOOLEAN DEFAULT FALSE,
  creado_en TIMESTAMP DEFAULT NOW()
);
CREATE INDEX idx_direccion_usuario ON direccion(usuario_id);

-- TABLA ENVÍO
CREATE TABLE envio (
  id SERIAL PRIMARY KEY,
  pedido_id INT REFERENCES pedido(id) ON DELETE CASCADE,
  direccion_entrega TEXT NOT NULL,
  estado estado_envio DEFAULT 'pendiente',
  fecha_envio TIMESTAMP,
  fecha_entrega TIMESTAMP,
  lat DECIMAL(10,7),
  lng DECIMAL(10,7),
  detalles TEXT,
  direccion_id INT REFERENCES direccion(id),
  distancia_km DECIMAL(6,2),
  tarifa_envio DECIMAL(10,2),
  prueba_entrega_foto TEXT,
  prueba_entrega_otp VARCHAR(6)
);
CREATE INDEX idx_envio_pedido ON envio(pedido_id);
CREATE INDEX idx_envio_estado ON envio(estado);

-- TABLA SERVICIO
CREATE TABLE servicio (
  id SERIAL PRIMARY KEY,
  tipo tipo_servicio NOT NULL,
  descripcion TEXT,
  precio_base DECIMAL(10,2) NOT NULL,
  duracion_minutos INT DEFAULT 60
);
CREATE INDEX idx_servicio_tipo ON servicio(tipo);

-- TABLA CITA
CREATE TABLE cita (
  id SERIAL PRIMARY KEY,
  usuario_id INT REFERENCES usuario(id) ON DELETE SET NULL,
  mascota_id INT REFERENCES mascota(id) ON DELETE SET NULL,
  servicio_id INT REFERENCES servicio(id) ON DELETE SET NULL,
  empleado_id INT REFERENCES usuario(id) ON DELETE SET NULL,
  modalidad modalidad_servicio,
  estado estado_cita DEFAULT 'pendiente',
  fecha DATE NOT NULL,
  hora TIME NOT NULL,
  comentarios TEXT
);
CREATE INDEX idx_cita_usuario ON cita(usuario_id);
CREATE INDEX idx_cita_empleado ON cita(empleado_id);
CREATE INDEX idx_cita_fecha_hora ON cita(fecha, hora);
CREATE INDEX idx_cita_estado ON cita(estado);

-- TABLA CURSO
CREATE TABLE curso (
  id SERIAL PRIMARY KEY,
  titulo VARCHAR(100) NOT NULL,
  descripcion TEXT,
  estado estado_curso DEFAULT 'borrador',
  precio DECIMAL(10,2),
  fecha_publicacion TIMESTAMP,
  instructor_id INT REFERENCES usuario(id)
);
CREATE INDEX idx_curso_estado ON curso(estado);

-- TABLA CONTENIDO DEL CURSO
CREATE TABLE curso_contenido (
  id SERIAL PRIMARY KEY,
  curso_id INT REFERENCES curso(id) ON DELETE CASCADE,
  tipo tipo_archivo,
  titulo VARCHAR(100),
  url TEXT,
  duracion_minutos INT
);
CREATE INDEX idx_contenido_curso ON curso_contenido(curso_id);

-- TABLA INSCRIPCIÓN A CURSO
CREATE TABLE inscripcion_curso (
  id SERIAL PRIMARY KEY,
  usuario_id INT REFERENCES usuario(id) ON DELETE CASCADE,
  curso_id INT REFERENCES curso(id) ON DELETE CASCADE,
  fecha_inscripcion TIMESTAMP DEFAULT NOW(),
  progreso DECIMAL(5,2) DEFAULT 0.0,
  UNIQUE (usuario_id, curso_id)
);
CREATE INDEX idx_inscripcion_usuario ON inscripcion_curso(usuario_id);

-- TABLA ARCHIVO
CREATE TABLE archivo (
  id SERIAL PRIMARY KEY,
  tipo tipo_archivo,
  nombre VARCHAR(150),
  url TEXT,
  relacionado_con VARCHAR(50),
  id_relacionado INT,
  subido_en TIMESTAMP DEFAULT NOW()
);
