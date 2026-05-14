import { useState, useEffect } from "react";
import { supabase } from "./supabase.js";

const SEDES = {
  "9-de-julio": {
    nombre: "Sede 9 de Julio",
    direccion: "Villa María, Córdoba",
    icon: "🏋️",
  },
  "vm-shopping": {
    nombre: "Sede VM Shopping",
    direccion: "Villa María, Córdoba",
    icon: "💪",
  },
};

const TURNOS_NORMALES = ["10:00", "12:00", "12:45", "16:00", "16:45", "17:30"];
const TURNOS_VIERNES_SHOPPING = ["12:00", "12:45", "15:00", "15:45", "16:30", "17:15"];

const CALENDARIO = [
  { fecha: "2026-05-26", sede: "9-de-julio" },
  { fecha: "2026-05-27", sede: "vm-shopping" },
  { fecha: "2026-05-28", sede: "9-de-julio" },
  { fecha: "2026-05-29", sede: "vm-shopping" },
  { fecha: "2026-05-30", sede: "9-de-julio" },
  { fecha: "2026-06-02", sede: "vm-shopping" },
  { fecha: "2026-06-03", sede: "9-de-julio" },
  { fecha: "2026-06-04", sede: "vm-shopping" },
  { fecha: "2026-06-05", sede: "9-de-julio" },
  { fecha: "2026-06-06", sede: "vm-shopping" },
  { fecha: "2026-06-09", sede: "9-de-julio" },
  { fecha: "2026-06-10", sede: "vm-shopping" },
  { fecha: "2026-06-11", sede: "9-de-julio" },
  { fecha: "2026-06-12", sede: "vm-shopping" },
  { fecha: "2026-06-13", sede: "9-de-julio" },
];

const getTurnosForDay = (fechaStr, sedeKey) => {
  const date = new Date(fechaStr + "T12:00:00");
  if (sedeKey === "vm-shopping" && date.getDay() === 5) return TURNOS_VIERNES_SHOPPING;
  return TURNOS_NORMALES;
};

const parseFecha = (str) => new Date(str + "T12:00:00");

const formatFechaCorta = (str) => {
  const d = parseFecha(str);
  const dias = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  return `${dias[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`;
};

const formatFechaLarga = (str) => {
  const d = parseFecha(str);
  const dias = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
  const meses = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
  return `${dias[d.getDay()]} ${d.getDate()} de ${meses[d.getMonth()]}`;
};

const getSemana = (fechaStr) => {
  const d = parseFecha(fechaStr);
  if (d < new Date("2026-06-01T00:00:00")) return 1;
  if (d < new Date("2026-06-08T00:00:00")) return 2;
  return 3;
};

const SEMANA_LABELS = { 1: "26–30 May", 2: "2–6 Jun", 3: "9–13 Jun" };

