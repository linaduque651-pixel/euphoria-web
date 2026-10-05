import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'

/* ================================================================
   EUPHORIA · TIENDA
   El catálogo sale del inventario (Google Sheets) a través del servicio
   "Euphoria · Tienda web" (Apps Script). Las fotos salen de la carpeta
   de Drive "Euphoria/Fotos productos" (una subcarpeta por producto,
   varias fotos ordenadas por nombre: 1, 2, 3…).
   Lo que tiene stock 0 aparece como AGOTADO automáticamente.
   Los pedidos llegan a la pestaña "Pedidos" del inventario.
   ================================================================ */
const TIENDA_URL = 'https://script.google.com/macros/s/AKfycbxAs1wS__JS9-DOLD17cg-bQlhDgswkB6hU3OHzrhYuXewC3UeOW_X1SnN1KbL30hRBVg/exec'
const INSTAGRAM = 'https://instagram.com/euphoriaby.dz'

type Producto = {
  id: string
  nombre: string
  detalle: string
  coleccion: string
  tipo: string
  precio: number
  disponible: boolean
  maximo: number
  fotos: string[]
}

type Catalogo = {
  ok: boolean
  whatsapp: string
  mensajeEnvio: string
  colecciones: string[]
  productos: Producto[]
}

type Cliente = {
  nombre: string
  cedula: string
  celular: string
  correo: string
  direccion: string
  barrio: string
  ciudad: string
  departamento: string
  notas: string
}

type Carrito = Record<string, number>

const CLIENTE_VACIO: Cliente = {
  nombre: '', cedula: '', celular: '', correo: '', direccion: '',
  barrio: '', ciudad: '', departamento: '', notas: '',
}

const DEPARTAMENTOS = [
  'Antioquia', 'Amazonas', 'Arauca', 'Atlántico', 'Bogotá D.C.', 'Bolívar', 'Boyacá', 'Caldas',
  'Caquetá', 'Casanare', 'Cauca', 'Cesar', 'Chocó', 'Córdoba', 'Cundinamarca', 'Guainía',
  'Guaviare', 'Huila', 'La Guajira', 'Magdalena', 'Meta', 'Nariño', 'Norte de Santander',
  'Putumayo', 'Quindío', 'Risaralda', 'San Andrés y Providencia', 'Santander', 'Sucre',
  'Tolima', 'Valle del Cauca', 'Vaupés', 'Vichada',
]

const POR_PAGINA = 24
const SERIF = "'Cormorant Garamond', serif"
const SANS = "'Jost', sans-serif"
const C = {
  tinta: '#14120F', crema: '#F4EFE7', arena: '#EDE5D8', borde: '#DED4C4', papel: '#FBF8F2',
  rojo: '#C4241E', rojoOsc: '#a51e19', oro: '#E8B923', gris: '#8A8175', grisClaro: '#A2988A',
}

const pesos = (n: number) => '$' + Math.round(n).toLocaleString('es-CO')

function leerCarrito(): Carrito {
  try {
    const raw = localStorage.getItem('euphoria-carrito')
    const c = raw ? JSON.parse(raw) : {}
    return c && typeof c === 'object' ? c : {}
  } catch {
    return {}
  }
}

function guardarCarrito(c: Carrito) {
  try { localStorage.setItem('euphoria-carrito', JSON.stringify(c)) } catch { /* sin almacenamiento */ }
}

function waUrl(numero: string, texto: string) {
  return `https://wa.me/${numero}?text=${encodeURIComponent(texto)}`
}

/* ---------------- Piezas visuales ---------------- */

function Bolt({ w = 14, h = 24, color = C.rojo }: { w?: number; h?: number; color?: string }) {
  return <div className="bolt flex-none" style={{ width: w, height: h, background: color }} />
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Bolt w={11} h={18} color={dark ? C.oro : C.rojo} />
      <span
        className="uppercase tracking-[0.05em] text-[24px] leading-none"
        style={{ fontFamily: SERIF, fontWeight: 600, color: dark ? C.crema : C.tinta }}
      >
        Euphoria
      </span>
    </div>
  )
}

function Etiqueta({ children, color = C.grisClaro }: { children: ReactNode; color?: string }) {
  return (
    <span style={{ fontSize: 10, letterSpacing: '0.36em', color, fontFamily: SANS, fontWeight: 300 }}>
      {children}
    </span>
  )
}

function SinFoto({ nombre }: { nombre: string }) {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-4" style={{ background: C.arena }}>
      <Bolt w={26} h={43} color="#D9CDB9" />
      <span style={{ fontSize: 9, letterSpacing: '0.34em', color: C.grisClaro, fontFamily: SANS, textAlign: 'center', padding: '0 16px' }}>
        {nombre.toUpperCase()}
      </span>
    </div>
  )
}

