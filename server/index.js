import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import User from "./models/User.js";
import Bitacora from "./models/Bitacora.js";
import bcrypt from "bcrypt";
import cookieParser from "cookie-parser";
import BitSequence from "./models/BitSequence.js";
import Monitoreo from "./models/TipoMonitoreo.js";
import Client from "./models/Cliente.js";
import EventType from "./models/EventType.js";
import Role from "./models/Role.js";
import ClientSequence from "./models/ClientSequence.js";
import Destino from "./models/Destino.js";
import Origen from "./models/Origen.js";
import Operador from "./models/Operador.js";
import Inactividad from "./models/Inactividad.js";
import session from "express-session";
import nodemailer from "nodemailer";
import crypto from "crypto";
import Auditoria from "./models/Auditoria.js";
import LineaTransporte from "./models/LineaTransporte.js";
import OrigenSequence from "./models/OrigenSequence.js";
import DestinoSequence from "./models/DestinoSequence.js";
import TipoMonitoreoSequence from "./models/TipoMonitoreoSequence.js";
import ClienteSequence from "./models/ClienteSequence.js";
import EventTypeSequence from "./models/EventTypeSequence.js";
import LineaTransporteSequence from "./models/LineaTransporteSequence.js";
import OperadorSequence from "./models/OperadorSequence.js";
import DraftTransporte from "./models/DraftTransporte.js";
import PlanDeEmbarque from "./models/PlanDeEmbarque.js";
import Integration from "./models/Integration.js";
import VehicleMapping from "./models/VehicleMapping.js";
import InboundMessage from "./models/InboundMessage.js";
import ControlPatios from "./models/ControlPatios.js";
import RemolqueVisita from "./models/RemolqueVisita.js";
import PatioEntryEvent from "./models/PatioEntryEvent.js";
import PatioExitEvent from "./models/PatioExitEvent.js";
import PatioAnomaly from "./models/PatioAnomaly.js";
import wialonIntegrationService from "./services/wialonIntegrationService.js";
import telemetryService from "./services/telemetryService.js";
import { readPlateFromImage } from "./services/plateRecognitionService.js";
import { auditCreation, auditUpdate, auditDeletion } from "./auditoriaUtils.js";
import { convertToUpperCase } from "./utils/textUtils.js";
import multer from "multer";
import { writeFile, unlink } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

// Helper function to get next sequence number for Origen
const getNextOrigenSequence = async () => {
  const sequence = await OrigenSequence.findByIdAndUpdate(
    "origenSequence",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

// Helper function to get next sequence number for Destino
const getNextDestinoSequence = async () => {
  const sequence = await DestinoSequence.findByIdAndUpdate(
    "destinoSequence",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

// Helper function to decrement Origen sequence
const decrementOrigenSequence = async () => {
  const sequence = await OrigenSequence.findByIdAndUpdate(
    "origenSequence",
    { $inc: { seq: -1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

// Helper function to decrement Destino sequence
const decrementDestinoSequence = async () => {
  const sequence = await DestinoSequence.findByIdAndUpdate(
    "destinoSequence",
    { $inc: { seq: -1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

// Helper functions for TipoMonitoreo sequence
const getNextTipoMonitoreoSequence = async () => {
  const sequence = await TipoMonitoreoSequence.findByIdAndUpdate(
    "tipoMonitoreoSequence",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

const decrementTipoMonitoreoSequence = async () => {
  const sequence = await TipoMonitoreoSequence.findByIdAndUpdate(
    "tipoMonitoreoSequence",
    { $inc: { seq: -1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

// Helper functions for Cliente sequence
const getNextClienteSequence = async () => {
  const sequence = await ClienteSequence.findByIdAndUpdate(
    "clienteSequence",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

const decrementClienteSequence = async () => {
  const sequence = await ClienteSequence.findByIdAndUpdate(
    "clienteSequence",
    { $inc: { seq: -1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

// Helper functions for EventType sequence
const getNextEventTypeSequence = async () => {
  const sequence = await EventTypeSequence.findByIdAndUpdate(
    "eventTypeSequence",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

const decrementEventTypeSequence = async () => {
  const sequence = await EventTypeSequence.findByIdAndUpdate(
    "eventTypeSequence",
    { $inc: { seq: -1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

// Helper functions for LineaTransporte sequence
const getNextLineaTransporteSequence = async () => {
  const sequence = await LineaTransporteSequence.findByIdAndUpdate(
    "lineaTransporteSequence",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

const decrementLineaTransporteSequence = async () => {
  const sequence = await LineaTransporteSequence.findByIdAndUpdate(
    "lineaTransporteSequence",
    { $inc: { seq: -1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

// Helper functions for Operador sequence
const getNextOperadorSequence = async () => {
  const sequence = await OperadorSequence.findByIdAndUpdate(
    "operadorSequence",
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

const decrementOperadorSequence = async () => {
  const sequence = await OperadorSequence.findByIdAndUpdate(
    "operadorSequence",
    { $inc: { seq: -1 } },
    { new: true, upsert: true }
  );
  return sequence.seq;
};

// Normalize gpsUnits array: coerce wialonId to String, drop entries with invalid IDs
const normalizeGpsUnits = (gpsUnits) => {
  if (!Array.isArray(gpsUnits)) return [];
  return gpsUnits
    .filter((u) => u && u.wialonId != null && String(u.wialonId).trim() !== "")
    .map((u) => ({ ...u, wialonId: String(u.wialonId).trim() }));
};

dotenv.config();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const sendPasswordResetEmail = (email, resetToken) => {
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: process.env.EMAIL_USER,
    to: email,
    subject: "Cambio de contraseña",
    html: `<p>Se ha solicitado un cambio de contraseña. Click <a href="${resetUrl}"> aqui</a> para cambiar su contraseña. Si no solicitó este cambio, favor de hacer caso omiso.</p>`,
  };

  return transporter.sendMail(mailOptions);
};

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_SECRET_REFRESH = process.env.JWT_SECRET_REFRESH;

//midleware
const allowedOrigins = [
  "https://intacsep.spotynet.com", // Production
  "http://localhost:5173", // Development,
  "https://stg-app-intacsep.spotynet.com", //Staging
  "https://www.stg-app-intacsep.spotynet.com",
  "http://44.212.70.126", //AWS stg
  "https://intacsep.ilbento.com", //AWS test
  "https://www.intacsep.spotynet.com", //AWS PROD
  "https://www.stg-intacsep.spotynet.com", //AWS STG
  "https://stg-intacsep.spotynet.com", //AWS STG
  "https://bitacora.intacsep.com.mx",
  "https://stg-intacsep.onrender.com",
  "http://bitacora-intacsep.s3-website-us-east-1.amazonaws.com",
  "https://intacsep-stg.vercel.app",
  "https://intacsep-dev.spotynet.com",
  "http://intacsep-dev.spotynet.com",
];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (like mobile apps or Postman)
      if (!origin || allowedOrigins.indexOf(origin) !== -1) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true, // Allow credentials (cookies, authorization headers, etc.)
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(
  session({
    secret: process.env.SESSION_SECRET, // Replace with your actual secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: true }, // Set to true if using HTTPS
  })
);

//Create Custom Middleware to retreive Token Data
app.use((req, res, next) => {
  // Skip requests for login, logout, and refresh_token
  if (
    req.path === "/login" ||
    req.path === "/logout" ||
    req.path === "/refresh_token" ||
    req.path === "/register" ||
    req.path === "/request-reset-password" ||
    req.path === "/reset-password" ||
    req.path.startsWith("/inbound/") ||
    req.path.startsWith("/wialon/") ||
    (req.method === "GET" && req.path == "/")
  ) {
    return next();
  }

  const token = req.cookies.access_token; // Retrieve token after the path check

  // Check if the token exists
  if (!token) {
    return res.status(401).json({ message: "Unauthorized: Token missing" });
  }

  try {
    const data = jwt.verify(token, JWT_SECRET); // Verify the token
    req.session.user = data.user; // Store user data in session
  } catch (e) {
    console.error(e);
    req.session.user = null;
    return res.status(401).json({ message: "Unauthorized: Invalid token" }); // Return response on error
  }

  next(); // Proceed to the next middleware
});

//mongoose connection
mongoose.connect(process.env.MONGO_URI);

app.get("/", (req, res) => {
  res.send(`Node.js versionn: ${process.version}`);
});

app.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email });

    if (!user) {
      throw new Error("User Does Not Exist");
    }

    // Compare passwords
    const checkPwd = await bcrypt.compare(password, user.password);
    if (!checkPwd) {
      throw new Error("Incorrect Password");
    }

    // Remove Password from return object
    const publicUser = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
    };

    // Create Access Token
    const accessToken = jwt.sign({ user: publicUser }, JWT_SECRET, {
      expiresIn: "60m",
    });

    // Create Refresh Token
    const refreshToken = jwt.sign({ id: user._id, email: user.email }, JWT_SECRET_REFRESH, {
      expiresIn: "5d",
    });

    // Save tokens in cookies
    res.cookie("access_token", accessToken, {
      httpOnly: true,
      sameSite: "None", // or "Lax" depending on your needs
      secure: process.env.NODE_ENV === "production",
    });

    res.cookie("refresh_token", refreshToken, {
      httpOnly: true,
      sameSite: "None", // or "Lax" depending on your needs
      secure: process.env.NODE_ENV === "production",
    });

    user.refresh_token = refreshToken;
    await user.save();

    res.json({ user: publicUser });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "An error occurred" });
  }
});

app.post("/register", async (req, res) => {
  try {
    const { email, password, phone, firstName, lastName } = req.body;

    //   Check if user already exists
    const userExists = await User.findOne({ email: email });
    if (userExists) {
      throw new Error("Email Already Registered");
    }

    //hash Password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    //newUser
    const newUser = new User({
      email,
      password: hashedPassword,
      firstName,
      lastName,
      phone,
    });
    await newUser.save();
    res.status(200).json({ id: newUser.id });
  } catch (e) {
    res.status(401).json({ message: `${e}` });
  }
});

app.post("/logout", (req, res) => {
  res.clearCookie("access_token", {
    httpOnly: true,
    sameSite: "None",
    secure: true,
  });
  res.clearCookie("refresh_token", {
    httpOnly: true,
    sameSite: "None",
    secure: true,
  });
  res.status(200).send("Successful");
});

app.post("/request-reset-password", async (req, res) => {
  const { email } = req.body;
  // Find the user by email
  const user = await User.findOne({ email });
  if (!user) return res.status(404).send({ message: "User not found" });

  // Create a reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetPasswordToken = jwt.sign({ id: user._id, token: resetToken }, process.env.JWT_SECRET, {
    expiresIn: "1h",
  });

  // Send email

  await sendPasswordResetEmail(email, resetPasswordToken);
  res.status(200).send({ message: "Password reset email sent" });
});

app.post("/reset-password", async (req, res) => {
  const { token, newPassword } = req.body;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).send("User not found");
    }

    // Update the user's password
    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.send("Password has been reset");
  } catch (err) {
    res.status(400).send("Invalid or expired token");
  }
});

app.post("/protected", (req, res) => {
  const { user } = req.session;

  if (!user) return res.status(401).send("Access Denied");
  res.status(200).json({ user: user });
});

app.post("/refresh_token", async (req, res) => {
  //create new access token
  try {
    const { refresh_token } = req.cookies;

    if (!refresh_token) return res.status(403).json({ message: "No Token Refreshed" });

    const data = jwt.verify(refresh_token, JWT_SECRET_REFRESH);
    //Check if user exists
    const user = await User.findById(data.id);
    if (!user) throw new Error("username does not exists");

    //Remove Password from return object
    const publicUser = {
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
    };

    const newAccessToken = jwt.sign({ user: publicUser }, JWT_SECRET, {
      expiresIn: "15m",
    });

    //save tokens in cookie
    res.clearCookie("access_token");
    res.cookie("access_token", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
    });
    res.json({ message: "Access Token Refreshed", token: newAccessToken });
  } catch (e) {
    res.status(403).json({ message: "No Token Refreshed" });
  }
});

app.get("/user", async (req, res) => {
  try {
    const users = await User.find();
    res.status(200).json(users);
  } catch (e) {
    console.log(e);
  }
});

app.get("/user/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findOne({ email: id });
    res.status(200).json(user);
  } catch (e) {
    console.log(e);
  }
});

app.post("/user/:id", async (req, res) => {
  const { id } = req.params;
  const data = req.body;

  if (data.password) {
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(data.password, saltRounds);
    await User.updateOne({ email: id }, { password: hashedPassword });
  }

  try {
    const userToUpdate = await User.updateOne(
      { email: id },
      {
        name: data.name,
        username: data.username,
        phone: data.phone,
        address: {
          city: data.city,
          street: data.street,
          unit: data.unit,
          zip: data.zipCode,
        },
      }
    );

    console.log(userToUpdate);
    res.status(200).json({ message: "User Updated" });
  } catch (e) {
    console.log(e);
    res.json({ message: "User NOT Updated" });
  }
});

app.patch("/user/:id", async (req, res) => {
  const { id } = req.params;
  const updates = req.body;

  try {
    const user = await User.updateOne(
      { email: id },
      {
        admin: updates.admin,
      }
    );
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    res.send(user);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

app.patch("/profile/:id", async (req, res) => {
  const { id } = req.params;
  const updatedData = req.body;

  try {
    const updatedUser = await User.findByIdAndUpdate(id, updatedData, {
      new: true,
    });
    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.delete("/user/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const user = await User.deleteOne({ email: id });
    if (!user) {
      return res.status(404).send({ error: "User not found" });
    }
    res.send(user);
  } catch (error) {
    res.status(400).send({ error: error.message });
  }
});

// app.get("/bitacoras", async (req, res) => {
//   try {
//     const bitacoras = await Bitacora.find();
//     res.status(200).json(bitacoras);
//   } catch (e) {
//     console.error("Error fetching  bitácoras:", e);
//     res.status(500).json({error: "An error occurred while fetching past bitácoras."});
//   }
// });

app.get("/bitacoras", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;
    const operador = req.query.operador;
    const statusFilter = req.query.statusFilter;
    const creationDateFilter = req.query.creationDateFilter;
    const clienteFilter = req.query.clienteFilter;
    const monitoreoFilter = req.query.monitoreoFilter;
    const operadorFilter = req.query.operadorFilter;
    const idFilter = req.query.idFilter;
    const sortField = req.query.sortField || "createdAt";
    const sortOrder = req.query.sortOrder || "desc";
    const allowedClients = req.query.allowed_clients; // Nuevo parámetro para filtrar por permisos de cliente
    const hideCerradas = req.query.hideCerradas === "true";
    const lean = req.query.lean === "true";

    const query = {};

    // Exclude soft deleted bitacoras
    query.deleted = { $ne: true };

    // Apply client permissions filtering FIRST (most restrictive)
    if (allowedClients) {
      const clientsList = allowedClients.split(',').map(c => c.trim().toUpperCase());
      query.cliente = { $in: clientsList };
    }

    // Build query based on filters
    if (operador) {
      // Case-insensitive exact match: bitacoras store operador uppercased via convertToUpperCase
      const escapedOperador = operador.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.operador = { $regex: `^${escapedOperador}$`, $options: "i" };
    }
    if (statusFilter) query.status = statusFilter;
    if (clienteFilter) {
      // Si ya hay filtro de clientes permitidos, hacer intersección
      if (query.cliente && query.cliente.$in) {
        const filteredClients = query.cliente.$in.filter(c =>
          c.toUpperCase().includes(clienteFilter.toUpperCase())
        );
        query.cliente = { $in: filteredClients };
      } else {
        query.cliente = { $regex: clienteFilter, $options: "i" };
      }
    }
    if (monitoreoFilter) query.monitoreo = { $regex: monitoreoFilter, $options: "i" };
    if (operadorFilter) {
      if (operador) {
        // User restriction is active: combine both so user can only filter within their own bitacoras
        if (!query.$and) query.$and = [];
        query.$and.push({ operador: query.operador });
        query.$and.push({ operador: { $regex: operadorFilter, $options: "i" } });
        delete query.operador;
      } else {
        query.operador = { $regex: operadorFilter, $options: "i" };
      }
    }
    if (idFilter) query.bitacora_id = { $regex: idFilter, $options: "i" };
    if (creationDateFilter) {
      const startDate = new Date(creationDateFilter + "T00:00:00");
      const endDate = new Date(creationDateFilter + "T23:59:59.999");
      query.createdAt = { $gte: startDate, $lte: endDate };
    }

    // Hide cerradas if role doesn't have permission
    if (hideCerradas) {
      if (!query.$and) query.$and = [];
      query.$and.push({ status: { $nin: ["cerrada", "cerrada (e)"] } });
    }

    // Build sort object
    const sortObj = {};
    sortObj[sortField] = sortOrder === "asc" ? 1 : -1;

    const totalItems = await Bitacora.countDocuments(query);
    const bitacoras = await Bitacora.find(query).sort(sortObj).skip(skip).limit(limit);

    // Batch-lookup destino/origen nombres so clients don't have to show raw IDs.
    // Note: edited bitácoras may store origen/destino as plain name strings instead of
    // ObjectIds (fallback from getObjectId in BitacoraDetailPage), so we handle both.
    const isObjectId = (v) => /^[0-9a-f]{24}$/i.test(v || "");
    const allDestinos = bitacoras.map(b => b.destino).filter(Boolean);
    const allOrigenes = bitacoras.map(b => b.origen).filter(Boolean);
    const destinoIds = [...new Set(allDestinos.filter(isObjectId))];
    const origenIds  = [...new Set(allOrigenes.filter(isObjectId))];
    const [destinos, origenes] = await Promise.all([
      Destino.find({ _id: { $in: destinoIds } }).select("_id nombre").lean(),
      Origen.find({ _id: { $in: origenIds } }).select("_id nombre").lean(),
    ]);
    const destinoMap = Object.fromEntries(destinos.map(d => [d._id.toString(), d.nombre]));
    const origenMap  = Object.fromEntries(origenes.map(o => [o._id.toString(), o.nombre]));
    const enriched = bitacoras.map(b => ({
      ...b.toObject(),
      // When destino/origen is a name string (edited bitácora fallback), use it directly
      destino_nombre: destinoMap[b.destino] || (!isObjectId(b.destino) ? b.destino : "") || "",
      origen_nombre:  origenMap[b.origen]   || (!isObjectId(b.origen)  ? b.origen  : "") || "",
    }));

    res.status(200).json({
      bitacoras: enriched,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (e) {
    console.error("Error fetching bitacoras:", e);
    res.status(500).json({ error: "An error occurred while fetching bitacoras." });
  }
});

// Endpoint para descargar todas las bitácoras de un cliente específico (sin paginación)
app.get("/bitacoras/download/:clienteName", async (req, res) => {
  try {
    const { clienteName } = req.params;
    const { fechaDesde, fechaHasta, lineaTransporte, operador } = req.query;

    // Build query filters (same as pagination endpoint)
    let query = {
      cliente: decodeURIComponent(clienteName),
      deleted: { $ne: true }
    };

    // Add date range filter if provided
    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');

      if (!isNaN(startDate) && !isNaN(endDate)) {
        query.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }

    // Add transport line filter if provided
    if (lineaTransporte && lineaTransporte !== 'all') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { 'transportes.lineaTransporte': lineaTransporte }
        ]
      });
    }

    // Add operator filter if provided
    if (operador && operador !== 'all') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { 'transportes.operador': operador }
        ]
      });
    }

    // Get ALL bitacoras for this client (no pagination for download) using aggregation
    const bitacoras = await Bitacora.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      // Add fields to handle ObjectId conversion for lookups
      {
        $addFields: {
          origenForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$origen' }, 'string'] },
                  { $regexMatch: { input: '$origen', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$origen' },
              else: '$origen'
            }
          },
          destinoForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$destino' }, 'string'] },
                  { $regexMatch: { input: '$destino', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$destino' },
              else: '$destino'
            }
          }
        }
      },
      // Lookups with ObjectId conversion
      {
        $lookup: {
          from: 'origens',
          localField: 'origenForLookup',
          foreignField: '_id',
          as: 'origenInfoById'
        }
      },
      {
        $lookup: {
          from: 'origens',
          localField: 'origen',
          foreignField: 'nombre',
          as: 'origenInfoByName'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destinoForLookup',
          foreignField: '_id',
          as: 'destinoInfoById'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destino',
          foreignField: 'nombre',
          as: 'destinoInfoByName'
        }
      },
      // Combine results - prefer _id match over nombre match
      {
        $addFields: {
          origenInfo: {
            $cond: {
              if: { $gt: [{ $size: '$origenInfoById' }, 0] },
              then: '$origenInfoById',
              else: '$origenInfoByName'
            }
          },
          destinoInfo: {
            $cond: {
              if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
              then: '$destinoInfoById',
              else: '$destinoInfoByName'
            }
          }
        }
      }
    ]);

    // Helper functions (same as in anomalias endpoint)
    const getTransportLines = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const lines = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.lineaTransporte || transporte.lineaTransporte.trim() === '') {
            return 'N/A';
          }
          return transporte.lineaTransporte;
        })
        .filter((line, index, array) => array.indexOf(line) === index); // Remove duplicates

      return lines.length > 0 ? lines.join(', ') : 'N/A';
    };

    const getTransportOperators = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const operators = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.operador || transporte.operador.trim() === '') {
            return 'N/A';
          }
          return transporte.operador;
        })
        .filter((operator, index, array) => array.indexOf(operator) === index); // Remove duplicates

      return operators.length > 0 ? operators.join(', ') : 'N/A';
    };

    const getLocationName = (locationField, lookupInfo = null, debugContext = '') => {
      // First, try to use lookup data if available
      if (lookupInfo && lookupInfo.length > 0) {
        const locationData = lookupInfo[0];
        const result = `${locationData.nombre}, ${locationData.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // Fallback to original field processing
      if (!locationField) {
        return 'N/A';
      }

      // If it's an object with nombre and estado properties
      if (typeof locationField === 'object' && locationField.nombre) {
        const result = `${locationField.nombre}, ${locationField.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // If it's a plain string and not an ObjectId
      if (typeof locationField === 'string' && !locationField.match(/^[0-9a-f]{24}$/i)) {
        return locationField;
      }

      // If it's an ObjectId string and no lookup data found
      return `ObjectId no resuelto: ${locationField}`;
    };

    // Format the data using the same helper functions as anomalias endpoint
    const formattedBitacoras = bitacoras.map(bitacora => {
      return {
        _id: bitacora._id,
        bitacora_id: bitacora.bitacora_id,
        fechaCreacion: bitacora.createdAt,
        cliente: bitacora.cliente,
        tipoMonitoreo: bitacora.monitoreo,
        lineaTransporte: getTransportLines(bitacora.transportes),
        operadorTransporte: getTransportOperators(bitacora.transportes),
        origen: getLocationName(bitacora.origen, bitacora.origenInfo, 'ORIGEN'),
        destino: getLocationName(bitacora.destino, bitacora.destinoInfo, 'DESTINO'),
        estado: bitacora.status,
        usuario: bitacora.operador || 'N/A'
      };
    });

    res.status(200).json({
      bitacoras: formattedBitacoras,
      totalCount: formattedBitacoras.length,
      cliente: decodeURIComponent(clienteName)
    });
  } catch (error) {
    console.error("Error fetching all bitacoras for download:", error);
    res.status(500).json({ error: "Failed to fetch bitacoras for download" });
  }
});

// Endpoint para obtener bitácoras por cliente específico
app.get("/bitacoras/by-client/:clienteName", async (req, res) => {
  try {
    const { clienteName } = req.params;
    const { fechaDesde, fechaHasta, lineaTransporte, operador } = req.query;

    // Build query filters
    let query = {
      cliente: decodeURIComponent(clienteName),
      deleted: { $ne: true } // Exclude soft deleted bitacoras
    };

    // Add date range filter if provided
    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');

      if (!isNaN(startDate) && !isNaN(endDate)) {
        query.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }

    // Add transport line filter
    if (lineaTransporte && lineaTransporte !== 'all') {
      query.$or = [
        { linea_transporte: lineaTransporte },
        { 'transportes.lineaTransporte': lineaTransporte }
      ];
    }

    // Add operator filter
    if (operador && operador !== 'all') {
      // If there's already an $or filter, we need to combine with $and
      if (query.$or) {
        query.$and = [
          { $or: query.$or },
          {
            $or: [
              { operador: operador },
              { 'transportes.operador': operador }
            ]
          }
        ];
        delete query.$or;
      } else {
        query.$or = [
          { operador: operador },
          { 'transportes.operador': operador }
        ];
      }
    }

    // Pagination parameters
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    // Get total count for pagination
    const totalCount = await Bitacora.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limit);

    // Get bitacoras for this client with detailed information using aggregation
    const bitacoras = await Bitacora.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      // Add fields to handle ObjectId conversion for lookups
      {
        $addFields: {
          origenForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$origen' }, 'string'] },
                  { $regexMatch: { input: '$origen', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$origen' },
              else: '$origen'
            }
          },
          destinoForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$destino' }, 'string'] },
                  { $regexMatch: { input: '$destino', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$destino' },
              else: '$destino'
            }
          }
        }
      },
      // Lookups with ObjectId conversion
      {
        $lookup: {
          from: 'origens',
          localField: 'origenForLookup',
          foreignField: '_id',
          as: 'origenInfoById'
        }
      },
      {
        $lookup: {
          from: 'origens',
          localField: 'origen',
          foreignField: 'nombre',
          as: 'origenInfoByName'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destinoForLookup',
          foreignField: '_id',
          as: 'destinoInfoById'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destino',
          foreignField: 'nombre',
          as: 'destinoInfoByName'
        }
      },
      // Combine results - prefer _id match over nombre match
      {
        $addFields: {
          origenInfo: {
            $cond: {
              if: { $gt: [{ $size: '$origenInfoById' }, 0] },
              then: '$origenInfoById',
              else: '$origenInfoByName'
            }
          },
          destinoInfo: {
            $cond: {
              if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
              then: '$destinoInfoById',
              else: '$destinoInfoByName'
            }
          }
        }
      }
    ]);

    // Helper functions (same as in anomalias endpoint)
    const getTransportLines = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const lines = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.lineaTransporte || transporte.lineaTransporte.trim() === '') {
            return 'N/A';
          }
          return transporte.lineaTransporte;
        })
        .filter((line, index, array) => array.indexOf(line) === index); // Remove duplicates

      return lines.length > 0 ? lines.join(', ') : 'N/A';
    };

    const getTransportOperators = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const operators = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.operador || transporte.operador.trim() === '') {
            return 'N/A';
          }
          return transporte.operador;
        })
        .filter((operator, index, array) => array.indexOf(operator) === index); // Remove duplicates

      return operators.length > 0 ? operators.join(', ') : 'N/A';
    };

    const getLocationName = (locationField, lookupInfo = null, debugContext = '') => {
      // First, try to use lookup data if available
      if (lookupInfo && lookupInfo.length > 0) {
        const locationData = lookupInfo[0];
        const result = `${locationData.nombre}, ${locationData.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // Fallback to original field processing
      if (!locationField) {
        return 'N/A';
      }

      // If it's an object with nombre and estado properties
      if (typeof locationField === 'object' && locationField.nombre) {
        const result = `${locationField.nombre}, ${locationField.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // If it's a plain string and not an ObjectId
      if (typeof locationField === 'string' && !locationField.match(/^[0-9a-f]{24}$/i)) {
        return locationField;
      }

      // If it's an ObjectId string and no lookup data found
      return `ObjectId no resuelto: ${locationField}`;
    };

    // Format the data using the same helper functions as anomalias endpoint
    const formattedBitacoras = bitacoras.map(bitacora => {
      return {
        _id: bitacora._id,
        bitacora_id: bitacora.bitacora_id,
        fechaCreacion: bitacora.createdAt,
        cliente: bitacora.cliente,
        tipoMonitoreo: bitacora.monitoreo,
        lineaTransporte: getTransportLines(bitacora.transportes),
        operadorTransporte: getTransportOperators(bitacora.transportes),
        origen: getLocationName(bitacora.origen, bitacora.origenInfo, 'ORIGEN'),
        destino: getLocationName(bitacora.destino, bitacora.destinoInfo, 'DESTINO'),
        estado: bitacora.status,
        usuario: bitacora.operador || 'N/A'
      };
    });

    res.status(200).json({
      bitacoras: formattedBitacoras,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error("Error fetching bitacoras by client:", error);
    res.status(500).json({ error: "Failed to fetch bitacoras for client" });
  }
});

// Endpoint para obtener bitácoras por usuario específico
app.get("/bitacoras/by-user/:userName", async (req, res) => {
  try {
    const { userName } = req.params;
    const { fechaDesde, fechaHasta, lineaTransporte, operador, page = 1, limit = 20 } = req.query;

    // Construir query base
    let query = { deleted: { $ne: true } }; // Exclude deleted bitacoras

    // Filtro por usuario
    if (userName && userName !== 'all') {
      query.$or = [
        { operador: decodeURIComponent(userName) },
        { 'transportes.operador': decodeURIComponent(userName) }
      ];
    }

    // Filtros adicionales
    if (fechaDesde) {
      query.createdAt = { ...query.createdAt, $gte: new Date(fechaDesde) };
    }
    if (fechaHasta) {
      query.createdAt = { ...query.createdAt, $lte: new Date(fechaHasta + 'T23:59:59.999Z') };
    }
    if (lineaTransporte && lineaTransporte !== 'all') {
      query['transportes.lineaTransporte'] = decodeURIComponent(lineaTransporte);
    }
    if (operador && operador !== 'all') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { operador: decodeURIComponent(operador) },
          { 'transportes.operador': decodeURIComponent(operador) }
        ]
      });
    }

    // Pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Bitacora.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get bitacoras for this user with detailed information using aggregation
    const bitacoras = await Bitacora.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      // Add fields to handle ObjectId conversion for lookups
      {
        $addFields: {
          origenForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$origen' }, 'string'] },
                  { $regexMatch: { input: '$origen', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$origen' },
              else: '$origen'
            }
          },
          destinoForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$destino' }, 'string'] },
                  { $regexMatch: { input: '$destino', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$destino' },
              else: '$destino'
            }
          }
        }
      },
      // Lookups with ObjectId conversion
      {
        $lookup: {
          from: 'origens',
          localField: 'origenForLookup',
          foreignField: '_id',
          as: 'origenInfoById'
        }
      },
      {
        $lookup: {
          from: 'origens',
          localField: 'origen',
          foreignField: 'nombre',
          as: 'origenInfoByName'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destinoForLookup',
          foreignField: '_id',
          as: 'destinoInfoById'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destino',
          foreignField: 'nombre',
          as: 'destinoInfoByName'
        }
      },
      // Combine results - prefer _id match over nombre match
      {
        $addFields: {
          origenInfo: {
            $cond: {
              if: { $gt: [{ $size: '$origenInfoById' }, 0] },
              then: '$origenInfoById',
              else: '$origenInfoByName'
            }
          },
          destinoInfo: {
            $cond: {
              if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
              then: '$destinoInfoById',
              else: '$destinoInfoByName'
            }
          }
        }
      }
    ]);

    // Helper functions (same as in anomalias endpoint)
    const getTransportLines = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const lines = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.lineaTransporte || transporte.lineaTransporte.trim() === '') {
            return 'N/A';
          }
          return transporte.lineaTransporte;
        })
        .filter((line, index, array) => array.indexOf(line) === index); // Remove duplicates

      return lines.length > 0 ? lines.join(', ') : 'N/A';
    };

    const getTransportOperators = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const operators = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.operador || transporte.operador.trim() === '') {
            return 'N/A';
          }
          return transporte.operador;
        })
        .filter((operator, index, array) => array.indexOf(operator) === index); // Remove duplicates

      return operators.length > 0 ? operators.join(', ') : 'N/A';
    };

    const getLocationName = (locationField, lookupInfo, debugContext = '') => {
      // First, try to use lookup data if available
      if (lookupInfo && lookupInfo.length > 0) {
        const locationData = lookupInfo[0];
        const result = `${locationData.nombre}, ${locationData.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // Fallback to original field processing
      if (!locationField) {
        return 'N/A';
      }

      // If it's an object with nombre and estado properties
      if (typeof locationField === 'object' && locationField.nombre) {
        const result = `${locationField.nombre}, ${locationField.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // If it's a plain string and not an ObjectId
      if (typeof locationField === 'string' && !locationField.match(/^[0-9a-f]{24}$/i)) {
        return locationField;
      }

      // If it's an ObjectId string and no lookup data found
      return `ObjectId no resuelto: ${locationField}`;
    };

    // Format the data using the same helper functions as anomalias endpoint
    const formattedBitacoras = bitacoras.map(bitacora => {
      return {
        _id: bitacora._id,
        bitacora_id: bitacora.bitacora_id,
        fechaCreacion: bitacora.createdAt,
        cliente: bitacora.cliente,
        tipoMonitoreo: bitacora.monitoreo,
        lineaTransporte: getTransportLines(bitacora.transportes),
        operadorTransporte: getTransportOperators(bitacora.transportes),
        origen: getLocationName(bitacora.origen, bitacora.origenInfo, 'ORIGEN'),
        destino: getLocationName(bitacora.destino, bitacora.destinoInfo, 'DESTINO'),
        estado: bitacora.status,
        usuario: bitacora.operador || 'N/A'
      };
    });

    res.status(200).json({
      bitacoras: formattedBitacoras,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error("Error fetching bitacoras by user:", error);
    res.status(500).json({ error: "Failed to fetch bitacoras for user" });
  }
});

// Endpoint para descargar todas las bitácoras de un usuario
app.get("/bitacoras/download-user/:userName", async (req, res) => {
  try {
    const { userName } = req.params;
    const { fechaDesde, fechaHasta, lineaTransporte, operador } = req.query;

    // Construir query base
    let query = { deleted: { $ne: true } }; // Exclude deleted bitacoras

    // Filtro por usuario
    if (userName && userName !== 'all') {
      query.$or = [
        { operador: decodeURIComponent(userName) },
        { 'transportes.operador': decodeURIComponent(userName) }
      ];
    }

    // Filtros adicionales
    if (fechaDesde) {
      query.createdAt = { ...query.createdAt, $gte: new Date(fechaDesde) };
    }
    if (fechaHasta) {
      query.createdAt = { ...query.createdAt, $lte: new Date(fechaHasta + 'T23:59:59.999Z') };
    }
    if (lineaTransporte && lineaTransporte !== 'all') {
      query['transportes.lineaTransporte'] = decodeURIComponent(lineaTransporte);
    }
    if (operador && operador !== 'all') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { operador: decodeURIComponent(operador) },
          { 'transportes.operador': decodeURIComponent(operador) }
        ]
      });
    }

    // Get ALL bitacoras for this user (no pagination for download) using aggregation
    const bitacoras = await Bitacora.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      // Add fields to handle ObjectId conversion for lookups
      {
        $addFields: {
          origenForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$origen' }, 'string'] },
                  { $regexMatch: { input: '$origen', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$origen' },
              else: '$origen'
            }
          },
          destinoForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$destino' }, 'string'] },
                  { $regexMatch: { input: '$destino', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$destino' },
              else: '$destino'
            }
          }
        }
      },
      // Lookups with ObjectId conversion
      {
        $lookup: {
          from: 'origens',
          localField: 'origenForLookup',
          foreignField: '_id',
          as: 'origenInfoById'
        }
      },
      {
        $lookup: {
          from: 'origens',
          localField: 'origen',
          foreignField: 'nombre',
          as: 'origenInfoByName'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destinoForLookup',
          foreignField: '_id',
          as: 'destinoInfoById'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destino',
          foreignField: 'nombre',
          as: 'destinoInfoByName'
        }
      },
      // Combine results - prefer _id match over nombre match
      {
        $addFields: {
          origenInfo: {
            $cond: {
              if: { $gt: [{ $size: '$origenInfoById' }, 0] },
              then: '$origenInfoById',
              else: '$origenInfoByName'
            }
          },
          destinoInfo: {
            $cond: {
              if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
              then: '$destinoInfoById',
              else: '$destinoInfoByName'
            }
          }
        }
      }
    ]);

    // Helper functions (same as in anomalias endpoint)
    const getTransportLines = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const lines = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.lineaTransporte || transporte.lineaTransporte.trim() === '') {
            return 'N/A';
          }
          return transporte.lineaTransporte;
        })
        .filter((line, index, array) => array.indexOf(line) === index); // Remove duplicates

      return lines.length > 0 ? lines.join(', ') : 'N/A';
    };

    const getTransportOperators = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const operators = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.operador || transporte.operador.trim() === '') {
            return 'N/A';
          }
          return transporte.operador;
        })
        .filter((operator, index, array) => array.indexOf(operator) === index); // Remove duplicates

      return operators.length > 0 ? operators.join(', ') : 'N/A';
    };

    const getLocationName = (locationField, lookupInfo, debugContext = '') => {
      // First, try to use lookup data if available
      if (lookupInfo && lookupInfo.length > 0) {
        const locationData = lookupInfo[0];
        const result = `${locationData.nombre}, ${locationData.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // Fallback to original field processing
      if (!locationField) {
        return 'N/A';
      }

      // If it's an object with nombre and estado properties
      if (typeof locationField === 'object' && locationField.nombre) {
        const result = `${locationField.nombre}, ${locationField.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // If it's a plain string and not an ObjectId
      if (typeof locationField === 'string' && !locationField.match(/^[0-9a-f]{24}$/i)) {
        return locationField;
      }

      // If it's an ObjectId string and no lookup data found
      return `ObjectId no resuelto: ${locationField}`;
    };

    // Format the data using the same helper functions as anomalias endpoint
    const formattedBitacoras = bitacoras.map(bitacora => {
      return {
        _id: bitacora._id,
        bitacora_id: bitacora.bitacora_id,
        fechaCreacion: bitacora.createdAt,
        cliente: bitacora.cliente,
        tipoMonitoreo: bitacora.monitoreo,
        lineaTransporte: getTransportLines(bitacora.transportes),
        operadorTransporte: getTransportOperators(bitacora.transportes),
        origen: getLocationName(bitacora.origen, bitacora.origenInfo, 'ORIGEN'),
        destino: getLocationName(bitacora.destino, bitacora.destinoInfo, 'DESTINO'),
        estado: bitacora.status,
        usuario: bitacora.operador || 'N/A'
      };
    });

    res.status(200).json({
      bitacoras: formattedBitacoras,
      totalCount: formattedBitacoras.length,
      usuario: decodeURIComponent(userName)
    });
  } catch (error) {
    console.error("Error fetching all bitacoras for user download:", error);
    res.status(500).json({ error: "Failed to fetch bitacoras for user download" });
  }
});

