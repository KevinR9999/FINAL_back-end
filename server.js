const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const path = require('path');
const bcrypt = require('bcrypt');
require('dotenv').config();

const app = express();
const port = 3000;
const SALT_ROUNDS = 10;

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASS,
  port: process.env.DB_PORT,
});

// Registro de usuario
app.post('/api/registro', async (req, res) => {
  const { nombre, email, password, rol } = req.body;

  if (!/^[0-9]{10}$/.test(password)) {
    return res.status(400).json({ error: 'La contraseña debe tener exactamente 10 dígitos numéricos' });
  }

  try {
    const correoExistente = await pool.query(
      'SELECT 1 FROM registro WHERE correo_electronico = $1',
      [email]
    );

    if (correoExistente.rows.length > 0) {
      return res.status(409).json({ error: 'El correo ya está registrado' });
    }

    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
    const nuevoUsuario = await pool.query(
      'INSERT INTO registro (nombre_completo, correo_electronico, contraseña, rol) VALUES ($1, $2, $3, $4) RETURNING correo_electronico, rol',
      [nombre, email, hashedPassword, rol]
    );

    res.status(201).json(nuevoUsuario.rows[0]);
  } catch (error) {
    console.error('Error al registrar:', error);
    res.status(500).json({ error: 'Error al registrar usuario' });
  }
});

// Login de usuario
app.post('/api/login', async (req, res) => {
  const { correo_electronico, contraseña } = req.body;

  try {
    const resultado = await pool.query(
      'SELECT correo_electronico, contraseña, rol FROM registro WHERE correo_electronico = $1',
      [correo_electronico]
    );

    if (resultado.rows.length === 0) {
      return res.status(401).json({ mensaje: 'Correo no encontrado' });
    }

    const usuario = resultado.rows[0];
    const contraseñaValida = await bcrypt.compare(contraseña, usuario.contraseña);

    if (!contraseñaValida) {
      return res.status(401).json({ mensaje: 'Contraseña incorrecta' });
    }

    let datos_clinicos = null;
    let datos_cita = [];

    if (usuario.rol === 'paciente') {
      const historia = await pool.query(
        'SELECT nombre, edad, documento, diagnostico, historial, fecha FROM historias_clinicas WHERE documento = $1 LIMIT 1',
        [contraseña]
      );
      const citas = await pool.query(
        'SELECT id, fecha, hora, motivo FROM citas_medicas WHERE no_documento = $1 ORDER BY fecha, hora',
        [contraseña]
      );

      datos_clinicos = historia.rows[0] || null;
      datos_cita = citas.rows;
    }

    res.status(200).json({
      mensaje: 'Login exitoso',
      usuario: {
        correo: usuario.correo_electronico,
        rol: usuario.rol,
        documento: usuario.rol === 'paciente' ? contraseña : null,
        datos_clinicos,
        datos_cita
      }
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ mensaje: 'Error en el servidor' });
  }
});

// Alta médica
app.post('/api/alta', async (req, res) => {
  const { nombre, edad, fecha, documento, diagnostico, tratamiento, indicaciones } = req.body;

  try {
    await pool.query(
      `INSERT INTO alta_pacientes (nombre_paciente, edad, fecha, documento_identidad, diagnostico, tratamiento_recomendado, indicaciones_post_alta)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [nombre, edad, fecha, documento, diagnostico, tratamiento, indicaciones]
    );
    res.status(200).json({ mensaje: 'Alta registrada exitosamente' });
  } catch (error) {
    console.error('Error al registrar alta médica:', error);
    res.status(500).json({ error: 'Error al registrar la información médica' });
  }
});

// Obtener todas las altas médicas
app.get('/api/altas', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT nombre_paciente AS nombre, fecha, documento_identidad, diagnostico, tratamiento_recomendado, indicaciones_post_alta
      FROM alta_pacientes
      ORDER BY fecha DESC
    `);
    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener altas médicas:', error);
    res.status(500).json({ error: 'Error al consultar las altas médicas' });
  }
});

// Obtener alta médica por documento de identidad
app.get('/api/alta/:documento', async (req, res) => {
  const { documento } = req.params;

  try {
    const result = await pool.query(`
      SELECT nombre_paciente AS nombre_paciente, edad, fecha, documento_identidad, diagnostico, tratamiento_recomendado, indicaciones_post_alta
      FROM alta_pacientes
      WHERE documento_identidad = $1
    `, [documento]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No se encontró alta médica para este paciente' });
    }

    res.status(200).json(result.rows[0]);
  } catch (error) {
    console.error('Error al obtener alta médica:', error);
    res.status(500).json({ error: 'Error al consultar la alta médica' });
  }
});


// Historias clínicas
app.get('/historias', async (req, res) => {
  const result = await pool.query('SELECT id, nombre, edad, documento, diagnostico, historial, fecha FROM historias_clinicas ORDER BY id');
  res.json(result.rows);
});

app.post('/historias', async (req, res) => {
  const { nombre, edad, documento, diagnostico, historial } = req.body;
  const result = await pool.query(
    'INSERT INTO historias_clinicas (nombre, edad, documento, diagnostico, historial) VALUES ($1, $2, $3, $4, $5) RETURNING id, nombre, edad, documento, diagnostico, historial, fecha',
    [nombre, edad, documento, diagnostico, historial]
  );
  res.json(result.rows[0]);
});