export default function App() {
  const [step, setStep] = useState(1);
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [sedeSeleccionada, setSedeSeleccionada] = useState("");
  const [fechaSeleccionada, setFechaSeleccionada] = useState("");
  const [turnoSeleccionado, setTurnoSeleccionado] = useState(null);
  const [errors, setErrors] = useState({});
  const [ultimaReserva, setUltimaReserva] = useState(null);
  const [reservados, setReservados] = useState({});
  const [animating, setAnimating] = useState(false);
  const [semanaActiva, setSemanaActiva] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Cargar reservas existentes de Supabase
  useEffect(() => {
    const cargarReservas = async () => {
      const { data, error } = await supabase
        .from("reservas")
        .select("sede, fecha, turno");

      if (error) { console.error("Error cargando reservas:", error); return; }

      const mapa = {};
      data.forEach((r) => {
        const fechaKey = r.fecha;
        if (!mapa[fechaKey]) mapa[fechaKey] = {};
        const turnoKey = r.turno.slice(0, 5);
        mapa[fechaKey][turnoKey] = true;
      });
      setReservados(mapa);
    };

    cargarReservas();

    // Suscribirse a cambios en tiempo real
    const channel = supabase
      .channel("reservas-changes")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "reservas" },
        (payload) => {
          const r = payload.new;
          setReservados((prev) => ({
            ...prev,
            [r.fecha]: { ...prev[r.fecha], [r.turno.slice(0, 5)]: true },
          }));
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const goToStep = (s) => {
    setAnimating(true);
    setTimeout(() => { setStep(s); setAnimating(false); }, 180);
  };

  const validarDatos = () => {
    const e = {};
    if (!nombre.trim()) e.nombre = "Ingresá tu nombre completo";
    const dniClean = dni.replace(/\./g, "");
    if (!dniClean) e.dni = "Ingresá tu DNI";
    else if (!/^\d{7,8}$/.test(dniClean)) e.dni = "El DNI debe tener 7 u 8 dígitos";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmitDatos = () => { if (validarDatos()) goToStep(2); };

  const handleSeleccionarSede = (s) => {
    setSedeSeleccionada(s);
    const fechas = CALENDARIO.filter((c) => c.sede === s);
    const s1 = fechas.filter((c) => getSemana(c.fecha) === 1);
    if (s1.length > 0) { setFechaSeleccionada(s1[0].fecha); setSemanaActiva(1); }
    else { setFechaSeleccionada(fechas[0].fecha); setSemanaActiva(getSemana(fechas[0].fecha)); }
    setTurnoSeleccionado(null);
    goToStep(3);
  };

  const handleConfirmar = async () => {
    setLoading(true);
    setSubmitError("");

    const entry = CALENDARIO.find((c) => c.fecha === fechaSeleccionada);
    const { data, error } = await supabase.from("reservas").insert({
      nombre: nombre.trim(),
      dni: dni.replace(/\./g, ""),
      sede: entry.sede,
      fecha: fechaSeleccionada,
      turno: turnoSeleccionado,
    }).select();

    setLoading(false);

    if (error) {
      if (error.code === "23505") {
        setSubmitError("¡Uy! Alguien acaba de reservar este turno. Elegí otro por favor.");
        setReservados((prev) => ({
          ...prev,
          [fechaSeleccionada]: { ...prev[fechaSeleccionada], [turnoSeleccionado]: true },
        }));
        setTurnoSeleccionado(null);
      } else {
        setSubmitError("Hubo un error al reservar. Intentá de nuevo.");
        console.error("Error:", error);
      }
      return;
    }

    setUltimaReserva({
      nombre: nombre.trim(),
      dni: dni.replace(/\./g, ""),
      sede: SEDES[entry.sede].nombre,
      fechaDisplay: formatFechaLarga(fechaSeleccionada),
      turno: turnoSeleccionado,
    });
    setReservados((prev) => ({
      ...prev,
      [fechaSeleccionada]: { ...prev[fechaSeleccionada], [turnoSeleccionado]: true },
    }));
    goToStep(4);
  };

  const handleNuevaReserva = () => {
    setNombre(""); setDni(""); setSedeSeleccionada("");
    setFechaSeleccionada(""); setTurnoSeleccionado(null);
    setErrors({}); setSubmitError(""); setUltimaReserva(null);
    goToStep(1);
  };

  const fechasDeSede = CALENDARIO.filter((c) => c.sede === sedeSeleccionada);
  const fechasDeSemana = fechasDeSede.filter((c) => getSemana(c.fecha) === semanaActiva);
  const semanasDisponibles = [...new Set(fechasDeSede.map((c) => getSemana(c.fecha)))].sort();

  const turnosDelDia = fechaSeleccionada && sedeSeleccionada
    ? getTurnosForDay(fechaSeleccionada, sedeSeleccionada) : [];

  const turnosConEstado = turnosDelDia.map((t) => ({
    hora: t,
    disponible: !(reservados[fechaSeleccionada] && reservados[fechaSeleccionada][t]),
  }));

  const disponiblesCount = turnosConEstado.filter((t) => t.disponible).length;

  return (
    <div style={{
      fontFamily: "'DM Sans', sans-serif", maxWidth: 520,
      margin: "0 auto", minHeight: "100vh",
      background: "linear-gradient(170deg, #f8f6f3 0%, #f0ece6 100%)",
    }}>
      {/* Header */}
      <div style={{
        background: "linear-gradient(135deg, #5c4a3a 0%, #3d2e22 100%)",
        padding: "28px 24px 24px", color: "#fff",
        position: "relative", overflow: "hidden",
      }}>
        <div style={{ position: "absolute", top: -30, right: -30, width: 120, height: 120, borderRadius: "50%", background: "rgba(255,255,255,0.06)" }} />
        <div style={{ position: "absolute", bottom: -20, left: -20, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
        <p style={{ fontSize: 11, letterSpacing: 3, textTransform: "uppercase", opacity: 0.7, marginBottom: 6, fontWeight: 500 }}>
          Sabor Científico
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, margin: 0, lineHeight: 1.2 }}>
          Jornada de mediciones antropométricas
        </h1>
        <p style={{ fontSize: 13, opacity: 0.7, marginTop: 8, lineHeight: 1.5 }}>
          Reservá tu turno para una evaluación de composición corporal
        </p>
        <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
          {[1, 2, 3, 4].map((s) => (
            <div key={s} style={{
              height: 3, flex: s <= step ? 2 : 1, borderRadius: 2,
              background: s <= step ? "#d4a574" : "rgba(255,255,255,0.2)",
              transition: "all 0.4s ease",
            }} />
          ))}
        </div>
      </div>

      {/* Content */}
      <div style={{
        padding: "24px 20px 40px",
        opacity: animating ? 0 : 1,
        transform: animating ? "translateY(8px)" : "translateY(0)",
        transition: "all 0.18s ease",
      }}>

        {/* STEP 1 — Datos */}
        {step === 1 && (
          <div>
            <StepLabel number="1" text="Tus datos" />
            <p style={subtextStyle}>Completá con tu nombre y DNI. Verificaremos que estés inscripto/a en el gimnasio.</p>
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>Nombre completo</label>
              <input type="text" value={nombre}
                onChange={(e) => { setNombre(e.target.value); setErrors((p) => ({ ...p, nombre: undefined })); }}
                placeholder="Ej: María García"
                style={{ ...inputStyle, borderColor: errors.nombre ? "#c44" : "#d9d3cb" }}
              />
              {errors.nombre && <ErrorMsg text={errors.nombre} />}
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={labelStyle}>DNI (sin puntos)</label>
              <input type="text" value={dni}
                onChange={(e) => { setDni(e.target.value.replace(/[^\d.]/g, "")); setErrors((p) => ({ ...p, dni: undefined })); }}
                placeholder="Ej: 35678901" maxLength={10}
                style={{ ...inputStyle, borderColor: errors.dni ? "#c44" : "#d9d3cb" }}
              />
              {errors.dni && <ErrorMsg text={errors.dni} />}
            </div>

            <div style={{
              padding: "14px 16px", borderRadius: 10, marginBottom: 20,
              background: "#fdf8f0", border: "1px solid #e8dfd3",
            }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: "#5c4a3a", marginBottom: 8 }}>
                📋 Indicaciones para el día de la medición
              </p>
              <div style={{ fontSize: 12.5, color: "#6b5d50", lineHeight: 1.7 }}>
                <p style={{ margin: "0 0 6px" }}>🩳 <strong>Hombres:</strong> venir con pantalón corto</p>
                <p style={{ margin: "0 0 6px" }}>👙 <strong>Mujeres:</strong> venir con short y top</p>
                <p style={{ margin: 0 }}>🧴 <strong>Sin crema corporal</strong> el día de la medición (para que no resbalen los instrumentos)</p>
              </div>
            </div>

            <button onClick={handleSubmitDatos} style={primaryBtnStyle}>Continuar →</button>
          </div>
        )}

        {/* STEP 2 — Sede */}
        {step === 2 && (
          <div>
            <BackButton onClick={() => goToStep(1)} />
            <StepLabel number="2" text="Elegí tu sede" />
            <p style={subtextStyle}>Seleccioná en qué sede querés hacer tus mediciones.</p>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {Object.entries(SEDES).map(([key, s]) => {
                const diasEnSede = CALENDARIO.filter((c) => c.sede === key).length;
                const turnosTotales = CALENDARIO.filter((c) => c.sede === key)
                  .reduce((acc, c) => {
                    return acc + getTurnosForDay(c.fecha, c.sede)
                      .filter((t) => !(reservados[c.fecha] && reservados[c.fecha][t])).length;
                  }, 0);
                return (
                  <button key={key} onClick={() => handleSeleccionarSede(key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 14,
                      padding: "16px 18px", background: "#fff",
                      border: "1px solid #e5e0d9", borderRadius: 12,
                      cursor: "pointer", textAlign: "left", transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "#c4a882"; e.currentTarget.style.transform = "translateX(4px)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "#e5e0d9"; e.currentTarget.style.transform = "translateX(0)"; }}
                  >
                    <span style={{ fontSize: 28 }}>{s.icon}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 15, color: "#3d2e22" }}>{s.nombre}</div>
                      <div style={{ fontSize: 12, color: "#8a7e74", marginTop: 2 }}>{s.direccion}</div>
                      <div style={{ fontSize: 11, color: "#a89880", marginTop: 4 }}>
                        {diasEnSede} días · {turnosTotales} turnos disponibles
                      </div>
                    </div>
                    <span style={{ color: "#c4a882", fontSize: 18 }}>→</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* STEP 3 — Turnos */}
        {step === 3 && (
          <div>
            <BackButton onClick={() => { setSedeSeleccionada(""); goToStep(2); }} />
            <StepLabel number="3" text="Elegí tu turno" />

            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              marginBottom: 16, padding: "8px 12px",
              background: "#fff", borderRadius: 8, border: "1px solid #e5e0d9",
            }}>
              <span style={{ fontSize: 16 }}>{SEDES[sedeSeleccionada]?.icon}</span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "#5c4a3a" }}>
                {SEDES[sedeSeleccionada]?.nombre}
              </span>
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
              {semanasDisponibles.map((s) => (
                <button key={s}
                  onClick={() => {
                    setSemanaActiva(s);
                    const pf = fechasDeSede.filter((c) => getSemana(c.fecha) === s)[0];
                    if (pf) { setFechaSeleccionada(pf.fecha); setTurnoSeleccionado(null); }
                  }}
                  style={{
                    padding: "6px 14px", borderRadius: 20,
                    border: semanaActiva === s ? "none" : "1px solid #e5e0d9",
                    background: semanaActiva === s ? "#5c4a3a" : "#fff",
                    color: semanaActiva === s ? "#fff" : "#8a7e74",
                    fontSize: 12, fontWeight: 500, cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  Sem {s} · {SEMANA_LABELS[s]}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 6, marginBottom: 18, overflowX: "auto", paddingBottom: 4 }}>
              {fechasDeSemana.map((c) => {
                const selected = fechaSeleccionada === c.fecha;
                const libres = getTurnosForDay(c.fecha, c.sede)
                  .filter((t) => !(reservados[c.fecha] && reservados[c.fecha][t])).length;
                return (
                  <button key={c.fecha}
                    onClick={() => { setFechaSeleccionada(c.fecha); setTurnoSeleccionado(null); }}
                    style={{
                      padding: "10px 12px", borderRadius: 10, minWidth: 85,
                      border: selected ? "2px solid #5c4a3a" : "1px solid #e5e0d9",
                      background: selected ? "#5c4a3a" : "#fff",
                      color: selected ? "#fff" : "#5c4a3a",
                      cursor: "pointer", fontSize: 13, fontWeight: selected ? 600 : 400,
                      textAlign: "center", transition: "all 0.15s ease",
                    }}
                  >
                    <div>{formatFechaCorta(c.fecha)}</div>
                    <div style={{ fontSize: 10, marginTop: 3, opacity: selected ? 0.8 : 0.5 }}>
                      {libres} {libres === 1 ? "lugar" : "lugares"}
                    </div>
                  </button>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 14, fontSize: 12, color: "#8a7e74" }}>
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#7a9e6b", marginRight: 6, verticalAlign: "middle" }} />
                {disponiblesCount} disponibles
              </span>
              <span>
                <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: "#d9d3cb", marginRight: 6, verticalAlign: "middle" }} />
                {turnosConEstado.length - disponiblesCount} ocupados
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {turnosConEstado.map((t) => {
                const isSelected = turnoSeleccionado === t.hora;
                const [h, m] = t.hora.split(":").map(Number);
                const totalMin = h * 60 + m + 45;
                const fin = `${String(Math.floor(totalMin / 60)).padStart(2, "0")}:${String(totalMin % 60).padStart(2, "0")}`;
                return (
                  <button key={t.hora} disabled={!t.disponible}
                    onClick={() => { setTurnoSeleccionado(t.hora); setSubmitError(""); }}
                    style={{
                      padding: "12px 8px", borderRadius: 10,
                      border: isSelected ? "2px solid #5c4a3a" : "1px solid " + (t.disponible ? "#e5e0d9" : "#eee"),
                      background: isSelected ? "#5c4a3a" : t.disponible ? "#fff" : "#f5f3f0",
                      color: isSelected ? "#fff" : t.disponible ? "#5c4a3a" : "#c5bfb7",
                      cursor: t.disponible ? "pointer" : "not-allowed",
                      fontSize: 14, fontWeight: isSelected ? 600 : 400,
                      transition: "all 0.12s ease", textAlign: "center",
                    }}
                  >
                    <div>{t.hora}</div>
                    <div style={{ fontSize: 10, opacity: isSelected ? 0.8 : 0.5, marginTop: 2 }}>a {fin}</div>
                  </button>
                );
              })}
            </div>

            {submitError && (
              <div style={{
                marginTop: 16, padding: "12px 14px", borderRadius: 10,
                background: "#fef2f2", border: "1px solid #fecaca",
                fontSize: 13, color: "#991b1b",
              }}>
                {submitError}
              </div>
            )}

            {turnoSeleccionado && (
              <div style={{
                marginTop: 24, padding: 16, background: "#fff",
                borderRadius: 12, border: "1px solid #e5e0d9",
              }}>
                <p style={{ fontSize: 12, color: "#8a7e74", marginBottom: 10, textTransform: "uppercase", letterSpacing: 1 }}>
                  Resumen de tu turno
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 14 }}>
                  <span style={{ color: "#8a7e74" }}>👤</span>
                  <span style={{ color: "#3d2e22", fontWeight: 500 }}>{nombre}</span>
                  <span style={{ color: "#8a7e74" }}>🪪</span>
                  <span style={{ color: "#3d2e22" }}>DNI {dni}</span>
                  <span style={{ color: "#8a7e74" }}>📍</span>
                  <span style={{ color: "#3d2e22" }}>{SEDES[sedeSeleccionada]?.nombre}</span>
                  <span style={{ color: "#8a7e74" }}>📅</span>
                  <span style={{ color: "#3d2e22", textTransform: "capitalize" }}>{formatFechaLarga(fechaSeleccionada)}</span>
                  <span style={{ color: "#8a7e74" }}>🕐</span>
                  <span style={{ color: "#3d2e22", fontWeight: 500 }}>{turnoSeleccionado} hs (45 min)</span>
                </div>
                <button
                  onClick={handleConfirmar}
                  disabled={loading}
                  style={{
                    ...primaryBtnStyle,
                    marginTop: 16,
                    opacity: loading ? 0.7 : 1,
                    cursor: loading ? "wait" : "pointer",
                  }}
                >
                  {loading ? "Reservando..." : "Confirmar turno ✓"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* STEP 4 — Confirmación */}
        {step === 4 && ultimaReserva && (
          <div style={{ textAlign: "center", paddingTop: 16 }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%", background: "#7a9e6b",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 18px", fontSize: 26, color: "#fff",
            }}>✓</div>
            <h2 style={{
              fontFamily: "'Playfair Display', serif",
              fontSize: 21, color: "#3d2e22", marginBottom: 6,
            }}>¡Turno confirmado!</h2>
            <p style={{ fontSize: 13, color: "#8a7e74", marginBottom: 16, lineHeight: 1.6 }}>
              Te esperamos para tu evaluación antropométrica.
            </p>

            <div style={{
              background: "#fff", borderRadius: 12,
              border: "1px solid #e5e0d9", padding: 18,
              textAlign: "left", marginBottom: 16,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 10 }}>
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14, color: "#3d2e22", marginBottom: 2 }}>{ultimaReserva.nombre}</p>
                  <p style={{ fontSize: 12, color: "#8a7e74" }}>DNI: {ultimaReserva.dni}</p>
                </div>
                <span style={{
                  fontSize: 11, padding: "3px 10px", borderRadius: 20,
                  background: "#eef5eb", color: "#5a7d4e", fontWeight: 500,
                }}>Confirmado</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, fontSize: 12 }}>
                <div style={{ color: "#8a7e74" }}>📍 {ultimaReserva.sede}</div>
                <div style={{ color: "#8a7e74", textTransform: "capitalize" }}>📅 {ultimaReserva.fechaDisplay}</div>
                <div style={{ color: "#8a7e74" }}>🕐 {ultimaReserva.turno} hs</div>
              </div>
            </div>

            <div style={{
              padding: "12px 14px", borderRadius: 10, marginBottom: 20,
              background: "#fdf8f0", border: "1px solid #e8dfd3",
              textAlign: "left", fontSize: 12.5, color: "#6b5d50", lineHeight: 1.7,
            }}>
              <p style={{ fontWeight: 600, marginBottom: 6, color: "#5c4a3a" }}>📋 Recordá:</p>
              <p style={{ margin: "0 0 4px" }}>🩳 Hombres: pantalón corto · Mujeres: short y top</p>
              <p style={{ margin: 0 }}>🧴 No aplicar crema corporal el día de la medición</p>
            </div>

            <button onClick={handleNuevaReserva} style={{
              ...primaryBtnStyle, background: "#fff", color: "#5c4a3a", border: "1px solid #d9d3cb",
            }}>
              Registrar otra persona
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function StepLabel({ number, text }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
      <span style={{
        width: 26, height: 26, borderRadius: "50%",
        background: "#5c4a3a", color: "#fff",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 600,
      }}>{number}</span>
      <span style={{
        fontFamily: "'Playfair Display', serif",
        fontSize: 18, fontWeight: 600, color: "#3d2e22",
      }}>{text}</span>
    </div>
  );
}

function BackButton({ onClick }) {
  return (
    <button onClick={onClick} style={{
      display: "flex", alignItems: "center", gap: 6,
      background: "none", border: "none", color: "#8a7e74",
      fontSize: 13, cursor: "pointer", padding: "0 0 14px", marginLeft: -2,
    }}>← Volver</button>
  );
}

function ErrorMsg({ text }) {
  return <p style={{ fontSize: 12, color: "#c44", marginTop: 4, marginBottom: 0 }}>{text}</p>;
}

const subtextStyle = { fontSize: 13, color: "#8a7e74", marginBottom: 18, lineHeight: 1.6 };
const labelStyle = { display: "block", fontSize: 13, fontWeight: 500, color: "#5c4a3a", marginBottom: 6 };
const inputStyle = {
  width: "100%", padding: "12px 14px", borderRadius: 10,
  border: "1px solid #d9d3cb", fontSize: 15, background: "#fff",
  outline: "none", transition: "border-color 0.15s ease",
  boxSizing: "border-box", fontFamily: "'DM Sans', sans-serif",
};
const primaryBtnStyle = {
  width: "100%", padding: "14px", borderRadius: 10,
  border: "none", background: "#5c4a3a", color: "#fff",
  fontSize: 15, fontWeight: 600, cursor: "pointer",
  transition: "all 0.15s ease", fontFamily: "'DM Sans', sans-serif",
};