app.post("/bitacora", async (req, res) => {
  // Import validation utilities
  const { validateAndConvertObjectIds } = await import('./utils/validationUtils.js');

  // Validate and convert ObjectIds first
  const objectIdValidation = validateAndConvertObjectIds(req.body, ['origen', 'destino']);

  if (objectIdValidation.errors.length > 0) {
    return res.status(400).json({
      error: 'Datos de entrada inválidos',
      details: objectIdValidation.errors
    });
  }

  // Convertir campos de texto a mayúsculas antes de procesar
  const excludeFields = ['status', 'inicioMonitoreo', 'finalMonitoreo', 'telefono', '_id', 'createdAt', 'updatedAt', 'bitacora_id', 'capacidad', 'gpsUnits', 'origen', 'destino'];
  const data = convertToUpperCase(objectIdValidation.data, excludeFields);

  try {
    const sequence = await BitSequence.findOneAndUpdate(
      { name: "bitacora_id" },
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );

    const sequenceNumber = sequence.sequence_value.toString().padStart(6, "0");

    const newItem = new Bitacora({
      bitacora_id: sequenceNumber,
      folio_servicio: data.folio_servicio,
      linea_transporte: data.linea_transporte,
      destino: data.destino,
      origen: data.origen,
      monitoreo: data.monitoreo,
      cliente: data.cliente,
      enlace: data.enlace,
      id_acceso: data.id_acceso,
      contra_acceso: data.contra_acceso,
      remolque: {
        eco: data.remolque?.eco,
        placa: data.remolque?.placa,
        color: data.remolque?.color,
        capacidad: data.remolque?.capacidad,
        sello: data.remolque?.sello,
      },
      tracto: {
        eco: data.tracto?.eco,
        placa: data.tracto?.placa,
        marca: data.tracto?.marca,
        modelo: data.tracto?.modelo,
        color: data.tracto?.color,
        tipo: data.tracto?.tipo,
      },
      operador: data.operador,
      telefono: data.telefono,
      inicioMonitoreo: data.inicioMonitoreo ? new Date(data.inicioMonitoreo) : null,
      finalMonitoreo: data.finalMonitoreo ? new Date(data.finalMonitoreo) : null,
      status: data.status || "creada",
      eventos: data.eventos || [],

      // 🆕 Inject only if it's custodia física
      ...((data.monitoreo === "Custodia fisica" || data.monitoreo === "CUSTODIA FISICA" || data.monitoreo?.toLowerCase() === "custodia fisica") && {
        custodia: {
          custodio1_nombre: data.custodia?.custodio1_nombre,
          custodio1_telefono: data.custodia?.custodio1_telefono,
          custodio2_nombre: data.custodia?.custodio2_nombre,
          custodio2_telefono: data.custodia?.custodio2_telefono,
          placa: data.custodia?.placa,
          modelo: data.custodia?.modelo,
          color: data.custodia?.color,
          marca: data.custodia?.marca,
        },
      }),
    });

    await newItem.save();
    await auditCreation({ newData: newItem.toObject(), modelId: newItem._id, user: req.session.user || {}, seccion: "Bitacora" });

    // Use aggregation to resolve origen and destino names in the response
    const resolvedBitacora = await Bitacora.aggregate([
      {
        $match: {
          _id: newItem._id,
          deleted: { $ne: true }
        }
      },
      // Add fields to handle ObjectId conversion for lookups
      {
        $addFields: {
          origenForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$origen' }, 'string'] },
                  { $regexMatch: { input: '$origen', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$origen' },
              else: '$origen'
            }
          },
          destinoForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$destino' }, 'string'] },
                  { $regexMatch: { input: '$destino', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$destino' },
              else: '$destino'
            }
          }
        }
      },
      // Lookups with ObjectId conversion
      {
        $lookup: {
          from: 'origens',
          localField: 'origenForLookup',
          foreignField: '_id',
          as: 'origenInfoById'
        }
      },
      {
        $lookup: {
          from: 'origens',
          localField: 'origen',
          foreignField: 'nombre',
          as: 'origenInfoByName'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destinoForLookup',
          foreignField: '_id',
          as: 'destinoInfoById'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destino',
          foreignField: 'nombre',
          as: 'destinoInfoByName'
        }
      },
      // Combine results - prefer _id match over nombre match
      {
        $addFields: {
          origen: {
            $cond: {
              if: { $gt: [{ $size: '$origenInfoById' }, 0] },
              then: { $arrayElemAt: ['$origenInfoById.nombre', 0] },
              else: {
                $cond: {
                  if: { $gt: [{ $size: '$origenInfoByName' }, 0] },
                  then: { $arrayElemAt: ['$origenInfoByName.nombre', 0] },
                  else: 'Ubicación no encontrada'
                }
              }
            }
          },
          destino: {
            $cond: {
              if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
              then: { $arrayElemAt: ['$destinoInfoById.nombre', 0] },
              else: {
                $cond: {
                  if: { $gt: [{ $size: '$destinoInfoByName' }, 0] },
                  then: { $arrayElemAt: ['$destinoInfoByName.nombre', 0] },
                  else: 'Ubicación no encontrada'
                }
              }
            }
          }
        }
      },
      // Remove the lookup arrays to clean up the response
      {
        $project: {
          origenInfoById: 0,
          origenInfoByName: 0,
          destinoInfoById: 0,
          destinoInfoByName: 0,
          origenForLookup: 0,
          destinoForLookup: 0
        }
      }
    ]);

    res.status(201).send(resolvedBitacora[0]);
  } catch (err) {
    console.error("Error creating bitacora:", err);
    res.status(500).send("Error creating bitacora");
  }
});

// Get deleted bitacoras (for admin purposes)
app.get("/bitacoras/deleted", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 25;
    const skip = (page - 1) * limit;

    // Only show deleted bitacoras
    const query = { deleted: true };

    // Build sort object
    const sortObj = { deleted_at: -1 }; // Most recently deleted first

    const totalItems = await Bitacora.countDocuments(query);
    const deletedBitacoras = await Bitacora.find(query)
      .sort(sortObj)
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      bitacoras: deletedBitacoras,
      totalItems,
      totalPages: Math.ceil(totalItems / limit),
    });
  } catch (e) {
    console.error("Error fetching deleted bitacoras:", e);
    res.status(500).json({ error: "An error occurred while fetching deleted bitacoras." });
  }
});

// Repair internalIds on evento copies so renamed transportes stay linked to their events.
app.post("/bitacora/:id/repair-internalids", async (req, res) => {
  try {
    const bitacora = await Bitacora.findById(req.params.id);
    if (!bitacora) return res.status(404).json({ error: "Bitácora not found" });

    const byInternalId = new Map(
      bitacora.transportes.filter((t) => t.internalId).map((t) => [t.internalId, t])
    );
    const byId = new Map(bitacora.transportes.map((t) => [t.id, t]));

    let dirty = false;
    bitacora.eventos?.forEach((evento) => {
      evento.transportes?.forEach((et, i) => {
        const resolved =
          (et.internalId && byInternalId.get(et.internalId)) ||
          byId.get(et.id);
        if (resolved?.internalId && resolved.internalId !== et.internalId) {
          evento.transportes[i] = { ...(et.toObject?.() ?? et), internalId: resolved.internalId };
          dirty = true;
        }
      });
    });

    if (dirty) {
      bitacora.markModified("eventos");
      await bitacora.save({ validateModifiedOnly: true });
    }

    res.json({ repaired: dirty });
  } catch (e) {
    console.error("Error repairing internalIds:", e);
    res.status(500).json({ error: "Repair failed" });
  }
});

