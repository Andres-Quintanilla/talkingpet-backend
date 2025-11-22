import {
  obtenerExpedienteCompleto,
  crearExpedienteInicial,
  obtenerVacunasMascota,
  registrarVacuna,
  actualizarVacuna,
  eliminarVacuna,
  obtenerConsultasMascota,
  registrarConsulta,
  obtenerMedicamentosActivos,
  registrarMedicamento,
  actualizarMedicamento,
  obtenerHistorialPeso,
  registrarPeso,
  obtenerAlergiasMascota,
  registrarAlergia,
  obtenerDocumentosMascota,
  subirDocumento,
  obtenerAlertasPendientes,
  crearAlerta,
  completarAlerta
} from '../services/medical-record.service.js';

export async function getExpedienteCompleto(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.rol;

    const resultado = await obtenerExpedienteCompleto(id);

    if (!resultado.exito) {
      return res.status(404).json({
        success: false,
        message: resultado.error
      });
    }

    const expediente = resultado.data;

    if (userRole !== 'admin' && expediente.mascota.usuario_id !== userId) {
      return res.status(403).json({
        success: false,
        message: 'No tienes permisos para ver este expediente'
      });
    }

    res.json({
      success: true,
      data: expediente
    });
  } catch (error) {
    console.error('Error obteniendo expediente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener expediente médico',
      error: error.message
    });
  }
}

export async function createExpedienteInicial(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const resultado = await crearExpedienteInicial(id, userId);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Expediente médico creado exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error creando expediente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear expediente médico',
      error: error.message
    });
  }
}

export async function getVacunas(req, res) {
  try {
    const { id } = req.params;
    const resultado = await obtenerVacunasMascota(id);

    if (!resultado.exito) {
      return res.status(404).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      data: resultado.data
    });
  } catch (error) {
    console.error('Error obteniendo vacunas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener vacunas',
      error: error.message
    });
  }
}

export async function addVacuna(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const datos = {
      mascotaId: id,
      ...req.body,
      creadoPor: userId
    };

    const resultado = await registrarVacuna(datos);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Vacuna registrada exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error registrando vacuna:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar vacuna',
      error: error.message
    });
  }
}

export async function updateVacuna(req, res) {
  try {
    const { vacunaId } = req.params;
    const resultado = await actualizarVacuna(vacunaId, req.body);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      message: 'Vacuna actualizada exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error actualizando vacuna:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar vacuna',
      error: error.message
    });
  }
}

export async function deleteVacuna(req, res) {
  try {
    const { vacunaId } = req.params;
    const resultado = await eliminarVacuna(vacunaId);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      message: 'Vacuna eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error eliminando vacuna:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar vacuna',
      error: error.message
    });
  }
}

export async function getConsultas(req, res) {
  try {
    const { id } = req.params;
    const resultado = await obtenerConsultasMascota(id);

    if (!resultado.exito) {
      return res.status(404).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      data: resultado.data
    });
  } catch (error) {
    console.error('Error obteniendo consultas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener consultas',
      error: error.message
    });
  }
}

export async function addConsulta(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const datos = {
      mascotaId: id,
      ...req.body,
      creadoPor: userId
    };

    const resultado = await registrarConsulta(datos);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Consulta registrada exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error registrando consulta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar consulta',
      error: error.message
    });
  }
}

export async function getMedicamentos(req, res) {
  try {
    const { id } = req.params;
    const resultado = await obtenerMedicamentosActivos(id);

    if (!resultado.exito) {
      return res.status(404).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      data: resultado.data
    });
  } catch (error) {
    console.error('Error obteniendo medicamentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener medicamentos',
      error: error.message
    });
  }
}

export async function addMedicamento(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const datos = {
      mascotaId: id,
      ...req.body,
      creadoPor: userId
    };

    const resultado = await registrarMedicamento(datos);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Medicamento registrado exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error registrando medicamento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar medicamento',
      error: error.message
    });
  }
}

export async function updateMedicamento(req, res) {
  try {
    const { medicamentoId } = req.params;
    const resultado = await actualizarMedicamento(medicamentoId, req.body);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      message: 'Medicamento actualizado exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error actualizando medicamento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar medicamento',
      error: error.message
    });
  }
}

export async function getPeso(req, res) {
  try {
    const { id } = req.params;
    const resultado = await obtenerHistorialPeso(id);

    if (!resultado.exito) {
      return res.status(404).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      data: resultado.data
    });
  } catch (error) {
    console.error('Error obteniendo historial de peso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de peso',
      error: error.message
    });
  }
}

export async function addPeso(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const datos = {
      mascotaId: id,
      ...req.body,
      creadoPor: userId
    };

    const resultado = await registrarPeso(datos);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Peso registrado exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error registrando peso:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar peso',
      error: error.message
    });
  }
}

export async function getAlergias(req, res) {
  try {
    const { id } = req.params;
    const resultado = await obtenerAlergiasMascota(id);

    if (!resultado.exito) {
      return res.status(404).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      data: resultado.data
    });
  } catch (error) {
    console.error('Error obteniendo alergias:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener alergias',
      error: error.message
    });
  }
}

export async function addAlergia(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const datos = {
      mascotaId: id,
      ...req.body,
      creadoPor: userId
    };

    const resultado = await registrarAlergia(datos);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Alergia registrada exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error registrando alergia:', error);
    res.status(500).json({
      success: false,
      message: 'Error al registrar alergia',
      error: error.message
    });
  }
}

export async function getDocumentos(req, res) {
  try {
    const { id } = req.params;
    const resultado = await obtenerDocumentosMascota(id);

    if (!resultado.exito) {
      return res.status(404).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      data: resultado.data
    });
  } catch (error) {
    console.error('Error obteniendo documentos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener documentos',
      error: error.message
    });
  }
}


export async function addDocumento(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se ha subido ningún archivo'
      });
    }

    const datos = {
      mascotaId: id,
      tipo: req.body.tipo || 'certificado',
      titulo: req.body.titulo,
      descripcion: req.body.descripcion,
      archivoUrl: `/uploads/${req.file.filename}`,
      archivoNombre: req.file.originalname,
      archivoTipo: req.file.mimetype,
      archivoTamano: req.file.size,
      creadoPor: userId
    };

    const resultado = await subirDocumento(datos);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Documento subido exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error subiendo documento:', error);
    res.status(500).json({
      success: false,
      message: 'Error al subir documento',
      error: error.message
    });
  }
}

export async function getAlertas(req, res) {
  try {
    const { id } = req.params;
    const resultado = await obtenerAlertasPendientes(id);

    if (!resultado.exito) {
      return res.status(404).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      data: resultado.data
    });
  } catch (error) {
    console.error('Error obteniendo alertas:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener alertas',
      error: error.message
    });
  }
}

export async function addAlerta(req, res) {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const datos = {
      mascotaId: id,
      ...req.body,
      creadoPor: userId
    };

    const resultado = await crearAlerta(datos);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.status(201).json({
      success: true,
      message: 'Alerta creada exitosamente',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error creando alerta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear alerta',
      error: error.message
    });
  }
}

export async function completeAlerta(req, res) {
  try {
    const { alertaId } = req.params;
    const resultado = await completarAlerta(alertaId);

    if (!resultado.exito) {
      return res.status(400).json({
        success: false,
        message: resultado.error
      });
    }

    res.json({
      success: true,
      message: 'Alerta marcada como completada',
      data: resultado.data
    });
  } catch (error) {
    console.error('Error completando alerta:', error);
    res.status(500).json({
      success: false,
      message: 'Error al completar alerta',
      error: error.message
    });
  }
}
