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
// WhatsApp de la marca (con indicativo de Colombia). Es el número de respaldo: si el
// inventario trae uno propio, se usa ese; si no, se usa este.
const WHATSAPP_MARCA = '573024342490'

/* ---------------- Protección de datos personales (Ley 1581 de 2012) ----------------
   Completa estos datos con la información legal de la marca. Mientras no haya correo,
   las solicitudes se reciben por WhatsApp e Instagram. */
const RESPONSABLE = 'Euphoria · Medellín, Colombia'
const CORREO_DATOS = '' // ej. 'hola@tudominio.com'
const POLITICA_VERSION = '2026-10-28'

type Producto = {
  id: string
  nombre: string
  detalle: string
  coleccion: string
  tipo: string
  color?: string
  base?: string
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

// Variantes de color: las filas que comparten "Código base" se muestran como un solo producto.
const baseDe = (p: Producto) => p.base || p.id
// Orden de las categorías en el filtro; las que no estén aquí van al final en orden alfabético.
const ORDEN_CAT = ['Aretes', 'Collares', 'Manillas', 'Anillos', 'Pines', 'Pinzas', 'Lanyards']
const sinTildes = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

/* ---------------- Rendimiento ---------------- */
// Google entrega las fotos de Drive en PNG gigante (≈1,8 MB). Pedimos JPG liviano
// al tamaño justo de la pantalla (≈70 KB): misma foto, carga ~20 veces más rápido.
function foto(url: string, w: number) {
  return url.replace(/=[^/=]*$/, '') + `=w${w}-rj-l82`
}
function fotoSet(url: string, anchos: number[]) {
  return anchos.map(w => `${foto(url, w)} ${w}w`).join(', ')
}

// El catálogo se guarda en el navegador: quien vuelve ve la tienda al instante
// mientras se actualiza por detrás con el inventario real.
const CACHE_CATALOGO = 'euphoria-catalogo-v2'
function leerCatalogoGuardado(): Catalogo | null {
  try {
    const raw = localStorage.getItem(CACHE_CATALOGO)
    const d = raw ? JSON.parse(raw) : null
    return d && d.ok && Array.isArray(d.productos) ? d : null
  } catch {
    return null
  }
}
function guardarCatalogo(d: Catalogo) {
  try { localStorage.setItem(CACHE_CATALOGO, JSON.stringify(d)) } catch { /* sin almacenamiento */ }
}
// La petición sale apenas carga el código, sin esperar a que se pinte la página.
let catalogoEnCamino: Promise<Catalogo> | null = fetch(TIENDA_URL)
  .then(r => r.json())
  .then((d: Catalogo) => { if (!d.ok) throw new Error(); return d })
catalogoEnCamino.catch(() => { /* se maneja al usarla */ })

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

function IconoWhatsApp({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path d="M12 3a9 9 0 0 0-7.8 13.5L3 21l4.65-1.2A9 9 0 1 0 12 3Z" fill="currentColor" />
      <path d="M9.2 8.3c.2-.4.5-.4.7-.4h.5c.2 0 .4 0 .5.4l.6 1.5c.1.2 0 .4-.1.6l-.4.5c-.1.1-.2.3 0 .5.5.9 1.3 1.6 2.3 2 .2.1.4.1.5-.1l.6-.7c.2-.2.3-.2.5-.1l1.4.7c.2.1.3.2.3.4 0 .5-.2 1.1-.7 1.4-.5.3-1.2.4-2 .2a9 9 0 0 1-5-4.2c-.4-.7-.7-1.7-.2-2.4Z" fill="#fff" />
    </svg>
  )
}

function PoliticaDatos({ onCerrar, whatsapp }: { onCerrar: () => void; whatsapp: string }) {
  const h = { fontFamily: SERIF, fontWeight: 600, fontSize: 20, margin: '22px 0 6px' } as const
  const p = { fontSize: 14, color: C.tinta, fontWeight: 300, lineHeight: 1.65, margin: '0 0 8px' } as const
  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center" style={{ background: 'rgba(20,18,15,0.7)' }} onClick={onCerrar}>
      <div
        role="dialog" aria-modal="true" aria-label="Política de tratamiento de datos personales"
        className="w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: C.papel }}
        onClick={e => e.stopPropagation()}
      >
        <header className="flex items-center justify-between px-6 h-16 sticky top-0" style={{ background: C.tinta, color: C.crema }}>
          <span style={{ fontFamily: SERIF, fontSize: 20 }}>Política de tratamiento de datos</span>
          <button onClick={onCerrar} aria-label="Cerrar" style={{ background: 'none', border: 'none', color: C.crema, fontSize: 24, cursor: 'pointer' }}>×</button>
        </header>
        <div className="px-6 pb-8 pt-2">
          <p style={{ ...p, color: C.gris, marginTop: 14 }}>Versión {POLITICA_VERSION} · Ley 1581 de 2012 y Decreto 1377 de 2013 (compilado en el Decreto 1074 de 2015)</p>

          <h4 style={h}>1. Responsable del tratamiento</h4>
          <p style={p}>{RESPONSABLE}. Canales de contacto: WhatsApp{whatsapp ? ` +${whatsapp}` : ''}{CORREO_DATOS ? `, correo ${CORREO_DATOS}` : ''} e Instagram @euphoriaby.dz.</p>

          <h4 style={h}>2. Datos que recogemos</h4>
          <p style={p}>Cuando haces un pedido te pedimos: nombre completo, celular, dirección de entrega (dirección, barrio, ciudad y departamento) y, de forma opcional, cédula, correo electrónico y notas sobre la entrega. No recogemos datos sensibles ni datos de tarjetas o cuentas bancarias.</p>

          <h4 style={h}>3. Para qué los usamos</h4>
          <p style={p}>Únicamente para registrar y atender tu pedido, contactarte por WhatsApp o llamada para confirmar el pago y el envío, despachar tu compra, atender garantías, cambios y reclamos, y cumplir obligaciones legales, contables y tributarias. No vendemos ni cedemos tus datos a terceros con fines comerciales. Solo los compartimos con transportadoras o mensajeros cuando es necesario para entregarte tu pedido, y con los proveedores tecnológicos que alojan la tienda.</p>

          <h4 style={h}>4. Autorización</h4>
          <p style={p}>Al marcar la casilla de autorización antes de hacer tu pedido, aceptas de forma previa, expresa e informada el tratamiento de tus datos para las finalidades descritas. Es voluntario entregarlos, pero sin los datos obligatorios no podemos procesar el pedido. Si eres menor de edad, el pedido debe hacerlo tu padre, madre o representante legal.</p>

          <h4 style={h}>5. Tus derechos</h4>
          <p style={p}>Como titular puedes conocer, actualizar y rectificar tus datos; solicitar prueba de la autorización; ser informado del uso que les damos; presentar quejas ante la Superintendencia de Industria y Comercio (SIC); revocar la autorización y pedir la supresión de tus datos cuando no exista un deber legal de conservarlos; y acceder gratuitamente a ellos.</p>

          <h4 style={h}>6. Cómo ejercer tus derechos</h4>
          <p style={p}>Escríbenos por los canales del punto 1 indicando tu nombre y el número de tu pedido. Respondemos las consultas en máximo 10 días hábiles y los reclamos en máximo 15 días hábiles desde su recepción.</p>

          <h4 style={h}>7. Conservación y seguridad</h4>
          <p style={p}>Conservamos tus datos mientras sea necesario para atender tu pedido y cumplir obligaciones legales, y luego los eliminamos o anonimizamos. Aplicamos medidas razonables para protegerlos contra acceso no autorizado, pérdida o uso indebido.</p>

          <h4 style={h}>8. Almacenamiento en tu navegador</h4>
          <p style={p}>Esta página guarda en tu propio navegador el contenido de tu bolsa y una copia del catálogo para que cargue más rápido. No usamos cookies de publicidad ni de rastreo.</p>

          <h4 style={h}>9. Cambios a esta política</h4>
          <p style={p}>Si la actualizamos, publicaremos la nueva versión en esta página con su fecha.</p>

          <div className="mt-6"><Boton claro onClick={onCerrar}>CERRAR</Boton></div>
        </div>
      </div>
    </div>
  )
}

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
function Galeria({ p, grande = false, prioridad = false }: { p: Producto; grande?: boolean; prioridad?: boolean }) {
  const [i, setI] = useState(0)
  const [x0, setX0] = useState<number | null>(null)
  const [cargada, setCargada] = useState(false)
  const n = p.fotos.length
  // Al pasar el mouse o tocar, se deja lista la siguiente foto para que el cambio sea instantáneo.
  const precargar = () => {
    if (n < 2) return
    const im = new Image()
    im.src = foto(p.fotos[(i + 1) % n], grande ? 900 : 600)
  }
  if (!n) return <SinFoto nombre={p.nombre} />
  const ir = (d: number) => { setCargada(false); setI(v => (v + d + n) % n) }
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
      onMouseEnter={precargar}
      onTouchStart={e => { precargar(); setX0(e.touches[0].clientX) }}
      onTouchEnd={e => {
        if (x0 === null) return
        const dx = e.changedTouches[0].clientX - x0
        if (Math.abs(dx) > 40) ir(dx < 0 ? 1 : -1)
        setX0(null)
      }}
    >
      <img
        key={p.fotos[i]}
        src={foto(p.fotos[i], grande ? 900 : 600)}
        srcSet={fotoSet(p.fotos[i], grande ? [600, 900, 1200] : [400, 600, 900])}
        sizes={grande ? '(min-width: 640px) 384px, 100vw' : '(min-width: 1100px) 340px, (min-width: 1024px) 31vw, 48vw'}
        alt={`${p.nombre} · foto ${i + 1}`}
        loading={prioridad || grande ? 'eager' : 'lazy'}
        fetchPriority={prioridad ? 'high' : 'auto'}
        decoding="async"
        width={600}
        height={800}
        ref={el => { if (el?.complete && el.naturalWidth) setCargada(true) }}
        onLoad={() => setCargada(true)}
        onError={() => setCargada(true)}
        className={`w-full h-full object-cover ${grande ? '' : 'product-img'}`}
        style={{
          opacity: cargada ? 1 : 0, transition: 'opacity .4s ease, transform .5s ease',
          ...(p.disponible ? {} : { filter: 'grayscale(35%)' }),
        }}
      />
      {n > 1 && (
        <>
          {flecha(-1)}
          {flecha(1)}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5">
            {p.fotos.map((_, k) => (
              <span
                key={k}
                onClick={e => { e.stopPropagation(); if (k !== i) { setCargada(false); setI(k) } }}
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

// Botones para elegir el color cuando un producto tiene varias variantes.
function Colores({ variantes, actual, onElegir, grande = false }: {
  variantes: Producto[]; actual: Producto; onElegir: (p: Producto) => void; grande?: boolean
}) {
  if (variantes.length < 2) return null
  return (
    <div className="flex flex-col gap-2">
      <span style={{ fontSize: 9, letterSpacing: '0.28em', color: C.grisClaro, fontFamily: SANS }}>
        COLOR · <span style={{ color: C.tinta }}>{(actual.color || '').toUpperCase()}</span>
      </span>
      <div className="flex flex-wrap gap-1.5">
        {variantes.map(v => {
          const activo = v.id === actual.id
          return (
            <button
              key={v.id}
              onClick={e => { e.stopPropagation(); onElegir(v) }}
              aria-pressed={activo}
              title={v.disponible ? v.color : `${v.color} · agotado`}
              style={{
                fontSize: grande ? 11 : 10, letterSpacing: '0.08em', fontFamily: SANS, fontWeight: 400,
                padding: grande ? '7px 12px' : '5px 9px', cursor: 'pointer', transition: 'all .2s',
                border: `1px solid ${activo ? C.tinta : C.borde}`,
                background: activo ? C.tinta : 'transparent',
                color: activo ? C.crema : v.disponible ? C.tinta : C.grisClaro,
                textDecoration: v.disponible ? 'none' : 'line-through',
              }}
            >
              {v.color || v.id}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/* ---------------- Aplicación ---------------- */

export default function App() {
  const [catalogo, setCatalogo] = useState<Catalogo | null>(leerCatalogoGuardado)
  const [error, setError] = useState('')
  const [coleccion, setColeccion] = useState('Todas')
  const [categoria, setCategoria] = useState('Todas')
  const [elegido, setElegido] = useState<Record<string, string>>({}) // código base → variante elegida
  const [soloDisponibles, setSoloDisponibles] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [pagina, setPagina] = useState(1)
  const [detalle, setDetalle] = useState<Producto | null>(null)
  const [carrito, setCarrito] = useState<Carrito>(leerCarrito)
  const [panel, setPanel] = useState<'cerrado' | 'carrito' | 'datos' | 'listo'>('cerrado')
  const [cliente, setCliente] = useState<Cliente>(CLIENTE_VACIO)
  const [aceptaDatos, setAceptaDatos] = useState(false)
  const [verPolitica, setVerPolitica] = useState(false)
  const [trampa, setTrampa] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [errorPedido, setErrorPedido] = useState('')
  const [resultado, setResultado] = useState<{ numero: string; total: number; whatsapp: string; mensaje: string } | null>(null)

  const cargar = () => {
    setError('')
    const pedido = catalogoEnCamino || fetch(TIENDA_URL)
      .then(r => r.json())
      .then((d: Catalogo) => { if (!d.ok) throw new Error(); return d })
    catalogoEnCamino = null
    pedido
      .then(d => { setCatalogo(d); guardarCatalogo(d) })
      .catch(() => {
        // Si ya hay un catálogo guardado se sigue mostrando; solo se avisa si no hay nada.
        if (!leerCatalogoGuardado()) setError('No pudimos cargar el catálogo en este momento.')
      })
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

  const whatsapp = WHATSAPP_MARCA
  const contacto = whatsapp ? waUrl(whatsapp, 'Hola Euphoria ⚡ quiero hacer una consulta') : INSTAGRAM

  // Todas las variantes de cada producto (mismo código base), en el orden del catálogo.
  const familias = useMemo(() => {
    const m: Record<string, Producto[]> = {}
    catalogo?.productos.forEach(p => { (m[baseDe(p)] ||= []).push(p) })
    return m
  }, [catalogo])
  const variantesDe = (p: Producto) => familias[baseDe(p)] || [p]

  const categorias = useMemo(() => {
    const s = new Set<string>()
    catalogo?.productos.forEach(p => { if (p.tipo) s.add(p.tipo) })
    return [...s].sort((a, b) => {
      const ia = ORDEN_CAT.indexOf(a) === -1 ? 99 : ORDEN_CAT.indexOf(a)
      const ib = ORDEN_CAT.indexOf(b) === -1 ? 99 : ORDEN_CAT.indexOf(b)
      return ia - ib || a.localeCompare(b, 'es')
    })
  }, [catalogo])

  // Un producto aparece una sola vez aunque tenga varios colores.
  const filtrados = useMemo(() => {
    if (!catalogo) return []
    const q = sinTildes(busqueda.trim())
    const pasa = (p: Producto) =>
      (coleccion === 'Todas' || p.coleccion === coleccion) &&
      (categoria === 'Todas' || p.tipo === categoria) &&
      (!soloDisponibles || p.disponible) &&
      (!q || sinTildes(`${p.nombre} ${p.detalle} ${p.coleccion} ${p.tipo} ${p.color || ''}`).includes(q))
    const vistos = new Set<string>()
    const out: Producto[][] = []
    catalogo.productos.forEach(p => {
      const b = baseDe(p)
      if (vistos.has(b)) return
      const vs = (familias[b] || [p]).filter(pasa)
      if (!vs.length) return
      vistos.add(b)
      out.push(vs)
    })
    return out
  }, [catalogo, familias, coleccion, categoria, soloDisponibles, busqueda])

  // Variante que se muestra en la tarjeta: la elegida, o la primera disponible.
  // Colores que se ofrecen: todos (los agotados salen tachados), salvo con "solo disponibles".
  const opciones = (vs: Producto[], p: Producto) => soloDisponibles ? vs : variantesDe(p)
  const varianteActual = (vs: Producto[]) =>
    opciones(vs, vs[0]).find(v => v.id === elegido[baseDe(vs[0])]) || vs.find(v => v.disponible) || vs[0]
  const elegir = (v: Producto) => setElegido(e => ({ ...e, [baseDe(v)]: v.id }))

  useEffect(() => setPagina(1), [coleccion, categoria, soloDisponibles, busqueda])

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
          autorizacionDatos: { acepta: aceptaDatos, version: POLITICA_VERSION, fecha: new Date().toISOString() },
          website: trampa,
        }),
      })
      const d = await r.json()
      if (!d.ok) throw new Error(d.error || 'No pudimos registrar tu pedido.')
      setResultado(d)
      setCarrito({})
      setCliente(CLIENTE_VACIO)
      setAceptaDatos(false)
      setPanel('listo')
      cargar()
    } catch (err) {
      setErrorPedido(err instanceof Error && err.message ? err.message : 'No pudimos registrar tu pedido. Intenta de nuevo.')
    } finally {
      setEnviando(false)
    }
  }

  const visibles = filtrados.slice(0, pagina * POR_PAGINA)
  const disponibles = Object.values(familias).filter(vs => vs.some(v => v.disponible)).length

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
              {categorias.length > 1 && (
                <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }} aria-label="Categorías">
                  {['Todas', ...categorias].map(c => (
                    <button
                      key={c}
                      onClick={() => setCategoria(c)}
                      className="flex-none"
                      style={{
                        fontSize: 10, letterSpacing: '0.2em', padding: '7px 13px', fontFamily: SANS,
                        border: 'none', borderBottom: `1px solid ${categoria === c ? C.rojo : 'transparent'}`,
                        background: 'transparent',
                        color: categoria === c ? C.rojo : C.gris, cursor: 'pointer', transition: 'all .2s',
                      }}
                    >
                      {c === 'Todas' ? 'TODO TIPO DE PIEZA' : c.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
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
                {visibles.map((vs, idx) => { const p = varianteActual(vs); return (
                  <article key={baseDe(p)} className="product-card flex flex-col" style={{ border: `1px solid ${C.borde}`, background: C.papel }}>
                    <div className="overflow-hidden relative cursor-pointer" style={{ background: C.arena, aspectRatio: '3/4' }} onClick={() => setDetalle(p)}>
                      <Galeria key={p.id} p={p} prioridad={idx < 3} />
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
                        {p.color && opciones(vs, p).length < 2 && (
                          <p style={{ fontSize: 12, color: C.gris, margin: 0, letterSpacing: '0.04em', fontWeight: 300 }}>Color: {p.color}</p>
                        )}
                      </div>
                      <Colores variantes={opciones(vs, p)} actual={p} onElegir={elegir} />
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
                ) })}
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
            {' · '}
            <button onClick={() => setVerPolitica(true)} className="hover:text-[#F4EFE7] transition-colors"
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit', letterSpacing: 'inherit', textDecoration: 'underline' }}>
              Política de tratamiento de datos
            </button>
          </p>
        </div>
      </footer>

      {/* ── WhatsApp flotante ── */}
      {panel === 'cerrado' && !detalle && !verPolitica && (
        <a
          href={contacto}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Escríbenos por WhatsApp"
          className={`fixed right-5 z-40 flex items-center justify-center shadow-xl hover:scale-105 transition-transform ${unidades > 0 ? 'bottom-24' : 'bottom-5'}`}
          style={{ width: 54, height: 54, borderRadius: '50%', background: '#25D366', color: '#25D366' }}
        >
          <IconoWhatsApp size={30} />
        </a>
      )}

      {verPolitica && <PoliticaDatos onCerrar={() => setVerPolitica(false)} whatsapp={whatsapp} />}

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
              <Galeria key={detalle.id} p={detalle} grande />
            </div>
            <div className="p-7 flex flex-col gap-5">
              <div className="flex justify-between items-start gap-4">
                <Etiqueta>{(detalle.coleccion || 'Euphoria').toUpperCase()}</Etiqueta>
                <button onClick={() => setDetalle(null)} aria-label="Cerrar" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: C.gris, lineHeight: 1 }}>×</button>
              </div>
              <h3 style={{ fontFamily: SERIF, fontWeight: 500, fontSize: 32, margin: 0, lineHeight: 1.1 }}>{detalle.nombre}</h3>
              {detalle.detalle && <p style={{ fontSize: 14, color: C.gris, margin: 0, fontWeight: 300 }}>{detalle.detalle}</p>}
              {detalle.color && variantesDe(detalle).length < 2 && (
                <p style={{ fontSize: 14, color: C.gris, margin: 0, fontWeight: 300 }}>Color: {detalle.color}</p>
              )}
              <Colores variantes={variantesDe(detalle)} actual={detalle} onElegir={v => { elegir(v); setDetalle(v) }} grande />
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
                  <a href={whatsapp ? waUrl(whatsapp, `Hola Euphoria ⚡ ¿van a volver a tener ${detalle.nombre}${detalle.color ? ` en ${detalle.color}` : ''}?`) : INSTAGRAM} target="_blank" rel="noopener noreferrer"
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
                        {p.fotos[0] ? <img src={foto(p.fotos[0], 200)} alt="" loading="lazy" decoding="async" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Bolt w={12} h={20} color="#D9CDB9" /></div>}
                      </div>
                      <div className="flex-1 flex flex-col gap-1 min-w-0">
                        <span style={{ fontFamily: SERIF, fontSize: 17, lineHeight: 1.2 }}>{p.nombre}</span>
                        {p.detalle && <span style={{ fontSize: 11, color: C.gris, fontWeight: 300 }}>{p.detalle}</span>}
                        {p.color && <span style={{ fontSize: 11, color: C.tinta, fontWeight: 400 }}>Color: {p.color}</span>}
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
                  <label className="col-span-2 flex items-start gap-3 cursor-pointer" style={{ fontSize: 12, color: C.tinta, fontWeight: 300, lineHeight: 1.55 }}>
                    <input type="checkbox" required checked={aceptaDatos} onChange={e => setAceptaDatos(e.target.checked)} style={{ accentColor: C.rojo, marginTop: 3, flex: 'none' }} />
                    <span>
                      Autorizo a {RESPONSABLE.split(' · ')[0]} el tratamiento de mis datos personales para gestionar mi pedido y contactarme, según la{' '}
                      <button type="button" onClick={() => setVerPolitica(true)} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: C.rojo, font: 'inherit', textDecoration: 'underline' }}>
                        política de tratamiento de datos
                      </button>. *
                    </span>
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
                {whatsapp && (
                  <a href={waUrl(whatsapp, resultado.mensaje || `Hola Euphoria ⚡ hice el pedido ${resultado.numero}`)} target="_blank" rel="noopener noreferrer" className="hover:bg-[#a51e19] transition-colors"
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