app.get("/bitacora/:id", async (req, res) => {
  try {
    // Use aggregation to resolve origen and destino names
    const bitacoras = await Bitacora.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(req.params.id),
          deleted: { $ne: true }
        }
      },
      // Add fields to handle ObjectId conversion for lookups
      {
        $addFields: {
          origenForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$origen' }, 'string'] },
                  { $regexMatch: { input: '$origen', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$origen' },
              else: '$origen'
            }
          },
          destinoForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$destino' }, 'string'] },
                  { $regexMatch: { input: '$destino', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$destino' },
              else: '$destino'
            }
          }
        }
      },
      // Lookups with ObjectId conversion
      {
        $lookup: {
          from: 'origens',
          localField: 'origenForLookup',
          foreignField: '_id',
          as: 'origenInfoById'
        }
      },
      {
        $lookup: {
          from: 'origens',
          localField: 'origen',
          foreignField: 'nombre',
          as: 'origenInfoByName'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destinoForLookup',
          foreignField: '_id',
          as: 'destinoInfoById'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destino',
          foreignField: 'nombre',
          as: 'destinoInfoByName'
        }
      },
      // Combine results - prefer _id match over nombre match
      {
        $addFields: {
          origen: {
            $cond: {
              if: { $gt: [{ $size: '$origenInfoById' }, 0] },
              then: { $arrayElemAt: ['$origenInfoById.nombre', 0] },
              else: {
                $cond: {
                  if: { $gt: [{ $size: '$origenInfoByName' }, 0] },
                  then: { $arrayElemAt: ['$origenInfoByName.nombre', 0] },
                  else: 'Ubicación no encontrada'
                }
              }
            }
          },
          destino: {
            $cond: {
              if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
              then: { $arrayElemAt: ['$destinoInfoById.nombre', 0] },
              else: {
                $cond: {
                  if: { $gt: [{ $size: '$destinoInfoByName' }, 0] },
                  then: { $arrayElemAt: ['$destinoInfoByName.nombre', 0] },
                  else: 'Ubicación no encontrada'
                }
              }
            }
          }
        }
      },
      // Remove the lookup arrays to clean up the response
      {
        $project: {
          origenInfoById: 0,
          origenInfoByName: 0,
          destinoInfoById: 0,
          destinoInfoByName: 0,
          origenForLookup: 0,
          destinoForLookup: 0
        }
      }
    ]);

    if (bitacoras.length === 0) {
      return res.status(404).json({ message: "Bitacora not found" });
    }

    // Normalize GPS formats in response so frontend can consume either structure
    const response = bitacoras[0];

    const buildDataFromRegistro = (registro = {}) => ({
      duracion: registro.duracion || "",
      velocidad: registro.velocidad || "",
      coordenadas: registro.coordenadas || "",
      ultimo_posicionamiento: registro.ultimo_posicionamiento || "",
      ubicacion: registro.ubicacion || "",
    });

    if (Array.isArray(response.eventos)) {
      response.eventos.forEach((evt) => {
        if (Array.isArray(evt.transportes)) {
          evt.transportes.forEach((t) => {
            // Ensure arrays
            if (!Array.isArray(t.gpsData)) t.gpsData = [];
            if (!Array.isArray(t.gpsUnits)) t.gpsUnits = [];

            const hasRegistroData = !!(t.registro && (t.registro.coordenadas || t.registro.ubicacion));

            // Migration aid: if gpsData missing but registro has data, create gpsData[0] from gpsUnits[0] + registro
            // This handles old documents created before gpsData was populated by the client
            if (t.gpsData.length === 0 && hasRegistroData) {
              const firstUnit = t.gpsUnits[0] || {};
              t.gpsData.push({
                wialonId: firstUnit.wialonId || undefined,
                name: firstUnit.name || undefined,
                data: buildDataFromRegistro(t.registro),
              });
            }
          });
        }
      });
    }

    res.json(response);
  } catch (error) {
    console.error("Error fetching bitacora:", error);
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/bitacora/:id/event", async (req, res) => {
  const { id } = req.params;
  const { nombre, descripcion, registrado_por, frecuencia, transportes } = req.body;

  console.log(transportes);

  try {
    // Find the bitacora by its ID (exclude deleted)
    const bitacora = await Bitacora.findOne({
      _id: id,
      deleted: { $ne: true }
    });
    if (!bitacora) {
      return res.status(404).json({ message: "Bitacora not found" });
    }

    // ── 1) Flag the *previous* event, if any ──
    const lastIdx = bitacora.eventos.length - 1;
    if (lastIdx >= 0) {
      const prev = bitacora.eventos[lastIdx];
      const elapsed = Date.now() - new Date(prev.createdAt).getTime();
      const windowMs = (prev.frecuencia || 0) * 60000;
      // was the timer met before we added a new event?
      prev.isFrecuenciaMet = elapsed <= windowMs;
      bitacora.markModified("eventos");
    }

    // Create a new event, normalizing gpsData for each transporte
    const normalizedTransportes = (transportes || []).map((t) => {
      const registro = t.registro || {};
      const gpsUnits = normalizeGpsUnits(t.gpsUnits);
      let gpsData = Array.isArray(t.gpsData) ? t.gpsData : [];

      // Migration aid: if client didn't send gpsData (old client), create from gpsUnits[0] + registro
      if (gpsData.length === 0 && (registro.coordenadas || registro.ubicacion)) {
        const firstUnit = gpsUnits[0] || {};
        gpsData = [{
          wialonId: firstUnit.wialonId || undefined,
          name: firstUnit.name || undefined,
          data: {
            duracion: registro.duracion || "",
            velocidad: registro.velocidad || "",
            coordenadas: registro.coordenadas || "",
            ultimo_posicionamiento: registro.ultimo_posicionamiento || "",
            ubicacion: registro.ubicacion || "",
          }
        }];
      }

      return { ...t, gpsUnits, gpsData };
    });

    // If this is an anomaly event (non-General), backfill GPS from the most recent General event
    const eventTypeInfo = await EventType.findOne({ evento: new RegExp(`^${nombre?.trim()}$`, 'i') });
    const isAnomaly = eventTypeInfo && eventTypeInfo.categoria !== 'General';

    let finalTransportes = normalizedTransportes;
    if (isAnomaly) {
      // Find the most recent General event in this bitácora
      const generalEvents = bitacora.eventos.filter((e) => {
        // We can't do a DB lookup per event here, so identify General events by presence of GPS in registro
        return e.transportes?.some((t) => t.registro?.coordenadas || t.registro?.ubicacion);
      });
      const latestGeneral = generalEvents[generalEvents.length - 1];

      if (latestGeneral) {
        // Build a map of GPS data keyed by transport id/placa for matching
        const gpsMap = new Map();
        for (const t of (latestGeneral.transportes || [])) {
          const key = t.transporte_id?.toString() || t.placa;
          if (key) gpsMap.set(key, t.registro);
        }

        finalTransportes = normalizedTransportes.map((t) => {
          const key = t.transporte_id?.toString() || t.placa;
          const sourceRegistro = (key && gpsMap.get(key)) || latestGeneral.transportes?.[0]?.registro;
          if (!sourceRegistro) return t;
          const registro = {
            ...(t.registro || {}),
            coordenadas: t.registro?.coordenadas || sourceRegistro.coordenadas || "",
            ubicacion: t.registro?.ubicacion || sourceRegistro.ubicacion || "",
            velocidad: t.registro?.velocidad || sourceRegistro.velocidad || "",
            duracion: t.registro?.duracion || sourceRegistro.duracion || "",
            ultimo_posicionamiento: t.registro?.ultimo_posicionamiento || sourceRegistro.ultimo_posicionamiento || "",
          };
          const gpsData = registro.coordenadas || registro.ubicacion ? [{
            wialonId: t.gpsUnits?.[0]?.wialonId,
            name: t.gpsUnits?.[0]?.name,
            data: {
              coordenadas: registro.coordenadas,
              ubicacion: registro.ubicacion,
              velocidad: registro.velocidad,
              duracion: registro.duracion,
              ultimo_posicionamiento: registro.ultimo_posicionamiento,
            },
          }] : t.gpsData;
          return { ...t, registro, gpsData };
        });
      }
    }

    const newEvent = {
      nombre,
      descripcion,
      registrado_por,
      frecuencia,
      transportes: finalTransportes,
    };

    // Add the new event to the bitacora's eventos array
    bitacora.eventos.push(newEvent);

    // If a "validación" event is added to a plan-de-embarque bitacora, promote status
    const nombreNorm = nombre?.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    if (
      nombreNorm === "validacion" &&
      bitacora.status?.toLowerCase() === "plan de embarque"
    ) {
      bitacora.status = "validada";
    }

    // Save the updated bitacora
    await bitacora.save();

    // Respond with the updated bitacora
    res.status(200).json(bitacora);
  } catch (error) {
    console.error("Error adding event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//Update Bitacora
app.patch("/bitacora/:id", async (req, res) => {
  const { id } = req.params;

  // Import validation utilities
  const { validateAndConvertObjectIds } = await import('./utils/validationUtils.js');

  // Validate and convert ObjectIds first (only if origen/destino are being updated)
  const objectIdFields = [];
  if (req.body.origen) objectIdFields.push('origen');
  if (req.body.destino) objectIdFields.push('destino');

  let validatedData = req.body;
  if (objectIdFields.length > 0) {
    const objectIdValidation = validateAndConvertObjectIds(req.body, objectIdFields);

    if (objectIdValidation.errors.length > 0) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: objectIdValidation.errors
      });
    }
    validatedData = objectIdValidation.data;
  }

  // Convertir campos de texto a mayúsculas antes de procesar
  const excludeFields = ['status', 'inicioMonitoreo', 'finalMonitoreo', 'telefono', '_id', 'createdAt', 'updatedAt', 'bitacora_id', 'capacidad', 'gpsUnits', 'origen', 'destino', 'eventos'];
  const updatedData = convertToUpperCase(validatedData, excludeFields);
  console.log(updatedData);

  try {
    const bitacora = await Bitacora.findOne({
      _id: id,
      deleted: { $ne: true }
    });
    if (!bitacora) {
      return res.status(404).json({ message: "Bitacora not found" });
    }

    // Update the existing bitacora with the new data
    const oldData = bitacora.toObject();

    // Preserve internalId across transporte updates — it must never change once assigned.
    // Match incoming transportes to existing ones by: internalId → current id → _originalId (id changed).
    // Evento transporte copies also get their internalId stamped so future matches work.
    if (updatedData.transportes) {
      const existingById = new Map(bitacora.transportes.map((t) => [t.id, t]));
      const existingByInternalId = new Map(
        bitacora.transportes.filter((t) => t.internalId).map((t) => [t.internalId, t])
      );

      updatedData.transportes = updatedData.transportes.map((t) => {
        const existing =
          (t.internalId && existingByInternalId.get(t.internalId)) ||
          existingById.get(t.id) ||
          (t._originalId && existingById.get(t._originalId));
        const { _originalId, ...rest } = t;
        // Use existing internalId (immutable), or incoming one, or let schema default generate one
        return { ...rest, gpsUnits: normalizeGpsUnits(rest.gpsUnits), internalId: existing?.internalId || t.internalId || undefined };
      });

      // Build old-id → resolved transporte map for evento copy repair
      const resolvedByInternalId = new Map(
        updatedData.transportes.filter((t) => t.internalId).map((t) => [t.internalId, t])
      );
      // Map every old display id to its resolved transporte (covers id-change case)
      const oldIdToResolved = new Map();
      bitacora.transportes.forEach((oldT) => {
        const resolved = oldT.internalId ? resolvedByInternalId.get(oldT.internalId) : null;
        if (resolved) oldIdToResolved.set(oldT.id, resolved);
      });

      // Stamp correct internalId into evento copies — even ones that already have
      // a Mongoose-generated random internalId (assigned when the original transporte
      // had no internalId, which causes tMatch to fail after an id rename).
      if (bitacora.eventos?.length) {
        let eventosDirty = false;
        bitacora.eventos.forEach((evento) => {
          if (!evento.transportes?.length) return;
          evento.transportes.forEach((et, i) => {
            // First try matching by current internalId; fall back to old display id
            const resolved =
              (et.internalId && resolvedByInternalId.get(et.internalId)) ||
              oldIdToResolved.get(et.id);
            if (resolved?.internalId && resolved.internalId !== et.internalId) {
              evento.transportes[i] = { ...(et.toObject?.() ?? et), internalId: resolved.internalId };
              eventosDirty = true;
            }
          });
        });
        if (eventosDirty) bitacora.markModified('eventos');
      }
    }

    Object.assign(bitacora, updatedData);
    if (updatedData.custodia) bitacora.markModified('custodia');

    const updatedBitacora = await bitacora.save({ validateModifiedOnly: true });
    await auditUpdate({ oldData, newData: updatedData, modelId: id, user: req.session.user || {}, seccion: "Bitacora" });

    // Use aggregation to resolve origen and destino names in the response
    const resolvedBitacora = await Bitacora.aggregate([
      {
        $match: {
          _id: new mongoose.Types.ObjectId(id),
          deleted: { $ne: true }
        }
      },
      // Add fields to handle ObjectId conversion for lookups
      {
        $addFields: {
          origenForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$origen' }, 'string'] },
                  { $regexMatch: { input: '$origen', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$origen' },
              else: '$origen'
            }
          },
          destinoForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$destino' }, 'string'] },
                  { $regexMatch: { input: '$destino', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$destino' },
              else: '$destino'
            }
          }
        }
      },
      // Lookups with ObjectId conversion
      {
        $lookup: {
          from: 'origens',
          localField: 'origenForLookup',
          foreignField: '_id',
          as: 'origenInfoById'
        }
      },
      {
        $lookup: {
          from: 'origens',
          localField: 'origen',
          foreignField: 'nombre',
          as: 'origenInfoByName'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destinoForLookup',
          foreignField: '_id',
          as: 'destinoInfoById'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destino',
          foreignField: 'nombre',
          as: 'destinoInfoByName'
        }
      },
      // Combine results - prefer _id match over nombre match
      {
        $addFields: {
          origen: {
            $cond: {
              if: { $gt: [{ $size: '$origenInfoById' }, 0] },
              then: { $arrayElemAt: ['$origenInfoById.nombre', 0] },
              else: {
                $cond: {
                  if: { $gt: [{ $size: '$origenInfoByName' }, 0] },
                  then: { $arrayElemAt: ['$origenInfoByName.nombre', 0] },
                  else: 'Ubicación no encontrada'
                }
              }
            }
          },
          destino: {
            $cond: {
              if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
              then: { $arrayElemAt: ['$destinoInfoById.nombre', 0] },
              else: {
                $cond: {
                  if: { $gt: [{ $size: '$destinoInfoByName' }, 0] },
                  then: { $arrayElemAt: ['$destinoInfoByName.nombre', 0] },
                  else: 'Ubicación no encontrada'
                }
              }
            }
          }
        }
      },
      // Remove the lookup arrays to clean up the response
      {
        $project: {
          origenInfoById: 0,
          origenInfoByName: 0,
          destinoInfoById: 0,
          destinoInfoByName: 0,
          origenForLookup: 0,
          destinoForLookup: 0
        }
      }
    ]);

    res.json(resolvedBitacora[0]);
  } catch (error) {
    console.error("Error updating bitacora:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//Add trasnportes
app.post("/bitacoras/:id/transportes", async (req, res) => {
  try {
    const bitacoraId = req.params.id;
    const { id, internalId, tracto, remolque, operador, lineaTransporte, telefono, gpsUnits } = req.body;

    // Find the bitacora by ID (exclude deleted)
    const bitacora = await Bitacora.findOne({
      _id: bitacoraId,
      deleted: { $ne: true }
    });
    if (!bitacora) {
      return res.status(404).json({ message: "Bitacora not found" });
    }

    // Create a new Transporte object (internalId auto-assigned by schema default)
    const newTransporte = {
      id,
      tracto,
      remolque,
      lineaTransporte,
      operador,
      telefono,
      gpsUnits: normalizeGpsUnits(gpsUnits),
    };

    // Add the new Transporte to the bitacora's transportes array
    bitacora.transportes.push(newTransporte);

    // Save the updated bitacora
    await bitacora.save();

    // Return the updated bitacora
    res.status(200).json(bitacora);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
});

// Endpoint to start a bitacora
app.patch("/bitacora/:id/start", async (req, res) => {
  try {
    const bitacora = await Bitacora.findOne({
      _id: req.params.id,
      deleted: { $ne: true }
    });
    if (!bitacora) {
      return res.status(404).json({ message: "Bitacora not found" });
    }

    const date = new Date();
    bitacora.iniciada = true;
    bitacora.inicioMonitoreo = date;
    await bitacora.save();

    res.json(bitacora);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

// Endpoint to finish a bitacora
app.patch("/bitacora/:id/finish", async (req, res) => {
  try {
    const bitacora = await Bitacora.findOne({
      _id: req.params.id,
      deleted: { $ne: true }
    });
    if (!bitacora) {
      return res.status(404).json({ message: "Bitacora not found" });
    }
    const date = new Date();
    bitacora.activa = false;
    bitacora.finalMonitoreo = date;
    await bitacora.save();

    res.json(bitacora);
  } catch (error) {
    res.status(500).json({ message: "Server error" });
  }
});

app.patch("/bitacora/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const bitacora = await Bitacora.findOne({
      _id: id,
      deleted: { $ne: true }
    });
    if (!bitacora) return res.status(404).json({ message: "Bitacora not found" });

    bitacora.status = status;
    await bitacora.save();

    res.json(bitacora);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

app.patch("/bitacora/:id/edited", async (req, res) => {
  try {
    const { id } = req.params;
    const { edited } = req.body;

    const bitacora = await Bitacora.findOne({
      _id: id,
      deleted: { $ne: true }
    });
    if (!bitacora) return res.status(404).json({ message: "Bitacora not found" });

    bitacora.edited = edited;
    await bitacora.save();

    res.json(bitacora);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Soft delete bitacora - mark as deleted instead of removing
app.delete("/bitacora/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.session.user;

    const bitacora = await Bitacora.findById(id);
    if (!bitacora) {
      return res.status(404).json({ message: "Bitacora not found" });
    }

    if (bitacora.deleted) {
      return res.status(400).json({ message: "Bitacora already deleted" });
    }

    // Store the original data for audit
    const oldData = bitacora.toObject();

    // Mark as deleted instead of removing
    bitacora.deleted = true;
    bitacora.deleted_at = new Date();
    bitacora.deleted_by = user ? `${user.firstName} ${user.lastName}` : 'Unknown';

    await bitacora.save();

    // Create audit record for deletion
    await auditDeletion({
      oldData,
      modelId: id,
      user: user || {},
      seccion: "Bitacora"
    });

    res.status(200).json({
      message: "Bitacora marked as deleted successfully",
      bitacora: {
        _id: bitacora._id,
        bitacora_id: bitacora.bitacora_id,
        deleted: bitacora.deleted,
        deleted_at: bitacora.deleted_at,
        deleted_by: bitacora.deleted_by
      }
    });
  } catch (error) {
    console.error("Error soft deleting bitacora:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Restore a soft deleted bitacora
app.patch("/bitacora/:id/restore", async (req, res) => {
  try {
    const { id } = req.params;
    const user = req.session.user;

    const bitacora = await Bitacora.findOne({
      _id: id,
      deleted: true
    });

    if (!bitacora) {
      return res.status(404).json({ message: "Deleted bitacora not found" });
    }

    // Store the data before restoration for audit
    const oldData = bitacora.toObject();

    // Restore the bitacora
    bitacora.deleted = false;
    bitacora.deleted_at = undefined;
    bitacora.deleted_by = undefined;

    await bitacora.save();

    // Create audit record for restoration
    await auditUpdate({
      oldData,
      newData: { deleted: false },
      modelId: id,
      user: user || {},
      seccion: "Bitacora"
    });

    res.status(200).json({
      message: "Bitacora restored successfully",
      bitacora: {
        _id: bitacora._id,
        bitacora_id: bitacora.bitacora_id,
        deleted: bitacora.deleted
      }
    });
  } catch (error) {
    console.error("Error restoring bitacora:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

//Monitoreos
app.get("/monitoreos", async (req, res) => {
  try {
    const monitoreos = await Monitoreo.find();
    res.status(200).json(monitoreos);
  } catch (error) {
    console.error("Error fetching monitoreos:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Edit an existing origen
app.put("/monitoreos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { tipoMonitoreo } = req.body;
    const updatedMonitoreo = await Monitoreo.findByIdAndUpdate(id, { tipoMonitoreo }, { new: true });
    res.json(updatedMonitoreo);
  } catch (e) {
    res.status(500).json({ message: "Failed to edit origen", error: e.message });
  }
});

app.delete("/monitoreos/:id", async (req, res) => {
  const { id } = req.params;
  try {
    const deletedMonitoreo = await Monitoreo.findByIdAndDelete(id);
    if (!deletedMonitoreo) {
      return res.status(404).json({ message: "Monitoreo not found" });
    }

    // Decrement the sequence counter
    await decrementTipoMonitoreoSequence();

    await auditDeletion({ oldData: deletedMonitoreo.toObject(), modelId: id, user: req.session.user || {}, seccion: "Monitoreo" });
    res.status(200).json({ message: "Monitoreo deleted successfully" });
  } catch (error) {
    console.error("Error deleting monitoreo:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

app.post("/monitoreos", async (req, res) => {
  const { tipoMonitoreo } = req.body;
  if (!tipoMonitoreo) {
    return res.status(400).json({ message: "Tipo de monitoreo is required" });
  }

  try {
    // Get next sequence number
    const numericId = await getNextTipoMonitoreoSequence();

    const newMonitoreo = new Monitoreo({ tipoMonitoreo, numericId });
    const savedMonitoreo = await newMonitoreo.save();
    await auditCreation({ newData: savedMonitoreo.toObject(), modelId: savedMonitoreo._id, user: req.session.user || {}, seccion: "Monitoreo" });
    res.status(201).json(savedMonitoreo);
  } catch (error) {
    console.error("Error creating monitoreo:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// INTEGRATIONS
// Inbound telemetry route (Alpha-style)
// Public endpoint: secured by integration's own inboundToken (not JWT).
// Response shape mirrors Alpha/Layrz: { status: "OK" } or { status: "<ERROR>", reason: ["..."] }
app.post("/inbound/:inboundKey", async (req, res) => {
  try {
    const { inboundKey } = req.params;
    const authHeader = req.headers.authorization;

    // Accept "Bearer <token>" or "LayrzToken <token>"
    let token = null;
    if (authHeader) {
      const [scheme, value] = authHeader.split(" ");
      if ((scheme === "Bearer" || scheme === "LayrzToken") && value) {
        token = value;
      }
    }

    if (!token) {
      return res.status(401).json({
        status: "UNAUTHORIZED",
        reason: ["Missing or invalid Authorization header. Expected 'Bearer <token>' or 'LayrzToken <token>'."],
      });
    }

    const integration = await Integration.findOne({ inboundKey });
    if (!integration) {
      return res.status(401).json({
        status: "ACCESSDENIED",
        reason: ["Integration not found for the given inbound key."],
      });
    }

    if (integration.inboundToken !== token) {
      return res.status(401).json({
        status: "UNAUTHORIZED",
        reason: ["Invalid inbound token."],
      });
    }

    if (integration.type !== "inbound-rest") {
      return res.status(403).json({
        status: "ACCESSDENIED",
        reason: ["Integration is not of type 'inbound-rest'."],
      });
    }

    if (integration.status !== "active") {
      return res.status(403).json({
        status: "ACCESSDENIED",
        reason: ["Integration is inactive."],
      });
    }

    // Accept payload from body or query string (Alpha guide supports both).
    const ident = req.body?.ident ?? req.query?.ident;
    let position = req.body?.position ?? req.query?.position;

    // Position can arrive as a JSON string (especially via query params).
    if (typeof position === "string") {
      try {
        position = JSON.parse(position);
      } catch (e) {
        return res.status(400).json({
          status: "BADREQUEST",
          reason: ["'position' is not valid JSON."],
        });
      }
    }

    const reasons = [];
    if (!ident || typeof ident !== "string") {
      reasons.push("'ident' is required and must be a string.");
    }
    if (!position || typeof position !== "object") {
      reasons.push("'position' is required and must be an object.");
    } else {
      if (typeof position.latitude !== "number") reasons.push("'position.latitude' must be a number.");
      if (typeof position.longitude !== "number") reasons.push("'position.longitude' must be a number.");
      if (typeof position.speed !== "number") reasons.push("'position.speed' must be a number.");
    }

    if (reasons.length > 0) {
      return res.status(400).json({ status: "BADREQUEST", reason: reasons });
    }

    const result = await telemetryService.handleInbound(inboundKey, { ident, position });

    if (result && result.success === false) {
      // Mapping not found or other soft failure: still acknowledge with detail.
      return res.status(200).json({
        status: "OK",
        warning: result.message || "No vehicle mapping matched 'ident'.",
      });
    }

    return res.json({ status: "OK" });
  } catch (error) {
    console.error("Error handling inbound telemetry:", error);
    return res.status(500).json({
      status: "BADREQUEST",
      reason: [error.message || "Internal server error."],
    });
  }
});

// List all integrations
// SECURITY: never include inboundToken / apiKey in list responses.
app.get("/integrations", async (req, res) => {
  try {
    const integrations = await Integration.find()
      .select("-inboundToken -apiKey -wialonToken")
      .populate("clientId", "razon_social name");

    // Aggregate the latest inbound message timestamp per integration in a single query.
    const lastByIntegration = await InboundMessage.aggregate([
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$integrationId", lastInboundAt: { $first: "$createdAt" } } },
    ]);
    const lastMap = new Map(lastByIntegration.map((r) => [String(r._id), r.lastInboundAt]));

    const enrichedIntegrations = await Promise.all(
      integrations.map(async (integration) => {
        const vehicleCount = await VehicleMapping.countDocuments({ integrationId: integration._id });
        const obj = integration.toObject();
        return {
          ...obj,
          vehicleCount,
          hasInboundUrl: !!obj.inboundKey,
          lastInboundAt: lastMap.get(String(integration._id)) || null,
        };
      })
    );

    res.json(enrichedIntegrations);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Helper: build the absolute inbound URL for an integration.
// Honors INBOUND_BASE_URL env var if set, otherwise derives from the request.
const buildInboundUrl = (req, inboundKey) => {
  if (!inboundKey) return null;
  const base = process.env.INBOUND_BASE_URL
    ? process.env.INBOUND_BASE_URL.replace(/\/+$/, "")
    : `${req.protocol}://${req.get("host")}`;
  return `${base}/inbound/${inboundKey}`;
};

// Create a new integration
app.post("/integrations", async (req, res) => {
  try {
    const data = { ...req.body };

    // Auto-generate keys for inbound integrations.
    // inboundKey: short URL-safe slug (16 hex chars). inboundToken: 48 hex chars (24 bytes).
    if (data.type === "inbound-rest") {
      data.inboundKey = data.inboundKey || crypto.randomBytes(8).toString("hex");
      data.inboundToken = data.inboundToken || crypto.randomBytes(24).toString("hex");
    }

    const integration = new Integration(data);
    const newIntegration = await integration.save();
    await auditCreation({
      newData: newIntegration.toObject(),
      modelId: newIntegration._id,
      user: req.session.user || {},
      seccion: "Integracion",
    });

    // Return inboundToken (only on create) plus the full inbound URL for immediate display.
    const obj = newIntegration.toObject();
    obj.derivedInboundUrl = buildInboundUrl(req, obj.inboundKey);
    res.status(201).json(obj);
  } catch (error) {
    console.error("Error creating integration:", error);
    res.status(400).json({ message: error.message });
  }
});

// Get detailed info for an integration
// Returns inboundToken on this authenticated detail endpoint (allowed by spec).
app.get("/integrations/:id", async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id).populate("clientId", "razon_social name");
    if (!integration) return res.status(404).json({ message: "Integration not found" });
    const obj = integration.toObject();
    obj.derivedInboundUrl = buildInboundUrl(req, obj.inboundKey);
    res.json(obj);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update an integration
app.put("/integrations/:id", async (req, res) => {
  try {
    const prevIntegration = await Integration.findById(req.params.id);
    if (!prevIntegration) return res.status(404).json({ message: "Integration not found" });
    const oldData = prevIntegration.toObject();

    const updatedIntegration = await Integration.findByIdAndUpdate(req.params.id, req.body, { new: true });
    await auditUpdate({
      oldData,
      newData: req.body,
      modelId: req.params.id,
      user: req.session.user || {},
      seccion: "Integracion",
    });
    res.json(updatedIntegration);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete an integration
app.delete("/integrations/:id", async (req, res) => {
  try {
    const deletedIntegration = await Integration.findByIdAndDelete(req.params.id);
    if (!deletedIntegration) return res.status(404).json({ message: "Integration not found" });

    // Also delete associated vehicle mappings
    await VehicleMapping.deleteMany({ integrationId: req.params.id });

    await auditDeletion({
      oldData: deletedIntegration.toObject(),
      modelId: req.params.id,
      user: req.session.user || {},
      seccion: "Integracion",
    });
    res.json({ message: "Integration and associated mappings deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// List all vehicle mappings for a given integration
app.get("/integrations/:id/vehicles", async (req, res) => {
  try {
    const mappings = await VehicleMapping.find({ integrationId: req.params.id });

    // Latest inbound timestamp per mapping for this integration in a single query.
    const lastByMapping = await InboundMessage.aggregate([
      { $match: { integrationId: new mongoose.Types.ObjectId(req.params.id), vehicleMappingId: { $ne: null } } },
      { $sort: { createdAt: -1 } },
      { $group: { _id: "$vehicleMappingId", lastInboundAt: { $first: "$createdAt" } } },
    ]);
    const lastMap = new Map(lastByMapping.map((r) => [String(r._id), r.lastInboundAt]));

    const enriched = mappings.map((m) => ({
      ...m.toObject(),
      lastInboundAt: lastMap.get(String(m._id)) || null,
    }));

    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Bulk create or upsert vehicle mappings
app.post("/integrations/:id/vehicles", async (req, res) => {
  try {
    const integrationId = req.params.id;
    const { vehicles } = req.body; // Array of { imei, economico, placa, providerIdent, wialonUnitId, wialonUniqueId }

    if (!Array.isArray(vehicles)) {
      return res.status(400).json({ message: "Vehicles must be an array" });
    }

    // Validate and sanitize wialonUnitId — must be a numeric string or absent
    const sanitizedVehicles = vehicles.map((v) => {
      const clean = { ...v };
      if (clean.wialonUnitId != null) {
        const s = String(clean.wialonUnitId).trim();
        clean.wialonUnitId = /^\d+$/.test(s) ? s : undefined;
      }
      return clean;
    });

    const operations = sanitizedVehicles.map((v) => ({
      updateOne: {
        filter: { integrationId, imei: v.imei },
        update: { $set: { ...v, integrationId } },
        upsert: true,
      },
    }));

    const result = await VehicleMapping.bulkWrite(operations);
    
    // Audit log (simplified for bulk)
    await auditCreation({
      newData: { integrationId, count: vehicles.length },
      modelId: integrationId,
      user: req.session.user || {},
      seccion: "VehicleMapping Bulk",
    });

    res.json({ message: "Vehicles updated successfully", result });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Manually fire a sample inbound message at the integration to validate
// vehicle mappings, validation logic, and the Wialon push pipeline.
// Bypasses HTTP auth (admin already authenticated via session).
app.post("/integrations/:id/test-inbound", async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: "Integration not found" });
    if (integration.type !== "inbound-rest") {
      return res.status(400).json({ message: "Only inbound-rest integrations can be tested via this endpoint." });
    }

    const samplePosition = {
      hdop: 10,
      speed: 10,
      altitude: 10.0,
      latitude: 10.0,
      direction: 10,
      longitude: 10.0,
      satellites: 10,
    };

    const ident = req.body?.ident || "TEST-IDENT";
    let position = req.body?.position || samplePosition;
    if (typeof position === "string") {
      try { position = JSON.parse(position); } catch (e) {
        return res.status(400).json({ status: "BADREQUEST", reason: ["'position' is not valid JSON."] });
      }
    }

    try {
      const result = await telemetryService.handleInbound(integration.inboundKey, { ident, position });
      if (result && result.success === false) {
        return res.status(200).json({ status: "OK", warning: result.message });
      }
      return res.json({ status: "OK", echoed: { ident, position } });
    } catch (err) {
      return res.status(400).json({ status: "BADREQUEST", reason: [err.message] });
    }
  } catch (error) {
    console.error("Error in test-inbound:", error);
    res.status(500).json({ message: error.message });
  }
});

// Trigger bulk activation (ensure units exist in Wialon)
app.post("/integrations/:id/activate-wialon", async (req, res) => {
  try {
    const { mappingIds } = req.body;
    const result = await wialonIntegrationService.activateIntegration(req.params.id, mappingIds);
    res.json(result);
  } catch (error) {
    console.error("Error in activate-wialon:", error);
    res.status(500).json({ message: error.message });
  }
});

// Manually flush pending InboundMessages for this integration into Wialon.
// Useful for testing without waiting for the periodic worker.
app.post("/integrations/:id/flush-wialon", async (req, res) => {
  try {
    const result = await wialonIntegrationService.pushBatchToWialon(req.params.id);
    res.json(result);
  } catch (error) {
    console.error("Error in flush-wialon:", error);
    res.status(500).json({ message: error.message });
  }
});

// GET status of Wialon push pipeline for an integration
app.get("/integrations/:id/wialon-status", async (req, res) => {
  try {
    const integrationId = req.params.id;
    const stats = await InboundMessage.aggregate([
      { $match: { integrationId: new mongoose.Types.ObjectId(integrationId) } },
      { $group: {
        _id: "$wialonStatus",
        count: { $sum: 1 },
        lastAt: { $max: "$createdAt" },
        lastError: { $last: "$wialonError" }
      }}
    ]);
    
    const pendingCount = await InboundMessage.countDocuments({ integrationId, wialonStatus: "pending" });
    const failedCount = await InboundMessage.countDocuments({ integrationId, wialonStatus: "failed" });
    const pushedCount = await InboundMessage.countDocuments({ integrationId, wialonStatus: "pushed" });
    
    res.json({
      pending: pendingCount,
      failed: failedCount,
      pushed: pushedCount,
      details: stats
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// GET units from Wialon for an integration (to help with sync/mapping)
app.get("/integrations/:id/wialon-units", async (req, res) => {
  try {
    const integration = await Integration.findById(req.params.id);
    if (!integration) return res.status(404).json({ message: "Integration not found" });

    const token = integration.wialonToken || process.env.WIALON_API_TOKEN;
    if (!token) return res.status(400).json({ message: "No Wialon token configured" });

    const loginData = await wialonApiCall("token/login", { token });
    if (loginData.error) throw new Error(`Login error: ${loginData.error}`);
    const sid = loginData.eid;

    try {
      const data = await wialonApiCall("core/search_items", {
        spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name" },
        force: 1,
        flags: 0x1 | 0x100, // basic + custom props
        from: 0, to: 1000
      }, sid);

      res.json(data.items || []);
    } finally {
      wialonApiCall("core/logout", {}, sid).catch(() => {});
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Sync local vehicle mappings status with Wialon
app.post("/integrations/:id/sync-status", async (req, res) => {
  try {
    const integrationId = req.params.id;
    const integration = await Integration.findById(integrationId);
    if (!integration) return res.status(404).json({ message: "Integration not found" });

    const token = integration.wialonToken || process.env.WIALON_API_TOKEN;
    if (!token) return res.status(400).json({ message: "No Wialon token configured" });

    const loginData = await wialonApiCall("token/login", { token });
    if (loginData.error) throw new Error(`Login error: ${loginData.error}`);
    const sid = loginData.eid;

    try {
      // 1. Get all units from Wialon
      const data = await wialonApiCall("core/search_items", {
        spec: { itemsType: "avl_unit", propName: "sys_name", propValueMask: "*", sortType: "sys_name" },
        force: 1,
        flags: 0x1,
        from: 0, to: 1000
      }, sid);
      
      const wialonUnitIds = new Set((data.items || []).map(u => String(u.id)));
      
      // 2. Update local mappings
      const mappings = await VehicleMapping.find({ integrationId });
      let updatedCount = 0;
      
      for (const m of mappings) {
        let newStatus = m.status;
        if (m.wialonUnitId && !wialonUnitIds.has(m.wialonUnitId)) {
          newStatus = "pending"; // Lost link
        } else if (m.wialonUnitId && wialonUnitIds.has(m.wialonUnitId)) {
          newStatus = "linkedToWialon";
        }
        
        if (newStatus !== m.status) {
          m.status = newStatus;
          await m.save();
          updatedCount++;
        }
      }
      
      res.json({ success: true, updated: updatedCount, total: mappings.length });
    } finally {
      wialonApiCall("core/logout", {}, sid).catch(() => {});
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Legacy endpoint maintained for compatibility if needed
app.post("/integrations/:id/import-to-wialon", async (req, res) => {
  try {
    const { mappingIds } = req.body;
    const result = await wialonIntegrationService.importVehicles(req.params.id, mappingIds);
    res.json(result);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── Wialon API Proxy (avoids JS SDK execute limitations) ──
const WIALON_BASE = "https://hst-api.wialon.com/wialon/ajax.html";

async function wialonApiCall(svc, params, sid = null) {
  const url = new URL(WIALON_BASE);
  url.searchParams.append("svc", svc);
  if (sid) url.searchParams.append("sid", sid);

  const formData = new URLSearchParams();
  formData.append("params", JSON.stringify(params));

  const response = await fetch(url.toString(), {
    method: "POST",
    body: formData,
  });
  return response.json();
}

// GET /wialon/notifications - fetch notification rules from all resources
// Data flag 0x0400 = Resource.dataFlag.notifications — field is 'unf' (dict keyed by notif id)
app.get("/wialon/notifications", async (req, res) => {
  try {
    const token = process.env.WIALON_API_TOKEN;
    if (!token) return res.status(400).json({ error: "Missing WIALON_API_TOKEN in server .env" });

    const loginData = await wialonApiCall("token/login", { token });
    if (loginData.error) {
      return res.status(401).json({ error: `Wialon auth error: ${loginData.error}` });
    }
    const sid = loginData.eid;

    const searchData = await wialonApiCall(
      "core/search_items",
      {
        spec: {
          itemsType: "avl_resource",
          propName: "*",
          propValueMask: "*",
          sortType: "sys_name",
        },
        force: 1,
        flags: 0x0400 | 0x0800 | 0x1000 | 0x01,
        from: 0,
        to: 1000,
      },
      sid
    );

    if (searchData.error || !searchData.items) {
      await wialonApiCall("core/logout", {}, sid);
      return res.status(500).json({ error: `Search error: ${searchData.error || "no items"}` });
    }

    // Fetch all units to build id→name lookup
    const unitSearchData = await wialonApiCall(
      "core/search_items",
      {
        spec: {
          itemsType: "avl_unit",
          propName: "*",
          propValueMask: "*",
          sortType: "sys_name",
        },
        force: 1,
        flags: 0x1,
        from: 0,
        to: 1000,
      },
      sid
    );

    const unitNameMap = {};
    if (!unitSearchData.error && unitSearchData.items) {
      for (const u of unitSearchData.items) {
        unitNameMap[u.id] = u.nm || `Unit ${u.id}`;
      }
    }

    // Build geofence ID -> Name map from all resources
    const geofenceMap = {};
    for (const resItem of searchData.items) {
      if (resItem.zl && typeof resItem.zl === "object") {
        for (const [zid, z] of Object.entries(resItem.zl)) {
          geofenceMap[zid] = z.n || `Geozona ${zid}`;
        }
      }
    }

    const allNotifications = [];
    for (const resItem of searchData.items) {
      const unf = resItem.unf;
      if (!unf || typeof unf !== "object") continue;

      for (const [nid, n] of Object.entries(unf)) {
        if (!n || n.error) continue;
        const unitIds = n.un || [];
        const unitNames = unitIds.map((id) => unitNameMap[id] || `ID: ${id}`);
        const rawActions = n.act || [];
        const actionLabels = rawActions
          .map((a) => {
            if (typeof a === "string") return NOTIFICATION_ACTION_LABELS[a] || a;
            if (a && a.t) return NOTIFICATION_ACTION_LABELS[a.t] || a.t;
            return null;
          })
          .filter(Boolean);

        // Build detailed action descriptions
        const actionDescriptions = rawActions.map(a => {
          const type = typeof a === "string" ? a : (a.t || "");
          const p = a.p || {};
          
          switch(type) {
            case "notify_email":
            case "email":
              return `Enviar email a: ${p.email || p.email_to || "N/A"}`;
            case "notify_popup":
              return "Mostrar notificación en ventana emergente";
            case "notify_mobile":
            case "mobile_apps":
              return "Enviar notificación a aplicación móvil";
            case "notify_sms":
            case "sms":
              return `Enviar SMS a: ${p.phones || p.sms_to || "N/A"}`;
            case "notify_command":
            case "exec_command":
              return `Ejecutar comando: ${p.c || p.command_name || "N/A"}`;
            case "notify_http":
              return `Petición HTTP a: ${p.u || p.url || "URL"}`;
            case "notify_event":
              return "Registrar evento en la unidad";
            case "notify_telegram":
              return "Enviar mensaje a Telegram";
            case "notify_whatsapp":
              return "Enviar mensaje a WhatsApp";
            case "message":
              // In Wialon, 'message' action often means "Online notification" if no specific message text is provided
              if (typeof a === "string" || !p.message) {
                return "Mostrar notificación en ventana emergente";
              }
              return `Mensaje: ${p.message}`;
            default:
              // For unknown types, capitalize and replace underscores
              const label = NOTIFICATION_ACTION_LABELS[type];
              if (label) return label;
              return type.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
          }
        });

        // Build human-readable description
        let description = n.d || ""; // Some versions might provide a direct description
        
        // 1. Try to build description from trigger parameters (Geozones, Speed, etc.)
        if (!description && n.p) {
          // Geozones can be part of many trigger types (speed, stationary, etc.)
          if (Array.isArray(n.p.geos) && n.p.geos.length > 0) {
            const names = n.p.geos.map((id) => geofenceMap[id] || `ID: ${id}`);
            const checkType = n.p.type === 0 ? "Fuera de" : "Dentro de";
            description = `${checkType}: ${names.join(", ")}`;
          }
          
          // Append specific trigger details
          if (n.trg === "speed") {
            const speedInfo = `Velocidad: ${n.p.min || 0} a ${n.p.max || "∞"} km/h`;
            description = description ? `${description} (${speedInfo})` : speedInfo;
          } else if (n.trg === "sensor_value") {
            const sensorInfo = `Sensor: ${n.p.s || "N/A"} (${n.p.min || 0} a ${n.p.max || "∞"})`;
            description = description ? `${description} (${sensorInfo})` : sensorInfo;
          } else if (n.trg === "alarm") {
            description = description ? `${description} (Alarma)` : "Alarma / Botón de pánico";
          } else if (n.trg === "digital_input") {
            const diInfo = `Entrada digital: ${n.p.in || "N/A"}`;
            description = description ? `${description} (${diInfo})` : diInfo;
          } else if (n.trg === "outage") {
            description = "Pérdida de conexión";
          }
        }
        
        // 2. Fallback priority: Name (n.n) is usually the "ESTADIA..." text you expect.
        // We only use Text (n.txt) if Name is missing and Text isn't the generic template.
        if (!description || description === "—") {
          const isGenericText = !n.txt || n.txt === "%UNIT% %NOTIFICATION%";
          description = n.n || (!isGenericText ? n.txt : "—");
        }

        allNotifications.push({
          _key: `${resItem.id}_${nid}`,
          id: parseInt(nid),
          resourceId: resItem.id,
          name: n.n || "Sin nombre",
          triggerType: n.trg || "unknown",
          text: n.txt || "",
          description: description || "—",
          units: unitIds,
          unitNames,
          enabled: !(n.fl & 0x2),
          alarmCount: n.ac || 0,
          createdAt: n.ct,
          resourceName: resItem.nm || "—",
          actions: rawActions,
          actionLabels,
          actionDescriptions,
          raw: n,
        });
      }
    }

    // Cross-reference: find active bitácoras using any of the notification unit IDs
    // Use both String and Number variants in $in to handle mixed-type historical data
    const allUnitIdsRaw = [...new Set(allNotifications.flatMap((n) => n.units).map(String))];
    const allUnitIdsNum = allUnitIdsRaw.map(Number).filter((n) => !Number.isNaN(n));
    const allUnitIds = [...allUnitIdsRaw, ...allUnitIdsNum];
    const unitActivityMap = {};
    if (allUnitIds.length > 0) {
      const col = mongoose.connection.db.collection("bitacoras");
      const activeBits = await col
        .find(
          {
            deleted: false,
            status: { $nin: ["cerrada", "cerrada (e)", "finalizada"] },
            "transportes.gpsUnits.wialonId": { $in: allUnitIds },
          },
          {
            projection: {
              _id: 1,
              bitacora_id: 1,
              cliente: 1,
              status: 1,
              "transportes.id": 1,
              "transportes.gpsUnits.wialonId": 1,
              "transportes.gpsUnits.name": 1,
            },
          }
        )
        .toArray();

      for (const bit of activeBits) {
        for (const t of bit.transportes || []) {
          for (const g of t.gpsUnits || []) {
            const wid = String(g.wialonId);
            if (!unitActivityMap[wid]) unitActivityMap[wid] = [];
            unitActivityMap[wid].push({
              _id: bit._id?.toString?.() || String(bit._id),
              bitacora_id: bit.bitacora_id,
              cliente: bit.cliente,
              status: bit.status,
              transporteId: t.id,
              unitName: g.name || null,
              wialonId: wid,
            });
          }
        }
      }
    }

    // Attach activeBitacoras to each notification
    for (const n of allNotifications) {
      const matches = [];
      for (const uid of n.units) {
        const hits = unitActivityMap[String(uid)];
        if (hits) matches.push(...hits);
      }
      // Deduplicate by bitacora_id + transporteId
      const seen = new Set();
      n.activeBitacoras = matches.filter((m) => {
        const k = `${m.bitacora_id}_${m.transporteId}`;
        if (seen.has(k)) return false;
        seen.add(k);
        return true;
      });
    }

    await wialonApiCall("core/logout", {}, sid);
    res.json({ notifications: allNotifications });
  } catch (err) {
    console.error("Wialon notifications proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Notification Action Labels Map ──
const NOTIFICATION_ACTION_LABELS = {
  "notify_popup": "Popup",
  "notify_email": "Email",
  "notify_sms": "SMS",
  "notify_command": "Comando",
  "notify_http": "HTTP",
  "notify_event": "Evento",
  "notify_mobile": "Móvil",
  "notify_telegram": "Telegram",
  "notify_whatsapp": "WhatsApp",
  "exec_command": "Ejecutar comando",
  "message": "Notificación en línea",
  "mobile_apps": "Notificación móvil",
  "email": "Email",
  "sms": "SMS",
};

// POST /wialon/notifications/:resourceId/:notifId/toggle - enable/disable a notification
app.post("/wialon/notifications/:resourceId/:notifId/toggle", async (req, res) => {
  try {
    const token = process.env.WIALON_API_TOKEN;
    if (!token) return res.status(400).json({ error: "Missing WIALON_API_TOKEN" });

    const { resourceId, notifId } = req.params;
    const { enabled } = req.body;

    const loginData = await wialonApiCall("token/login", { token });
    if (loginData.error) {
      return res.status(401).json({ error: `Wialon auth error: ${loginData.error}` });
    }
    const sid = loginData.eid;

    const result = await wialonApiCall(
      "resource/update_notification",
      {
        itemId: parseInt(resourceId),
        id: parseInt(notifId),
        callMode: "update",
        e: enabled ? 1 : 0,
      },
      sid
    );

    await wialonApiCall("core/logout", {}, sid);

    if (result.error) {
      return res.status(500).json({ error: `Toggle error: ${result.error}` });
    }

    res.json({ success: true, enabled: !!enabled });
  } catch (err) {
    console.error("Wialon notification toggle error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /wialon/notifications/toggle-bulk - batch toggle notifications
app.post("/wialon/notifications/toggle-bulk", async (req, res) => {
  try {
    const token = process.env.WIALON_API_TOKEN;
    if (!token) return res.status(400).json({ error: "Missing WIALON_API_TOKEN" });

    const { items } = req.body;
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "items array is required" });
    }

    const loginData = await wialonApiCall("token/login", { token });
    if (loginData.error) {
      return res.status(401).json({ error: `Wialon auth error: ${loginData.error}` });
    }
    const sid = loginData.eid;

    let updated = 0;
    for (const item of items) {
      const result = await wialonApiCall(
        "resource/update_notification",
        {
          itemId: parseInt(item.resourceId),
          id: parseInt(item.notifId),
          callMode: "update",
          e: item.enabled ? 1 : 0,
        },
        sid
      );
      if (!result.error) updated++;
    }

    await wialonApiCall("core/logout", {}, sid);
    res.json({ success: true, updated });
  } catch (err) {
    console.error("Wialon notification bulk toggle error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /wialon/notifications/:resourceId/:notifId/log - fetch historical trigger log for a specific notification
app.get("/wialon/notifications/:resourceId/:notifId/log", async (req, res) => {
  try {
    const token = process.env.WIALON_API_TOKEN;
    if (!token) return res.status(400).json({ error: "Missing WIALON_API_TOKEN in server .env" });

    const { resourceId, notifId } = req.params;
    const { from, to } = req.query;

    const loginData = await wialonApiCall("token/login", { token });
    if (loginData.error) {
      return res.status(401).json({ error: `Wialon auth error: ${loginData.error}` });
    }
    const sid = loginData.eid;

    // Default to last 30 days if from/to not provided
    const now = Math.floor(Date.now() / 1000);
    const thirtyDaysAgo = now - (30 * 24 * 3600);
    
    const timeFrom = from ? parseInt(from) : thirtyDaysAgo;
    const timeTo = to ? parseInt(to) : now;

    // 1. Get the notification name by searching for it in the resource
    console.log(`[WialonLog] Searching for notification ${notifId} in resource ${resourceId}`);
    const searchRes = await wialonApiCall(
      "core/search_items",
      {
        spec: {
          itemsType: "avl_resource",
          propName: "sys_id",
          propValueMask: String(resourceId),
          sortType: "sys_name"
        },
        force: 1,
        flags: 0x0400 | 0x01,
        from: 0,
        to: 1
      },
      sid
    );

    let notifName = "";
    if (searchRes.items && searchRes.items.length > 0 && searchRes.items[0].unf) {
      const notif = searchRes.items[0].unf[notifId];
      if (notif) {
        notifName = notif.n;
        console.log(`[WialonLog] Found notification name: ${notifName}`);
      }
    }

    // 2. Get the notification log (Primary method)
    console.log(`[WialonLog] Fetching log for resource ${resourceId}, notif ${notifId} from ${timeFrom} to ${timeTo}`);
    let logEntries = [];
    const logData = await wialonApiCall(
      "resource/get_notifications_log",
      {
        itemId: parseInt(resourceId),
        col: [parseInt(notifId)],
        from: timeFrom,
        to: timeTo,
      },
      sid
    );

    if (logData && !logData.error) {
      console.log(`[WialonLog] Received logData keys: ${Object.keys(logData || {})}`);
      if (logData[notifId] && Array.isArray(logData[notifId].log)) {
        logEntries = logData[notifId].log;
      } else {
        // Fallback: search for any key that has a log array
        const firstKey = Object.keys(logData).find(k => logData[k] && Array.isArray(logData[k].log));
        if (firstKey) {
          console.log(`[WialonLog] Using fallback key ${firstKey}`);
          logEntries = logData[firstKey].log;
        }
      }
    } else {
      console.warn(`[WialonLog] resource/get_notifications_log failed or returned error: ${logData?.error || "unknown"}`);
      
      // 3. Fallback to resource messages if primary method failed and we have a name
      if (notifName) {
        console.log(`[WialonLog] Falling back to messages/load_interval for resource ${resourceId}`);
        const messagesData = await wialonApiCall(
          "messages/load_interval",
          {
            itemId: parseInt(resourceId),
            timeFrom: timeFrom,
            timeTo: timeTo,
            flags: 0,
            flagsMask: 0,
            loadCount: 5000
          },
          sid
        );

        if (messagesData && Array.isArray(messagesData.messages)) {
          console.log(`[WialonLog] Found ${messagesData.messages.length} total messages in resource`);
          // Filter by notification name
          const filtered = messagesData.messages.filter(m => 
            m.p && m.p.notification && m.p.notification.includes(notifName)
          );
          console.log(`[WialonLog] Found ${filtered.length} matching messages for "${notifName}"`);
          
          logEntries = filtered.map(m => ({
            t: m.t,
            u: 0, // Resource messages might not have unit ID in 'u' field, but it's in 'p.unit'
            txt: `[Trigger] ${m.p.notification} for unit ${m.p.unit || "Unknown"}`,
            tm: m.t,
            // Add custom fields that we can map later
            unit_name: m.p.unit,
            raw_msg: m
          }));
        }
      }
    }
    
    console.log(`[WialonLog] Total log entries found: ${logEntries.length}`);

    // 4. Build unit name lookup if we have entries and need names
    const unitNameMap = {};
    const unitsToFetch = [...new Set(logEntries.map(e => e.u).filter(u => u > 0))];
    
    if (unitsToFetch.length > 0 || logEntries.some(e => !e.unit_name)) {
      console.log(`[WialonLog] Fetching unit list for name resolution`);
        // Fetch unit names
        const unitSearchData = await wialonApiCall(
          "core/search_items",
          {
            spec: {
              itemsType: "avl_unit",
              propName: "sys_name",
              propValueMask: "*",
              sortType: "sys_name",
            },
            force: 1,
            flags: 0x1,
            from: 0,
            to: 1000,
          },
          sid
        );

        if (unitSearchData && Array.isArray(unitSearchData.items)) {
          console.log(`[WialonLog] Found ${unitSearchData.items.length} units in search`);
          unitSearchData.items.forEach(u => {
          unitNameMap[u.id] = u.nm || `Unit ${u.id}`;
        });
      }
    }

    await wialonApiCall("core/logout", {}, sid);


    // 5. Map logs to a cleaner format
    const logs = logEntries.map(entry => ({
      timestamp: entry.t,
      unitId: entry.u || (entry.raw_msg?.p?.unit_id),
      unitName: entry.unit_name || unitNameMap[entry.u] || `ID: ${entry.u}`,
      text: entry.txt || "",
      lng: entry.p?.x || entry.raw_msg?.p?.lon || entry.raw_msg?.pos?.x,
      lat: entry.p?.y || entry.raw_msg?.p?.lat || entry.raw_msg?.pos?.y,
      serverTime: entry.tm || entry.t
    }));


    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp - a.timestamp);

    res.json({ logs });
  } catch (err) {
    console.error("Wialon notification log error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /wialon/units - fetch all Wialon avl_unit items as [{id, name}]
app.get("/wialon/units", async (req, res) => {
  try {
    const token = process.env.WIALON_API_TOKEN;
    if (!token) return res.status(400).json({ error: "Missing WIALON_API_TOKEN in server .env" });

    const loginData = await wialonApiCall("token/login", { token });
    if (loginData.error) {
      return res.status(401).json({ error: `Wialon auth error: ${loginData.error}` });
    }
    const sid = loginData.eid;

    const searchData = await wialonApiCall(
      "core/search_items",
      {
        spec: {
          itemsType: "avl_unit",
          propName: "*",
          propValueMask: "*",
          sortType: "sys_name",
        },
        force: 1,
        flags: 0x1, // base flags — just id + name
        from: 0,
        to: 1000,
      },
      sid
    );

    await wialonApiCall("core/logout", {}, sid);

    if (searchData.error || !searchData.items) {
      return res.status(500).json({ error: `Search error: ${searchData.error || "no items"}` });
    }

    const units = searchData.items.map((u) => ({ id: u.id, name: u.nm || `Unit ${u.id}` }));
    res.json(units);
  } catch (err) {
    console.error("Wialon units proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// GET /wialon/geofences - fetch geofence/zone data from all resources
app.get("/wialon/geofences", async (req, res) => {
  try {
    const token = process.env.WIALON_API_TOKEN;
    if (!token) return res.status(400).json({ error: "Missing WIALON_API_TOKEN in server .env" });

    const loginData = await wialonApiCall("token/login", { token });
    if (loginData.error) {
      return res.status(401).json({ error: `Wialon auth error: ${loginData.error}` });
    }
    const sid = loginData.eid;

    const searchData = await wialonApiCall(
      "core/search_items",
      {
        spec: {
          itemsType: "avl_resource",
          propName: "*",
          propValueMask: "*",
          sortType: "sys_name",
        },
        force: 1,
        flags: 0x1000,
        from: 0,
        to: 1000,
      },
      sid
    );

    const allZones = [];
    if (!searchData.error && searchData.items) {
      for (const resItem of searchData.items) {
        const zData = await wialonApiCall(
          "resource/get_zone_data",
          { itemId: resItem.id, col: [], flags: 0x1f },
          sid
        );

        if (!zData.error && zData) {
          const arr = Array.isArray(zData) ? zData : [zData];
          for (const zoneData of arr) {
            const zones = zoneData?.d ? [zoneData] : Object.values(zoneData || {});
            for (const z of zones) {
              if (!z?.p || !z.p.length) continue;
              allZones.push({
                name: z.n || "Zona",
                type: z.t,
                points: z.p,
                color: z.c ? "#" + ((z.c >>> 0).toString(16).padStart(8, "0").slice(2)) : null,
                width: z.w,
              });
            }
          }
        }
      }
    }

    await wialonApiCall("core/logout", {}, sid);
    res.json({ zones: allZones });
  } catch (err) {
    console.error("Wialon geofences proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

// POST /wialon/proxy - generic Wialon API proxy for any service call
// Body: { svc, params } — uses server's own WIALON_API_TOKEN
app.post("/wialon/proxy", async (req, res) => {
  try {
    const token = process.env.WIALON_API_TOKEN;
    const { svc, params } = req.body;
    if (!token) return res.status(400).json({ error: "Missing WIALON_API_TOKEN in server .env" });
    if (!svc) return res.status(400).json({ error: "Missing svc parameter" });

    const loginData = await wialonApiCall("token/login", { token });
    if (loginData.error) {
      return res.status(401).json({ error: `Wialon auth error: ${loginData.error}` });
    }
    const sid = loginData.eid;

    const result = await wialonApiCall(svc, params || {}, sid);

    await wialonApiCall("core/logout", {}, sid);
    res.json(result);
  } catch (err) {
    console.error("Wialon proxy error:", err);
    res.status(500).json({ error: err.message });
  }
});

//USERS
// GET users
app.get("/users", async (req, res) => {
  try {
    const users = await User.find();
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//CREATE users
app.post("/users", async (req, res) => {
  const { email, password, firstName, lastName, phone, countryKey, role } = req.body;

  try {
    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: "Email Already Registered" });
    }

    // Hash Password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Create and save the new user
    const newUser = new User({
      email,
      password: hashedPassword, // Ensure this matches your schema
      firstName,
      lastName,
      phone,
      countryKey,
      role,
    });

    await newUser.save();
    await auditCreation({ newData: newUser.toObject(), modelId: newUser._id, user: req.session.user || {}, seccion: "Usuario" });
    res.status(201).json(newUser);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// DELETE /users/:id
app.delete("/users/:id", async (req, res) => {
  const { id } = req.params;

  try {
    const deletedUser = await User.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }
    await auditDeletion({ oldData: deletedUser.toObject(), modelId: id, user: req.session.user || {}, seccion: "Usuario" });
    res.status(200).json(deletedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//UPDATE user
app.put("/users/:id", async (req, res) => {
  const { password, firstName, lastName, phone, role, inactivityTimeout } = req.body;

  try {
    const prevUser = await User.findById(req.params.id);
    if (!prevUser) return res.status(404).json({ message: "User not found" });
    const oldData = prevUser.toObject();
    const updateData = { firstName, lastName, phone, role };
    if (password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(password, salt);
    }
    // null = use global default; 0 = infinite session (never expire); positive = personal timeout in minutes
    if (inactivityTimeout !== undefined) {
      if (inactivityTimeout === null || inactivityTimeout === undefined) {
        updateData.inactivityTimeout = null;
      } else {
        updateData.inactivityTimeout = Number(inactivityTimeout) >= 0 ? Number(inactivityTimeout) : null;
      }
    }
    const user = await User.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
    });
    await auditUpdate({ oldData, newData: updateData, modelId: req.params.id, user: req.session.user || {}, seccion: "Usuario" });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.status(200).json(user); // <-- Return updated user (not "SAVED")
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ message: "Server error" });
  }
});


//CLIENTS
// Get all clients
app.get("/clients", async (req, res) => {
  try {
    // Get user from session
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Get role permissions
    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    let clients;

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);
      clients = await Client.find({
        $or: [
          { razon_social: { $in: allowedClientNames } },
          { name: { $in: allowedClientNames } }
        ]
      });
    } else {
      // User has access to all clients
      clients = await Client.find();
    }

    res.json(clients);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new client
app.post("/clients", async (req, res) => {
  try {
    // Get next sequence number
    const maxClient = await Client.findOne().sort({ numericId: -1 }).select("numericId");
    const maxId = maxClient?.numericId || 0;
    await ClienteSequence.findByIdAndUpdate("clienteSequence", { $max: { seq: maxId } }, { upsert: true });
    const numericId = await getNextClienteSequence();
    const ID_Cliente = numericId.toString().padStart(5, "0");
    const excludeFields = ['_id', 'createdAt', 'updatedAt', 'numericId', 'ID_Cliente'];
    const clientData = { ...convertToUpperCase(req.body, excludeFields), numericId, ID_Cliente };

    const client = new Client(clientData);
    const newClient = await client.save();
    await auditCreation({ newData: newClient.toObject(), modelId: newClient._id, user: req.session.user || {}, seccion: "Cliente" });
    res.status(201).json(newClient);
  } catch (error) {
    // Handle errors
    res.status(400).json({ message: error.message });
  }
});

// Update a client
app.put("/clients/:id", async (req, res) => {
  try {
    const prevClient = await Client.findById(req.params.id);
    if (!prevClient) return res.status(404).json({ message: "Client not found" });
    const oldData = prevClient.toObject();

    // Convertir campos de texto a mayúsculas antes de actualizar
    const excludeFields = ['_id', 'createdAt', 'updatedAt', 'numericId'];
    const uppercaseData = convertToUpperCase(req.body, excludeFields);

    const updatedClient = await Client.findByIdAndUpdate(req.params.id, uppercaseData, { new: true });
    await auditUpdate({ oldData, newData: req.body, modelId: req.params.id, user: req.session.user || {}, seccion: "Cliente" });
    res.json(updatedClient);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a client
app.delete("/clients/:id", async (req, res) => {
  try {
    const deletedClient = await Client.findByIdAndDelete(req.params.id);
    if (!deletedClient) {
      return res.status(404).json({ message: "Client not found" });
    }

    // Decrement the sequence counter
    await decrementClienteSequence();

    await auditDeletion({ oldData: deletedClient.toObject(), modelId: req.params.id, user: req.session.user || {}, seccion: "Cliente" });
    res.json({ message: "Client deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

//EVENTS
app.get("/event_types", async (req, res) => {
  try {
    const eventsTypes = await EventType.find();
    res.json(eventsTypes);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//Create a new evenType
app.put("/event_types/:id", async (req, res) => {
  const { evento, categoria, calificacion } = req.body;

  try {
    const prevEvent = await EventType.findById(req.params.id);
    if (!prevEvent) return res.status(404).json({ message: "Event not found" });
    const oldData = prevEvent.toObject();
    const updatedEvent = await EventType.findByIdAndUpdate(
      req.params.id,
      { evento, categoria, calificacion },
      { new: true }
    );
    await auditUpdate({ oldData, newData: { evento, categoria, calificacion }, modelId: req.params.id, user: req.session.user || {}, seccion: "Evento" });

    if (!updatedEvent) return res.status(404).json({ message: "Event not found" });

    res.json(updatedEvent);
  } catch (err) {
    res.status(400).json({ message: err.message });
  }
});


app.post("/event_types", async (req, res) => {
  const { evento, categoria, calificacion } = req.body;

  try {
    const existingEventType = await EventType.findOne({
      evento: new RegExp(`^${evento}$`, "i"),
      categoria: new RegExp(`^${categoria}$`, "i"),
      calificacion: new RegExp(`^${calificacion}$`, "i"),
    });

    if (existingEventType) {
      return res.status(409).json({ message: "Event type already exists" });
    }

    // Get next sequence number
    const numericId = await getNextEventTypeSequence();

    const newEvent = new EventType({ evento, categoria, calificacion, numericId });
    const saved = await newEvent.save();
    await auditCreation({ newData: saved.toObject(), modelId: saved._id, user: req.session.user || {}, seccion: "Evento" });
    res.status(201).json(saved);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});


app.delete("/event_types/:id", async (req, res) => {
  try {
    const deletedEvent = await EventType.findByIdAndDelete(req.params.id);
    if (!deletedEvent) return res.status(404).json({ message: "Event not found" });

    // Decrement the sequence counter
    await decrementEventTypeSequence();

    await auditDeletion({ oldData: deletedEvent.toObject(), modelId: req.params.id, user: req.session.user || {}, seccion: "Evento" });
    res.json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

//ROLES
app.get("/roles", async (req, res) => {
  try {
    const roles = await Role.find();
    res.json(roles);
  } catch (error) {
    console.error("Error fetching roles:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});


// POST a new role
app.post("/roles", async (req, res) => {
  try {
    const role = new Role(req.body);
    const newRole = await role.save();
    await auditCreation({ newData: newRole.toObject(), modelId: newRole._id, user: req.session.user || {}, seccion: "Rol" });
    res.status(201).json(newRole);
  } catch (error) {
    console.error("Error creating role:", error);
    res.status(400).json({ message: error.message });
  }
});


// PUT update a role
app.put("/roles/:id", async (req, res) => {
  try {
    const prevRole = await Role.findById(req.params.id);
    if (!prevRole) return res.status(404).json({ message: "Role not found" });
    const oldData = prevRole.toObject();
    const updatedRole = await Role.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    await auditUpdate({ oldData, newData: req.body, modelId: req.params.id, user: req.session.user || {}, seccion: "Rol" });

    if (!updatedRole) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json(updatedRole);
  } catch (error) {
    console.error("Error updating role:", error);
    res.status(400).json({ message: error.message });
  }
});


app.get("/roles/:roleName", async (req, res) => {
  try {
    const roleName = req.params.roleName;
    const role = await Role.findOne({ name: roleName });

    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json(role);
  } catch (error) {
    res.status(500).json({ message: "Server error", error });
  }
});

// DELETE a role
app.delete("/roles/:id", async (req, res) => {
  try {
    const deletedRole = await Role.findByIdAndDelete(req.params.id);
    if (!deletedRole) return res.status(404).json({ message: "Role not found" });
    await auditDeletion({ oldData: deletedRole.toObject(), modelId: req.params.id, user: req.session.user || {}, seccion: "Rol" });
    res.json({ message: "Role deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ENDPOINTS PARA PERMISOS DE CLIENTES POR ROL

// GET clientes permitidos para un rol específico
app.get("/roles/:roleId/allowed-clients", async (req, res) => {
  try {
    const role = await Role.findById(req.params.roleId);
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    res.json({
      client_access: role.client_access,
      allowed_clients: role.allowed_clients || []
    });
  } catch (error) {
    console.error("Error fetching allowed clients:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// PUT actualizar permisos de clientes para un rol
app.put("/roles/:roleId/allowed-clients", async (req, res) => {
  try {
    const { client_access, allowed_clients } = req.body;

    // Validar que client_access sea válido
    if (!['all', 'specific'].includes(client_access)) {
      return res.status(400).json({ message: "client_access must be 'all' or 'specific'" });
    }

    // Si es 'specific', validar que se proporcionen clientes
    if (client_access === 'specific' && (!allowed_clients || allowed_clients.length === 0)) {
      return res.status(400).json({ message: "When client_access is 'specific', allowed_clients must be provided" });
    }

    const prevRole = await Role.findById(req.params.roleId);
    if (!prevRole) return res.status(404).json({ message: "Role not found" });

    const oldData = prevRole.toObject();

    const updatedRole = await Role.findByIdAndUpdate(
      req.params.roleId,
      {
        client_access: client_access,
        allowed_clients: client_access === 'all' ? [] : allowed_clients
      },
      {
        new: true,
        runValidators: true,
      }
    );

    await auditUpdate({
      oldData,
      newData: { client_access, allowed_clients },
      modelId: req.params.roleId,
      user: req.session.user || {},
      seccion: "Rol - Permisos de Clientes"
    });

    res.json(updatedRole);
  } catch (error) {
    console.error("Error updating allowed clients:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

// GET clientes filtrados según permisos del usuario actual
app.get("/clients/filtered", async (req, res) => {
  try {
    const userRole = req.session?.user?.role;

    if (!userRole) {
      return res.status(401).json({ message: "User role not found" });
    }

    // Buscar el rol del usuario
    const role = await Role.findOne({ name: userRole });
    if (!role) {
      return res.status(404).json({ message: "Role not found" });
    }

    let clients;

    if (role.client_access === 'all') {
      // Si tiene acceso a todos los clientes, devolver todos
      clients = await Client.find().sort({ razon_social: 1 });
    } else if (role.client_access === 'specific') {
      // Si tiene acceso a clientes específicos, filtrar por los permitidos
      const allowedClientIds = role.allowed_clients.map(ac => ac.client_id);
      clients = await Client.find({
        _id: { $in: allowedClientIds }
      }).sort({ razon_social: 1 });
    } else {
      // Fallback: no devolver ningún cliente
      clients = [];
    }

    res.json(clients);
  } catch (error) {
    console.error("Error fetching filtered clients:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
});

//ORIGENES
// Fetch all origenes
app.get("/origenes", async (req, res) => {
  try {
    const { cliente } = req.query;
    let query = {};

    // If cliente filter is provided, filter by cliente (case-insensitive)
    if (cliente && cliente !== "all") {
      query.cliente = { $regex: new RegExp(`^${cliente}$`, 'i') };
    }

    const origenes = await Origen.find(query);
    res.json(origenes);
  } catch (e) {
    res.status(500).json({ message: "Failed to fetch origenes", error: e.message });
  }
});

// Create a new origen
app.post("/origenes", async (req, res) => {
  try {
    // Convertir campos de texto a mayúsculas
    const excludeFields = ['_id', 'createdAt', 'updatedAt', 'numericId'];
    const uppercaseData = convertToUpperCase(req.body, excludeFields);
    const { estado, municipio: cliente, nombre } = uppercaseData;

    // Get next sequence number
    const numericId = await getNextOrigenSequence();

    const newOrigen = new Origen({ estado, cliente, nombre, numericId });
    const savedOrigen = await newOrigen.save();
    await auditCreation({ newData: savedOrigen.toObject(), modelId: savedOrigen._id, user: req.session.user || {}, seccion: "Origen" });
    res.status(201).json(savedOrigen);
  } catch (e) {
    res.status(500).json({ message: "Failed to create origen", error: e.message });
  }
});


// Edit an existing origen
app.put("/origenes/:id", async (req, res) => {
  try {
    const prevOrigen = await Origen.findById(req.params.id);
    if (!prevOrigen) return res.status(404).json({ message: "Origen not found" });
    const oldData = prevOrigen.toObject();

    // Convertir campos de texto a mayúsculas, excluyendo numericId
    const excludeFields = ['_id', 'createdAt', 'updatedAt', 'numericId'];
    const uppercaseData = convertToUpperCase(req.body, excludeFields);
    const { estado, municipio: cliente, nombre } = uppercaseData;

    const updatedOrigen = await Origen.findByIdAndUpdate(
      req.params.id,
      { estado, cliente, nombre },
      { new: true }
    );
    await auditUpdate({ oldData, newData: { estado, cliente, nombre }, modelId: req.params.id, user: req.session.user || {}, seccion: "Origen" });
    res.json(updatedOrigen);
  } catch (e) {
    res.status(500).json({ message: "Failed to edit origen", error: e.message });
  }
});


// Delete an origen
app.delete("/origenes/:id", async (req, res) => {
  try {
    const deletedOrigen = await Origen.findByIdAndDelete(req.params.id);
    if (!deletedOrigen) return res.status(404).json({ message: "Origen not found" });

    // Decrement the sequence counter
    await decrementOrigenSequence();

    await auditDeletion({ oldData: deletedOrigen.toObject(), modelId: req.params.id, user: req.session.user || {}, seccion: "Origen" });
    res.status(204).end();
  } catch (e) {
    res.status(500).json({ message: "Failed to delete origen", error: e.message });
  }
});

//DESTINOS
app.get("/destinos", async (req, res) => {
  try {
    const { cliente } = req.query;
    let query = {};

    // If cliente filter is provided, filter by cliente (case-insensitive)
    if (cliente && cliente !== "all") {
      query.cliente = { $regex: new RegExp(`^${cliente}$`, 'i') };
    }

    const destinos = await Destino.find(query);
    res.status(200).json(destinos);
  } catch (e) {
    res.status(500).json({ message: "Error fetching destinos", error: e.message });
  }
});

// Create a new destino
app.post("/destinos", async (req, res) => {
  try {
    // Convertir campos de texto a mayúsculas
    const excludeFields = ['_id', 'createdAt', 'updatedAt', 'numericId'];
    const uppercaseData = convertToUpperCase(req.body, excludeFields);
    const { estado, municipio: cliente, nombre } = uppercaseData;

    // Get next sequence number
    const numericId = await getNextDestinoSequence();

    const newDestino = new Destino({ estado, cliente, nombre, numericId });
    const savedDestino = await newDestino.save();
    await auditCreation({ newData: savedDestino.toObject(), modelId: savedDestino._id, user: req.session.user || {}, seccion: "Destino" });
    res.status(201).json(savedDestino);
  } catch (e) {
    res.status(500).json({ message: "Error creating destino", error: e.message });
  }
});


// Edit a destino
app.put("/destinos/:id", async (req, res) => {
  try {
    const prevDestino = await Destino.findById(req.params.id);
    if (!prevDestino) return res.status(404).json({ message: "Destino not found" });
    const oldData = prevDestino.toObject();

    // Convertir campos de texto a mayúsculas, excluyendo numericId
    const excludeFields = ['_id', 'createdAt', 'updatedAt', 'numericId'];
    const uppercaseData = convertToUpperCase(req.body, excludeFields);
    const { estado, municipio: cliente, nombre } = uppercaseData;

    const updatedDestino = await Destino.findByIdAndUpdate(
      req.params.id,
      { estado, cliente, nombre },
      { new: true }
    );
    await auditUpdate({ oldData, newData: { estado, cliente, nombre }, modelId: req.params.id, user: req.session.user || {}, seccion: "Destino" });
    res.status(200).json(updatedDestino);
  } catch (e) {
    res.status(500).json({ message: "Error updating destino", error: e.message });
  }
});


// Delete a destino
app.delete("/destinos/:id", async (req, res) => {
  try {
    const deletedDestino = await Destino.findByIdAndDelete(req.params.id);
    if (!deletedDestino) return res.status(404).json({ message: "Destino not found" });

    // Decrement the sequence counter
    await decrementDestinoSequence();

    await auditDeletion({ oldData: deletedDestino.toObject(), modelId: req.params.id, user: req.session.user || {}, seccion: "Destino" });
    res.status(200).json({ message: "Destino deleted successfully" });
  } catch (e) {
    res.status(500).json({ message: "Error deleting destino", error: e.message });
  }
});

//OPERADORES
// Get all operadores
app.get("/operadores", async (req, res) => {
  try {
    const { lineaTransporte } = req.query;
    let query = {};

    // If lineaTransporte filter is provided, filter by lineaTransporte
    if (lineaTransporte && lineaTransporte !== "all") {
      query.lineaTransporte = lineaTransporte;
    }

    const operadores = await Operador.find(query);
    res.status(200).json(operadores);
  } catch (e) {
    res.status(500).json({ message: "Error fetching operadores", error: e.message });
  }
});

// Get available operators from bitacoras
app.get("/operadores-bitacoras", async (req, res) => {
  try {
    const operadores = await Bitacora.aggregate([
      { $match: { deleted: { $ne: true } } }, // Exclude deleted bitacoras
      // Solo obtener operadores del campo principal bitacora.operador
      {
        $group: {
          _id: '$operador',
          nombre: { $first: '$operador' }
        }
      },
      {
        $match: {
          nombre: { $ne: null, $ne: '' }
        }
      },
      { $sort: { nombre: 1 } },
      {
        $project: {
          _id: 1,
          nombre: 1
        }
      }
    ]);

    res.status(200).json(operadores);
  } catch (e) {
    res.status(500).json({ message: "Error fetching operadores from bitacoras", error: e.message });
  }
});

// Get available transport lines from bitacoras
app.get("/lineas-transporte-bitacoras", async (req, res) => {
  try {
    const lineasTransporte = await Bitacora.aggregate([
      { $match: { deleted: { $ne: true } } }, // Exclude deleted bitacoras
      // Solo obtener líneas de transporte del array transportes
      { $unwind: '$transportes' },
      {
        $addFields: {
          'transportes.lineaTransporte': {
            $cond: {
              if: {
                $or: [
                  { $eq: ['$transportes.lineaTransporte', null] },
                  { $eq: ['$transportes.lineaTransporte', ''] },
                  { $eq: ['$transportes.lineaTransporte', undefined] }
                ]
              },
              then: 'N/A',
              else: '$transportes.lineaTransporte'
            }
          }
        }
      },
      {
        $group: {
          _id: '$transportes.lineaTransporte',
          nombre: { $first: '$transportes.lineaTransporte' }
        }
      },
      { $sort: { nombre: 1 } },
      {
        $project: {
          _id: 1,
          nombre: 1
        }
      }
    ]);

    res.status(200).json(lineasTransporte);
  } catch (e) {
    res.status(500).json({ message: "Error fetching transport lines from bitacoras", error: e.message });
  }
});

// LINEAS DE TRANSPORTE
// Get all lineas de transporte
app.get("/lineas-transporte", async (req, res) => {
  try {
    const { cliente } = req.query;
    let query = {};

    // If cliente filter is provided, filter by cliente
    if (cliente && cliente !== "all") {
      query.cliente = cliente;
    }

    const lineasTransporte = await LineaTransporte.find(query);
    res.json(lineasTransporte);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new linea de transporte
app.post("/lineas-transporte", async (req, res) => {
  try {
    // Get next sequence number
    const numericId = await getNextLineaTransporteSequence();

    const lineaTransporte = new LineaTransporte({ ...req.body, numericId });
    const newLineaTransporte = await lineaTransporte.save();
    await auditCreation({ newData: newLineaTransporte.toObject(), modelId: newLineaTransporte._id, user: req.session.user || {}, seccion: "LineaTransporte" });
    res.status(201).json(newLineaTransporte);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update a linea de transporte
app.put("/lineas-transporte/:id", async (req, res) => {
  try {
    const prevLineaTransporte = await LineaTransporte.findById(req.params.id);
    if (!prevLineaTransporte) return res.status(404).json({ message: "Linea de transporte not found" });
    const oldData = prevLineaTransporte.toObject();
    const updatedLineaTransporte = await LineaTransporte.findByIdAndUpdate(req.params.id, req.body, { new: true });
    await auditUpdate({ oldData, newData: req.body, modelId: req.params.id, user: req.session.user || {}, seccion: "LineaTransporte" });
    res.json(updatedLineaTransporte);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete a linea de transporte
app.delete("/lineas-transporte/:id", async (req, res) => {
  try {
    const deletedLineaTransporte = await LineaTransporte.findByIdAndDelete(req.params.id);
    if (!deletedLineaTransporte) {
      return res.status(404).json({ message: "Linea de transporte not found" });
    }

    // Decrement the sequence counter
    await decrementLineaTransporteSequence();

    await auditDeletion({ oldData: deletedLineaTransporte.toObject(), modelId: req.params.id, user: req.session.user || {}, seccion: "LineaTransporte" });
    res.json({ message: "Linea de transporte deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create a new operador
app.post("/operadores", async (req, res) => {
  try {
    // Get next sequence number
    const numericId = await getNextOperadorSequence();

    // Convertir campos de texto a mayúsculas
    const excludeFields = ['_id', 'createdAt', 'updatedAt', 'telefono', 'numericId'];
    const uppercaseData = convertToUpperCase(req.body, excludeFields);
    const newOperador = new Operador({ ...uppercaseData, numericId });
    const savedOperador = await newOperador.save();
    await auditCreation({ newData: savedOperador.toObject(), modelId: savedOperador._id, user: req.session.user || {}, seccion: "Operador" });
    res.status(201).json(savedOperador);
  } catch (e) {
    res.status(500).json({ message: "Error creating operador", error: e.message });
  }
});

// Edit an operador
app.put("/operadores/:id", async (req, res) => {
  try {
    const prevOperador = await Operador.findById(req.params.id);
    if (!prevOperador) return res.status(404).json({ message: "Operador not found" });
    const oldData = prevOperador.toObject();
    const updatedOperador = await Operador.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true }
    );
    await auditUpdate({ oldData, newData: req.body, modelId: req.params.id, user: req.session.user || {}, seccion: "Operador" });
    res.status(200).json(updatedOperador);
  } catch (e) {
    res.status(500).json({ message: "Error updating operador", error: e.message });
  }
});

// Delete an operador
app.delete("/operadores/:id", async (req, res) => {
  try {
    const deletedOperador = await Operador.findByIdAndDelete(req.params.id);
    if (!deletedOperador) return res.status(404).json({ message: "Operador not found" });

    // Decrement the sequence counter
    await decrementOperadorSequence();

    await auditDeletion({ oldData: deletedOperador.toObject(), modelId: req.params.id, user: req.session.user || {}, seccion: "Operador" });
    res.status(200).json({ message: "Operador deleted successfully" });
  } catch (e) {
    res.status(500).json({ message: "Error deleting operador", error: e.message });
  }
});

// ─── DRAFT TRANSPORTES ───────────────────────────────────────────────────────

// GET all pending drafts (optionally filtered by bitacora_id)
app.get("/drafts", async (req, res) => {
  try {
    const { bitacora_id } = req.query;
    const query = bitacora_id ? { bitacora_id, status: "pendiente" } : { status: "pendiente" };
    const drafts = await DraftTransporte.find(query).sort({ createdAt: -1 });
    res.json(drafts);
  } catch (e) {
    res.status(500).json({ message: "Error fetching drafts", error: e.message });
  }
});

// POST create a draft transporte entry
app.post("/drafts", async (req, res) => {
  try {
    const { bitacora_id, bitacora_num_id, transporte_id, transporte, cliente, lineaTransporte, lineaTransporte_es_draft, operador, operador_es_draft, telefono, creado_por } = req.body;

    // Remove any existing pendiente draft for this transporte (replace on re-submit)
    await DraftTransporte.deleteOne({ bitacora_id, transporte_id, status: "pendiente" });

    const draft = new DraftTransporte({
      bitacora_id, bitacora_num_id, transporte_id, transporte: transporte ?? null, cliente,
      lineaTransporte, lineaTransporte_es_draft,
      operador, operador_es_draft,
      telefono: telefono ?? null,
      creado_por,
    });
    await draft.save();

    // Set draft_pendiente on the bitacora
    await Bitacora.findByIdAndUpdate(bitacora_id, { draft_pendiente: true });

    res.status(201).json(draft);
  } catch (e) {
    res.status(500).json({ message: "Error creating draft", error: e.message });
  }
});

// Helper: resolve draft_pendiente flag after any accept/reject
const resolveBitacoraDraftFlag = async (bitacora_id) => {
  const remainingPending = await DraftTransporte.countDocuments({ bitacora_id, status: "pendiente" });
  if (remainingPending === 0) {
    await Bitacora.findByIdAndUpdate(bitacora_id, { draft_pendiente: false });
  }
};

// PUT accept a draft → create LineaTransporte and/or Operador records
app.put("/drafts/:id/accept", async (req, res) => {
  try {
    const draft = await DraftTransporte.findById(req.params.id);
    if (!draft) return res.status(404).json({ message: "Draft not found" });
    if (draft.status !== "pendiente") return res.status(400).json({ message: "Draft already resolved" });

    let createdLinea = null;

    // Create LineaTransporte if it's a draft
    if (draft.lineaTransporte_es_draft && draft.lineaTransporte) {
      const exists = await LineaTransporte.findOne({
        nombre: { $regex: `^${draft.lineaTransporte}$`, $options: "i" },
        cliente: draft.cliente,
      });
      if (!exists) {
        const numericId = await getNextLineaTransporteSequence();
        createdLinea = new LineaTransporte({ nombre: draft.lineaTransporte.toUpperCase(), cliente: draft.cliente, numericId });
        await createdLinea.save();
      } else {
        createdLinea = exists;
      }
    }

    // Create Operador if it's a draft
    let finalOperadorNombre = draft.operador;
    if (draft.operador_es_draft && draft.operador) {
      const lineaRef = createdLinea ? createdLinea.nombre : draft.lineaTransporte;
      const exists = await Operador.findOne({ nombre: { $regex: `^${draft.operador}$`, $options: "i" } });
      if (!exists) {
        const numericId = await getNextOperadorSequence();
        const newOperador = new Operador({ nombre: draft.operador.toUpperCase(), lineaTransporte: lineaRef, numericId });
        await newOperador.save();
        finalOperadorNombre = newOperador.nombre;
      } else {
        finalOperadorNombre = exists.nombre;
      }
    }

    // Update matching transportes in the bitacora (top-level and nested in eventos)
    const finalLineaNombre = draft.lineaTransporte_es_draft
      ? (createdLinea?.nombre ?? draft.lineaTransporte.toUpperCase())
      : draft.lineaTransporte;

    const setFields = {};
    if (draft.lineaTransporte_es_draft) {
      setFields["transportes.$[t].lineaTransporte"] = finalLineaNombre;
      setFields["eventos.$[].transportes.$[t].lineaTransporte"] = finalLineaNombre;
    }
    if (draft.operador_es_draft) {
      setFields["transportes.$[t].operador"] = finalOperadorNombre;
      setFields["eventos.$[].transportes.$[t].operador"] = finalOperadorNombre;
    }
    if (Object.keys(setFields).length > 0) {
      // Match by internalId if available (stable across id changes), fallback to id
      const bitacoraForDraft = await Bitacora.findById(draft.bitacora_id).select("transportes").lean();
      const matchingT = bitacoraForDraft?.transportes?.find((t) => t.id === draft.transporte_id);
      const arrayFilter = matchingT?.internalId
        ? { $or: [{ "t.internalId": matchingT.internalId }, { "t.id": draft.transporte_id }] }
        : { "t.id": draft.transporte_id };
      await Bitacora.updateOne(
        { _id: draft.bitacora_id },
        { $set: setFields },
        { arrayFilters: [arrayFilter] }
      );
    }

    draft.status = "aceptado";
    await draft.save();

    await resolveBitacoraDraftFlag(draft.bitacora_id);

    res.json({ message: "Draft accepted", draft });
  } catch (e) {
    res.status(500).json({ message: "Error accepting draft", error: e.message });
  }
});

// PUT reject a draft
app.put("/drafts/:id/reject", async (req, res) => {
  try {
    const draft = await DraftTransporte.findById(req.params.id);
    if (!draft) return res.status(404).json({ message: "Draft not found" });
    if (draft.status !== "pendiente") return res.status(400).json({ message: "Draft already resolved" });

    draft.status = "rechazado";
    await draft.save();

    await resolveBitacoraDraftFlag(draft.bitacora_id);

    res.json({ message: "Draft rejected", draft });
  } catch (e) {
    res.status(500).json({ message: "Error rejecting draft", error: e.message });
  }
});

// PUT reject a draft and provide a replacement value
app.put("/drafts/:id/reject-with-replacement", async (req, res) => {
  try {
    const draft = await DraftTransporte.findById(req.params.id);
    if (!draft) return res.status(404).json({ message: "Draft not found" });
    if (draft.status !== "pendiente") return res.status(400).json({ message: "Draft already resolved" });

    const { lineaTransporte, lineaTransporte_es_draft, operador, operador_es_draft, creado_por } = req.body;

    const anyNewDraft = lineaTransporte_es_draft || operador_es_draft;

    if (!anyNewDraft) {
      // Both replacements are existing catalog entries — update the bitacora directly
      const setFields = {};
      if (draft.lineaTransporte_es_draft && lineaTransporte) {
        setFields["transportes.$[t].lineaTransporte"] = lineaTransporte;
        setFields["eventos.$[].transportes.$[t].lineaTransporte"] = lineaTransporte;
      }
      if (draft.operador_es_draft && operador) {
        setFields["transportes.$[t].operador"] = operador;
        setFields["eventos.$[].transportes.$[t].operador"] = operador;
      }
      if (Object.keys(setFields).length > 0) {
        const bitacoraForDraft2 = await Bitacora.findById(draft.bitacora_id).select("transportes").lean();
        const matchingT2 = bitacoraForDraft2?.transportes?.find((t) => t.id === draft.transporte_id);
        const arrayFilter2 = matchingT2?.internalId
          ? { $or: [{ "t.internalId": matchingT2.internalId }, { "t.id": draft.transporte_id }] }
          : { "t.id": draft.transporte_id };
        await Bitacora.updateOne(
          { _id: draft.bitacora_id },
          { $set: setFields },
          { arrayFilters: [arrayFilter2] }
        );
      }

      draft.status = "rechazado";
      await draft.save();
      await resolveBitacoraDraftFlag(draft.bitacora_id);

      return res.json({ replaced: true, draft });
    }

    // At least one replacement is a new draft text — reject original and create a new draft
    draft.status = "rechazado";
    await draft.save();

    const newDraft = new DraftTransporte({
      bitacora_id: draft.bitacora_id,
      bitacora_num_id: draft.bitacora_num_id,
      transporte_id: draft.transporte_id,
      cliente: draft.cliente,
      lineaTransporte: lineaTransporte_es_draft ? lineaTransporte : draft.lineaTransporte,
      lineaTransporte_es_draft: !!lineaTransporte_es_draft,
      operador: operador_es_draft ? operador : draft.operador,
      operador_es_draft: !!operador_es_draft,
      creado_por: creado_por || draft.creado_por,
    });
    await newDraft.save();

    // Ensure bitacora.draft_pendiente stays true
    await Bitacora.findByIdAndUpdate(draft.bitacora_id, { draft_pendiente: true });

    return res.json({ replaced: false, newDraftId: newDraft._id, draft });
  } catch (e) {
    res.status(500).json({ message: "Error rejecting draft with replacement", error: e.message });
  }
});

//Inactividad
app.get("/inactividad/me", async (req, res) => {
  try {
    const sessionUser = req.session.user;
    if (!sessionUser) return res.status(401).json({ message: "Unauthorized" });

    const user = await User.findOne({ email: sessionUser.email });
    if (user && user.inactivityTimeout != null) {
      // 0 means infinite session — never expire
      return res.status(200).json({ value: user.inactivityTimeout, isPersonal: true, isInfinite: user.inactivityTimeout === 0 });
    }

    const globalTimeout = await Inactividad.findOne({ name: "timeoutTime" });
    res.status(200).json({ value: globalTimeout?.value ?? 5, isPersonal: false, isInfinite: false });
  } catch (e) {
    res.status(500).json({ message: "Error getting effective inactivity time", error: e.message });
  }
});

app.get("/inactividad", async (req, res) => {
  try {
    const timeoutTime = await Inactividad.find({ name: "timeoutTime" });
    res.status(200).json(timeoutTime);
  } catch (e) {
    res.status(500).json({ message: "Error getting inactivity time", error: e.message });
  }
});

app.post("/inactividad", async (req, res) => {
  const { newTimeout } = req.body;

  try {
    const timeoutTime = await Inactividad.findOne({ name: "timeoutTime" });
    if (!timeoutTime) return res.status(404).json({ message: "Timeout not found" });

    timeoutTime.value = newTimeout;
    const newTimeoutTime = await timeoutTime.save();
    res.status(200).json(newTimeoutTime);
  } catch (e) {
    res.status(500).json({ message: "Error updating inactivity time", error: e.message });
  }
});

// [POST] Create a new auditoria document
app.post('/auditoria/bitacoras', async (req, res) => {
  try {
    const newAuditoria = new Auditoria(req.body);
    const saved = await newAuditoria.save();
    res.status(201).json(saved);
  } catch (err) {
    console.error('[POST /auditoria/bitacora] Error:', err);
    res.status(500).json({ error: 'Failed to create auditoria record' });
  }
});

// [GET] Fetch all auditoria documents
app.get('/auditoria/bitacoras', async (req, res) => {
  try {
    const auditorias = await Auditoria.find().sort({ createdAt: -1 });
    res.status(200).json(auditorias);
  } catch (err) {
    console.error('[GET /auditoria/bitacora] Error:', err);
    res.status(500).json({ error: 'Failed to fetch auditoria records' });
  }
});

// Endpoint para obtener bitácoras por ubicación específica
app.get("/bitacoras/by-location/:locationName", async (req, res) => {
  try {
    const { locationName } = req.params;
    const { fechaDesde, fechaHasta, lineaTransporte, operador, geoType, page = 1, limit = 20 } = req.query;

    // Construir query base
    let query = { deleted: { $ne: true } }; // Exclude deleted bitacoras

    // Filtro por ubicación (origen o destino) con matching case-insensitive
    if (locationName && locationName !== 'all') {
      const decodedLocationName = decodeURIComponent(locationName);
      if (geoType === 'origen') {
        // Para origen, necesitamos hacer matching case-insensitive con ObjectId
        // Primero intentamos encontrar el origen por nombre para obtener su _id
        const origenDoc = await Origen.findOne({
          nombre: { $regex: new RegExp(`^${decodedLocationName}$`, 'i') }
        });

        if (origenDoc) {
          // Si encontramos el origen, buscamos bitácoras que coincidan con el _id (case-insensitive)
          query.$or = [
            { origen: origenDoc._id.toString() },
            { origen: { $regex: new RegExp(`^${origenDoc._id.toString()}$`, 'i') } },
            { 'origen.nombre': { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } }
          ];
        } else {
          // Si no encontramos el origen, buscamos por nombre (fallback)
          query.$or = [
            { origen: { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } },
            { 'origen.nombre': { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } }
          ];
        }
      } else if (geoType === 'destino') {
        // Para destino, similar lógica
        const destinoDoc = await Destino.findOne({
          nombre: { $regex: new RegExp(`^${decodedLocationName}$`, 'i') }
        });

        if (destinoDoc) {
          query.$or = [
            { destino: destinoDoc._id.toString() },
            { destino: { $regex: new RegExp(`^${destinoDoc._id.toString()}$`, 'i') } },
            { 'destino.nombre': { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } }
          ];
        } else {
          query.$or = [
            { destino: { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } },
            { 'destino.nombre': { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } }
          ];
        }
      }
    }

    // Filtros adicionales
    if (fechaDesde) {
      query.createdAt = { ...query.createdAt, $gte: new Date(fechaDesde) };
    }
    if (fechaHasta) {
      query.createdAt = { ...query.createdAt, $lte: new Date(fechaHasta + 'T23:59:59.999Z') };
    }
    if (lineaTransporte && lineaTransporte !== 'all') {
      query['transportes.lineaTransporte'] = decodeURIComponent(lineaTransporte);
    }
    if (operador && operador !== 'all') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { operador: decodeURIComponent(operador) },
          { 'transportes.operador': decodeURIComponent(operador) }
        ]
      });
    }

    // Pagination parameters
    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    // Get total count for pagination
    const totalCount = await Bitacora.countDocuments(query);
    const totalPages = Math.ceil(totalCount / limitNum);

    // Get bitacoras for this location with detailed information using aggregation
    const bitacoras = await Bitacora.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      // Add fields to handle ObjectId conversion for lookups
      {
        $addFields: {
          origenForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$origen' }, 'string'] },
                  { $regexMatch: { input: '$origen', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$origen' },
              else: '$origen'
            }
          },
          destinoForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$destino' }, 'string'] },
                  { $regexMatch: { input: '$destino', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$destino' },
              else: '$destino'
            }
          }
        }
      },
      // Lookups with ObjectId conversion
      {
        $lookup: {
          from: 'origens',
          localField: 'origenForLookup',
          foreignField: '_id',
          as: 'origenInfoById'
        }
      },
      {
        $lookup: {
          from: 'origens',
          localField: 'origen',
          foreignField: 'nombre',
          as: 'origenInfoByName'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destinoForLookup',
          foreignField: '_id',
          as: 'destinoInfoById'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destino',
          foreignField: 'nombre',
          as: 'destinoInfoByName'
        }
      },
      // Combine results - prefer _id match over nombre match
      {
        $addFields: {
          origenInfo: {
            $cond: {
              if: { $gt: [{ $size: '$origenInfoById' }, 0] },
              then: '$origenInfoById',
              else: '$origenInfoByName'
            }
          },
          destinoInfo: {
            $cond: {
              if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
              then: '$destinoInfoById',
              else: '$destinoInfoByName'
            }
          }
        }
      }
    ]);

    // Helper functions (same as in anomalias endpoint)
    const getTransportLines = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const lines = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.lineaTransporte || transporte.lineaTransporte.trim() === '') {
            return 'N/A';
          }
          return transporte.lineaTransporte;
        })
        .filter((line, index, array) => array.indexOf(line) === index); // Remove duplicates

      return lines.length > 0 ? lines.join(', ') : 'N/A';
    };

    const getTransportOperators = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const operators = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.operador || transporte.operador.trim() === '') {
            return 'N/A';
          }
          return transporte.operador;
        })
        .filter((operator, index, array) => array.indexOf(operator) === index); // Remove duplicates

      return operators.length > 0 ? operators.join(', ') : 'N/A';
    };

    const getLocationName = (locationField, lookupInfo, debugContext = '') => {
      // First, try to use lookup data if available
      if (lookupInfo && lookupInfo.length > 0) {
        const locationData = lookupInfo[0];
        const result = `${locationData.nombre}, ${locationData.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // Fallback to original field processing
      if (!locationField) {
        return 'N/A';
      }

      // If it's an object with nombre and estado properties
      if (typeof locationField === 'object' && locationField.nombre) {
        const result = `${locationField.nombre}, ${locationField.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // If it's a plain string and not an ObjectId
      if (typeof locationField === 'string' && !locationField.match(/^[0-9a-f]{24}$/i)) {
        return locationField;
      }

      // If it's an ObjectId string and no lookup data found
      return `ObjectId no resuelto: ${locationField}`;
    };

    // Format the data using the same helper functions as anomalias endpoint
    const formattedBitacoras = bitacoras.map(bitacora => {
      return {
        _id: bitacora._id,
        bitacora_id: bitacora.bitacora_id,
        fechaCreacion: bitacora.createdAt,
        cliente: bitacora.cliente,
        tipoMonitoreo: bitacora.monitoreo,
        lineaTransporte: getTransportLines(bitacora.transportes),
        operadorTransporte: getTransportOperators(bitacora.transportes),
        origen: getLocationName(bitacora.origen, bitacora.origenInfo, 'ORIGEN'),
        destino: getLocationName(bitacora.destino, bitacora.destinoInfo, 'DESTINO'),
        estado: bitacora.status,
        usuario: bitacora.operador || 'N/A'
      };
    });

    res.status(200).json({
      bitacoras: formattedBitacoras,
      pagination: {
        currentPage: pageNum,
        totalPages,
        totalCount,
        limit: limitNum,
        hasNextPage: pageNum < totalPages,
        hasPrevPage: pageNum > 1
      }
    });
  } catch (error) {
    console.error("Error fetching bitacoras by location:", error);
    res.status(500).json({ error: "Failed to fetch bitacoras for location" });
  }
});

// Endpoint para descargar todas las bitácoras de una ubicación
app.get("/bitacoras/download-location/:locationName", async (req, res) => {
  try {
    const { locationName } = req.params;
    const { fechaDesde, fechaHasta, lineaTransporte, operador, geoType } = req.query;

    // Construir query base
    let query = { deleted: { $ne: true } }; // Exclude deleted bitacoras

    // Filtro por ubicación (origen o destino) con matching case-insensitive
    if (locationName && locationName !== 'all') {
      const decodedLocationName = decodeURIComponent(locationName);
      if (geoType === 'origen') {
        // Para origen, necesitamos hacer matching case-insensitive con ObjectId
        // Primero intentamos encontrar el origen por nombre para obtener su _id
        const origenDoc = await Origen.findOne({
          nombre: { $regex: new RegExp(`^${decodedLocationName}$`, 'i') }
        });

        if (origenDoc) {
          // Si encontramos el origen, buscamos bitácoras que coincidan con el _id (case-insensitive)
          query.$or = [
            { origen: origenDoc._id.toString() },
            { origen: { $regex: new RegExp(`^${origenDoc._id.toString()}$`, 'i') } },
            { 'origen.nombre': { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } }
          ];
        } else {
          // Si no encontramos el origen, buscamos por nombre (fallback)
          query.$or = [
            { origen: { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } },
            { 'origen.nombre': { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } }
          ];
        }
      } else if (geoType === 'destino') {
        // Para destino, similar lógica
        const destinoDoc = await Destino.findOne({
          nombre: { $regex: new RegExp(`^${decodedLocationName}$`, 'i') }
        });

        if (destinoDoc) {
          query.$or = [
            { destino: destinoDoc._id.toString() },
            { destino: { $regex: new RegExp(`^${destinoDoc._id.toString()}$`, 'i') } },
            { 'destino.nombre': { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } }
          ];
        } else {
          query.$or = [
            { destino: { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } },
            { 'destino.nombre': { $regex: new RegExp(`^${decodedLocationName}$`, 'i') } }
          ];
        }
      }
    }

    // Filtros adicionales
    if (fechaDesde) {
      query.createdAt = { ...query.createdAt, $gte: new Date(fechaDesde) };
    }
    if (fechaHasta) {
      query.createdAt = { ...query.createdAt, $lte: new Date(fechaHasta + 'T23:59:59.999Z') };
    }
    if (lineaTransporte && lineaTransporte !== 'all') {
      query['transportes.lineaTransporte'] = decodeURIComponent(lineaTransporte);
    }
    if (operador && operador !== 'all') {
      query.$and = query.$and || [];
      query.$and.push({
        $or: [
          { operador: decodeURIComponent(operador) },
          { 'transportes.operador': decodeURIComponent(operador) }
        ]
      });
    }

    // Get ALL bitacoras for this location (no pagination for download) using aggregation
    const bitacoras = await Bitacora.aggregate([
      { $match: query },
      { $sort: { createdAt: -1 } },
      // Add fields to handle ObjectId conversion for lookups
      {
        $addFields: {
          origenForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$origen' }, 'string'] },
                  { $regexMatch: { input: '$origen', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$origen' },
              else: '$origen'
            }
          },
          destinoForLookup: {
            $cond: {
              if: {
                $and: [
                  { $eq: [{ $type: '$destino' }, 'string'] },
                  { $regexMatch: { input: '$destino', regex: '^[0-9a-fA-F]{24}$' } }
                ]
              },
              then: { $toObjectId: '$destino' },
              else: '$destino'
            }
          }
        }
      },
      // Lookups with ObjectId conversion
      {
        $lookup: {
          from: 'origens',
          localField: 'origenForLookup',
          foreignField: '_id',
          as: 'origenInfoById'
        }
      },
      {
        $lookup: {
          from: 'origens',
          localField: 'origen',
          foreignField: 'nombre',
          as: 'origenInfoByName'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destinoForLookup',
          foreignField: '_id',
          as: 'destinoInfoById'
        }
      },
      {
        $lookup: {
          from: 'destinos',
          localField: 'destino',
          foreignField: 'nombre',
          as: 'destinoInfoByName'
        }
      },
      // Combine results - prefer _id match over nombre match
      {
        $addFields: {
          origenInfo: {
            $cond: {
              if: { $gt: [{ $size: '$origenInfoById' }, 0] },
              then: '$origenInfoById',
              else: '$origenInfoByName'
            }
          },
          destinoInfo: {
            $cond: {
              if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
              then: '$destinoInfoById',
              else: '$destinoInfoByName'
            }
          }
        }
      }
    ]);

    // Helper functions (same as in anomalias endpoint)
    const getTransportLines = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const lines = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.lineaTransporte || transporte.lineaTransporte.trim() === '') {
            return 'N/A';
          }
          return transporte.lineaTransporte;
        })
        .filter((line, index, array) => array.indexOf(line) === index); // Remove duplicates

      return lines.length > 0 ? lines.join(', ') : 'N/A';
    };

    const getTransportOperators = (transportes) => {
      if (!transportes || !Array.isArray(transportes) || transportes.length === 0) {
        return 'N/A';
      }

      const operators = transportes
        .map(transporte => {
          // Convert null, undefined, or empty string to 'N/A'
          if (!transporte.operador || transporte.operador.trim() === '') {
            return 'N/A';
          }
          return transporte.operador;
        })
        .filter((operator, index, array) => array.indexOf(operator) === index); // Remove duplicates

      return operators.length > 0 ? operators.join(', ') : 'N/A';
    };

    const getLocationName = (locationField, lookupInfo, debugContext = '') => {
      // First, try to use lookup data if available
      if (lookupInfo && lookupInfo.length > 0) {
        const locationData = lookupInfo[0];
        const result = `${locationData.nombre}, ${locationData.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // Fallback to original field processing
      if (!locationField) {
        return 'N/A';
      }

      // If it's an object with nombre and estado properties
      if (typeof locationField === 'object' && locationField.nombre) {
        const result = `${locationField.nombre}, ${locationField.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // If it's a plain string and not an ObjectId
      if (typeof locationField === 'string' && !locationField.match(/^[0-9a-f]{24}$/i)) {
        return locationField;
      }

      // If it's an ObjectId string and no lookup data found
      return `ObjectId no resuelto: ${locationField}`;
    };

    // Format the data using the same helper functions as anomalias endpoint
    const formattedBitacoras = bitacoras.map(bitacora => {
      return {
        _id: bitacora._id,
        bitacora_id: bitacora.bitacora_id,
        fechaCreacion: bitacora.createdAt,
        cliente: bitacora.cliente,
        tipoMonitoreo: bitacora.monitoreo,
        lineaTransporte: getTransportLines(bitacora.transportes),
        operadorTransporte: getTransportOperators(bitacora.transportes),
        origen: getLocationName(bitacora.origen, bitacora.origenInfo, 'ORIGEN'),
        destino: getLocationName(bitacora.destino, bitacora.destinoInfo, 'DESTINO'),
        estado: bitacora.status,
        usuario: bitacora.operador || 'N/A'
      };
    });

    res.status(200).json({
      bitacoras: formattedBitacoras,
      totalCount: formattedBitacoras.length,
      ubicacion: decodeURIComponent(locationName)
    });
  } catch (error) {
    console.error("Error fetching all bitacoras for location download:", error);
    res.status(500).json({ error: "Failed to fetch bitacoras for location download" });
  }
});

// Dashboard Stats (for main dashboard)
/**
 * Reusable helper to build bitacora filters based on dashboard query params and user role.
 */
async function buildBitacoraFilter(user, role, query) {
  const {
    timeFilter = 'all',
    yearFilter = new Date().getFullYear(),
    clientFilter = 'all',
    fechaDesde = '',
    fechaHasta = '',
    lineaTransporte = 'all',
    operador = 'all'
  } = query;

  // Build time filter
  let timeFilterQuery = {};
  if (timeFilter !== 'all') {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    switch (timeFilter) {
      case 'today':
        timeFilterQuery = { createdAt: { $gte: startOfDay } };
        break;
      case 'week':
        const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
        timeFilterQuery = { createdAt: { $gte: startOfWeek } };
        break;
      case 'month':
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        timeFilterQuery = { createdAt: { $gte: startOfMonth } };
        break;
      case 'quarter':
        const currentQuarter = Math.floor(now.getMonth() / 3);
        const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
        timeFilterQuery = { createdAt: { $gte: startOfQuarter } };
        break;
      case 'year':
        const startOfYear = new Date(now.getFullYear(), 0, 1);
        timeFilterQuery = { createdAt: { $gte: startOfYear } };
        break;
    }
  }

  // Build filters based on user permissions
  let bitacoraFilter = { deleted: { $ne: true } }; // Exclude deleted bitacoras

  // Apply client permissions based on role
  if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
    const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);
    if (clientFilter !== 'all') {
      if (!allowedClientNames.includes(clientFilter)) {
        throw new Error('Access denied to this client');
      }
      bitacoraFilter.cliente = clientFilter;
    } else {
      bitacoraFilter.cliente = { $in: allowedClientNames };
    }
  } else {
    if (clientFilter !== 'all') {
      bitacoraFilter.cliente = clientFilter;
    }
  }

  // Add date range filter
  if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
    const startDate = new Date(fechaDesde);
    const endDate = new Date(fechaHasta + 'T23:59:59.999Z');
    if (!isNaN(startDate) && !isNaN(endDate)) {
      bitacoraFilter.createdAt = { $gte: startDate, $lte: endDate };
    }
  } else if (yearFilter && yearFilter !== 'all') {
    const startOfYear = new Date(parseInt(yearFilter), 0, 1);
    const endOfYear = new Date(parseInt(yearFilter), 11, 31, 23, 59, 59);
    bitacoraFilter.createdAt = { $gte: startOfYear, $lte: endOfYear };
  } else if (Object.keys(timeFilterQuery).length > 0) {
    bitacoraFilter = { ...bitacoraFilter, ...timeFilterQuery };
  }

  // Add transport line filter
  if (lineaTransporte !== 'all') {
    const lineFilter = {
      $or: [
        { linea_transporte: lineaTransporte },
        { 'transportes.lineaTransporte': lineaTransporte }
      ]
    };
    if (bitacoraFilter.$and) {
      bitacoraFilter.$and.push(lineFilter);
    } else if (Object.keys(bitacoraFilter).some(k => k.startsWith('$'))) {
      const existing = { ...bitacoraFilter };
      Object.keys(bitacoraFilter).forEach(k => delete bitacoraFilter[k]);
      bitacoraFilter.$and = [existing, lineFilter];
    } else {
      Object.assign(bitacoraFilter, lineFilter);
    }
  }

  // Add operator filter
  if (operador !== 'all') {
    const opFilter = {
      $or: [
        { operador: operador },
        { 'transportes.operador': operador }
      ]
    };
    if (bitacoraFilter.$and) {
      bitacoraFilter.$and.push(opFilter);
    } else {
      // Handle potential existing $or from line filter
      const currentKeys = Object.keys(bitacoraFilter);
      if (currentKeys.includes('$or')) {
        const existingOr = { $or: bitacoraFilter.$or };
        delete bitacoraFilter.$or;
        bitacoraFilter.$and = [existingOr, opFilter];
      } else {
        Object.assign(bitacoraFilter, opFilter);
      }
    }
  }

  // Personal bitacoras only if no read_all
  if (!role.bitacoras?.read_all) {
    const userFullName = `${user.firstName} ${user.lastName}`;
    if (operador === 'all') {
      const personalFilter = {
        $or: [
          { operador: userFullName },
          { 'transportes.operador': userFullName }
        ]
      };
      if (bitacoraFilter.$and) {
        bitacoraFilter.$and.push(personalFilter);
      } else if (bitacoraFilter.$or) {
        const existingOr = { $or: bitacoraFilter.$or };
        delete bitacoraFilter.$or;
        bitacoraFilter.$and = [existingOr, personalFilter];
      } else {
        Object.assign(bitacoraFilter, personalFilter);
      }
    }
  }

  return bitacoraFilter;
}

app.get('/dashboard/summary', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'User not found' });
    const role = await Role.findOne({ name: user.role });
    if (!role) return res.status(401).json({ message: 'Role not found' });

    const filter = await buildBitacoraFilter(user, role, req.query);
    
    // For summary cards, we often want a wider range if no dates provided
    let summaryFilter = { ...filter };
    if (!req.query.fechaDesde && !req.query.fechaHasta) {
      const defaultStartDate = new Date('2024-01-01');
      summaryFilter.createdAt = { $gte: defaultStartDate, $lte: new Date() };
    }

    const [
      total,
      nuevas,
      enProceso,
      cerradas,
      anomalias,
      totalUsers,
      totalClients,
      recentActivity
    ] = await Promise.all([
      Bitacora.countDocuments(summaryFilter),
      Bitacora.countDocuments({ ...summaryFilter, status: 'nueva' }),
      Bitacora.countDocuments({ ...summaryFilter, status: { $in: ['validada', 'iniciada'] } }),
      Bitacora.countDocuments({ ...summaryFilter, status: { $in: ['cerrada', 'finalizada'] } }),
      // Anomaly detection logic (needs to be consistent with main stats)
      getCachedAnomalyEventTypes().then(async (eventTypes) => {
        const anomalyNames = eventTypes.map(et => et.evento);
        return Bitacora.countDocuments({
          ...summaryFilter,
          'eventos.nombre': { $in: anomalyNames }
        });
      }),
      role.usuarios?.read ? User.countDocuments() : Promise.resolve(0),
      role.clientes?.read ? Client.countDocuments() : Promise.resolve(0),
      Auditoria.find().sort({ createdAt: -1 }).limit(10).populate('bitacora_id', 'bitacora_id').lean()
    ]);

    res.json({
      totalBitacoras: total,
      nuevasBitacoras: nuevas,
      enProcesoBitacoras: enProceso,
      cerradasBitacoras: cerradas,
      totalBitacorasConAnomalias: anomalias,
      totalUsers,
      totalClients,
      recentActivity: recentActivity.map(activity => ({
        description: `${activity.tipo} - ${activity.seccion}`,
        icon: getActivityIcon(activity.tipo),
        color: getActivityColor(activity.tipo),
        timestamp: activity.createdAt
      }))
    });
  } catch (err) {
    console.error('[GET /dashboard/summary] Error:', err);
    res.status(500).json({ error: err.message || 'Failed to fetch summary' });
  }
});
    app.get('/dashboard/trends', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'User not found' });
    const role = await Role.findOne({ name: user.role });
    if (!role) return res.status(401).json({ message: 'Role not found' });

    const filter = await buildBitacoraFilter(user, role, req.query);
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

    // We want the last 12 months by default if no date filter
    const now = new Date();
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(now.getMonth() - 11);
    twelveMonthsAgo.setDate(1);
    twelveMonthsAgo.setHours(0, 0, 0, 0);

    const trendFilter = { ...filter };
    if (!req.query.fechaDesde && !req.query.fechaHasta && !req.query.yearFilter) {
      trendFilter.createdAt = { $gte: twelveMonthsAgo };
    }

    const aggregation = await Bitacora.aggregate([
      { $match: trendFilter },
      {
        $group: {
          _id: {
            year: { $year: "$createdAt" },
            month: { $month: "$createdAt" },
            status: "$status"
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Process aggregation results into the format expected by frontend
    const monthlyDataMap = {};
    const statusDataMap = {
      Activas: {},
      Completadas: {},
      Pendientes: {}
    };

    aggregation.forEach(item => {
      const { year, month, status } = item._id;
      const key = `${year}-${month}`;
      
      // Monthly total
      monthlyDataMap[key] = (monthlyDataMap[key] || 0) + item.count;

      // Status trends
      if (status === 'nueva') {
        statusDataMap.Pendientes[key] = (statusDataMap.Pendientes[key] || 0) + item.count;
      }
      if (['cerrada', 'finalizada'].includes(status)) {
        statusDataMap.Completadas[key] = (statusDataMap.Completadas[key] || 0) + item.count;
      } else {
        statusDataMap.Activas[key] = (statusDataMap.Activas[key] || 0) + item.count;
      }
    });

    // Fill in gaps for the last 12 months (or the filtered range)
    const monthlyData = [];
    const statusTrends = [
      { status: 'Activas', color: '#10b981', data: [] },
      { status: 'Completadas', color: '#3b82f6', data: [] },
      { status: 'Pendientes', color: '#f59e0b', data: [] }
    ];

    // Determine range
    let start, end;
    if (req.query.fechaDesde && req.query.fechaHasta) {
      start = new Date(req.query.fechaDesde);
      end = new Date(req.query.fechaHasta);
    } else if (req.query.yearFilter && req.query.yearFilter !== 'all') {
      const y = parseInt(req.query.yearFilter);
      start = new Date(y, 0, 1);
      end = new Date(y, 11, 31);
    } else {
      start = twelveMonthsAgo;
      end = now;
    }

    let curr = new Date(start.getFullYear(), start.getMonth(), 1);
    while (curr <= end) {
      const y = curr.getFullYear();
      const m = curr.getMonth() + 1;
      const key = `${y}-${m}`;
      const label = months[curr.getMonth()];

      monthlyData.push({
        month: label,
        year: y,
        value: monthlyDataMap[key] || 0
      });

      statusTrends[0].data.push({ month: label, value: statusDataMap.Activas[key] || 0 });
      statusTrends[1].data.push({ month: label, value: statusDataMap.Completadas[key] || 0 });
      statusTrends[2].data.push({ month: label, value: statusDataMap.Pendientes[key] || 0 });

      curr.setMonth(curr.getMonth() + 1);
    }

    res.json({ monthlyData, statusTrends });
  } catch (err) {
    console.error('[GET /dashboard/trends] Error:', err);
    res.status(500).json({ error: 'Failed to fetch trends' });
  }
});

app.get('/dashboard/rankings', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'User not found' });
    const role = await Role.findOne({ name: user.role });
    if (!role) return res.status(401).json({ message: 'Role not found' });

    const filter = await buildBitacoraFilter(user, role, req.query);

    const rankings = await Bitacora.aggregate([
      { $match: filter },
      {
        $facet: {
          topClients: [
            { $group: { _id: '$cliente', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { nombre: '$_id', count: 1 } }
          ],
          topOperadores: [
            { $group: { _id: '$operador', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { name: '$_id', count: 1 } }
          ],
          topLineasTransporte: [
            { $unwind: '$transportes' },
            { $group: { _id: '$transportes.lineaTransporte', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { nombre: '$_id', count: 1 } }
          ],
          topOperadoresTransportes: [
            { $unwind: '$transportes' },
            { $group: { _id: '$transportes.operador', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 },
            { $project: { nombre: '$_id', count: 1 } }
          ],
          tiposMonitoreo: [
            { $group: { _id: '$monitoreo', count: { $sum: 1 } } },
            { $project: { nombre: '$_id', count: 1 } }
          ]
        }
      }
    ]);

    const result = rankings[0];
    const monitoringColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    result.tiposMonitoreo = (result.tiposMonitoreo || []).map((tipo, index) => ({
      ...tipo,
      nombre: tipo.nombre || 'N/A',
      color: monitoringColors[index % monitoringColors.length]
    }));

    res.json(result);
  } catch (err) {
    console.error('[GET /dashboard/rankings] Error:', err);
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/dashboard/event-stats', async (req, res) => {
  try {
    const user = req.session.user;
    const role = await Role.findOne({ name: user.role });
    const filter = await buildBitacoraFilter(user, role, req.query);
    const eventTypes = await getCachedAnomalyEventTypes();
    const anomalyNames = eventTypes.map(et => et.evento);

    const stats = await Bitacora.aggregate([
      { $match: filter },
      { $unwind: '$eventos' },
      {
        $facet: {
          distribution: [
            { $group: { _id: '$eventos.tipo', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 10 }
          ],
          allEvents: [
            { $group: { _id: '$eventos.nombre', count: { $sum: 1 } } }
          ]
        }
      }
    ]);

    const eventColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
    const formattedDistribution = stats[0].distribution.map((event, index) => ({
      name: event._id || 'Sin especificar',
      count: event.count,
      color: eventColors[index % eventColors.length]
    }));

    const categoryMap = { ENA: 0, ONC: 0, DR: 0, FM: 0 };
    const categoryLabels = { ENA: 'Exceso Velocidad', ONC: 'Otras', DR: 'Desvío Ruta', FM: 'Falla Mecánica' };
    
    stats[0].allEvents.forEach(e => {
      const type = eventTypes.find(et => et.evento === e._id);
      if (type && categoryMap[type.categoria] !== undefined) {
        categoryMap[type.categoria] += e.count;
      }
    });

    const formattedCategories = Object.keys(categoryMap).map(cat => ({
      name: categoryLabels[cat],
      value: categoryMap[cat],
      color: cat === 'ENA' ? '#ef4444' : cat === 'ONC' ? '#f59e0b' : cat === 'DR' ? '#3b82f6' : '#10b981'
    })).filter(c => c.value > 0);

    res.json({
      eventDistribution: formattedDistribution,
      eventCategoriesStats: formattedCategories
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed' });
  }
});

app.get('/dashboard/performance', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: 'User not found' });
    const role = await Role.findOne({ name: user.role });
    if (!role) return res.status(401).json({ message: 'Role not found' });

    const filter = await buildBitacoraFilter(user, role, req.query);

    const [efficiency, performance] = await Promise.all([
      Bitacora.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$operador',
            total: { $sum: 1 },
            completed: { $sum: { $cond: [{ $in: ['$status', ['cerrada', 'finalizada']] }, 1, 0] } }
          }
        },
        { $sort: { total: -1 } },
        { $limit: 10 },
        {
          $project: {
            name: '$_id',
            total: 1,
            completed: 1,
            efficiency: { $multiply: [{ $divide: ['$completed', '$total'] }, 100] }
          }
        }
      ]),
      Bitacora.aggregate([
        { $match: filter },
        {
          $group: {
            _id: '$cliente',
            completed: { $sum: { $cond: [{ $in: ['$status', ['cerrada', 'finalizada']] }, 1, 0] } },
            pending: { $sum: { $cond: [{ $eq: ['$status', 'nueva'] }, 1, 0] } }
          }
        },
        { $sort: { completed: -1 } },
        { $limit: 10 },
        {
          $project: {
            name: '$_id',
            completed: 1,
            pending: 1
          }
        }
      ])
    ]);

    res.json({
      operatorEfficiency: efficiency,
      clientPerformance: performance
    });
  } catch (err) {
    console.error('[GET /dashboard/performance] Error:', err);
    res.status(500).json({ error: 'Failed to fetch performance stats' });
  }
});
// Process-level cache for anomaly EventTypes (refreshed every 5 min)
let _anomalyEventTypeCache = null;
let _anomalyEventTypeCacheTime = 0;
async function getCachedAnomalyEventTypes() {
  const now = Date.now();
  if (_anomalyEventTypeCache && now - _anomalyEventTypeCacheTime < 5 * 60 * 1000) {
    return _anomalyEventTypeCache;
  }
  const eventTypes = await EventType.find({ categoria: { $in: ['ENA', 'ONC', 'DR', 'FM'] } }).lean();
  _anomalyEventTypeCache = eventTypes;
  _anomalyEventTypeCacheTime = now;
  return eventTypes;
}

// Process-level cache for /dashboard/summary-counts (refreshed every 60s)
let _summaryCountsCache = null;
let _summaryCountsCacheTime = 0;
const SUMMARY_COUNTS_CACHE_TTL = 60 * 1000;

// Dashboard Stats for Anomalias Dashboard (without default time filters)
// Get geographic data independently
app.get('/dashboard/geographic-stats', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    const {
      clientFilter = 'all',
      fechaDesde = '',
      fechaHasta = '',
      lineaTransporte = 'all',
      operador = 'all',
      geoType = 'origen'
    } = req.query;

    let bitacoraFilter = { deleted: { $ne: true } };

    // Apply client permissions
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);
      if (clientFilter !== 'all') {
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else if (clientFilter !== 'all') {
      bitacoraFilter.cliente = clientFilter;
    }

    // Date filter
    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');
      if (!isNaN(startDate) && !isNaN(endDate)) {
        bitacoraFilter.createdAt = { $gte: startDate, $lte: endDate };
      }
    }

    // Transport line and Operator filters (applied similarly to stats endpoint)
    if (lineaTransporte !== 'all') {
      bitacoraFilter.lineaTransporte = lineaTransporte;
    }
    if (operador !== 'all') {
      bitacoraFilter.operador = operador;
    }

    // User permissions (non-read_all)
    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      const userFilter = {
        $or: [
          { operador: userFullName },
          { 'transportes.operador': userFullName }
        ]
      };
      
      if (bitacoraFilter.$and) {
        bitacoraFilter.$and.push(userFilter);
      } else if (Object.keys(bitacoraFilter).length > 1 || bitacoraFilter.deleted) {
        const existing = { ...bitacoraFilter };
        bitacoraFilter = { $and: [existing, userFilter] };
      } else {
        Object.assign(bitacoraFilter, userFilter);
      }
    }

    let geographicData = [];
    if (geoType === 'destino') {
      geographicData = await Bitacora.aggregate([
        { $match: bitacoraFilter },
        { $group: { _id: '$destino', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        {
          $addFields: {
            destinoForLookup: {
              $cond: {
                if: {
                  $and: [
                    { $eq: [{ $type: '$_id' }, 'string'] },
                    { $regexMatch: { input: '$_id', regex: '^[0-9a-fA-F]{24}$' } }
                  ]
                },
                then: { $toObjectId: '$_id' },
                else: '$_id'
              }
            }
          }
        },
        {
          $lookup: {
            from: 'destinos',
            localField: 'destinoForLookup',
            foreignField: '_id',
            as: 'destinoInfoById'
          }
        },
        {
          $lookup: {
            from: 'destinos',
            localField: '_id',
            foreignField: 'nombre',
            as: 'destinoInfoByName'
          }
        },
        {
          $addFields: {
            destinoInfo: {
              $cond: {
                if: { $gt: [{ $size: '$destinoInfoById' }, 0] },
                then: '$destinoInfoById',
                else: '$destinoInfoByName'
              }
            }
          }
        },
        {
          $project: {
            name: {
              $cond: {
                if: { $gt: [{ $size: '$destinoInfo' }, 0] },
                then: { $arrayElemAt: ['$destinoInfo.nombre', 0] },
                else: '$_id'
              }
            },
            count: 1
          }
        }
      ]);
    } else {
      geographicData = await Bitacora.aggregate([
        { $match: bitacoraFilter },
        { $group: { _id: '$origen', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        {
          $addFields: {
            origenForLookup: {
              $cond: {
                if: {
                  $and: [
                    { $eq: [{ $type: '$_id' }, 'string'] },
                    { $regexMatch: { input: '$_id', regex: '^[0-9a-fA-F]{24}$' } }
                  ]
                },
                then: { $toObjectId: '$_id' },
                else: '$_id'
              }
            }
          }
        },
        {
          $lookup: {
            from: 'origens',
            localField: 'origenForLookup',
            foreignField: '_id',
            as: 'origenInfoById'
          }
        },
        {
          $lookup: {
            from: 'origens',
            localField: '_id',
            foreignField: 'nombre',
            as: 'origenInfoByName'
          }
        },
        {
          $addFields: {
            origenInfo: {
              $cond: {
                if: { $gt: [{ $size: '$origenInfoById' }, 0] },
                then: '$origenInfoById',
                else: '$origenInfoByName'
              }
            }
          }
        },
        {
          $project: {
            name: {
              $cond: {
                if: { $gt: [{ $size: '$origenInfo' }, 0] },
                then: { $arrayElemAt: ['$origenInfo.nombre', 0] },
                else: '$_id'
              }
            },
            count: 1
          }
        }
      ]);
    }

    res.json(geographicData);
  } catch (error) {
    console.error('Error fetching geographic stats:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});

app.get('/dashboard/anomalias-stats', async (req, res) => {
  try {
    console.log('=== DEBUG: /dashboard/anomalias-stats ===');

    // Get user from session (already verified by middleware)
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    // Get role permissions
    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    // Get filter parameters
    const {
      clientFilter = 'all',
      fechaDesde = '',
      fechaHasta = '',
      lineaTransporte = 'all',
      operador = 'all'
    } = req.query;

    console.log('Query params:', { clientFilter, fechaDesde, fechaHasta, lineaTransporte, operador });

    // Build filters based on user permissions
    let bitacoraFilter = { deleted: { $ne: true } }; // Exclude deleted bitacoras

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);

      if (clientFilter !== 'all') {
        // If a specific client is selected, verify it's in the allowed list
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        // If no specific client is selected, filter by all allowed clients
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else {
      // User has access to all clients
      if (clientFilter !== 'all') {
        bitacoraFilter.cliente = clientFilter;
      }
    }

    // Add date range filter
    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');

      if (!isNaN(startDate) && !isNaN(endDate)) {
        bitacoraFilter.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }

    // Note: lineaTransporte and operador filters are applied in the aggregation pipeline
    // after $unwind: '$eventos.transportes' to ensure correct nested field matching

    if (!role.bitacoras?.read_all) {
      // If user can't read all bitacoras, filter by their name
      const userFullName = `${user.firstName} ${user.lastName}`;
      // Only override operator filter if no specific operator is selected
      if (operador === 'all') {
        if (bitacoraFilter.$or || bitacoraFilter.$and) {
          // If we already have filters, create $and to combine them
          const existingFilters = {};
          if (bitacoraFilter.$or) {
            existingFilters.$or = bitacoraFilter.$or;
            delete bitacoraFilter.$or;
          }
          if (bitacoraFilter.$and) {
            existingFilters.$and = bitacoraFilter.$and;
            delete bitacoraFilter.$and;
          }

          bitacoraFilter.$and = [
            existingFilters,
            {
              $or: [
                { operador: userFullName },
                { 'transportes.operador': userFullName }
              ]
            }
          ];
        } else {
          bitacoraFilter.$or = [
            { operador: userFullName },
            { 'transportes.operador': userFullName }
          ];
        }
      }
    }

    // Get bitacora statistics
    // For total cards, use January 2024 as default start date if no date filters are provided
    let totalCardsFilter = { ...bitacoraFilter };
    if (!fechaDesde || !fechaHasta || fechaDesde.trim() === '' || fechaHasta.trim() === '') {
      // Default to January 2024 for total cards when no date filters are provided
      const defaultStartDate = new Date('2024-01-01');
      const defaultEndDate = new Date(); // Current date

      totalCardsFilter.createdAt = {
        $gte: defaultStartDate,
        $lte: defaultEndDate
      };
    }

    // Use cached event types
    const eventTypes = await getCachedAnomalyEventTypes();
    const allEventNames = eventTypes.map(et => et.evento);
    const eventTypeCategoryMap = new Map(eventTypes.map(et => [et.evento?.toLowerCase(), et.categoria]));

    // Parallelize the 4 count queries
    const [totalBitacoras, nuevasBitacoras, enProcesoBitacoras, cerradasBitacoras] = await Promise.all([
      Bitacora.countDocuments(totalCardsFilter),
      Bitacora.countDocuments({ ...totalCardsFilter, status: 'nueva' }),
      Bitacora.countDocuments({ ...totalCardsFilter, status: { $in: ['validada', 'iniciada'] } }),
      Bitacora.countDocuments({ ...totalCardsFilter, status: { $in: ['cerrada', 'finalizada'] } }),
    ]);

    // Get event categories statistics for pie chart (excluding "General")
    let eventCategoriesStats = [];
    let totalBitacorasConAnomalias = 0;
    try {
      // Pre-filter bitacoras that have at least one anomaly event, then count unique bitacoras
      const anomaliaFilter = { ...bitacoraFilter, 'eventos.nombre': { $in: allEventNames } };

      const [totalBitacorasConAnomaliasResult, rawCategoryStats] = await Promise.all([
        // Count unique bitacoras with anomaly eventos (no $lookup needed — pre-filter does it)
        Bitacora.aggregate([
          { $match: anomaliaFilter },
          { $unwind: '$eventos' },
          { $match: { 'eventos.nombre': { $in: allEventNames } } },
          ...(lineaTransporte !== 'all' ? [{ $unwind: '$eventos.transportes' }, {
            $match: {
              $expr: {
                $eq: [
                  { $toLower: { $trim: { input: '$eventos.transportes.lineaTransporte' } } },
                  { $toLower: { $trim: { input: lineaTransporte } } }
                ]
              }
            }
          }] : []),
          ...(operador !== 'all' ? [
            ...(lineaTransporte === 'all' ? [{ $unwind: '$eventos.transportes' }] : []),
            {
              $match: {
                $expr: {
                  $eq: [
                    { $toLower: { $trim: { input: '$eventos.transportes.operador' } } },
                    { $toLower: { $trim: { input: operador } } }
                  ]
                }
              }
            }
          ] : []),
          { $group: { _id: '$_id' } },
          { $count: 'total' }
        ]),
        // Count by event nombre, map category in JS (no $lookup to eventtypes/lineas/operadores)
        Bitacora.aggregate([
          { $match: anomaliaFilter },
          { $unwind: '$eventos' },
          { $match: { 'eventos.nombre': { $in: allEventNames } } },
          ...(lineaTransporte !== 'all' || operador !== 'all' ? [{ $unwind: '$eventos.transportes' }] : []),
          ...(lineaTransporte !== 'all' ? [{
            $match: {
              $expr: {
                $eq: [
                  { $toLower: { $trim: { input: '$eventos.transportes.lineaTransporte' } } },
                  { $toLower: { $trim: { input: lineaTransporte } } }
                ]
              }
            }
          }] : []),
          ...(operador !== 'all' ? [{
            $match: {
              $expr: {
                $eq: [
                  { $toLower: { $trim: { input: '$eventos.transportes.operador' } } },
                  { $toLower: { $trim: { input: operador } } }
                ]
              }
            }
          }] : []),
          { $group: { _id: '$eventos.nombre', count: { $sum: 1 } } }
        ])
      ]);

      totalBitacorasConAnomalias = totalBitacorasConAnomaliasResult.length > 0 ? totalBitacorasConAnomaliasResult[0].total : 0;

      // Map event names to categories in JS using cached map
      const catCounts = {};
      for (const stat of rawCategoryStats) {
        const cat = eventTypeCategoryMap.get(stat._id?.toLowerCase());
        if (cat) catCounts[cat] = (catCounts[cat] || 0) + stat.count;
      }
      eventCategoriesStats = catCounts;

      // Format with colors
      const categoryColors = { 'ENA': '#3b82f6', 'FM': '#10b981', 'ONC': '#f59e0b', 'DR': '#ef4444' };
      eventCategoriesStats = ['ENA', 'FM', 'ONC', 'DR'].map(cat => ({
        categoria: cat,
        count: eventCategoriesStats[cat] || 0,
        color: categoryColors[cat]
      }));
    } catch (error) {
      console.log('Error fetching event categories stats:', error);
      eventCategoriesStats = [];
    }

    const response = {
      totalBitacoras,
      nuevasBitacoras,
      enProcesoBitacoras,
      cerradasBitacoras,
      totalBitacorasConAnomalias,
      eventCategoriesStats
    };

    console.log('=== DEBUG: Final response for /dashboard/anomalias-stats ===');
    console.log('Response:', JSON.stringify(response, null, 2));

    res.status(200).json(response);

  } catch (err) {
    console.error('[GET /dashboard/anomalias-stats] Error:', err);
    res.status(500).json({ error: 'Failed to fetch anomalias dashboard statistics' });
  }
});

// Helper functions for dashboard
function getActivityIcon(tipo) {
  const iconMap = {
    'CREATE': 'fa-plus',
    'UPDATE': 'fa-edit',
    'DELETE': 'fa-trash',
    'LOGIN': 'fa-sign-in-alt',
    'LOGOUT': 'fa-sign-out-alt'
  };
  return iconMap[tipo] || 'fa-info-circle';
}

function getActivityColor(tipo) {
  const colorMap = {
    'CREATE': 'success',
    'UPDATE': 'info',
    'DELETE': 'danger',
    'LOGIN': 'primary',
    'LOGOUT': 'secondary'
  };
  return colorMap[tipo] || 'muted';
}

// Additional dashboard endpoints for detailed data
app.get('/dashboard/monthly-trend', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findById(user.role);
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    const { yearFilter = new Date().getFullYear() } = req.query;

    // Build filters based on user permissions
    let bitacoraFilter = {};
    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      bitacoraFilter.operador = userFullName;
    }

    // Add year filter
    if (yearFilter && yearFilter !== 'all') {
      const startOfYear = new Date(parseInt(yearFilter), 0, 1);
      const endOfYear = new Date(parseInt(yearFilter), 11, 31, 23, 59, 59);
      bitacoraFilter.createdAt = {
        $gte: startOfYear,
        $lte: endOfYear
      };
    }

    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyData = [];

    for (let i = 0; i < 12; i++) {
      const date = new Date(parseInt(yearFilter), i, 1);
      const startOfMonth = new Date(date.getFullYear(), date.getMonth(), 1);
      const endOfMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0);

      const monthCount = await Bitacora.countDocuments({
        ...bitacoraFilter,
        createdAt: { $gte: startOfMonth, $lte: endOfMonth }
      });

      monthlyData.push({
        month: months[i],
        year: parseInt(yearFilter),
        value: monthCount
      });
    }

    res.status(200).json(monthlyData);
  } catch (err) {
    console.error('[GET /dashboard/monthly-trend] Error:', err);
    res.status(500).json({ error: 'Failed to fetch monthly trend data' });
  }
});

app.get('/dashboard/status-distribution', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    const { timeFilter = 'all', yearFilter = new Date().getFullYear(), clientFilter = 'all' } = req.query;

    // Build time filter
    let timeFilterQuery = {};
    if (timeFilter !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (timeFilter) {
        case 'today':
          timeFilterQuery = { createdAt: { $gte: startOfDay } };
          break;
        case 'week':
          const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
          timeFilterQuery = { createdAt: { $gte: startOfWeek } };
          break;
        case 'month':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          timeFilterQuery = { createdAt: { $gte: startOfMonth } };
          break;
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
          timeFilterQuery = { createdAt: { $gte: startOfQuarter } };
          break;
        case 'year':
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          timeFilterQuery = { createdAt: { $gte: startOfYear } };
          break;
      }
    }

    // Add year filter
    if (yearFilter) {
      const startOfYear = new Date(parseInt(yearFilter), 0, 1);
      const endOfYear = new Date(parseInt(yearFilter), 11, 31, 23, 59, 59);
      timeFilterQuery = {
        ...timeFilterQuery,
        createdAt: {
          $gte: startOfYear,
          $lte: endOfYear
        }
      };
    }

    // Build filters based on user permissions
    let bitacoraFilter = { ...timeFilterQuery };

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);

      if (clientFilter !== 'all') {
        // If a specific client is selected, verify it's in the allowed list
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        // If no specific client is selected, filter by all allowed clients
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else {
      // User has access to all clients
      if (clientFilter !== 'all') {
        bitacoraFilter.cliente = clientFilter;
      }
    }

    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      bitacoraFilter.operador = userFullName;
    }

    const statusDistribution = await Bitacora.aggregate([
      { $match: bitacoraFilter },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    const statusColors = {
      'nueva': '#10b981',
      'cerrada': '#3b82f6',
      'finalizada': '#3b82f6',
      'creada': '#f59e0b',
      'en_proceso': '#8b5cf6'
    };

    const formattedStatusDistribution = statusDistribution.map(status => ({
      status: status._id,
      count: status.count,
      color: statusColors[status._id] || '#64748b'
    }));

    res.status(200).json(formattedStatusDistribution);
  } catch (err) {
    console.error('[GET /dashboard/status-distribution] Error:', err);
    res.status(500).json({ error: 'Failed to fetch status distribution data' });
  }
});

app.get('/dashboard/event-types', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    const { timeFilter = 'all', yearFilter = new Date().getFullYear(), clientFilter = 'all' } = req.query;

    // Build time filter
    let timeFilterQuery = {};
    if (timeFilter !== 'all') {
      const now = new Date();
      const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      switch (timeFilter) {
        case 'today':
          timeFilterQuery = { createdAt: { $gte: startOfDay } };
          break;
        case 'week':
          const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
          timeFilterQuery = { createdAt: { $gte: startOfWeek } };
          break;
        case 'month':
          const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
          timeFilterQuery = { createdAt: { $gte: startOfMonth } };
          break;
        case 'quarter':
          const currentQuarter = Math.floor(now.getMonth() / 3);
          const startOfQuarter = new Date(now.getFullYear(), currentQuarter * 3, 1);
          timeFilterQuery = { createdAt: { $gte: startOfQuarter } };
          break;
        case 'year':
          const startOfYear = new Date(now.getFullYear(), 0, 1);
          timeFilterQuery = { createdAt: { $gte: startOfYear } };
          break;
      }
    }

    // Add year filter
    if (yearFilter && yearFilter !== 'all') {
      const startOfYear = new Date(parseInt(yearFilter), 0, 1);
      const endOfYear = new Date(parseInt(yearFilter), 11, 31, 23, 59, 59);
      timeFilterQuery = {
        ...timeFilterQuery,
        createdAt: {
          $gte: startOfYear,
          $lte: endOfYear
        }
      };
    }

    // Build filters based on user permissions
    let bitacoraFilter = { ...timeFilterQuery };

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);

      if (clientFilter !== 'all') {
        // If a specific client is selected, verify it's in the allowed list
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        // If no specific client is selected, filter by all allowed clients
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else {
      // User has access to all clients
      if (clientFilter !== 'all') {
        bitacoraFilter.cliente = clientFilter;
      }
    }

    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      bitacoraFilter.operador = userFullName;
    }

    const eventTypes = await Bitacora.aggregate([
      { $match: bitacoraFilter },
      { $unwind: '$eventos' },
      { $group: { _id: '$eventos.nombre', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    const eventColors = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899', '#6366f1'];

    const formattedEventTypes = eventTypes.map((event, index) => ({
      name: event._id || 'Sin especificar',
      count: event.count,
      color: eventColors[index % eventColors.length]
    }));

    res.status(200).json(formattedEventTypes);
  } catch (err) {
    console.error('[GET /dashboard/event-types] Error:', err);
    res.status(500).json({ error: 'Failed to fetch event types data' });
  }
});

// Test endpoint for event categories
app.get('/test/event-categories', async (req, res) => {
  try {
    // Get all event types
    const eventTypes = await EventType.find();
    console.log('All event types:', eventTypes);

    // Get event types by category
    const eventTypesByCategory = await EventType.find({ categoria: { $in: ['ENA', 'ONC', 'DR', 'FM'] } });
    console.log('Event types by category:', eventTypesByCategory);

    // Get some bitacoras with events
    const bitacorasWithEvents = await Bitacora.find({ 'eventos.0': { $exists: true } }).limit(5);
    console.log('Bitacoras with events:', bitacorasWithEvents);

    res.json({
      allEventTypes: eventTypes,
      eventTypesByCategory: eventTypesByCategory,
      bitacorasWithEvents: bitacorasWithEvents
    });
  } catch (error) {
    console.error('Error in test endpoint:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para obtener datos de eventos ONC para el gráfico de barras
app.get('/dashboard/onc-events', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    // Obtener filtros de la query
    const {
      clientFilter = 'all',
      fechaDesde = '',
      fechaHasta = '',
      lineaTransporte = 'all',
      operador = 'all'
    } = req.query;

    // Construir filtros de bitácora
    let bitacoraFilter = {};

    // Filtro de fechas
    console.log('ONC Date filter values:', { fechaDesde, fechaHasta, fechaDesdeType: typeof fechaDesde, fechaHastaType: typeof fechaHasta });

    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');

      console.log('ONC Parsed dates:', { startDate, endDate, startDateValid: !isNaN(startDate), endDateValid: !isNaN(endDate) });

      if (!isNaN(startDate) && !isNaN(endDate)) {
        bitacoraFilter.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
        console.log('ONC Date filter applied:', bitacoraFilter.createdAt);
      }
    }

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);

      if (clientFilter !== 'all') {
        // If a specific client is selected, verify it's in the allowed list
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        // If no specific client is selected, filter by all allowed clients
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else {
      // User has access to all clients
      if (clientFilter !== 'all') {
        bitacoraFilter.cliente = clientFilter;
      }
    }

    // Note: lineaTransporte and operador filters are applied in the aggregation pipeline
    // after $unwind: '$eventos.transportes' to ensure correct nested field matching



    // Debug: Log the filters being used for ONC events
    console.log('ONC events filters:', {
      clientFilter,
      fechaDesde,
      fechaHasta,
      lineaTransporte,
      operador,
      bitacoraFilter: JSON.stringify(bitacoraFilter, null, 2)
    });

    // Filtro de permisos de usuario para ONC events
    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      // Always apply user permission filter, but if a specific operator is selected, 
      // make sure it matches the user's name
      if (operador !== 'all' && operador !== userFullName) {
        // If a specific operator is selected that doesn't match the user, return empty results
        console.log('ONC events: User does not have permission to view this operator, returning empty results');
        return res.status(200).json([]);
      }

      // If we already have filters, we need to combine them properly
      if (bitacoraFilter.$or || bitacoraFilter.$and || Object.keys(bitacoraFilter).some(key => key !== 'cliente' && key !== 'createdAt')) {
        // Create a new $and filter to combine existing filters with user permission filter
        const existingFilters = {};
        if (bitacoraFilter.$or) {
          existingFilters.$or = bitacoraFilter.$or;
          delete bitacoraFilter.$or;
        }
        if (bitacoraFilter.$and) {
          existingFilters.$and = bitacoraFilter.$and;
          delete bitacoraFilter.$and;
        }

        // Add other existing filters
        Object.keys(bitacoraFilter).forEach(key => {
          if (key !== 'cliente' && key !== 'createdAt') {
            existingFilters[key] = bitacoraFilter[key];
            delete bitacoraFilter[key];
          }
        });

        bitacoraFilter.$and = [
          existingFilters,
          {
            $or: [
              { operador: userFullName },
              { 'transportes.operador': userFullName }
            ]
          }
        ];
      } else {
        bitacoraFilter.$or = [
          { operador: userFullName },
          { 'transportes.operador': userFullName }
        ];
      }
    }

    // Obtener todos los eventos de tipo ONC
    const oncEventTypes = await EventType.find({ categoria: 'ONC' });
    console.log('ONC Event types found:', oncEventTypes);

    // First, let's see how many bitacoras match our filter
    const matchingBitacoras = await Bitacora.find(bitacoraFilter).limit(5);
    console.log('Matching bitacoras for ONC events (first 5):', matchingBitacoras.map(b => ({
      _id: b._id,
      bitacora_id: b.bitacora_id,
      operador: b.operador,
      eventos: b.eventos?.length || 0
    })));

    // Obtener datos de eventos ONC de las bitácoras con catalog validation
    const oncEventsData = await Bitacora.aggregate([
      { $match: bitacoraFilter },
      { $unwind: '$eventos' },
      {
        $lookup: {
          from: 'eventtypes',
          localField: 'eventos.nombre',
          foreignField: 'evento',
          as: 'eventTypeInfo'
        }
      },
      {
        $match: {
          'eventTypeInfo.categoria': 'ONC'
        }
      },
      // Unwind the transportes array within each evento
      { $unwind: '$eventos.transportes' },
      // Verify that the transport line exists in the official catalog
      {
        $lookup: {
          from: 'lineatransportes',
          let: {
            lineaTransporte: '$eventos.transportes.lineaTransporte',
            cliente: '$cliente'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $toLower: { $trim: { input: '$nombre' } } }, { $toLower: { $trim: { input: '$$lineaTransporte' } } }] },
                    { $eq: [{ $toLower: { $trim: { input: '$cliente' } } }, { $toLower: { $trim: { input: '$$cliente' } } }] }
                  ]
                }
              }
            }
          ],
          as: 'lineaTransporteInfo'
        }
      },
      // Verify that the operator exists in the official catalog and is linked to the transport line
      {
        $lookup: {
          from: 'operadores',
          let: {
            operador: '$eventos.transportes.operador',
            lineaTransporte: '$eventos.transportes.lineaTransporte'
          },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: [{ $toLower: { $trim: { input: '$nombre' } } }, { $toLower: { $trim: { input: '$$operador' } } }] },
                    { $eq: [{ $toLower: { $trim: { input: '$lineaTransporte' } } }, { $toLower: { $trim: { input: '$$lineaTransporte' } } }] }
                  ]
                }
              }
            }
          ],
          as: 'operadorInfo'
        }
      },
      // Only include if transport line exists in the official catalog (less restrictive)
      {
        $match: {
          'lineaTransporteInfo': { $ne: [] }
        }
      },
      // Apply transport line filter if specified
      ...(lineaTransporte !== 'all' ? [{
        $match: {
          $expr: {
            $eq: [
              { $toLower: { $trim: { input: '$eventos.transportes.lineaTransporte' } } },
              { $toLower: { $trim: { input: lineaTransporte } } }
            ]
          }
        }
      }] : []),
      // Apply operator filter if specified
      ...(operador !== 'all' ? [{
        $match: {
          $expr: {
            $eq: [
              { $toLower: { $trim: { input: '$eventos.transportes.operador' } } },
              { $toLower: { $trim: { input: operador } } }
            ]
          }
        }
      }] : []),
      {
        $group: {
          _id: '$eventos.nombre',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    console.log('ONC Events data:', oncEventsData);

    // Debug logging
    console.log('[DEBUG] ONC events endpoint:', {
      clientFilter,
      lineaTransporte,
      operador,
      oncEventTypesCount: oncEventTypes.length,
      oncEventsDataCount: oncEventsData.length,
      oncEventTypes: oncEventTypes.map(et => et.evento),
      oncEventsDataRaw: oncEventsData.slice(0, 5)
    });

    // Función para generar iniciales del evento
    const getEventInitials = (eventName) => {
      // Obtener la parte antes del "/"
      const parts = eventName.split('/');
      if (parts.length === 0) {
        return eventName.substring(0, 3).toUpperCase();
      }

      const beforeSlash = parts[0].trim();

      // Dividir en palabras y obtener las iniciales
      const words = beforeSlash.split(' ').filter(word => word.length > 0);

      if (words.length === 0) {
        return eventName.substring(0, 3).toUpperCase();
      }

      // Generar iniciales basadas en el número de palabras
      let initials = '';
      if (words.length === 1) {
        // Si es 1 palabra, usar solo una letra
        initials = words[0].charAt(0).toUpperCase();
      } else if (words.length === 2) {
        // Si son 2 palabras, usar 2 letras
        initials = words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase();
      } else if (words.length >= 3) {
        // Si son 3 o más palabras, usar 3 letras
        initials = words[0].charAt(0).toUpperCase() + words[1].charAt(0).toUpperCase() + words[2].charAt(0).toUpperCase();
      }

      return initials;
    };

    // Colores para las barras
    const barColors = [
      '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4',
      '#84cc16', '#f97316', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'
    ];

    // Formatear datos para el gráfico
    const formattedData = oncEventTypes.map((eventType, index) => {
      const eventData = oncEventsData.find(data => data._id === eventType.evento);
      const count = eventData ? eventData.count : 0;

      return {
        eventName: eventType.evento,
        initials: getEventInitials(eventType.evento),
        count: count,
        color: barColors[index % barColors.length]
      };
    });

    res.status(200).json(formattedData);
  } catch (error) {
    console.error('[GET /dashboard/onc-events] Error:', error);
    res.status(500).json({ error: 'Failed to fetch ONC events data' });
  }
});

// Endpoint para obtener bitácoras con anomalías
app.get('/dashboard/bitacoras-anomalias', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    // Obtener filtros de la query
    const {
      clientFilter = 'all',
      fechaDesde = '',
      fechaHasta = '',
      lineaTransporte = 'all',
      operador = 'all'
    } = req.query;

    // Construir filtros de bitácora
    let bitacoraFilter = { deleted: { $ne: true } }; // Exclude deleted bitacoras

    // Filtro de fechas
    console.log('Bitacoras Anomalias Date filter values:', { fechaDesde, fechaHasta, fechaDesdeType: typeof fechaDesde, fechaHastaType: typeof fechaHasta });

    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');

      console.log('Bitacoras Anomalias Parsed dates:', { startDate, endDate, startDateValid: !isNaN(startDate), endDateValid: !isNaN(endDate) });

      if (!isNaN(startDate) && !isNaN(endDate)) {
        bitacoraFilter.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
        console.log('Bitacoras Anomalias Date filter applied:', bitacoraFilter.createdAt);
      }
    }

    // Note: lineaTransporte and operador filters are applied in the aggregation pipeline
    // after $unwind: '$eventos.transportes' to ensure correct nested field matching

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);

      if (clientFilter !== 'all') {
        // If a specific client is selected, verify it's in the allowed list
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        // If no specific client is selected, filter by all allowed clients
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else {
      // User has access to all clients
      if (clientFilter !== 'all') {
        bitacoraFilter.cliente = clientFilter;
      }
    }

    // Filtro de permisos de usuario para bitacoras anomalias
    // NOTE: For the anomalies dashboard, we want to show ALL bitacoras with anomalies,
    // not just the ones where the current user is the operator
    // This allows users to see the complete picture of anomalies in the system
    /*
    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      // Always apply user permission filter, but if a specific operator is selected, 
      // make sure it matches the user's name
      if (operador !== 'all' && operador !== userFullName) {
        // If a specific operator is selected that doesn't match the user, return empty results
        console.log('Bitacoras anomalias: User does not have permission to view this operator, returning empty results');
        return res.status(200).json([]);
      }

      // If we already have filters, we need to combine them properly
      if (bitacoraFilter.$or || bitacoraFilter.$and || Object.keys(bitacoraFilter).some(key => key !== 'cliente' && key !== 'createdAt')) {
        // Create a new $and filter to combine existing filters with user permission filter
        const existingFilters = {};
        if (bitacoraFilter.$or) {
          existingFilters.$or = bitacoraFilter.$or;
          delete bitacoraFilter.$or;
        }
        if (bitacoraFilter.$and) {
          existingFilters.$and = bitacoraFilter.$and;
          delete bitacoraFilter.$and;
        }

        // Add other existing filters
        Object.keys(bitacoraFilter).forEach(key => {
          if (key !== 'cliente' && key !== 'createdAt') {
            existingFilters[key] = bitacoraFilter[key];
            delete bitacoraFilter[key];
          }
        });

        bitacoraFilter.$and = [
          existingFilters,
          {
            $or: [
              { operador: userFullName },
              { 'transportes.operador': userFullName }
            ]
          }
        ];
      } else {
        bitacoraFilter.$or = [
          { operador: userFullName },
          { 'transportes.operador': userFullName }
        ];
      }
    }
    */

    // Pre-fetch reference data in parallel — avoids per-doc $lookup inside aggregation
    const [allEventTypes, allOrigens, allDestinos] = await Promise.all([
      EventType.find({}).lean(),
      Origen.find({}).lean(),
      Destino.find({}).lean(),
    ]);

    // Build in-memory Maps for O(1) resolution
    const eventTypeCategoryMap = new Map(allEventTypes.map(et => [et.evento?.toLowerCase(), et.categoria]));
    const anomalyEventNames = allEventTypes
      .filter(et => et.categoria && et.categoria !== 'General')
      .map(et => et.evento);

    const origenById = new Map(allOrigens.map(o => [o._id.toString().toLowerCase(), o]));
    const origenByName = new Map(allOrigens.map(o => [o.nombre?.toLowerCase(), o]));
    const destinoById = new Map(allDestinos.map(d => [d._id.toString().toLowerCase(), d]));
    const destinoByName = new Map(allDestinos.map(d => [d.nombre?.toLowerCase(), d]));

    let bitacorasConAnomalias;
    try {
      bitacorasConAnomalias = await Bitacora.aggregate([
        { $match: bitacoraFilter },
        // Pre-filter to only bitácoras that have at least one anomaly event — avoids full unwind
        { $match: { 'eventos.nombre': { $in: anomalyEventNames } } },
        { $unwind: '$eventos' },
        // Keep only anomaly events — no $lookup needed, we matched names above
        { $match: { 'eventos.nombre': { $in: anomalyEventNames } } },
        // Transport line filter
        ...(lineaTransporte !== 'all' ? [{
          $match: {
            $expr: {
              $or: [
                {
                  $in: [
                    { $toLower: { $trim: { input: lineaTransporte } } },
                    {
                      $map: {
                        input: { $ifNull: ['$transportes', []] },
                        as: 'transporte',
                        in: { $toLower: { $trim: { input: { $ifNull: ['$$transporte.lineaTransporte', ''] } } } }
                      }
                    }
                  ]
                },
                {
                  $eq: [
                    { $toLower: { $trim: { input: lineaTransporte } } },
                    { $toLower: { $trim: { input: { $ifNull: ['$linea_transporte', ''] } } } }
                  ]
                }
              ]
            }
          }
        }] : []),
        // Operator filter
        ...(operador !== 'all' ? [{
          $match: {
            $expr: {
              $or: [
                {
                  $in: [
                    { $toLower: { $trim: { input: operador } } },
                    {
                      $map: {
                        input: { $ifNull: ['$transportes', []] },
                        as: 'transporte',
                        in: { $toLower: { $trim: { input: { $ifNull: ['$$transporte.operador', ''] } } } }
                      }
                    }
                  ]
                },
                {
                  $eq: [
                    { $toLower: { $trim: { input: operador } } },
                    { $toLower: { $trim: { input: { $ifNull: ['$operador', ''] } } } }
                  ]
                }
              ]
            }
          }
        }] : []),
        { $sort: { createdAt: -1 } }
      ]);
    } catch (aggregationError) {
      console.error('Error in aggregation pipeline:', aggregationError);
      throw new Error(`Aggregation failed: ${aggregationError.message}`);
    }

    // Helper function to extract location name using lookup data
    const getLocationName = (locationField, lookupInfo, debugContext = '') => {
      // First, try to use lookup data if available
      if (lookupInfo && lookupInfo.length > 0) {
        const locationData = lookupInfo[0];
        const result = `${locationData.nombre}, ${locationData.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // Fallback to original field processing
      if (!locationField) {
        return 'N/A';
      }

      // If it's an object with nombre and estado properties
      if (typeof locationField === 'object' && locationField.nombre) {
        const result = `${locationField.nombre}, ${locationField.estado || ''}`.trim().replace(/,$/, '');
        return result;
      }

      // If it's a plain string and not an ObjectId
      if (typeof locationField === 'string' && !locationField.match(/^[0-9a-f]{24}$/i)) {
        return locationField;
      }

      // If it's an ObjectId string and no lookup data found
      return `ObjectId no resuelto: ${locationField}`;
    };

    // Helper function to extract safe field value (handles objects and ObjectIds)
    const getSafeFieldValue = (field) => {
      if (!field) return 'N/A';

      // If it's an object, try to extract a meaningful value
      if (typeof field === 'object') {
        // If it has a 'nombre' property, use that
        if (field.nombre) return field.nombre;
        // If it has a 'razon_social' property (for clients), use that
        if (field.razon_social) return field.razon_social;
        // Otherwise, convert to string
        return String(field);
      }

      // If it's already a string, return as is
      return field;
    };

    // Sentinel placeholder values that mean "no data" — stored historically in the DB
    const SENTINEL_VALUES = new Set(['s/e', 's/n', 'sn', 'na', 'n/a', 's/d', 'nd', 'sin datos', 'sin dato']);
    const isSentinel = (v) => SENTINEL_VALUES.has(v.toLowerCase().trim());

    // Helper function to get transport lines from transportes array, with top-level field fallback.
    // Old records stored linea_transporte as a top-level field; newer records store it per-transporte.
    const getTransportLines = (transportes, topLevelFallback) => {
      const lines = (transportes || [])
        .map(t => (t.lineaTransporte || '').trim())
        .filter(v => v && !isSentinel(v))
        .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

      if (lines.length > 0) return lines.join(', ');

      // Fallback: top-level bitacora.linea_transporte (legacy single-transporte records)
      const fallback = (topLevelFallback || '').trim();
      return (fallback && !isSentinel(fallback)) ? fallback : null;
    };

    // Helper function to get operators from transportes array, with top-level field fallback.
    const getTransportOperators = (transportes, topLevelFallback) => {
      const operators = (transportes || [])
        .map(t => (t.operador || '').trim())
        .filter(v => v && !isSentinel(v))
        .filter((v, i, a) => a.indexOf(v) === i); // deduplicate

      if (operators.length > 0) return operators.join(', ');

      // Fallback: top-level bitacora.operador (legacy single-transporte records)
      const fallback = (topLevelFallback || '').trim();
      return (fallback && !isSentinel(fallback)) ? fallback : null;
    };

    // Formatear los datos para la respuesta
    const formattedBitacoras = bitacorasConAnomalias.map(bitacora => {
      // Obtener las categorías únicas de eventos para esta bitácora
      // Each item is one anomaly event (pipeline no longer groups by bitácora)
      const evento = bitacora.eventos; // single unwound event
      const categoria = eventTypeCategoryMap.get(evento?.nombre?.toLowerCase());

      const isValid = (v) => v && typeof v === 'string' && v.trim() !== '' && v.trim() !== '--';

      // Build structured GPS readings per transporte unit, preserving unit identity
      const gpsTransportes = evento?.transportes || [];
      const gpsReadings = gpsTransportes.map((t) => {
        const g = (t.gpsData && t.gpsData.length > 0) ? t.gpsData[0] : null;
        const unitName = g?.name || t.gpsUnits?.[0]?.name || t.placa || null;
        const get = (field) => {
          const fromG = g?.data?.[field];
          const fromR = t.registro?.[field];
          const val = isValid(fromG) ? fromG.trim() : isValid(fromR) ? fromR.trim() : null;
          return val;
        };
        return {
          unit: unitName,
          ultimo_posicionamiento: get('ultimo_posicionamiento'),
          ubicacion: get('ubicacion'),
          coordenadas: get('coordenadas'),
          velocidad: get('velocidad'),
        };
      }).filter(r => r.ubicacion || r.coordenadas || r.velocidad || r.ultimo_posicionamiento);

      // Flat joined strings kept for Excel export and legacy filters
      const joinField = (field) => {
        const vals = gpsReadings.map(r => r[field]).filter(Boolean);
        return vals.length > 0 ? vals.join(' | ') : null;
      };

      return {
        _id: `${bitacora._id}_${evento?._id || evento?.nombre}`,
        bitacora_id: bitacora.bitacora_id,
        folio_servicio: (() => {
          const raw = (bitacora.folio_servicio || bitacora.edited_bitacora?.folio_servicio || '').trim();
          return raw && !isSentinel(raw) ? raw : null;
        })(),
        cliente: getSafeFieldValue(bitacora.cliente),
        linea_transporte: getTransportLines(bitacora.transportes, bitacora.linea_transporte),
        operador: getTransportOperators(bitacora.transportes, bitacora.operador),
        origen: (() => {
          const raw = bitacora.origen;
          if (!raw) return null;
          const key = raw.toString().toLowerCase();
          const o = origenById.get(key) || origenByName.get(key);
          if (o) return `${o.nombre}${o.estado && o.estado !== 'SELECCIONE UN ESTADO' ? ', ' + o.estado : ''}`.trim();
          // Plain string that isn't an ObjectId — return as-is
          if (!/^[0-9a-f]{24}$/i.test(raw)) return raw;
          // ObjectId with no matching catalog entry — don't expose raw ID
          return null;
        })(),
        destino: (() => {
          const raw = bitacora.destino;
          if (!raw) return null;
          const key = raw.toString().toLowerCase();
          const d = destinoById.get(key) || destinoByName.get(key);
          if (d) return `${d.nombre}${d.estado && d.estado !== 'SELECCIONE UN ESTADO' ? ', ' + d.estado : ''}`.trim();
          if (!/^[0-9a-f]{24}$/i.test(raw)) return raw;
          return null;
        })(),
        status: getSafeFieldValue(bitacora.status),
        createdAt: bitacora.createdAt,
        categorias: categoria ? [categoria] : [],
        eventoNombres: evento?.nombre ? [evento.nombre] : [],
        totalEventos: 1,
        gpsReadings,
        ultimo_posicionamiento: joinField('ultimo_posicionamiento'),
        ubicacion: joinField('ubicacion'),
        coordenadas: joinField('coordenadas'),
        velocidad: joinField('velocidad'),
      };
    });

    console.log(`=== DEBUG: Final formatted data has ${formattedBitacoras.length} items`);
    if (formattedBitacoras.length > 0) {
      console.log('First formatted bitacora sample:', JSON.stringify(formattedBitacoras[0], null, 2));
    }

    res.status(200).json(formattedBitacoras);
  } catch (error) {
    console.error('[GET /dashboard/bitacoras-anomalias] Error:', error);
    res.status(500).json({ error: 'Failed to fetch bitacoras with anomalies' });
  }
});

// Endpoint para obtener estadísticas de anomalías por cliente
app.get('/dashboard/client-anomalias-stats', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    // Obtener filtros de la query
    const {
      clientFilter = 'all',
      fechaDesde = '',
      fechaHasta = '',
      lineaTransporte = 'all',
      operador = 'all'
    } = req.query;

    // Construir filtros de bitácora
    let bitacoraFilter = {};

    // Filtro de fechas
    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');

      if (!isNaN(startDate) && !isNaN(endDate)) {
        bitacoraFilter.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);

      if (clientFilter !== 'all') {
        // If a specific client is selected, verify it's in the allowed list
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        // If no specific client is selected, filter by all allowed clients
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else {
      // User has access to all clients
      if (clientFilter !== 'all') {
        bitacoraFilter.cliente = clientFilter;
      }
    }

    // Filtro de línea de transporte
    if (lineaTransporte !== 'all') {
      if (bitacoraFilter.$or || bitacoraFilter.$and || Object.keys(bitacoraFilter).some(key => key !== 'cliente' && key !== 'createdAt')) {
        const existingFilters = {};
        if (bitacoraFilter.$or) {
          existingFilters.$or = bitacoraFilter.$or;
          delete bitacoraFilter.$or;
        }
        if (bitacoraFilter.$and) {
          existingFilters.$and = bitacoraFilter.$and;
          delete bitacoraFilter.$and;
        }

        Object.keys(bitacoraFilter).forEach(key => {
          if (key !== 'cliente' && key !== 'createdAt') {
            existingFilters[key] = bitacoraFilter[key];
            delete bitacoraFilter[key];
          }
        });

        bitacoraFilter.$and = [
          existingFilters,
          {
            $or: [
              { linea_transporte: lineaTransporte },
              { 'transportes.lineaTransporte': lineaTransporte }
            ]
          }
        ];
      } else {
        bitacoraFilter.$or = [
          { linea_transporte: lineaTransporte },
          { 'transportes.lineaTransporte': lineaTransporte }
        ];
      }
    }

    // Filtro de operador
    if (operador !== 'all') {
      if (bitacoraFilter.$or || bitacoraFilter.$and || Object.keys(bitacoraFilter).some(key => key !== 'cliente' && key !== 'createdAt')) {
        const existingFilters = {};
        if (bitacoraFilter.$or) {
          existingFilters.$or = bitacoraFilter.$or;
          delete bitacoraFilter.$or;
        }
        if (bitacoraFilter.$and) {
          existingFilters.$and = bitacoraFilter.$and;
          delete bitacoraFilter.$and;
        }

        Object.keys(bitacoraFilter).forEach(key => {
          if (key !== 'cliente' && key !== 'createdAt') {
            existingFilters[key] = bitacoraFilter[key];
            delete bitacoraFilter[key];
          }
        });

        bitacoraFilter.$and = [
          existingFilters,
          {
            $or: [
              { operador: operador },
              { 'transportes.operador': operador }
            ]
          }
        ];
      } else {
        bitacoraFilter.$or = [
          { operador: operador },
          { 'transportes.operador': operador }
        ];
      }
    }

    // Filtro de permisos de usuario
    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      if (operador !== 'all' && operador !== userFullName) {
        return res.status(200).json([]);
      }

      if (bitacoraFilter.$or || bitacoraFilter.$and || Object.keys(bitacoraFilter).some(key => key !== 'cliente' && key !== 'createdAt')) {
        const existingFilters = {};
        if (bitacoraFilter.$or) {
          existingFilters.$or = bitacoraFilter.$or;
          delete bitacoraFilter.$or;
        }
        if (bitacoraFilter.$and) {
          existingFilters.$and = bitacoraFilter.$and;
          delete bitacoraFilter.$and;
        }

        Object.keys(bitacoraFilter).forEach(key => {
          if (key !== 'cliente' && key !== 'createdAt') {
            existingFilters[key] = bitacoraFilter[key];
            delete bitacoraFilter[key];
          }
        });

        bitacoraFilter.$and = [
          existingFilters,
          {
            $or: [
              { operador: userFullName },
              { 'transportes.operador': userFullName }
            ]
          }
        ];
      } else {
        bitacoraFilter.$or = [
          { operador: userFullName },
          { 'transportes.operador': userFullName }
        ];
      }
    }

    // Obtener tipos de eventos para categorías
    const eventTypes = await EventType.find({ categoria: { $in: ['ENA', 'ONC', 'DR', 'FM'] } });
    const eventNamesByCategory = {};
    eventTypes.forEach(eventType => {
      if (!eventNamesByCategory[eventType.categoria]) {
        eventNamesByCategory[eventType.categoria] = [];
      }
      eventNamesByCategory[eventType.categoria].push(eventType.evento);
    });

    // Agregar filtro para bitácoras con anomalías
    const allEventNames = eventTypes.map(et => et.evento);
    bitacoraFilter['eventos.nombre'] = { $in: allEventNames };

    // Obtener estadísticas por cliente
    const clientStats = await Bitacora.aggregate([
      { $match: bitacoraFilter },
      { $unwind: '$eventos' },
      {
        $match: {
          'eventos.nombre': { $in: allEventNames }
        }
      },
      {
        $lookup: {
          from: 'eventtypes',
          localField: 'eventos.nombre',
          foreignField: 'evento',
          as: 'eventTypeInfo'
        }
      },
      {
        $group: {
          _id: '$cliente',
          anomalias: { $sum: 1 },
          bitacoras: { $addToSet: '$_id' }
        }
      },
      {
        $project: {
          cliente: '$_id',
          anomalias: 1,
          bitacoras: { $size: '$bitacoras' }
        }
      },
      { $sort: { anomalias: -1 } },
      { $limit: 10 }
    ]);

    // Formatear datos para el gráfico
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];

    const formattedStats = clientStats.map((stat, index) => ({
      cliente: stat.cliente || 'Cliente no especificado',
      anomalias: stat.anomalias,
      bitacoras: stat.bitacoras,
      color: colors[index % colors.length]
    }));

    res.status(200).json(formattedStats);
  } catch (error) {
    console.error('[GET /dashboard/client-anomalias-stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch client anomalies statistics' });
  }
});

// Endpoint para obtener estadísticas de anomalías por línea de transporte
app.get('/dashboard/lineas-transporte-stats', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    // Obtener filtros de la query
    const {
      clientFilter = 'all',
      fechaDesde = '',
      fechaHasta = '',
      lineaTransporte = 'all',
      operador = 'all'
    } = req.query;

    // Construir filtros de bitácora
    let bitacoraFilter = {};

    // Filtro de fechas
    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');

      if (!isNaN(startDate) && !isNaN(endDate)) {
        bitacoraFilter.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);

      if (clientFilter !== 'all') {
        // If a specific client is selected, verify it's in the allowed list
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        // If no specific client is selected, filter by all allowed clients
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else {
      // User has access to all clients
      if (clientFilter !== 'all') {
        bitacoraFilter.cliente = clientFilter;
      }
    }

    // Note: lineaTransporte and operador filters are applied in the aggregation pipeline
    // after $unwind: '$eventos.transportes' to ensure correct nested field matching

    // Filtro de permisos de usuario
    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      if (operador !== 'all' && operador !== userFullName) {
        return res.status(200).json([]);
      }

      if (bitacoraFilter.$or || bitacoraFilter.$and || Object.keys(bitacoraFilter).some(key => key !== 'cliente' && key !== 'createdAt')) {
        const existingFilters = {};
        if (bitacoraFilter.$or) {
          existingFilters.$or = bitacoraFilter.$or;
          delete bitacoraFilter.$or;
        }
        if (bitacoraFilter.$and) {
          existingFilters.$and = bitacoraFilter.$and;
          delete bitacoraFilter.$and;
        }

        Object.keys(bitacoraFilter).forEach(key => {
          if (key !== 'cliente' && key !== 'createdAt') {
            existingFilters[key] = bitacoraFilter[key];
            delete bitacoraFilter[key];
          }
        });

        bitacoraFilter.$and = [
          existingFilters,
          {
            $or: [
              { operador: userFullName },
              { 'transportes.operador': userFullName }
            ]
          }
        ];
      } else {
        bitacoraFilter.$or = [
          { operador: userFullName },
          { 'transportes.operador': userFullName }
        ];
      }
    }

    // Use cached event types (no fresh DB fetch per request)
    const eventTypes = await getCachedAnomalyEventTypes();
    const allEventNames = eventTypes.map(et => et.evento);

    // Pre-filter bitacoras to only those with anomaly events
    bitacoraFilter['eventos.nombre'] = { $in: allEventNames };

    // Fetch reference data in parallel
    const lineasTransporte = await LineaTransporte.find(
      clientFilter !== 'all' ? { cliente: clientFilter } : {}
    ).select('nombre').lean();

    // Optimized pipeline: pre-filter eliminates the unwind+lookup+regroup pattern
    const transportLineStats = await Bitacora.aggregate([
      { $match: bitacoraFilter },
      { $unwind: '$transportes' },
      {
        $match: {
          'transportes.lineaTransporte': { $exists: true, $nin: [null, '', 'N/A'] }
        }
      },
      ...(lineaTransporte !== 'all' ? [{
        $match: {
          $expr: {
            $eq: [
              { $toLower: { $trim: { input: '$transportes.lineaTransporte' } } },
              { $toLower: { $trim: { input: lineaTransporte } } }
            ]
          }
        }
      }] : []),
      ...(operador !== 'all' ? [{
        $match: {
          $expr: {
            $eq: [
              { $toLower: { $trim: { input: '$transportes.operador' } } },
              { $toLower: { $trim: { input: operador } } }
            ]
          }
        }
      }] : []),
      {
        $group: {
          _id: { lineaTransporte: '$transportes.lineaTransporte', cliente: '$cliente' },
          anomalias: { $sum: 1 },
          bitacoras: { $addToSet: '$_id' }
        }
      },
      {
        $project: {
          lineaTransporte: '$_id.lineaTransporte',
          cliente: '$_id.cliente',
          anomalias: 1,
          bitacoras: { $size: '$bitacoras' }
        }
      },
      { $sort: { anomalias: -1 } }
    ]);

    // Filtrar solo las líneas de transporte que existen en el modelo LineaTransporte
    let filteredTransportLineStats = [];
    if (clientFilter !== 'all') {
      // Si hay un cliente específico seleccionado, filtrar por ese cliente
      filteredTransportLineStats = transportLineStats.filter(stat => {
        // Verificar que la estadística sea del cliente correcto
        const isCorrectClient = stat.cliente === clientFilter;
        // Verificar que la línea de transporte exista en el modelo LineaTransporte para este cliente
        // Comparación case-insensitive para evitar problemas de capitalización
        const lineaExists = lineasTransporte.some(lt =>
          lt.nombre && stat.lineaTransporte &&
          lt.nombre.toLowerCase().trim() === stat.lineaTransporte.toLowerCase().trim()
        );

        console.log('[DEBUG] Filtering stat:', {
          statLineaTransporte: stat.lineaTransporte,
          statCliente: stat.cliente,
          clientFilter,
          isCorrectClient,
          lineaExists,
          availableLineas: lineasTransporte.map(lt => lt.nombre),
          willInclude: isCorrectClient && lineaExists
        });

        return isCorrectClient && lineaExists;
      });
    } else {
      // Si no hay cliente seleccionado, mostrar todas las líneas de transporte que existen en el catálogo
      filteredTransportLineStats = transportLineStats.filter(stat => {
        // Verificar que la línea de transporte exista en el modelo LineaTransporte
        // Comparación case-insensitive para evitar problemas de capitalización
        const lineaExists = lineasTransporte.some(lt =>
          lt.nombre && stat.lineaTransporte &&
          lt.nombre.toLowerCase().trim() === stat.lineaTransporte.toLowerCase().trim()
        );

        return lineaExists;
      });
    }

    // Formatear datos para el gráfico
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];

    const formattedStats = filteredTransportLineStats.map((stat, index) => ({
      lineaTransporte: stat.lineaTransporte || 'Línea no especificada',
      cliente: stat.cliente,
      anomalias: stat.anomalias,
      bitacoras: stat.bitacoras,
      color: colors[index % colors.length]
    }));

    // Debug logging
    console.log('[DEBUG] Transport lines endpoint:', {
      clientFilter,
      lineasTransporteCount: lineasTransporte.length,
      transportLineStatsCount: transportLineStats.length,
      filteredTransportLineStatsCount: filteredTransportLineStats.length,
      formattedStatsCount: formattedStats.length,
      lineasTransporteNames: lineasTransporte.map(lt => lt.nombre),
      transportLineStatsRaw: transportLineStats.slice(0, 5),
      formattedStats: formattedStats.slice(0, 3)
    });

    res.status(200).json(formattedStats);
  } catch (error) {
    console.error('[GET /dashboard/lineas-transporte-stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch transport lines anomalies statistics' });
  }
});

// Endpoint para obtener estadísticas de anomalías por operador
app.get('/dashboard/operadores-stats', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    // Obtener filtros de la query
    const {
      clientFilter = 'all',
      fechaDesde = '',
      fechaHasta = '',
      lineaTransporte = 'all',
      operador = 'all'
    } = req.query;

    // Construir filtros de bitácora
    let bitacoraFilter = {};

    // Filtro de fechas
    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');

      if (!isNaN(startDate) && !isNaN(endDate)) {
        bitacoraFilter.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);

      if (clientFilter !== 'all') {
        // If a specific client is selected, verify it's in the allowed list
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        // If no specific client is selected, filter by all allowed clients
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else {
      // User has access to all clients
      if (clientFilter !== 'all') {
        bitacoraFilter.cliente = clientFilter;
      }
    }

    // Note: lineaTransporte and operador filters are applied in the aggregation pipeline
    // after $unwind: '$eventos.transportes' to ensure correct nested field matching

    // Filtro de permisos de usuario
    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      if (operador !== 'all' && operador !== userFullName) {
        return res.status(200).json([]);
      }

      if (bitacoraFilter.$or || bitacoraFilter.$and || Object.keys(bitacoraFilter).some(key => key !== 'cliente' && key !== 'createdAt')) {
        const existingFilters = {};
        if (bitacoraFilter.$or) {
          existingFilters.$or = bitacoraFilter.$or;
          delete bitacoraFilter.$or;
        }
        if (bitacoraFilter.$and) {
          existingFilters.$and = bitacoraFilter.$and;
          delete bitacoraFilter.$and;
        }

        Object.keys(bitacoraFilter).forEach(key => {
          if (key !== 'cliente' && key !== 'createdAt') {
            existingFilters[key] = bitacoraFilter[key];
            delete bitacoraFilter[key];
          }
        });

        bitacoraFilter.$and = [
          existingFilters,
          {
            $or: [
              { operador: userFullName },
              { 'transportes.operador': userFullName }
            ]
          }
        ];
      } else {
        bitacoraFilter.$or = [
          { operador: userFullName },
          { 'transportes.operador': userFullName }
        ];
      }
    }

    // Use cached event types (no fresh DB fetch per request)
    const eventTypes = await getCachedAnomalyEventTypes();
    const allEventNames = eventTypes.map(et => et.evento);

    // Pre-filter bitacoras to only those with anomaly events
    bitacoraFilter['eventos.nombre'] = { $in: allEventNames };

    // Fetch operadores reference data
    let operadores = [];
    if (lineaTransporte !== 'all') {
      operadores = await Operador.find({ lineaTransporte: lineaTransporte }).select('nombre').lean();
    } else if (clientFilter !== 'all') {
      const lineasDelCliente = await LineaTransporte.find({ cliente: clientFilter }).select('nombre').lean();
      const nombresLineas = lineasDelCliente.map(lt => lt.nombre);
      operadores = await Operador.find({ lineaTransporte: { $in: nombresLineas } }).select('nombre').lean();
    } else {
      operadores = await Operador.find({}).select('nombre').lean();
    }

    // Optimized pipeline: pre-filter eliminates the unwind+lookup+regroup pattern
    const operatorStats = await Bitacora.aggregate([
      { $match: bitacoraFilter },
      { $unwind: '$transportes' },
      {
        $match: {
          'transportes.operador': { $exists: true, $nin: [null, '', 'N/A'] }
        }
      },
      ...(lineaTransporte !== 'all' ? [{
        $match: {
          $expr: {
            $eq: [
              { $toLower: { $trim: { input: '$transportes.lineaTransporte' } } },
              { $toLower: { $trim: { input: lineaTransporte } } }
            ]
          }
        }
      }] : []),
      ...(operador !== 'all' ? [{
        $match: {
          $expr: {
            $eq: [
              { $toLower: { $trim: { input: '$transportes.operador' } } },
              { $toLower: { $trim: { input: operador } } }
            ]
          }
        }
      }] : []),
      {
        $group: {
          _id: {
            operador: '$transportes.operador',
            cliente: '$cliente',
            lineaTransporte: '$transportes.lineaTransporte'
          },
          anomalias: { $sum: 1 },
          bitacoras: { $addToSet: '$_id' }
        }
      },
      {
        $project: {
          operador: '$_id.operador',
          cliente: '$_id.cliente',
          lineaTransporte: '$_id.lineaTransporte',
          anomalias: 1,
          bitacoras: { $size: '$bitacoras' }
        }
      },
      { $sort: { anomalias: -1 } }
    ]);

    // Filtrar solo los operadores que existen en el modelo Operador
    let filteredOperatorStats = [];
    if (lineaTransporte !== 'all') {
      // Si hay una línea de transporte específica seleccionada, filtrar por esa línea
      filteredOperatorStats = operatorStats.filter(stat => {
        // Verificar que la estadística sea de la línea de transporte correcta
        const isCorrectLineaTransporte = stat.lineaTransporte === lineaTransporte;
        // Verificar que el operador exista en el modelo Operador para esta línea de transporte
        // Comparación case-insensitive para evitar problemas de capitalización
        const operadorExists = operadores.some(op =>
          op.nombre && stat.operador &&
          op.nombre.toLowerCase().trim() === stat.operador.toLowerCase().trim()
        );

        return isCorrectLineaTransporte && operadorExists;
      });
    } else if (clientFilter !== 'all') {
      // Si no hay línea de transporte seleccionada pero sí hay cliente, filtrar por operadores del cliente
      filteredOperatorStats = operatorStats.filter(stat => {
        // Verificar que la estadística sea del cliente correcto
        const isCorrectClient = stat.cliente === clientFilter;
        // Verificar que el operador exista en el modelo Operador para las líneas del cliente
        const operadorExists = operadores.some(op =>
          op.nombre && stat.operador &&
          op.nombre.toLowerCase().trim() === stat.operador.toLowerCase().trim()
        );

        return isCorrectClient && operadorExists;
      });
    } else {
      // Si no hay filtros aplicados, mostrar todos los operadores que existen en el catálogo
      filteredOperatorStats = operatorStats.filter(stat => {
        // Verificar que el operador exista en el modelo Operador
        // Comparación case-insensitive para evitar problemas de capitalización
        const operadorExists = operadores.some(op =>
          op.nombre && stat.operador &&
          op.nombre.toLowerCase().trim() === stat.operador.toLowerCase().trim()
        );

        return operadorExists;
      });
    }

    // Formatear datos para el gráfico
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
      '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9'
    ];

    const formattedStats = filteredOperatorStats.map((stat, index) => ({
      operador: stat.operador || 'Operador no especificado',
      cliente: stat.cliente,
      lineaTransporte: stat.lineaTransporte,
      anomalias: stat.anomalias,
      bitacoras: stat.bitacoras,
      color: colors[index % colors.length]
    }));

    // Debug logging
    console.log('[DEBUG] Operators endpoint:', {
      clientFilter,
      lineaTransporte,
      operadoresCount: operadores.length,
      operatorStatsCount: operatorStats.length,
      filteredOperatorStatsCount: filteredOperatorStats.length,
      formattedStatsCount: formattedStats.length,
      operadoresNames: operadores.map(op => op.nombre),
      operatorStatsRaw: operatorStats.slice(0, 5),
      formattedStats: formattedStats.slice(0, 3)
    });

    res.status(200).json(formattedStats);
  } catch (error) {
    console.error('[GET /dashboard/operadores-stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch operators anomalies statistics' });
  }
});

// Endpoint para obtener estadísticas de anomalías por categoría de evento
app.get('/dashboard/event-categories-stats', async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) {
      return res.status(401).json({ message: 'User not found' });
    }

    const role = await Role.findOne({ name: user.role });
    if (!role) {
      return res.status(401).json({ message: 'Role not found' });
    }

    // Obtener filtros de la query
    const {
      clientFilter = 'all',
      fechaDesde = '',
      fechaHasta = '',
      lineaTransporte = 'all',
      operador = 'all'
    } = req.query;

    // Construir filtros de bitácora
    let bitacoraFilter = { deleted: { $ne: true } }; // Exclude deleted bitacoras

    // Filtro de fechas
    if (fechaDesde && fechaHasta && fechaDesde.trim() !== '' && fechaHasta.trim() !== '') {
      const startDate = new Date(fechaDesde);
      const endDate = new Date(fechaHasta + 'T23:59:59.999Z');

      if (!isNaN(startDate) && !isNaN(endDate)) {
        bitacoraFilter.createdAt = {
          $gte: startDate,
          $lte: endDate
        };
      }
    }

    // Apply client permissions based on role
    if (role.client_access === 'specific' && role.allowed_clients && role.allowed_clients.length > 0) {
      // User can only access specific clients
      const allowedClientNames = role.allowed_clients.map(ac => ac.client_name);

      if (clientFilter !== 'all') {
        // If a specific client is selected, verify it's in the allowed list
        if (!allowedClientNames.includes(clientFilter)) {
          return res.status(403).json({ message: 'Access denied to this client' });
        }
        bitacoraFilter.cliente = clientFilter;
      } else {
        // If no specific client is selected, filter by all allowed clients
        bitacoraFilter.cliente = { $in: allowedClientNames };
      }
    } else {
      // User has access to all clients
      if (clientFilter !== 'all') {
        bitacoraFilter.cliente = clientFilter;
      }
    }

    // Filtro de permisos de usuario
    if (!role.bitacoras?.read_all) {
      const userFullName = `${user.firstName} ${user.lastName}`;
      if (operador !== 'all' && operador !== userFullName) {
        return res.status(200).json([]);
      }

      bitacoraFilter.$or = [
        { operador: userFullName },
        { 'transportes.operador': userFullName }
      ];
    }

    // Use cached event types + build category map (no fresh DB fetch)
    const eventTypes = await getCachedAnomalyEventTypes();
    const allEventNames = eventTypes.map(et => et.evento);
    const eventTypeCategoryMap = new Map(eventTypes.map(et => [et.evento?.toLowerCase(), et.categoria]));

    // Pre-filter to bitacoras with anomaly events
    bitacoraFilter['eventos.nombre'] = { $in: allEventNames };

    // Aggregate by event nombre — no $lookup to eventtypes/lineatransportes/operadores
    const rawCategoryStats = await Bitacora.aggregate([
      { $match: bitacoraFilter },
      { $unwind: '$eventos' },
      { $match: { 'eventos.nombre': { $in: allEventNames } } },
      ...(lineaTransporte !== 'all' || operador !== 'all' ? [{ $unwind: '$eventos.transportes' }] : []),
      ...(lineaTransporte !== 'all' ? [{
        $match: {
          $expr: {
            $eq: [
              { $toLower: { $trim: { input: '$eventos.transportes.lineaTransporte' } } },
              { $toLower: { $trim: { input: lineaTransporte } } }
            ]
          }
        }
      }] : []),
      ...(operador !== 'all' ? [{
        $match: {
          $expr: {
            $eq: [
              { $toLower: { $trim: { input: '$eventos.transportes.operador' } } },
              { $toLower: { $trim: { input: operador } } }
            ]
          }
        }
      }] : []),
      { $group: { _id: '$eventos.nombre', count: { $sum: 1 } } }
    ]);

    // Map event names to categories in JS
    const catCounts = {};
    for (const stat of rawCategoryStats) {
      const cat = eventTypeCategoryMap.get(stat._id?.toLowerCase());
      if (cat) catCounts[cat] = (catCounts[cat] || 0) + stat.count;
    }
    const eventCategoryStats = catCounts;

    // Define colors for each category
    const categoryColors = {
      'ENA': '#3b82f6', // Blue
      'FM': '#10b981',  // Green
      'ONC': '#f59e0b', // Orange
      'DR': '#ef4444'   // Red
    };

    // Format with colors
    const formattedCategories = ['ENA', 'FM', 'ONC', 'DR'].map(cat => ({
      categoria: cat,
      count: eventCategoryStats[cat] || 0,
      color: categoryColors[cat]
    }));

    res.status(200).json(formattedCategories);
  } catch (error) {
    console.error('[GET /dashboard/event-categories-stats] Error:', error);
    res.status(500).json({ error: 'Failed to fetch event categories statistics' });
  }
});

// ── SUMMARY COUNTS ─────────────────────────────────────────────
// Lightweight endpoint returning 4 KPI counts. Cached 60s in-memory.
app.get("/dashboard/summary-counts", async (req, res) => {
  try {
    const user = req.session.user;
    if (!user) return res.status(401).json({ message: "User not found" });

    const now = Date.now();
    if (_summaryCountsCache && now - _summaryCountsCacheTime < SUMMARY_COUNTS_CACHE_TTL) {
      return res.json(_summaryCountsCache);
    }

    // 1. Total Bitácoras (not deleted)
    const totalBitacoras = Bitacora.countDocuments({ deleted: { $ne: true } });

    // 2. En Patio counts (both models)
    const tractoresEnPatio = ControlPatios.countDocuments({ status: "En patio" });
    const remolquesEnPatio = RemolqueVisita.countDocuments({ status: "En patio" });

    // 3. Current Alerts — count of Wialon notification rules
    const currentAlerts = (async () => {
      const token = process.env.WIALON_API_TOKEN;
      if (!token) return 0;
      const loginData = await wialonApiCall("token/login", { token });
      if (loginData.error) return 0;
      const sid = loginData.eid;
      try {
        const data = await wialonApiCall("core/search_items", {
          spec: { itemsType: "avl_resource", propName: "*", propValueMask: "*", sortType: "sys_name" },
          force: 1,
          flags: 0x0400,
          from: 0, to: 1000
        }, sid);
        if (!data.items) return 0;
        let count = 0;
        for (const r of data.items) {
          if (r.unf) count += Object.keys(r.unf).length;
        }
        return count;
      } finally {
        wialonApiCall("core/logout", {}, sid).catch(() => {});
      }
    })();

    // 4. Active Units — units with position update in last 10 minutes
    const activeUnits = (async () => {
      const token = process.env.WIALON_API_TOKEN;
      if (!token) return 0;
      const loginData = await wialonApiCall("token/login", { token });
      if (loginData.error) return 0;
      const sid = loginData.eid;
      try {
        const data = await wialonApiCall("core/search_items", {
          spec: { itemsType: "avl_unit", propName: "*", propValueMask: "*", sortType: "sys_name" },
          force: 1,
          flags: 0x1,
          from: 0, to: 1000
        }, sid);
        console.log(`[SummaryCounts] activeUnits: ${data.totalItemsCount || data.items?.length || 0}`);
        return data.totalItemsCount || data.items?.length || 0;
      } finally {
        wialonApiCall("core/logout", {}, sid).catch(() => {});
      }
    })();

    const [totalBitacorasCount, tractoresCount, remolquesCount, alertsCount, unitsCount] =
      await Promise.all([totalBitacoras, tractoresEnPatio, remolquesEnPatio, currentAlerts, activeUnits]);

    const result = {
      totalBitacoras: totalBitacorasCount,
      enPatio: { tractores: tractoresCount, remolques: remolquesCount },
      currentAlerts: alertsCount,
      activeUnits: unitsCount
    };

    _summaryCountsCache = result;
    _summaryCountsCacheTime = now;

    res.json(result);
  } catch (err) {
    console.error("Error in /dashboard/summary-counts:", err);
    res.status(500).json({ error: "Failed to fetch summary counts" });
  }
});

// ── PLANES DE EMBARQUE ───────────────────────────────────────

// GET all
app.get("/planes-embarque", async (req, res) => {
  try {
    const planes = await PlanDeEmbarque.find()
      .populate("cliente", "razon_social")
      .populate("destino", "nombre")
      .sort({ citaCarga: 1 })
      .lean();

    const planIds = planes.map((plan) => plan._id);
    const linkedBitacoras = await Bitacora.find(
      {
        deleted: { $ne: true },
        planDeEmbarque_id: { $in: planIds },
      },
      {
        _id: 1,
        bitacora_id: 1,
        status: 1,
        planDeEmbarque_id: 1,
      }
    ).lean();

    const linkedBitacoraMap = Object.fromEntries(
      linkedBitacoras.map((bitacora) => [
        bitacora.planDeEmbarque_id?.toString(),
        {
          _id: bitacora._id,
          bitacora_id: bitacora.bitacora_id,
          status: bitacora.status,
        },
      ])
    );

    const enrichedPlanes = planes.map((plan) => ({
      ...plan,
      linked_bitacora: linkedBitacoraMap[plan._id.toString()] || null,
    }));

    res.json(enrichedPlanes);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET exact carrierMove search (must be before /:id)
app.get("/planes-embarque/search/carrier", async (req, res) => {
  try {
    const { carrierMove } = req.query;
    if (!carrierMove?.trim()) return res.json(null);
    const plan = await PlanDeEmbarque.findOne({
      carrierMove: { $regex: `^${carrierMove.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    })
      .populate("cliente", "razon_social")
      .populate("destino", "nombre")
      .lean();

    if (!plan) return res.json(null);

    const linkedBitacora = await Bitacora.findOne(
      {
        deleted: { $ne: true },
        planDeEmbarque_id: plan._id,
      },
      {
        _id: 1,
        bitacora_id: 1,
        status: 1,
      }
    ).lean();

    res.json({
      ...plan,
      linked_bitacora: linkedBitacora || null,
    });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST start a plan — create a bitacora from an existing plan
app.post("/planes-embarque/:id/start", async (req, res) => {
  try {
    const { creado_por, lineaTransporte, operador, telefono } = req.body;
    const plan = await PlanDeEmbarque.findById(req.params.id)
      .populate("cliente", "razon_social")
      .populate("destino", "nombre");
    if (!plan) return res.status(404).json({ message: "Plan no encontrado" });

    const existingBitacora = await Bitacora.findOne(
      {
        deleted: { $ne: true },
        planDeEmbarque_id: plan._id,
      },
      {
        _id: 1,
        bitacora_id: 1,
        status: 1,
      }
    ).lean();

    if (existingBitacora) {
      return res.status(409).json({
        message: `Este plan ya fue usado en la bitácora #${existingBitacora.bitacora_id}.`,
        bitacora: existingBitacora,
      });
    }

    const sequence = await BitSequence.findOneAndUpdate(
      { name: "bitacora_id" },
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );
    const sequenceNumber = sequence.sequence_value.toString().padStart(6, "0");

    const transporteId = plan.transporte;

    const planMetadata = {
      tipoViaje:       plan.tipoViaje,
      carrierMove:     plan.carrierMove,
      cliente:         plan.cliente?.razon_social,
      destino:         plan.destino?.nombre,
      citaCarga:       plan.citaCarga,
      horaSalida:      plan.horaSalida,
      citaEntrega:     plan.citaEntrega,
      transporte:      plan.transporte,
      lineaTransporte: lineaTransporte?.trim() || null,
      operador:        operador?.trim() || null,
      telefono:        telefono?.trim() || null,
    };

    const bitacora = await new Bitacora({
      bitacora_id:       sequenceNumber,
      folio_servicio:    plan.carrierMove, // Map carrierMove to folio_servicio
      cliente:           plan.cliente?.razon_social,
      destino:           plan.destino?._id?.toString() ?? "",
      status:            "plan de embarque",
      fechaPlanEmbarque: new Date(),
      planDeEmbarque_id: plan._id,
      draft_pendiente:   true,
      transportes: [{
        id:             transporteId,
        lineaTransporte: lineaTransporte?.trim() || "",
        operador:       operador?.trim() || "",
        telefono:       telefono?.trim() || "",
      }],
      eventos: [{
        nombre:         "PRESENCIA EN ORIGEN",
        registrado_por: creado_por ?? "Sistema",
        metadata:       planMetadata,
      }],
    }).save();

    await new DraftTransporte({
      bitacora_id:              bitacora._id,
      bitacora_num_id:          sequenceNumber,
      transporte_id:            transporteId,
      transporte:               plan.transporte ?? null,
      cliente:                  plan.cliente?.razon_social,
      lineaTransporte:          lineaTransporte?.trim() || null,
      lineaTransporte_es_draft: false,
      operador:                 operador?.trim() || null,
      operador_es_draft:        false,
      telefono:                 telefono?.trim() || null,
      creado_por:               creado_por ?? "Sistema",
    }).save();

    res.status(201).json({ bitacora_id: bitacora._id, bitacora_num_id: sequenceNumber });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// GET single
app.get("/planes-embarque/:id", async (req, res) => {
  try {
    const plan = await PlanDeEmbarque.findById(req.params.id)
      .populate("cliente", "razon_social")
      .populate("destino", "nombre");
    if (!plan) return res.status(404).json({ message: "Plan no encontrado" });
    res.json(plan);
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// POST create plan + bitacora + evento + draft transporte atomically
app.post("/planes-embarque/with-bitacora", async (req, res) => {
  try {
    const { tipoViaje, carrierMove, cliente, destino, citaCarga, horaSalida, citaEntrega, transporte, creado_por } = req.body;

    // Fetch client and destino names for embedding
    const clienteDoc  = await Client.findById(cliente).catch(() => null);
    const destinoDoc  = await Destino.findById(destino).catch(() => null);

    // 1. Create the PlanDeEmbarque record
    const plan = await new PlanDeEmbarque({ tipoViaje, carrierMove, cliente, destino, citaCarga, horaSalida, citaEntrega, transporte }).save();

    // 2. Get next sequence number
    const sequence = await BitSequence.findOneAndUpdate(
      { name: "bitacora_id" },
      { $inc: { sequence_value: 1 } },
      { new: true, upsert: true }
    );
    const sequenceNumber = sequence.sequence_value.toString().padStart(6, "0");

    // 3. Build the "PRESENCIA EN ORIGEN" evento metadata
    const planMetadata = {
      tipoViaje,
      carrierMove,
      cliente: clienteDoc?.razon_social ?? cliente,
      destino: destinoDoc?.nombre ?? destino,
      citaCarga,
      horaSalida,
      citaEntrega,
      transporte,
    };

    // 4. Create the Bitacora
    // Use a unique placeholder ID for the transporte (transport name alone is not unique)
    const placeholderTransporteId = `plan_${sequenceNumber}_${Date.now()}`;

    const bitacora = await new Bitacora({
      bitacora_id: sequenceNumber,
      cliente: clienteDoc?.razon_social ?? "",
      status: "plan de embarque",
      fechaPlanEmbarque: new Date(),
      planDeEmbarque_id: plan._id,
      draft_pendiente: true,
      transportes: [{ id: placeholderTransporteId }],
      eventos: [{
        nombre: "PRESENCIA EN ORIGEN",
        registrado_por: creado_por ?? "Sistema",
        metadata: planMetadata,
      }],
    }).save();

    // 5. Create the DraftTransporte so another user can complete it
    await new DraftTransporte({
      bitacora_id: bitacora._id,
      bitacora_num_id: sequenceNumber,
      transporte_id: placeholderTransporteId,
      cliente: clienteDoc?.razon_social ?? "",
      lineaTransporte: null,
      lineaTransporte_es_draft: true,
      operador: null,
      operador_es_draft: true,
      creado_por: creado_por ?? "Sistema",
    }).save();

    const populatedPlan = await PlanDeEmbarque.findById(plan._id)
      .populate("cliente", "razon_social")
      .populate("destino", "nombre");

    res.status(201).json({ plan: populatedPlan, bitacora });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// POST bulk create plans + bitacoras from imported rows
app.post("/planes-embarque/bulk", async (req, res) => {
  const { rows } = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: "No rows provided" });

  const results = [];

  for (const row of rows) {
    const { _rowNum, tipoViaje, carrierMove, clienteNombre, destinoNombre, citaCarga, horaSalida, citaEntrega, transporte } = row;

    try {
      if (!tipoViaje || !carrierMove || !clienteNombre || !destinoNombre || !citaCarga || !horaSalida || !citaEntrega || !transporte)
        throw new Error("Faltan campos requeridos");

      const clienteDoc = await Client.findOne({
        razon_social: { $regex: `^${clienteNombre.trim()}$`, $options: "i" },
      });
      if (!clienteDoc) throw new Error(`Cliente "${clienteNombre}" no encontrado`);

      const destinoDoc = await Destino.findOne({
        nombre:  { $regex: `^${destinoNombre.trim()}$`, $options: "i" },
        cliente: clienteDoc.razon_social,
      });
      if (!destinoDoc) throw new Error(`Destino "${destinoNombre}" no encontrado para cliente "${clienteNombre}"`);

      const plan = await new PlanDeEmbarque({
        tipoViaje, carrierMove,
        cliente: clienteDoc._id,
        destino: destinoDoc._id,
        citaCarga: new Date(citaCarga),
        horaSalida: new Date(horaSalida),
        citaEntrega: new Date(citaEntrega),
        transporte,
      }).save();

      const populatedPlan = await PlanDeEmbarque.findById(plan._id)
        .populate("cliente", "razon_social")
        .populate("destino", "nombre");

      results.push({ row: _rowNum, status: "ok", plan: populatedPlan, tipoViaje, clienteNombre, destinoNombre, transporte });
    } catch (e) {
      results.push({ row: _rowNum, status: "error", message: e.message, tipoViaje, clienteNombre, destinoNombre, transporte });
    }
  }

  res.json({ results });
});

app.post("/planes-embarque/bulk-with-bitacora", async (req, res) => {
  const { rows, creado_por } = req.body;
  if (!Array.isArray(rows) || rows.length === 0)
    return res.status(400).json({ message: "No rows provided" });

  const results = [];

  for (const row of rows) {
    const { _rowNum, tipoViaje, carrierMove, clienteNombre, destinoNombre, citaCarga, horaSalida, citaEntrega, transporte } = row;

    try {
      // Validate required text fields
      if (!tipoViaje || !carrierMove || !clienteNombre || !destinoNombre || !citaCarga || !horaSalida || !citaEntrega || !transporte)
        throw new Error("Faltan campos requeridos");

      // Match client by razon_social (case-insensitive)
      const clienteDoc = await Client.findOne({
        razon_social: { $regex: `^${clienteNombre.trim()}$`, $options: "i" },
      });
      if (!clienteDoc) throw new Error(`Cliente "${clienteNombre}" no encontrado`);

      // Match destino by nombre, scoped to that client
      const destinoDoc = await Destino.findOne({
        nombre:  { $regex: `^${destinoNombre.trim()}$`, $options: "i" },
        cliente: clienteDoc.razon_social,
      });
      if (!destinoDoc) throw new Error(`Destino "${destinoNombre}" no encontrado para cliente "${clienteNombre}"`);

      // Create PlanDeEmbarque
      const plan = await new PlanDeEmbarque({
        tipoViaje, carrierMove,
        cliente: clienteDoc._id,
        destino: destinoDoc._id,
        citaCarga: new Date(citaCarga),
        horaSalida: new Date(horaSalida),
        citaEntrega: new Date(citaEntrega),
        transporte,
      }).save();

      // Next sequence number
      const sequence = await BitSequence.findOneAndUpdate(
        { name: "bitacora_id" },
        { $inc: { sequence_value: 1 } },
        { new: true, upsert: true }
      );
      const sequenceNumber = sequence.sequence_value.toString().padStart(6, "0");

      const planMetadata = {
        tipoViaje, carrierMove,
        cliente: clienteDoc.razon_social,
        destino: destinoDoc.nombre,
        citaCarga, horaSalida, citaEntrega, transporte,
      };

      const placeholderTransporteId = `plan_${sequenceNumber}_${Date.now()}`;

      const bitacora = await new Bitacora({
        bitacora_id: sequenceNumber,
        cliente: clienteDoc.razon_social,
        status: "plan de embarque",
        fechaPlanEmbarque: new Date(),
        planDeEmbarque_id: plan._id,
        draft_pendiente: true,
        transportes: [{ id: placeholderTransporteId }],
        eventos: [{
          nombre: "PRESENCIA EN ORIGEN",
          registrado_por: creado_por ?? "Sistema",
          metadata: planMetadata,
        }],
      }).save();

      await new DraftTransporte({
        bitacora_id: bitacora._id,
        bitacora_num_id: sequenceNumber,
        transporte_id: placeholderTransporteId,
        cliente: clienteDoc.razon_social,
        lineaTransporte: null,
        lineaTransporte_es_draft: true,
        operador: null,
        operador_es_draft: true,
        creado_por: creado_por ?? "Sistema",
      }).save();

      const populatedPlan = await PlanDeEmbarque.findById(plan._id)
        .populate("cliente", "razon_social")
        .populate("destino", "nombre");

      results.push({ row: _rowNum, status: "ok", plan: populatedPlan, tipoViaje, clienteNombre, destinoNombre, transporte });
    } catch (e) {
      results.push({ row: _rowNum, status: "error", message: e.message, tipoViaje, clienteNombre, destinoNombre, transporte });
    }
  }

  res.json({ results });
});

// POST create
app.post("/planes-embarque", async (req, res) => {
  try {
    const plan = new PlanDeEmbarque(req.body);
    const saved = await plan.save();
    const populated = await PlanDeEmbarque.findById(saved._id)
      .populate("cliente", "razon_social")
      .populate("destino", "nombre");
    res.status(201).json(populated);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// PUT update
app.put("/planes-embarque/:id", async (req, res) => {
  try {
    const updated = await PlanDeEmbarque.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    )
      .populate("cliente", "razon_social")
      .populate("destino", "nombre");
    if (!updated) return res.status(404).json({ message: "Plan no encontrado" });
    res.json(updated);
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

// DELETE
app.delete("/planes-embarque/:id", async (req, res) => {
  try {
    const deleted = await PlanDeEmbarque.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: "Plan no encontrado" });
    res.json({ message: "Plan eliminado" });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

// ── Reporte Estadísticas ─────────────────────────────────────────
app.get("/reporte-estadisticas", async (req, res) => {
  try {
    const { startDate, endDate, clienteFilter, origenFilter, destinoFilter, statusFilter, lineaFilter, operadorFilter } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: "startDate y endDate son requeridos" });
    }

    const start = new Date(startDate);
    const end   = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const query = {
      deleted:   { $ne: true },
      createdAt: { $gte: start, $lte: end },
    };

    if (clienteFilter) {
      query.cliente = { $regex: clienteFilter, $options: "i" };
    }
    if (statusFilter) {
      query.status = statusFilter;
    }

    // Remove direct ID-based filter as data might store names or not match
    // if (origenFilter) {
    //   const origenDocs = await Origen.find(
    //     { nombre: { $regex: origenFilter, $options: "i" } }
    //   ).select("_id").lean();
    //   query.origen = { $in: origenDocs.map((o) => o._id.toString()) };
    // }
    // if (destinoFilter) {
    //   const destinoDocs = await Destino.find(
    //     { nombre: { $regex: destinoFilter, $options: "i" } }
    //   ).select("_id").lean();
    //   query.destino = { $in: destinoDocs.map((d) => d._id.toString()) };
    // }

    const bitacoras = await Bitacora.find(
      query,
      { bitacora_id: 1, cliente: 1, operador: 1, createdAt: 1, eventos: 1,
        edited_bitacora: 1, origen: 1, destino: 1, status: 1, transportes: 1,
        linea_transporte: 1, folio_servicio: 1, planDeEmbarque_id: 1 }
    ).lean();

    // Batch-resolve linked PlanDeEmbarque docs (source of truth for citas/carrierMove).
    // The embedded "PRESENCIA EN ORIGEN" metadata is a snapshot taken at creation time
    // and is frequently incomplete (e.g. citaEntrega missing), so the plan is used as a
    // fallback to fill any gaps.
    const planIds = [...new Set(
      bitacoras.map((b) => b.planDeEmbarque_id?.toString()).filter(Boolean)
    )];
    const planDocs = planIds.length
      ? await PlanDeEmbarque.find(
          { _id: { $in: planIds } },
          { carrierMove: 1, citaCarga: 1, horaSalida: 1, citaEntrega: 1, destino: 1, transporte: 1 }
        ).lean()
      : [];
    const planMap = Object.fromEntries(planDocs.map((p) => [p._id.toString(), p]));

    // Batch-resolve origen/destino names
    const isObjectId = (v) => /^[0-9a-f]{24}$/i.test(v || "");
    const getLookupId = (value) => {
      if (!value) return null;
      if (typeof value === "string") return isObjectId(value) ? value : null;
      if (typeof value === "object" && value._id) {
        const id = value._id.toString();
        return isObjectId(id) ? id : null;
      }
      return null;
    };
    const destinoIds = [...new Set(
      bitacoras.flatMap((b) => [
        getLookupId(b.destino),
        getLookupId(b.edited_bitacora?.destino),
        getLookupId(planMap[b.planDeEmbarque_id?.toString()]?.destino),
      ]).filter(Boolean)
    )];
    const origenIds  = [...new Set(
      bitacoras.flatMap((b) => [getLookupId(b.origen), getLookupId(b.edited_bitacora?.origen)]).filter(Boolean)
    )];
    const [destinoDocs2, origenDocs2] = await Promise.all([
      Destino.find({ _id: { $in: destinoIds } }).select("_id nombre").lean(),
      Origen.find(  { _id: { $in: origenIds  } }).select("_id nombre").lean(),
    ]);
    const destinoMap = Object.fromEntries(destinoDocs2.map((d) => [d._id.toString().toLowerCase(), d.nombre]));
    const origenMap  = Object.fromEntries(origenDocs2.map((o) => [o._id.toString().toLowerCase(), o.nombre]));

    const normalizeNombre = (s) =>
      (s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const getResolvedLocationName = (value, map) => {
      if (!value) return "";
      if (typeof value === "object") {
        if (value.nombre) return value.nombre;
        if (value._id) return map[value._id.toString().toLowerCase()] || "";
        return "";
      }
      return map[String(value).toLowerCase()] || (!isObjectId(value) ? value : "") || "";
    };
    const getMetadataValue = (metadata = {}, keys = []) => {
      for (const key of keys) {
        if (metadata?.[key] !== undefined && metadata?.[key] !== null && metadata?.[key] !== "") {
          return metadata[key];
        }
      }
      return null;
    };
    const getFirstLineaTransporte = (transportes = []) =>
      transportes.find((t) => t?.lineaTransporte)?.lineaTransporte || "";

    // Filtering in-memory based on resolved names
    let bitacorasToProcess = bitacoras;
    
    if (origenFilter || destinoFilter || lineaFilter || operadorFilter) {
      bitacorasToProcess = bitacoras.filter(b => {
        const oName = getResolvedLocationName(b.origen, origenMap).toLowerCase();
        const dName = getResolvedLocationName(b.destino, destinoMap).toLowerCase();
        // Línea y operador viven principalmente en transportes[]; el campo raíz suele estar vacío.
        const lName = (getFirstLineaTransporte(b.transportes) || b.linea_transporte || "").toLowerCase();
        const opName = [
          b.operador,
          ...(b.transportes || []).map((t) => t?.operador),
        ].filter(Boolean).join(" ").toLowerCase();

        const oMatch = !origenFilter || oName.includes(origenFilter.toLowerCase());
        const dMatch = !destinoFilter || dName.includes(destinoFilter.toLowerCase());
        const lMatch = !lineaFilter || lName.includes(lineaFilter.toLowerCase());
        const opMatch = !operadorFilter || opName.includes(operadorFilter.toLowerCase());
        
        return oMatch && dMatch && lMatch && opMatch;
      });
    }

    const servicios = bitacorasToProcess.map((bit) => {
      const eventos = (bit.eventos?.length ? bit.eventos : null)
        || bit.edited_bitacora?.eventos
        || [];

      const presenciaOrigenEvento =
        eventos.find((e) => normalizeNombre(e.nombre) === "presencia en origen")
        || eventos.find((e) => e.nombre?.toUpperCase() === "PLAN DE EMBARQUE");
      const validacionEvento = eventos.find(
        (e) => normalizeNombre(e.nombre) === "validacion"
      );
      const inicioRecorridoEvento = eventos.find(
        (e) => normalizeNombre(e.nombre).includes("inicio de recorrido")
      );
      const arriboDestinoEvento = eventos.find(
        (e) => {
          const nombre = normalizeNombre(e.nombre);
          return nombre.includes("arribo a destino")
            || nombre.includes("arribo al destino")
            || nombre.includes("arribo destino");
        }
      );

      const plan = bit.planDeEmbarque_id ? planMap[bit.planDeEmbarque_id.toString()] : null;
      // folio_servicio is where legacy bitácoras (created without a plan de embarque)
      // store the carrier move. "S/N" is a "sin número" placeholder, not a real value.
      const folioCarrier = (val) => {
        const v = (val || "").trim();
        return v && v.toUpperCase() !== "S/N" ? v : null;
      };
      // The root linea_transporte is frequently a "." placeholder; the real carrier
      // line lives in transportes[].lineaTransporte, so placeholders are ignored.
      const cleanLinea = (val) => {
        const v = (val || "").trim();
        return v && v !== "." ? v : null;
      };

      const citaCarga =
        getMetadataValue(presenciaOrigenEvento?.metadata, ["citaCarga", "cita_carga", "Cita de Carga", "citacarga"])
        ?? plan?.citaCarga
        ?? null;
      const horaSalida =
        getMetadataValue(presenciaOrigenEvento?.metadata, ["horaSalida", "hora_salida", "Hora de Salida", "horasalida"])
        ?? plan?.horaSalida
        ?? null;
      const citaEntrega =
        getMetadataValue(presenciaOrigenEvento?.metadata, ["citaEntrega", "cita_entrega", "Cita de Entrega", "citaentrega"])
        ?? plan?.citaEntrega
        ?? null;
      const planEmbarqueAt = presenciaOrigenEvento?.createdAt ?? null;
      const validacionAt = validacionEvento?.createdAt ?? null;
      const inicioRecorridoAt = inicioRecorridoEvento?.createdAt ?? null;
      const arriboDestinoAt = arriboDestinoEvento?.createdAt ?? null;
      const carrierMove =
        getMetadataValue(presenciaOrigenEvento?.metadata, ["carrierMove", "carrier_move", "carriermove", "Carrier Move", "carrier"])
        || folioCarrier(bit.folio_servicio)
        || folioCarrier(bit.edited_bitacora?.folio_servicio)
        || plan?.carrierMove
        || "";
      const lineaTransporte =
        cleanLinea(getMetadataValue(presenciaOrigenEvento?.metadata, ["lineaTransporte", "linea_transporte", "Linea de Transporte", "linea transporte"]))
        || cleanLinea(getFirstLineaTransporte(bit.transportes))
        || cleanLinea(bit.linea_transporte)
        || cleanLinea(getFirstLineaTransporte(bit.edited_bitacora?.transportes))
        || cleanLinea(bit.edited_bitacora?.linea_transporte)
        || cleanLinea(plan?.transporte)
        || "";
      const origenNombre =
        getResolvedLocationName(bit.origen, origenMap)
        || getResolvedLocationName(bit.edited_bitacora?.origen, origenMap)
        || getMetadataValue(presenciaOrigenEvento?.metadata, ["origen", "Origen"])
        || "";
      const destinoNombre =
        getResolvedLocationName(bit.destino, destinoMap)
        || getResolvedLocationName(bit.edited_bitacora?.destino, destinoMap)
        || getResolvedLocationName(plan?.destino, destinoMap)
        || getMetadataValue(presenciaOrigenEvento?.metadata, ["destino", "Destino"])
        || "";

      const desfaseCitaCargaMs = citaCarga && planEmbarqueAt
        ? new Date(planEmbarqueAt).getTime() - new Date(citaCarga).getTime()
        : null;
      const desfaseHoraSalidaMs = horaSalida && inicioRecorridoAt
        ? new Date(inicioRecorridoAt).getTime() - new Date(horaSalida).getTime()
        : null;
      const tiempoPresenciaValidacionMs = planEmbarqueAt && validacionAt
        ? new Date(validacionAt).getTime() - new Date(planEmbarqueAt).getTime()
        : null;
      const desfaseCitaEntregaMs = citaEntrega && arriboDestinoAt
        ? new Date(arriboDestinoAt).getTime() - new Date(citaEntrega).getTime()
        : null;

      return {
        bitacora_id:         bit.bitacora_id,
        cliente:             bit.cliente,
        origen_nombre:       origenNombre,
        destino_nombre:      destinoNombre,
        carrierMove,
        lineaTransporte,
        status:              bit.status,
        createdAt:           bit.createdAt,
        citaCarga,
        horaSalida,
        citaEntrega,
        planEmbarqueAt,
        validacionAt,
        inicioRecorridoAt,
        arriboDestinoAt,
        desfaseCitaCargaMs,
        tiempoPresenciaValidacionMs,
        desfaseHoraSalidaMs,
        desfaseCitaEntregaMs,
      };
    });

    res.json({ servicios });
  } catch (e) {
    console.error("Error en /reporte-estadisticas:", e);
    res.status(500).json({ error: e.message });
  }
});

// -----------------------------------------------------------------------
// Plates test endpoint (Placa Test prototype)
// Receives a single image upload and runs OpenALPR via the
// plateRecognitionService. No DB writes. Results live only in the browser
// via localStorage.
// -----------------------------------------------------------------------
const plateUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

app.post("/plates/test-scan", plateUpload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: "No image received" });
  }

  const ext = (req.file.mimetype || "").split("/")[1] || "jpg";
  const tmpPath = join(tmpdir(), `plate-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`);

  try {
    await writeFile(tmpPath, req.file.buffer);
    console.log("[/plates/test-scan] Processing image at:", tmpPath);
    const result = await readPlateFromImage(tmpPath);
    if (!result) throw new Error("OCR service returned nothing");
    console.log("[/plates/test-scan] OCR Result:", result);
    res.set('Content-Type', 'application/json');
    return res.status(200).send(JSON.stringify(result));
  } catch (err) {
    console.error("[/plates/test-scan] CRITICAL error:", err);
    // Use .status().json() to ensure a complete response
    return res.status(500).json({ success: false, message: "OCR processing failed" });
  } finally {
    try {
      await unlink(tmpPath);
    } catch (cleanupErr) {
      console.warn("Cleanup error for", tmpPath, cleanupErr);
    }
  }
});

// Control Patios Endpoints
app.get("/control-patios/dashboard-summary", async (req, res) => {
  try {
    const { desde, hasta, plate, cliente, linea } = req.query;
    
    // Base query for distinct values (ignores plate/linea filters)
    const baseQuery = {};
    if (cliente && cliente !== "all") baseQuery.cliente = cliente;
    if (desde || hasta) {
      baseQuery.fecha_hora_inicio = {};
      if (desde) baseQuery.fecha_hora_inicio.$gte = new Date(desde);
      if (hasta) baseQuery.fecha_hora_inicio.$lte = new Date(hasta);
    }
    
    // Main query for movements (includes plate/linea filters)
    const query = { ...baseQuery };
    if (plate) {
      const plates = Array.isArray(plate) ? plate : plate.split(',').filter(Boolean);
      if (plates.length > 0) query.placa = { $in: plates.map(p => new RegExp(p, "i")) };
    }
    
    if (linea) {
      const lineas = Array.isArray(linea) ? linea : linea.split(',').filter(Boolean);
      if (lineas.length > 0) query.linea_transporte = { $in: lineas };
    }

    const movements = await ControlPatios.find(query).sort({ fecha_hora_inicio: -1 });

    const movementsWithDuration = movements.map(m => {
      const obj = m.toObject();
      let duration = obj.stay_seconds;
      if (duration == null && obj.fecha_hora_inicio) {
        const end = obj.fecha_hora_salida ? new Date(obj.fecha_hora_salida) : new Date();
        duration = Math.floor((end - new Date(obj.fecha_hora_inicio)) / 1000);
      }
      return { ...obj, stay_seconds: duration };
    });

    const totalRecords = movementsWithDuration.length;
    const anomaliesCount = await PatioAnomaly.countDocuments({ resolved: false });
    const anomaliesList = await PatioAnomaly.find({ resolved: false }).sort({ createdAt: -1 }).limit(20);

    let longestStay = null;
    let shortestStay = null;

    if (movementsWithDuration.length > 0) {
      longestStay = movementsWithDuration.reduce((prev, curr) => (prev.stay_seconds > curr.stay_seconds) ? prev : curr);
      shortestStay = movementsWithDuration.reduce((prev, curr) => (prev.stay_seconds < curr.stay_seconds) ? prev : curr);
    }

    // Chart data: Group stay durations
    // For now, let's just return the movementsWithDuration for the frontend to process into a bar chart
    // And some entry/exit events for the right-side timeline
    const entryEvents = await PatioEntryEvent.find(plate ? { plate: new RegExp(plate, "i") } : {}).sort({ entry_datetime: -1 }).limit(50);
    const exitEvents = await PatioExitEvent.find(plate ? { plate: new RegExp(plate, "i") } : {}).sort({ exit_datetime: -1 }).limit(50);

    const distinctPlates = await ControlPatios.distinct("placa", baseQuery);
    const distinctLineas = await ControlPatios.distinct("linea_transporte", baseQuery);

    // Remolque stats
    const remolqueQuery = {};
    if (baseQuery.cliente) remolqueQuery.cliente = baseQuery.cliente;
    if (baseQuery.fecha_hora_inicio) remolqueQuery.fecha_hora_entrada = baseQuery.fecha_hora_inicio;

    const remolques = await RemolqueVisita.find(remolqueQuery).sort({ fecha_hora_entrada: -1 });
    const remolquesEnPatio = remolques.filter(r => r.status === "En patio").length;
    const tractoresEnPatio = movements.filter(m => m.status === "En patio").length;
    const conCambioRemolque = movements.filter(m => m.hubo_cambio_remolque === true).length;
    const sinCambioRemolque = movements.filter(m => m.hubo_cambio_remolque === false).length;

    const distinctRemolquePlates = await RemolqueVisita.distinct("placa", remolqueQuery);

    res.json({
      totalRecords,
      anomaliesCount,
      anomaliesList,
      longestStay: longestStay ? { plate: longestStay.placa, seconds: longestStay.stay_seconds } : null,
      shortestStay: shortestStay ? { plate: shortestStay.placa, seconds: shortestStay.stay_seconds } : null,
      movements: movementsWithDuration,
      entryEvents,
      exitEvents,
      distinctPlates,
      distinctLineas,
      remolques,
      remolquesEnPatio,
      tractoresEnPatio,
      conCambioRemolque,
      sinCambioRemolque,
      distinctRemolquePlates,
    });
  } catch (err) {
    console.error("Error in dashboard-summary:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/patio-anomalies", async (req, res) => {
  try {
    const { resolved } = req.query;
    const query = {};
    if (resolved !== undefined) query.resolved = resolved === "true";
    const anomalies = await PatioAnomaly.find(query).sort({ createdAt: -1 });
    res.json(anomalies);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/patio-anomalies/:id/resolve", async (req, res) => {
  try {
    const anomaly = await PatioAnomaly.findByIdAndUpdate(req.params.id, { resolved: true }, { new: true });
    res.json(anomaly);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/control-patios", async (req, res) => {
  try {
    const { placa, placa_remolque, remolque_linea_transporte, linea_transporte, fecha_hora_inicio, cliente, confidence, image_preview, source } = req.body;
    const usuario_registro = req.session?.user?.email || "Unknown";
    const entryDate = fecha_hora_inicio ? new Date(fecha_hora_inicio) : new Date();

    // 1. Check for anomalies (duplicate tractor plate in patio)
    const existing = await ControlPatios.findOne({ placa: placa.toUpperCase(), status: "En patio" });

    const record = new ControlPatios({
      placa,
      linea_transporte,
      fecha_hora_inicio: entryDate,
      cliente,
      usuario_registro,
      confidence,
      image_preview,
      movement_type: "cycle",
      anomaly_flag: !!existing,
    });

    await record.save();

    // 2. Create remolque visit if trailer plate provided
    if (placa_remolque && placa_remolque.trim()) {
      const remolqueRecord = new RemolqueVisita({
        placa: placa_remolque.trim(),
        linea_transporte: remolque_linea_transporte || null,
        cliente,
        fecha_hora_entrada: entryDate,
        tractor_entrada_id: record._id,
        tractor_entrada_placa: placa.toUpperCase(),
      });
      await remolqueRecord.save();

      record.placa_remolque_entrada = placa_remolque.trim().toUpperCase();
      record.remolque_entrada_id = remolqueRecord._id;
      await record.save();
    }

    // 3. Create Entry Event
    await new PatioEntryEvent({
      plate: placa.toUpperCase(),
      entry_datetime: entryDate,
      source: source || "Manual",
    }).save();

    // 4. Create anomaly if duplicate
    if (existing) {
      await new PatioAnomaly({
        movement_id: record._id,
        plate: placa.toUpperCase(),
        anomaly_type: "duplicate_plate",
        severity: "medium",
        description: `Vehículo con placa ${placa} ya se encuentra registrado en el patio.`,
      }).save();
    }

    res.status(201).json(record);
  } catch (err) {
    console.error("Error creating control-patios record:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/control-patios", async (req, res) => {
  try {
    const { cliente } = req.query;
    const query = {};
    if (cliente && cliente !== "all") {
      query.cliente = cliente;
    }

    const records = await ControlPatios.find(query).sort({ fecha_hora_inicio: -1 });
    res.json(records);
  } catch (err) {
    console.error("Error fetching control-patios records:", err);
    res.status(500).json({ error: err.message });
  }
});

app.patch("/control-patios/:id/salida", async (req, res) => {
  try {
    const { id } = req.params;
    // remolque_exit: "same" | "different" | "none"
    // remolque_salida_id: ObjectId of the RemolqueVisita that's leaving with this tractor
    const { fecha_hora_salida, source, remolque_exit, remolque_salida_id } = req.body;

    const record = await ControlPatios.findById(id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    const exitDate = fecha_hora_salida ? new Date(fecha_hora_salida) : new Date();
    record.fecha_hora_salida = exitDate;

    // Calculate stay seconds
    const diff = exitDate.getTime() - new Date(record.fecha_hora_inicio).getTime();
    record.stay_seconds = Math.floor(diff / 1000);

    if (record.stay_seconds > 86400 || record.stay_seconds < 60) {
      record.anomaly_flag = true;
      await new PatioAnomaly({
        movement_id: record._id,
        plate: record.placa,
        anomaly_type: "unusual_duration",
        severity: "low",
        description: `Duración de estadía inusual: ${record.stay_seconds < 60 ? `${record.stay_seconds} segundos` : `${Math.floor(record.stay_seconds / 60)} minutos`}.`,
      }).save();
    }

    // Handle remolque exit logic
    if (remolque_exit === "none") {
      // Tractor leaves without any trailer
      record.placa_remolque_salida = null;
      record.remolque_salida_id = null;
      record.hubo_cambio_remolque = record.remolque_entrada_id ? true : null;
    } else if (remolque_exit === "same" && record.remolque_entrada_id) {
      // Tractor leaves with the same trailer it came in with
      const remolque = await RemolqueVisita.findById(record.remolque_entrada_id);
      if (remolque) {
        remolque.fecha_hora_salida = exitDate;
        remolque.tractor_salida_id = record._id;
        remolque.tractor_salida_placa = record.placa;
        await remolque.save();
      }
      record.placa_remolque_salida = record.placa_remolque_entrada;
      record.remolque_salida_id = record.remolque_entrada_id;
      record.hubo_cambio_remolque = false;
    } else if (remolque_exit === "different" && remolque_salida_id) {
      // Tractor leaves with a different trailer
      const remolque = await RemolqueVisita.findById(remolque_salida_id);
      if (remolque) {
        remolque.fecha_hora_salida = exitDate;
        remolque.tractor_salida_id = record._id;
        remolque.tractor_salida_placa = record.placa;
        await remolque.save();
      }
      record.placa_remolque_salida = remolque ? remolque.placa : null;
      record.remolque_salida_id = remolque_salida_id;
      record.hubo_cambio_remolque = true;
    }

    await record.save();

    await new PatioExitEvent({
      plate: record.placa,
      exit_datetime: exitDate,
      source: source || "Manual",
    }).save();

    res.json(record);
  } catch (err) {
    console.error("Error updating control-patios exit:", err);
    res.status(500).json({ error: err.message });
  }
});

app.put("/control-patios/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { placa, linea_transporte, fecha_hora_inicio, fecha_hora_salida, status } = req.body;

    const record = await ControlPatios.findById(id);
    if (!record) return res.status(404).json({ error: "Record not found" });

    if (placa) record.placa = placa;
    if (linea_transporte) record.linea_transporte = linea_transporte;
    if (fecha_hora_inicio) record.fecha_hora_inicio = fecha_hora_inicio;
    if (fecha_hora_salida !== undefined) record.fecha_hora_salida = fecha_hora_salida;
    if (status) record.status = status;

    await record.save();
    res.json(record);
  } catch (err) {
    console.error("Error updating control-patios record:", err);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/control-patios/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await ControlPatios.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: "Record not found" });
    res.json({ message: "Record deleted successfully" });
  } catch (err) {
    console.error("Error deleting control-patios record:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Remolque Visitas ──────────────────────────────────────────────────────────

app.get("/remolque-visitas", async (req, res) => {
  try {
    const { cliente, status } = req.query;
    const query = {};
    if (cliente && cliente !== "all") query.cliente = cliente;
    if (status) query.status = status;
    const records = await RemolqueVisita.find(query).sort({ fecha_hora_entrada: -1 });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/remolque-visitas", async (req, res) => {
  try {
    const { placa, linea_transporte, cliente, fecha_hora_entrada, tractor_entrada_id, tractor_entrada_placa } = req.body;
    const record = new RemolqueVisita({
      placa,
      linea_transporte,
      cliente,
      fecha_hora_entrada: fecha_hora_entrada || new Date(),
      tractor_entrada_id: tractor_entrada_id || null,
      tractor_entrada_placa: tractor_entrada_placa || null,
    });
    await record.save();
    res.status(201).json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.patch("/remolque-visitas/:id/salida", async (req, res) => {
  try {
    const { fecha_hora_salida, tractor_salida_id, tractor_salida_placa, placa_confirmada, linea_transporte } = req.body;
    const record = await RemolqueVisita.findById(req.params.id);
    if (!record) return res.status(404).json({ error: "Remolque record not found" });

    record.fecha_hora_salida = fecha_hora_salida ? new Date(fecha_hora_salida) : new Date();
    if (tractor_salida_id) record.tractor_salida_id = tractor_salida_id;
    if (tractor_salida_placa) record.tractor_salida_placa = tractor_salida_placa;
    if (placa_confirmada) record.placa = placa_confirmada.toUpperCase().trim();
    if (linea_transporte) record.linea_transporte = linea_transporte;
    await record.save();
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/remolque-visitas/:id", async (req, res) => {
  try {
    const deleted = await RemolqueVisita.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ error: "Record not found" });
    res.json({ message: "Deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//start the server
app.listen(PORT, () => {
  console.log(`Server Running at ${PORT}`);
});

// -----------------------------------------------------------------------
// Wialon flush worker
// Drains InboundMessage records with wialonStatus="pending" and pushes them
// to Wialon via exchange/import_messages. Skipped if WIALON_FLUSH_INTERVAL_MS=0.
// -----------------------------------------------------------------------
const WIALON_FLUSH_INTERVAL_MS = parseInt(process.env.WIALON_FLUSH_INTERVAL_MS || "60000", 10);
if (WIALON_FLUSH_INTERVAL_MS > 0) {
  setInterval(async () => {
    try {
      const result = await wialonIntegrationService.pushAllPending();
      if (result && (result.pushed || result.failed)) {
        console.log(
          `[wialon-flush] integrations=${result.integrations} pushed=${result.pushed} failed=${result.failed} skipped=${result.skipped}`
        );
      }
    } catch (err) {
      console.error("[wialon-flush] worker error:", err);
    }
  }, WIALON_FLUSH_INTERVAL_MS);
  console.log(`[wialon-flush] Worker enabled (interval=${WIALON_FLUSH_INTERVAL_MS}ms)`);
} else {
  console.log("[wialon-flush] Worker disabled (WIALON_FLUSH_INTERVAL_MS=0)");
}