// Galería: varias fotos por producto, con flechas, puntos y deslizar en el celular.
function Galeria({ p, grande = false }: { p: Producto; grande?: boolean }) {
  const [i, setI] = useState(0)
  const [x0, setX0] = useState<number | null>(null)
  const n = p.fotos.length
  if (!n) return <SinFoto nombre={p.nombre} />
  const ir = (d: number) => setI(v => (v + d + n) % n)
  const flecha = (d: number) => (
    <button
      aria-label={d < 0 ? 'Foto anterior' : 'Foto siguiente'}
      onClick={e => { e.stopPropagation(); ir(d) }}
      className={`absolute top-1/2 -translate-y-1/2 ${d < 0 ? 'left-2' : 'right-2'} ${grande ? '' : 'opacity-0 group-hover:opacity-100'} transition-opacity`}
      style={{ width: 32, height: 32, background: 'rgba(244,239,231,0.9)', color: C.tinta, border: 'none', cursor: 'pointer', fontSize: 16 }}
    >
      {d < 0 ? '‹' : '›'}
    </button>
  )
  return (
    <div
      className="relative w-full h-full group"
      onTouchStart={e => setX0(e.touches[0].clientX)}
      onTouchEnd={e => {
        if (x0 === null) return
        const dx = e.changedTouches[0].clientX - x0
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1)
        setX0(null)
      }}
    >
      <img
        src={p.fotos[i]}
        alt={`${p.nombre} · foto ${i + 1}`}
        loading="lazy"
        className={`w-full h-full object-cover ${grande ? '' : 'product-img'}`}
        style={p.disponible ? undefined : { filter: 'grayscale(35%)' }}
      />
      {n > 1 && (
        <>
          {flecha(-1)}
          {flecha(1)}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {p.fotos.map((_, k) => (
              <span
                key={k}
                onClick={e => { e.stopPropagation(); setI(k) }}
                style={{
                  width: k === i ? 16 : 6, height: 6, cursor: 'pointer', transition: 'all .25s',
                  background: k === i ? C.crema : 'rgba(244,239,231,0.55)',
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function Boton({ children, onClick, disabled = false, claro = false, full = false, type = 'button' }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; claro?: boolean; full?: boolean; type?: 'button' | 'submit'
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`transition-colors duration-200 ${full ? 'w-full' : ''} ${disabled ? '' : claro ? 'hover:bg-[#14120F] hover:text-[#F4EFE7]' : 'hover:bg-[#a51e19]'}`}
      style={{
        background: disabled ? '#CFC5B5' : claro ? 'transparent' : C.rojo,
        color: claro ? C.tinta : C.crema,
        border: claro ? `1px solid ${C.tinta}` : 'none',
        fontSize: 10, letterSpacing: '0.28em', padding: '12px 18px',
        fontFamily: SANS, fontWeight: 400, cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}

/* ---------------- Aplicación ---------------- */

export default function App() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null)
  const [error, setError] = useState('')
  const [coleccion, setColeccion] = useState('Todas')
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [detalle, setDetalle] = useState<Producto | null>(null)
  const [carrito, setCarrito] = useState<Carrito>(leerCarrito)
  const [panel, setPanel] = useState<'cerrado' | 'carrito' | 'datos' | 'listo'>('cerrado')
  const [cliente, setCliente] = useState<Cliente>(CLIENTE_VACIO)
  const [trampa, setTrampa] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorPedido, setErrorPedido] = useState('')
  const [resultado, setResultado] = useState<{ numero: string; total: number; whatsapp: string; mensaje: string } | null>(null)

  const cargar = () => {
    setError('')
    fetch(TIENDA_URL)
      .then(r => r.json())
      .then((d: Catalogo) => {
        if (!d.ok) throw new Error()
        setCatalogo(d)
      })
      .catch(() => setError('No pudimos cargar el catálogo en este momento.'))
  }
  useEffect(cargar, [])

  useEffect(() => guardarCarrito(carrito), [carrito])

  const porId = useMemo(() => {
    const m: Record<string, Producto> = {}
    catalogo?.productos.forEach(p => { m[p.id] = p })
    return m
  }, [catalogo])

  // Ajusta el carrito si algo se agotó o bajó el stock desde la última visita.
  useEffect(() => {
    if (!catalogo) return
    setCarrito(c => {
      const n: Carrito = {}
      Object.entries(c).forEach(([id, q]) => {
        const p = porId[id]
        if (p && p.disponible) n[id] = Math.min(q, p.maximo)
      })
      return n
    })
  }, [catalogo, porId])

  const whatsapp = catalogo?.whatsapp || ''
  const contacto = whatsapp ? waUrl(whatsapp, 'Hola Euphoria ⚡ quiero hacer una consulta') : INSTAGRAM

  const filtrados = useMemo(() => {
    if (!catalogo) return []
    const q = busqueda.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    return catalogo.productos.filter(p =>
      (coleccion === 'Todas' || p.coleccion === coleccion) &&
      (!soloDisponibles || p.disponible) &&
      (!q || `${p.nombre} ${p.detalle} ${p.coleccion} ${p.tipo}`.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').includes(q)),
    )
  }, [catalogo, coleccion, soloDisponibles, busqueda])

  useEffect(() => setPagina(1), [coleccion, soloDisponibles, busqueda])

  const lineas = Object.entries(carrito)
    .map(([id, cantidad]) => ({ p: porId[id], cantidad }))
    .filter(l => l.p && l.cantidad > 0)
  const unidades = lineas.reduce((s, l) => s + l.cantidad, 0)
  const total = lineas.reduce((s, l) => s + l.p.precio * l.cantidad, 0)

  const agregar = (p: Producto) => {
    setCarrito(c => ({ ...c, [p.id]: Math.min((c[p.id] || 0) + 1, p.maximo) }))
    setPanel('carrito')
  }
  const cambiar = (id: string, cantidad: number) => {
    setCarrito(c => {
      const n = { ...c }
      if (cantidad <= 0) delete n[id]
      else n[id] = Math.min(cantidad, porId[id]?.maximo || cantidad)
      return n
    })
  }

  const enviarPedido = async (e: FormEvent) => {
    e.preventDefault()
    setErrorPedido('')
    setEnviando(true)
    try {
      const r = await fetch(TIENDA_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({
          cliente,
          items: lineas.map(l => ({ id: l.p.id, cantidad: l.cantidad })),
          website: trampa,
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || 'No pudimos registrar tu pedido.')
      setResultado(d)
      setCarrito({})
      setCliente(CLIENTE_VACIO)
      setPanel('listo')
      cargar()
    } catch (err) {
      setErrorPedido(err instanceof Error && err.message ? err.message : 'No pudimos registrar tu pedido. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const visibles = filtrados.slice(0, pagina * POR_PAGINA)
  const disponibles = catalogo?.productos.filter(p => p.disponible).length || 0

  return (
    <div style={{ background: C.arena, minHeight: '100vh' }}>

      {/* ── Ticker ── */}
      <div style={{ background: C.rojo, overflow: 'hidden', padding: '9px 0' }} aria-hidden>
        <div className="ticker-track">
          {[...Array(2)].map((_, i) => (
            <span key={i} style={{ fontSize: 10, letterSpacing: '0.48em', color: C.crema, fontFamily: SANS, fontWeight: 300, paddingRight: '4em' }}>
              SER VOS, ESO ES REVOLUCIÓN ⚡ EUPHORIA · MEDELLÍN ⚡ ENVÍOS A TODA COLOMBIA ⚡ SER VOS, ESO ES REVOLUCIÓN ⚡ EUPHORIA · MEDELLÍN ⚡ ENVÍOS A TODA COLOMBIA ⚡&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav style={{ background: C.tinta, borderBottom: '1px solid #2A2724' }} className="sticky top-0 z-40">
        <div style={{ maxWidth: 1120 }} className="mx-auto px-6 md:px-16 h-14 flex items-center justify-between">
          <Logo dark />
          <div className="flex items-center gap-5">
            <a href="#catalogo" className="hover:text-[#F4EFE7] transition-colors hidden sm:block"
              style={{ fontSize: 11, letterSpacing: '0.3em', color: C.grisClaro, fontFamily: SANS, fontWeight: 300, textDecoration: 'none' }}>
              CATÁLOGO
            </a>
            <button
              onClick={() => setPanel('carrito')}
              className="flex items-center gap-2 hover:bg-[#a51e19] transition-colors"
              style={{ background: C.rojo, color: C.crema, fontSize: 11, letterSpacing: '0.26em', fontFamily: SANS, padding: '8px 16px', border: 'none', cursor: 'pointer' }}
            >
              BOLSA
              <span style={{ background: C.crema, color: C.rojo, minWidth: 20, height: 20, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, letterSpacing: 0, fontWeight: 500 }}>
                {unidades}
              </span>
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: C.tinta, color: C.crema }}>
        <div style={{ maxWidth: 1120 }} className="mx-auto px-6 md:px-16 py-24 md:py-36 grid md:grid-cols-[1fr_auto] gap-12 items-end">
          <div className="flex flex-col gap-7">
            <Bolt w={40} h={66} />
            <h1 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(52px, 8vw, 96px)', lineHeight: 0.92, letterSpacing: '0.03em', textTransform: 'uppercase', margin: 0 }}>
              Ser vos,<br />eso es<br />revolución.
            </h1>
            <div className="flex items-center gap-5">
              <div style={{ width: 60, height: 1, background: '#5C544A' }} />
              <span style={{ fontSize: 11, letterSpacing: '0.42em', color: '#C0B6A8', fontFamily: SANS, fontWeight: 300 }}>
                EUPHORIA · ACCESORIOS · MEDELLÍN
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-5 md:text-right">
            <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, lineHeight: 1.35, maxWidth: '14ch', margin: 0, color: '#C0B6A8' }}>
              Medellín · Envíos a toda Colombia.
            </p>
            <a href="#catalogo" className="md:self-end hover:bg-[#C4241E] hover:text-[#F4EFE7] transition-colors duration-300"
              style={{ display: 'inline-block', border: `1px solid ${C.rojo}`, color: C.rojo, fontSize: 11, letterSpacing: '0.3em', padding: '14px 28px', textDecoration: 'none', fontFamily: SANS, alignSelf: 'flex-start' }}>
              VER CATÁLOGO
            </a>
          </div>
        </div>
      </section>

      {/* ── Catálogo ── */}
      <section id="catalogo" style={{ background: C.crema }}>
        <div style={{ maxWidth: 1120 }} className="mx-auto px-6 md:px-16 py-20 md:py-28">

          <div className="flex flex-col gap-3 mb-10">
            <Etiqueta>01 · CATÁLOGO</Etiqueta>
            <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.05, margin: 0 }}>
              Nuestras piezas
            </h2>
            {catalogo && (
              <p style={{ fontSize: 13, color: C.gris, margin: 0, fontWeight: 300 }}>
                {disponibles} piezas disponibles · {catalogo.colecciones.length} colecciones
              </p>
            )}
          </div>

          {catalogo && (
            <div className="flex flex-col gap-4 mb-10">
              <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
                {['Todas', ...catalogo.colecciones].map(c => (
                  <button
                    key={c}
                    onClick={() => setColeccion(c)}
                    className="flex-none"
                    style={{
                      fontSize: 10, letterSpacing: '0.26em', padding: '9px 16px', fontFamily: SANS,
                      border: `1px solid ${coleccion === c ? C.tinta : C.borde}`,
                      background: coleccion === c ? C.tinta : 'transparent',
                      color: coleccion === c ? C.crema : C.gris, cursor: 'pointer', transition: 'all .2s',
                    }}
                  >
                    {c.toUpperCase()}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-4 justify-between">
                <input
                  value={busqueda}
                  onChange={e => setBusqueda(e.target.value)}
                  placeholder="Buscar: aretes, perlas, corazón…"
                  aria-label="Buscar en el catálogo"
                  style={{ flex: '1 1 240px', maxWidth: 380, background: 'transparent', border: 'none', borderBottom: `1px solid ${C.borde}`, padding: '8px 2px', fontSize: 14, fontFamily: SANS, fontWeight: 300, outline: 'none', color: C.tinta }}
                />
                <label className="flex items-center gap-2 cursor-pointer" style={{ fontSize: 10, letterSpacing: '0.24em', color: C.gris }}>
                  <input type="checkbox" checked={soloDisponibles} onChange={e => setSoloDisponibles(e.target.checked)} style={{ accentColor: C.rojo }} />
                  SOLO DISPONIBLES
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="flex flex-col items-start gap-4 py-10">
              <p style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>{error}</p>
              <Boton claro onClick={cargar}>INTENTAR DE NUEVO</Boton>
            </div>
          )}

          {!catalogo && !error && (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-5">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="animate-pulse" style={{ border: `1px solid ${C.borde}`, background: C.papel }}>
                  <div style={{ aspectRatio: '3/4', background: C.arena }} />
                  <div className="p-5 flex flex-col gap-3">
                    <div style={{ height: 14, width: '60%', background: C.arena }} />
                    <div style={{ height: 10, width: '40%', background: C.arena }} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {catalogo && (
            <>
              {filtrados.length === 0 && (
                <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 22, color: C.gris }}>
                  No encontramos piezas con ese filtro.
                </p>
              )}
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5">
                {visibles.map(p => (
                  <article key={p.id} className="product-card flex flex-col" style={{ border: `1px solid ${C.borde}`, background: C.papel }}>
                    <div className="overflow-hidden relative cursor-pointer" style={{ background: C.arena, aspectRatio: '3/4' }} onClick={() => setDetalle(p)}>
                      <Galeria p={p} />
                      {!p.disponible && (
                        <div className="absolute top-3 right-3" style={{ background: C.tinta, color: C.crema, fontSize: 9, letterSpacing: '0.34em', padding: '6px 10px', fontFamily: SANS }}>
                          AGOTADO
                        </div>
                      )}
                      {p.coleccion && (
                        <div className="absolute top-3 left-3" style={{ fontSize: 9, letterSpacing: '0.24em', color: C.gris, background: 'rgba(244,239,231,0.9)', padding: '4px 8px', fontFamily: SANS }}>
                          {p.coleccion.toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-3 p-4 sm:p-5" style={{ borderTop: `1px solid ${C.borde}`, flex: 1 }}>
                      <div className="flex flex-col gap-1 cursor-pointer" onClick={() => setDetalle(p)}>
                        <h3 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 22, margin: 0, letterSpacing: '0.02em', lineHeight: 1.2 }}>{p.nombre}</h3>
                        {p.detalle && <p style={{ fontSize: 12, color: C.gris, margin: 0, letterSpacing: '0.04em', fontWeight: 300 }}>{p.detalle}</p>}
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-auto flex-wrap">
                        <span style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 23, color: p.disponible ? C.tinta : C.grisClaro }}>{pesos(p.precio)}</span>
                        {p.disponible ? (
                          <Boton onClick={() => agregar(p)} disabled={(carrito[p.id] || 0) >= p.maximo}>
                            {(carrito[p.id] || 0) >= p.maximo ? 'EN TU BOLSA' : 'AGREGAR'}
                          </Boton>
                        ) : (
                          <span style={{ fontSize: 10, letterSpacing: '0.28em', color: C.grisClaro, fontFamily: SANS }}>AGOTADO</span>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
              {visibles.length < filtrados.length && (
                <div className="mt-10 flex justify-center">
                  <Boton claro onClick={() => setPagina(n => n + 1)}>VER MÁS PIEZAS ({filtrados.length - visibles.length})</Boton>
                </div>
              )}
            </>
          )}

          <div className="mt-12 text-center">
            <p style={{ fontSize: 15, color: C.gris, fontFamily: SANS, fontWeight: 300, margin: 0 }}>
              ¿No encontraste lo que buscabas?{' '}
              <a href={contacto} target="_blank" rel="noopener noreferrer" style={{ color: C.rojo, textDecoration: 'none', borderBottom: '1px solid rgba(196,36,30,0.35)' }}>
                Escríbenos y te ayudamos.
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── Statement ── */}
      <section style={{ background: C.tinta, color: C.crema }}>
        <div style={{ maxWidth: 1120 }} className="mx-auto px-6 md:px-16 py-24 grid md:grid-cols-[1fr_auto] gap-12 items-center">
          <div className="flex flex-col gap-8">
            <Etiqueta color={C.oro}>EUPHORIA · ACCESORIOS</Etiqueta>
            <blockquote style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(32px, 5vw, 56px)', lineHeight: 1.15, margin: 0, maxWidth: '22ch' }}>
              Póntelo porque quieres.<br />No para que te lo noten.<br />Para sentirte tú.
            </blockquote>
          </div>
          <Bolt w={56} h={92} />
        </div>
      </section>

      {/* ── Cómo comprar ── */}
      <section style={{ background: C.arena }}>
        <div style={{ maxWidth: 1120 }} className="mx-auto px-6 md:px-16 py-20 md:py-28">
          <div className="flex flex-col gap-3 mb-12">
            <Etiqueta>02 · CÓMO COMPRAR</Etiqueta>
            <h2 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(28px, 4vw, 44px)', lineHeight: 1.1, margin: 0 }}>
              Tu pieza, en tres pasos.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[
              ['Elige', 'Agrega a tu bolsa las piezas que te enamoren. Lo que ves disponible está en stock.'],
              ['Déjanos tus datos', 'Completa la dirección de envío. Tu pedido nos llega al instante con un número de seguimiento.'],
              ['Confirmamos y enviamos', 'Te contactamos para confirmar el pago y el costo de envío, y despachamos a toda Colombia.'],
            ].map(([t, d], i) => (
              <div key={t} className="flex flex-col gap-4 p-7" style={{ background: C.crema, border: `1px solid ${C.borde}` }}>
                <span style={{ fontFamily: SERIF, fontSize: 34, color: C.rojo, lineHeight: 1 }}>0{i + 1}</span>
                <p style={{ fontFamily: SERIF, fontSize: 22, margin: 0 }}>{t}</p>
                <p style={{ fontSize: 14, color: C.gris, margin: 0, fontWeight: 300, lineHeight: 1.6 }}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ background: C.rojo, color: C.crema }}>
        <div style={{ maxWidth: 1120 }} className="mx-auto px-6 md:px-16 py-16 flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col gap-3">
            <Etiqueta color="rgba(244,239,231,0.6)">¿LISTA PARA PEDIR?</Etiqueta>
            <p style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 'clamp(26px, 4vw, 40px)', margin: 0, lineHeight: 1.15 }}>
              Tu próxima pieza<br />te está esperando.
            </p>
          </div>
          <a href="#catalogo" className="flex items-center gap-3 flex-none hover:opacity-90 transition-opacity"
            style={{ background: C.crema, color: C.tinta, fontSize: 11, letterSpacing: '0.3em', padding: '16px 32px', textDecoration: 'none', fontFamily: SANS, fontWeight: 500 }}>
            <Bolt w={9} h={15} />
            VER CATÁLOGO
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: C.tinta, color: C.crema, borderTop: '1px solid #2A2724' }}>
        <div style={{ maxWidth: 1120 }} className="mx-auto px-6 md:px-16 py-12 flex flex-col md:flex-row justify-between gap-8">
          <Logo dark />
          <div className="flex flex-col gap-3">
            <span style={{ fontSize: 9, letterSpacing: '0.32em', color: '#5C544A', fontFamily: SANS }}>CONTACTO</span>
            {whatsapp && (
              <a href={contacto} target="_blank" rel="noopener noreferrer" className="hover:text-[#F4EFE7] transition-colors" style={{ fontSize: 14, color: C.grisClaro, textDecoration: 'none', fontWeight: 300 }}>
                WhatsApp
              </a>
            )}
            <a href={INSTAGRAM} target="_blank" rel="noopener noreferrer" className="hover:text-[#F4EFE7] transition-colors" style={{ fontSize: 14, color: C.grisClaro, textDecoration: 'none', fontWeight: 300 }}>
              @euphoriaby.dz · Instagram
            </a>
          </div>
        </div>
        <div style={{ borderTop: '1px solid #2A2724', maxWidth: 1120 }} className="mx-auto px-6 md:px-16 py-5">
          <p style={{ fontSize: 11, color: '#5C544A', margin: 0, letterSpacing: '0.14em', fontWeight: 300 }}>
            © {new Date().getFullYear()} Euphoria · Medellín, Colombia
          </p>
        </div>
      </footer>

      {/* ── Bolsa flotante (celular) ── */}
      {unidades > 0 && panel === 'cerrado' && (
        <button
          onClick={() => setPanel('carrito')}
          className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-4 shadow-xl"
          style={{ background: C.tinta, color: C.crema, padding: '14px 22px', border: 'none', cursor: 'pointer', fontFamily: SANS, fontSize: 11, letterSpacing: '0.24em', whiteSpace: 'nowrap' }}
        >
          <Bolt w={8} h={13} color={C.oro} />
          VER BOLSA · {unidades} · {pesos(total)}
        </button>
      )}

      {/* ── Detalle de producto ── */}
      {detalle && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" style={{ background: 'rgba(20,18,15,0.6)' }} onClick={() => setDetalle(null)}>
          <div className="w-full sm:max-w-3xl max-h-[92vh] overflow-y-auto grid sm:grid-cols-2" style={{ background: C.papel }} onClick={e => e.stopPropagation()}>
            <div className="relative" style={{ aspectRatio: '3/4', background: C.arena }}>
              <Galeria p={detalle} grande />
            </div>
            <div className="p-7 flex flex-col gap-5">
              <div className="flex justify-between items-start gap-4">
                <Etiqueta>{(detalle.coleccion || 'Euphoria').toUpperCase()}</Etiqueta>
                <button onClick={() => setDetalle(null)} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gris, lineHeight: 1 }}>×</button>
              </div>
              <h3 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 32, margin: 0, lineHeight: 1.1 }}>{detalle.nombre}</h3>
              {detalle.detalle && <p style={{ fontSize: 14, color: C.gris, margin: 0, fontWeight: 300 }}>{detalle.detalle}</p>}
              <span style={{ fontFamily: SERIF, fontSize: 28 }}>{pesos(detalle.precio)}</span>
              {detalle.disponible ? (
                <>
                  <p style={{ fontSize: 12, color: C.gris, margin: 0, fontWeight: 300 }}>
                    {detalle.maximo <= 3 ? `¡Últimas ${detalle.maximo} unidades!` : 'Disponible para envío inmediato.'}
                  </p>
                  <Boton full onClick={() => { agregar(detalle); setDetalle(null) }} disabled={(carrito[detalle.id] || 0) >= detalle.maximo}>
                    {(carrito[detalle.id] || 0) >= detalle.maximo ? 'YA ESTÁ EN TU BOLSA' : 'AGREGAR A LA BOLSA'}
                  </Boton>
                </>
              ) : (
                <div className="flex flex-col gap-3">
                  <span style={{ fontSize: 11, letterSpacing: '0.3em', color: C.rojo }}>AGOTADO</span>
                  <a href={whatsapp ? waUrl(whatsapp, `Hola Euphoria ⚡ ¿van a volver a tener ${detalle.nombre}?`) : INSTAGRAM} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 13, color: C.tinta, fontWeight: 300 }}>
                    Avísame cuando vuelva →
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bolsa / Datos de envío / Confirmación ── */}
      {panel !== 'cerrado' && (
        <div className="fixed inset-0 z-50 flex justify-end" style={{ background: 'rgba(20,18,15,0.6)' }} onClick={() => !enviando && setPanel('cerrado')}>
          <aside className="w-full sm:w-[440px] h-full flex flex-col" style={{ background: C.crema }} onClick={e => e.stopPropagation()}>
            <header className="flex items-center justify-between px-6 h-16" style={{ background: C.tinta, color: C.crema }}>
              <span style={{ fontFamily: SERIF, fontSize: 20 }}>
                {panel === 'carrito' ? 'Tu bolsa' : panel === 'datos' ? 'Datos de envío' : '¡Pedido recibido!'}
              </span>
              <button onClick={() => setPanel('cerrado')} disabled={enviando} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: C.crema, fontSize: 24, cursor: 'pointer' }}>×</button>
            </header>

            {panel === 'carrito' && (
              <>
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  {lineas.length === 0 && (
                    <div className="flex flex-col items-center gap-5 py-16 text-center">
                      <Bolt w={22} h={36} color={C.borde} />
                      <p style={{ fontFamily: SERIF, fontStyle: 'italic', fontSize: 20, margin: 0, color: C.gris }}>Tu bolsa está vacía.</p>
                      <Boton claro onClick={() => setPanel('cerrado')}>VER CATÁLOGO</Boton>
                    </div>
                  )}
                  {lineas.map(({ p, cantidad }) => (
                    <div key={p.id} className="flex gap-4 py-4" style={{ borderBottom: `1px solid ${C.borde}` }}>
                      <div className="flex-none overflow-hidden" style={{ width: 64, height: 84, background: C.arena }}>
                        {p.fotos[0] ? <img src={p.fotos[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Bolt w={12} h={20} color="#D9CDB9" /></div>}
                      </div>
                      <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <span style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.2 }}>{p.nombre}</span>
                        {p.detalle && <span style={{ fontSize: 11, color: C.gris, fontWeight: 300 }}>{p.detalle}</span>}
                        <div className="flex items-center justify-between mt-auto">
                          <div className="flex items-center" style={{ border: `1px solid ${C.borde}` }}>
                            <button onClick={() => cambiar(p.id, cantidad - 1)} aria-label="Quitar uno" style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: 'pointer' }}>−</button>
                            <span style={{ width: 26, textAlign: 'center', fontSize: 13 }}>{cantidad}</span>
                            <button onClick={() => cambiar(p.id, cantidad + 1)} disabled={cantidad >= p.maximo} aria-label="Agregar uno" style={{ width: 28, height: 28, background: 'none', border: 'none', cursor: cantidad >= p.maximo ? 'not-allowed' : 'pointer', color: cantidad >= p.maximo ? C.borde : C.tinta }}>+</button>
                          </div>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{pesos(p.precio * cantidad)}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                {lineas.length > 0 && (
                  <footer className="px-6 py-5 flex flex-col gap-4" style={{ borderTop: `1px solid ${C.borde}`, background: C.papel }}>
                    <div className="flex justify-between items-baseline">
                      <span style={{ fontSize: 10, letterSpacing: '0.3em', color: C.gris }}>TOTAL PRODUCTOS</span>
                      <span style={{ fontFamily: SERIF, fontSize: 26 }}>{pesos(total)}</span>
                    </div>
                    <p style={{ fontSize: 12, color: C.gris, margin: 0, fontWeight: 300 }}>
                      {catalogo?.mensajeEnvio || 'El costo de envío se confirma según tu ciudad.'}
                    </p>
                    <Boton full onClick={() => setPanel('datos')}>CONTINUAR CON EL ENVÍO</Boton>
                  </footer>
                )}
              </>
            )}

            {panel === 'datos' && (
              <form onSubmit={enviarPedido} className="flex-1 flex flex-col min-h-0">
                <div className="flex-1 overflow-y-auto px-6 py-5 grid grid-cols-2 gap-x-4 gap-y-4 content-start">
                  {([
                    ['nombre', 'Nombre completo', 'col-span-2', 'text', true, 'name'],
                    ['cedula', 'Cédula', '', 'text', false, 'off'],
                    ['celular', 'Celular (WhatsApp)', '', 'tel', true, 'tel'],
                    ['correo', 'Correo electrónico', 'col-span-2', 'email', false, 'email'],
                    ['direccion', 'Dirección', 'col-span-2', 'text', true, 'street-address'],
                    ['barrio', 'Barrio', '', 'text', false, 'off'],
                    ['ciudad', 'Ciudad / municipio', '', 'text', true, 'address-level2'],
                  ] as const).map(([k, label, span, type, req, ac]) => (
                    <label key={k} className={`flex flex-col gap-1 ${span}`}>
                      <span style={{ fontSize: 9, letterSpacing: '0.26em', color: C.gris }}>{label.toUpperCase()}{req ? ' *' : ''}</span>
                      <input
                        type={type} required={req} autoComplete={ac} value={cliente[k]}
                        onChange={e => setCliente(c => ({ ...c, [k]: e.target.value }))}
                        style={{ background: C.papel, border: `1px solid ${C.borde}`, padding: '10px 12px', fontSize: 14, fontFamily: SANS, outline: 'none' }}
                      />
                    </label>
                  ))}
                  <label className="flex flex-col gap-1 col-span-2">
                    <span style={{ fontSize: 9, letterSpacing: '0.26em', color: C.gris }}>DEPARTAMENTO *</span>
                    <select required value={cliente.departamento} onChange={e => setCliente(c => ({ ...c, departamento: e.target.value }))}
                      style={{ background: C.papel, border: `1px solid ${C.borde}`, padding: '10px 12px', fontSize: 14, fontFamily: SANS, outline: 'none' }}>
                      <option value="">Selecciona…</option>
                      {DEPARTAMENTOS.map(d => <option key={d}>{d}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-1 col-span-2">
                    <span style={{ fontSize: 9, letterSpacing: '0.26em', color: C.gris }}>NOTAS (OPCIONAL)</span>
                    <textarea rows={3} value={cliente.notas} onChange={e => setCliente(c => ({ ...c, notas: e.target.value }))}
                      placeholder="Es un regalo, apartamento, horario de entrega…"
                      style={{ background: C.papel, border: `1px solid ${C.borde}`, padding: '10px 12px', fontSize: 14, fontFamily: SANS, outline: 'none', resize: 'vertical' }} />
                  </label>
                  {/* Campo oculto anti-spam */}
                  <input tabIndex={-1} autoComplete="off" value={trampa} onChange={e => setTrampa(e.target.value)} name="website" aria-hidden
                    style={{ position: 'absolute', left: -9999, width: 1, height: 1, opacity: 0 }} />
                </div>
                <footer className="px-6 py-5 flex flex-col gap-3" style={{ borderTop: `1px solid ${C.borde}`, background: C.papel }}>
                  {errorPedido && <p style={{ color: C.rojo, fontSize: 13, margin: 0 }}>{errorPedido}</p>}
                  <div className="flex justify-between items-baseline">
                    <span style={{ fontSize: 10, letterSpacing: '0.3em', color: C.gris }}>{unidades} {unidades === 1 ? 'PIEZA' : 'PIEZAS'}</span>
                    <span style={{ fontFamily: SERIF, fontSize: 24 }}>{pesos(total)}</span>
                  </div>
                  <div className="flex gap-3">
                    <Boton claro onClick={() => setPanel('carrito')} disabled={enviando}>VOLVER</Boton>
                    <div className="flex-1"><Boton full type="submit" disabled={enviando || !lineas.length}>{enviando ? 'ENVIANDO…' : 'HACER PEDIDO'}</Boton></div>
                  </div>
                </footer>
              </form>
            )}

            {panel === 'listo' && resultado && (
              <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8 text-center">
                <Bolt w={30} h={50} />
                <p style={{ fontFamily: SERIF, fontSize: 30, margin: 0, lineHeight: 1.15 }}>¡Gracias por elegir Euphoria!</p>
                <div className="flex flex-col gap-1">
                  <Etiqueta>TU NÚMERO DE PEDIDO</Etiqueta>
                  <span style={{ fontFamily: SERIF, fontSize: 34, color: C.rojo }}>{resultado.numero}</span>
                </div>
                <p style={{ fontSize: 14, color: C.gris, margin: 0, fontWeight: 300, lineHeight: 1.6 }}>
                  Recibimos tu pedido por {pesos(resultado.total)}. Te contactaremos muy pronto para confirmar el pago y el envío.
                </p>
                {resultado.whatsapp && (
                  <a href={waUrl(resultado.whatsapp, resultado.mensaje)} target="_blank" rel="noopener noreferrer" className="hover:bg-[#a51e19] transition-colors"
                    style={{ background: C.rojo, color: C.crema, fontSize: 11, letterSpacing: '0.26em', padding: '14px 24px', textDecoration: 'none', fontFamily: SANS }}>
                    ENVIAR PEDIDO POR WHATSAPP
                  </a>
                )}
                <Boton claro onClick={() => setPanel('cerrado')}>SEGUIR VIENDO</Boton>
              </div>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