app.put('/historias/documento/:documento', async (req, res) => {
  const { documento } = req.params;
  const { nombre, edad, diagnostico, historial } = req.body;

  try {
    const result = await pool.query(
      'UPDATE historias_clinicas SET nombre=$1, edad=$2, diagnostico=$3, historial=$4, fecha=NOW() WHERE documento=$5 RETURNING *',
      [nombre, edad, diagnostico, historial, documento]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Historia no encontrada' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error al actualizar historia por documento:', error);
    res.status(500).json({ error: 'Error al actualizar la historia clínica' });
  }
});


app.delete('/historias/:documento', async (req, res) => {
  const documento = req.params.documento;

  try {
    const result = await pool.query(
      `DELETE FROM historias_clinicas 
       WHERE id = (
         SELECT id FROM historias_clinicas 
         WHERE documento = $1 
         ORDER BY fecha ASC 
         LIMIT 1
       ) 
       RETURNING *`,
      [documento]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: 'No se encontró ninguna historia para eliminar con ese documento' });
    }

    res.status(200).json({ mensaje: 'Historia eliminada correctamente', historiaEliminada: result.rows[0] });
  } catch (error) {
    console.error('Error al eliminar historia por documento:', error);
    res.status(500).json({ mensaje: 'Error al eliminar la historia' });
  }
});


// Citas médicas
app.post('/api/cita', async (req, res) => {
  const { no_documento, paciente, fecha, hora, motivo, doctor } = req.body;

  try {
    const existente = await pool.query(
      'SELECT id FROM citas_medicas WHERE no_documento = $1 AND fecha = $2 LIMIT 1',
      [no_documento, fecha]
    );

    if (existente.rows.length > 0) {
      await pool.query(
        'UPDATE citas_medicas SET paciente = $1, hora = $2, motivo = $3, doctor = $4 WHERE no_documento = $5 AND fecha = $6',
        [paciente, hora, motivo, doctor, no_documento, fecha]
      );
    } else {
      await pool.query(
        'INSERT INTO citas_medicas (no_documento, paciente, fecha, hora, motivo, doctor) VALUES ($1, $2, $3, $4, $5, $6)',
        [no_documento, paciente, fecha, hora, motivo, doctor]
      );
    }

    res.status(200).json({ mensaje: 'Cita guardada en la base de datos' });
  } catch (error) {
    console.error('Error al guardar cita:', error);
    res.status(500).json({ error: 'Error al guardar en la base de datos' });
  }
});

app.get('/api/citas', async (req, res) => {
  try {
    const resultado = await pool.query('SELECT id, no_documento, paciente, fecha, hora, motivo, doctor FROM citas_medicas ORDER BY fecha, hora');
    res.status(200).json(resultado.rows);
  } catch (error) {
    console.error('Error al obtener citas:', error);
    res.status(500).json({ error: 'Error al consultar las citas' });
  }
});

app.get('/api/citas/:documento', async (req, res) => {
  const { documento } = req.params;

  try {
    const result = await pool.query(
      'SELECT id, no_documento, paciente, fecha, hora, motivo, doctor FROM citas_medicas WHERE no_documento = $1 ORDER BY fecha, hora',
      [documento]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ mensaje: 'No se encontraron citas para este paciente' });
    }

    res.status(200).json(result.rows);
  } catch (error) {
    console.error('Error al obtener citas del paciente:', error);
    res.status(500).json({ mensaje: 'Error al consultar las citas del paciente' });
  }
});

app.put('/api/citas/:id', async (req, res) => {
  const id = req.params.id;
  const { no_documento, paciente, fecha, hora, motivo, doctor } = req.body;

  try {
    await pool.query(
      'UPDATE citas_medicas SET no_documento = $1, paciente = $2, fecha = $3, hora = $4, motivo = $5, doctor = $6 WHERE id = $7',
      [no_documento, paciente, fecha, hora, motivo, doctor, id]
    );
    res.status(200).json({ mensaje: 'Cita actualizada correctamente' });
  } catch (error) {
    console.error('Error al actualizar cita:', error);
    res.status(500).json({ error: 'Error al actualizar cita' });
  }
});

app.delete('/api/citas/documento/:documento', async (req, res) => {
  const { documento } = req.params;

  try {
    // Elimina solo la PRIMERA cita que coincida con ese documento
    const result = await pool.query(
      'DELETE FROM citas_medicas WHERE id = (SELECT id FROM citas_medicas WHERE no_documento = $1 ORDER BY fecha, hora LIMIT 1) RETURNING *',
      [documento]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ mensaje: 'No se encontró ninguna cita para eliminar con ese documento' });
    }

    res.status(200).json({ mensaje: 'Cita eliminada correctamente', citaEliminada: result.rows[0] });
  } catch (error) {
    console.error('Error al eliminar cita por documento:', error);
    res.status(500).json({ mensaje: 'Error al eliminar la cita' });
  }
});


app.listen(port, () => {
  console.log(`Servidor corriendo en http://localhost:${port}`);
});
