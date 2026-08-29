import { useEffect, useState } from 'react'
import Papa from 'papaparse'

const WHATSAPP = '573000000000' // ← Reemplazá con tu número real

// ← Pegá acá el link CSV de tu Google Sheet publicada (ver guía al final de App.tsx)
const SHEET_CSV_URL = ''

type Product = {
  id: number
  name: string
  material: string
  price: string
  tag: string
  img: string
  sold: boolean
}

// Productos de ejemplo — se muestran solo mientras SHEET_CSV_URL esté vacío,
// para que el sitio nunca se vea roto antes de conectar la hoja.

function Bolt({ w = 14, h = 24, color = '#C4241E' }: { w?: number; h?: number; color?: string }) {
  return (
    <div
      className="bolt flex-none"
      style={{ width: w, height: h, background: color }}
    />
  )
}

function Logo({ dark = false }: { dark?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <Bolt w={11} h={18} color={dark ? '#E8B923' : '#C4241E'} />
      <span
        className="uppercase tracking-[0.05em] text-[22px] leading-none"
        style={{
          fontFamily: "'Playfair Display', serif",
          fontWeight: 500,
          color: dark ? '#F4EFE7' : '#14120F',
        }}
      >
        Euphoria
      </span>
    </div>
  )
}

const PRODUCTS_EJEMPLO: Product[] = [
  {
    id: 1,
    name: 'Collar Ají',
    material: 'Acero dorado · baño oro 18k',
    price: '$38.000',
    tag: 'TAL-01',
    img: 'https://images.unsplash.com/photo-1606760227091-3dd870d97f1d?w=600&h=800&fit=crop&auto=format',
    sold: false,
  },
  {
    id: 2,
    name: 'Argollas Rayo',
    material: 'Acero plateado · antialérgico',
    price: '$25.000',
    tag: 'ARL-02',
    img: 'https://images.unsplash.com/photo-1601121141461-9d6647bca1ed?w=600&h=800&fit=crop&auto=format',
    sold: false,
  },
  {
    id: 3,
    name: 'Pulsera Medellín',
    material: 'Hilo encerado · dijes acero',
    price: '$32.000',
    tag: 'PUL-03',
    img: 'https://images.unsplash.com/photo-1655255114527-d0a834d9a774?w=600&h=800&fit=crop&auto=format',
    sold: false,
  },
  {
    id: 4,
    name: 'Dije Luna',
    material: 'Plata 925 · cadena 45 cm',
    price: '$28.000',
    tag: 'DIJ-04',
    img: 'https://images.unsplash.com/photo-1722410180687-b05b50922362?w=600&h=800&fit=crop&auto=format',
    sold: false,
  },
  {
    id: 5,
    name: 'Set Tierra',
    material: 'Collar + argollas · acero dorado',
    price: '$55.000',
    tag: 'SET-05',
    img: 'https://images.unsplash.com/photo-1722410180670-b6d5a2e704fa?w=600&h=800&fit=crop&auto=format',
    sold: true,
  },
  {
    id: 6,
    name: 'Tobillera Cruda',
    material: 'Hilo crudo · dije acero',
    price: '$22.000',
    tag: 'TOB-06',
    img: 'https://images.unsplash.com/photo-1603974372039-adc49044b6bd?w=600&h=800&fit=crop&auto=format',
    sold: false,
  },
]

const TESTIMONIALS = [
  { quote: 'Llegó hoy y no me la he quitado.', name: 'Laura M.', city: 'Medellín' },
  { quote: 'El empaque es una obra de arte. Lo fotografié todo.', name: 'Sara V.', city: 'Bogotá' },
  { quote: 'Pedí para regalo y mi amiga lloró. Perfecto.', name: 'Daniela R.', city: 'Cali' },
]

function waLink(productName: string) {
  const msg = encodeURIComponent(`Hola ⚡ quiero pedir: ${productName}`)
  return `https://wa.me/${WHATSAPP}?text=${msg}`
}

// Convierte una fila de la hoja (columnas: nombre, codigo, material, precio, foto, disponible)
// en un producto. "disponible" acepta SI/NO, TRUE/FALSE, 1/0 — sin distinguir mayúsculas.
function filaAProducto(fila: Record<string, string>, index: number): Product {
  const disponible = (fila.disponible || '').trim().toLowerCase()
  return {
    id: index + 1,
    name: fila.nombre?.trim() || 'Sin nombre',
    material: fila.material?.trim() || '',
    price: fila.precio?.trim() || '',
    tag: fila.codigo?.trim() || '',
    img: fila.foto?.trim() || '',
    sold: !(disponible === 'si' || disponible === 'sí' || disponible === 'true' || disponible === '1' || disponible === 'yes'),
  }
}

export default function App() {
  const [filter, setFilter] = useState<'todos' | 'disponibles'>('todos')
  const [products, setProducts] = useState<Product[]>(PRODUCTS_EJEMPLO)
  const [usandoEjemplo, setUsandoEjemplo] = useState(true)

  useEffect(() => {
    if (!SHEET_CSV_URL) return // sin hoja configurada todavía: se quedan los productos de ejemplo

    Papa.parse(SHEET_CSV_URL, {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (resultado) => {
        const filas = resultado.data as Record<string, string>[]
        const productosDesdeHoja = filas
          .filter(f => f.nombre?.trim())
          .map(filaAProducto)
        if (productosDesdeHoja.length > 0) {
          setProducts(productosDesdeHoja)
          setUsandoEjemplo(false)
        }
      },
      error: () => {
        // Si falla la carga (hoja no publicada, sin internet, etc.) se quedan los de ejemplo
        setUsandoEjemplo(true)
      },
    })
  }, [])

  const visible = filter === 'disponibles' ? products.filter(p => !p.sold) : products

  return (
    <div style={{ background: '#EDE5D8', minHeight: '100vh' }}>

      {/* ── Ticker ── */}
      <div
        style={{ background: '#C4241E', overflow: 'hidden', padding: '9px 0' }}
        aria-hidden
      >
        <div className="ticker-track">
          {[...Array(2)].map((_, i) => (
            <span
              key={i}
              style={{
                fontSize: 10,
                letterSpacing: '0.48em',
                color: '#F4EFE7',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 300,
                paddingRight: '4em',
              }}
            >
              SER VOS, ESO ES REVOLUCIÓN ⚡ EUPHORIA · MEDELLÍN ⚡ SER VOS, ESO ES REVOLUCIÓN ⚡ EUPHORIA · MEDELLÍN ⚡ SER VOS, ESO ES REVOLUCIÓN ⚡ EUPHORIA · MEDELLÍN ⚡&nbsp;
            </span>
          ))}
        </div>
      </div>

      {/* ── Nav ── */}
      <nav
        style={{ background: '#14120F', borderBottom: '1px solid #2A2724' }}
        className="sticky top-0 z-50"
      >
        <div
          style={{ maxWidth: 1120 }}
          className="mx-auto px-6 md:px-16 h-14 flex items-center justify-between"
        >
          <Logo dark />
          <div className="flex items-center gap-6">
            <a
              href="#catalogo"
              style={{
                fontSize: 11,
                letterSpacing: '0.3em',
                color: '#A2988A',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 300,
                textDecoration: 'none',
              }}
              className="hover:text-[#F4EFE7] transition-colors duration-200 hidden sm:block"
            >
              CATÁLOGO
            </a>
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                background: '#C4241E',
                color: '#F4EFE7',
                fontSize: 11,
                letterSpacing: '0.26em',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 400,
                padding: '8px 18px',
                textDecoration: 'none',
              }}
              className="hover:bg-[#a51e19] transition-colors duration-200"
            >
              ESCRÍBENOS
            </a>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section style={{ background: '#14120F', color: '#F4EFE7' }}>
        <div
          style={{ maxWidth: 1120 }}
          className="mx-auto px-6 md:px-16 py-24 md:py-36 grid md:grid-cols-[1fr_auto] gap-12 items-end"
        >
          <div className="flex flex-col gap-7">
            <Bolt w={40} h={66} color="#C4241E" />
            <h1
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 500,
                fontSize: 'clamp(52px, 8vw, 96px)',
                lineHeight: 0.92,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                margin: 0,
              }}
            >
              Ser vos,<br />eso es<br />revolución.
            </h1>
            <div className="flex items-center gap-5">
              <div style={{ width: 60, height: 1, background: '#5C544A' }} />
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.42em',
                  color: '#C0B6A8',
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 300,
                }}
              >
                EUPHORIA · ACCESORIOS · MEDELLÍN
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-5 md:text-right">
            <p
              style={{
                fontFamily: "'Playfair Display', serif",
                fontStyle: 'italic',
                fontSize: 22,
                lineHeight: 1.35,
                maxWidth: '14ch',
                margin: 0,
                color: '#C0B6A8',
              }}
            >
              Medellín · Envíos a toda Colombia.
            </p>
            <a
              href="#catalogo"
              style={{
                display: 'inline-block',
                border: '1px solid #C4241E',
                color: '#C4241E',
                fontSize: 11,
                letterSpacing: '0.3em',
                padding: '14px 28px',
                textDecoration: 'none',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 400,
                alignSelf: 'flex-start',
              }}
              className="md:self-end hover:bg-[#C4241E] hover:text-[#F4EFE7] transition-colors duration-300"
            >
              VER CATÁLOGO
            </a>
          </div>
        </div>
      </section>

      {/* ── Catálogo ── */}
      <section id="catalogo" style={{ background: '#F4EFE7' }}>
        <div style={{ maxWidth: 1120 }} className="mx-auto px-6 md:px-16 py-20 md:py-28">

          <div className="flex items-end justify-between mb-12 flex-wrap gap-4">
            <div className="flex flex-col gap-3">
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.36em',
                  color: '#A2988A',
                  fontFamily: "'Jost', sans-serif",
                  fontWeight: 300,
                }}
              >
                01 · CATÁLOGO
              </span>
              <h2
                style={{
                  fontFamily: "'Playfair Display', serif",
                  fontWeight: 400,
                  fontSize: 'clamp(32px, 4vw, 52px)',
                  lineHeight: 1.05,
                  margin: 0,
                }}
              >
                Piezas disponibles
              </h2>
              {usandoEjemplo && (
                <p
                  style={{
                    fontSize: 11,
                    letterSpacing: '0.08em',
                    color: '#C4241E',
                    fontFamily: "'Jost', sans-serif",
                    fontWeight: 400,
                    margin: '4px 0 0 0',
                  }}
                >
                  ⚡ Mostrando productos de ejemplo — conectá tu Google Sheet en SHEET_CSV_URL (ver guía al final de App.tsx)
                </p>
              )}
            </div>
            <div className="flex gap-2">
              {(['todos', 'disponibles'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  style={{
                    fontSize: 10,
                    letterSpacing: '0.28em',
                    padding: '8px 16px',
                    fontFamily: "'Jost', sans-serif",
                    fontWeight: 400,
                    border: '1px solid #DED4C4',
                    background: filter === f ? '#14120F' : 'transparent',
                    color: filter === f ? '#F4EFE7' : '#8A8175',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                >
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {visible.map(product => (
              <article
                key={product.id}
                className="product-card flex flex-col"
                style={{ border: '1px solid #DED4C4', background: '#FBF8F2' }}
              >
                <div
                  className="overflow-hidden relative"
                  style={{ background: '#EDE5D8', aspectRatio: '3/4' }}
                >
                  <img
                    src={product.img}
                    alt={product.name}
                    className="product-img w-full h-full object-cover"
                  />
                  {product.sold && (
                    <div
                      className="absolute inset-0 flex items-center justify-center"
                      style={{ background: 'rgba(20,18,15,0.55)' }}
                    >
                      <span
                        style={{
                          color: '#F4EFE7',
                          fontSize: 11,
                          letterSpacing: '0.4em',
                          fontFamily: "'Jost', sans-serif",
                          fontWeight: 300,
                        }}
                      >
                        AGOTADO
                      </span>
                    </div>
                  )}
                  <div
                    className="absolute top-3 left-3"
                    style={{
                      fontSize: 9,
                      letterSpacing: '0.2em',
                      color: '#8A8175',
                      background: 'rgba(244,239,231,0.88)',
                      padding: '4px 8px',
                      fontFamily: 'ui-monospace, monospace',
                    }}
                  >
                    {product.tag}
                  </div>
                </div>
                <div
                  className="flex flex-col gap-4 p-5"
                  style={{ borderTop: '1px solid #DED4C4', flex: 1 }}
                >
                  <div className="flex flex-col gap-1">
                    <h3
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontWeight: 500,
                        fontSize: 20,
                        margin: 0,
                        letterSpacing: '0.02em',
                      }}
                    >
                      {product.name}
                    </h3>
                    <p
                      style={{
                        fontSize: 13,
                        color: '#8A8175',
                        margin: 0,
                        letterSpacing: '0.04em',
                        fontWeight: 300,
                      }}
                    >
                      {product.material}
                    </p>
                  </div>
                  <div className="flex items-center justify-between mt-auto">
                    <span
                      style={{
                        fontFamily: "'Playfair Display', serif",
                        fontWeight: 500,
                        fontSize: 22,
                      }}
                    >
                      {product.price}
                    </span>
                    {!product.sold ? (
                      <a
                        href={waLink(product.name)}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          background: '#C4241E',
                          color: '#F4EFE7',
                          fontSize: 10,
                          letterSpacing: '0.28em',
                          padding: '10px 18px',
                          textDecoration: 'none',
                          fontFamily: "'Jost', sans-serif",
                          fontWeight: 400,
                        }}
                        className="hover:bg-[#a51e19] transition-colors duration-200"
                      >
                        PEDIR
                      </a>
                    ) : (
                      <span
                        style={{
                          fontSize: 10,
                          letterSpacing: '0.28em',
                          color: '#A2988A',
                          fontFamily: "'Jost', sans-serif",
                        }}
                      >
                        SIN STOCK
                      </span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 text-center">
            <p
              style={{
                fontSize: 15,
                color: '#8A8175',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 300,
                margin: 0,
              }}
            >
              ¿No encontraste lo que buscabas?{' '}
              <a
                href={`https://wa.me/${WHATSAPP}?text=${encodeURIComponent('Hola ⚡ quiero consultar por un accesorio')}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#C4241E',
                  textDecoration: 'none',
                  borderBottom: '1px solid rgba(196,36,30,0.35)',
                }}
              >
                Escríbenos y te ayudamos.
              </a>
            </p>
          </div>
        </div>
      </section>

      {/* ── Statement ── */}
      <section style={{ background: '#14120F', color: '#F4EFE7' }}>
        <div
          style={{ maxWidth: 1120 }}
          className="mx-auto px-6 md:px-16 py-24 grid md:grid-cols-[1fr_auto] gap-12 items-center"
        >
          <div className="flex flex-col gap-8">
            <span
              style={{
                fontSize: 9,
                letterSpacing: '0.42em',
                color: '#E8B923',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 300,
              }}
            >
              EUPHORIA · ACCESORIOS
            </span>
            <blockquote
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 500,
                fontSize: 'clamp(32px, 5vw, 56px)',
                lineHeight: 1.15,
                margin: 0,
                maxWidth: '22ch',
              }}
            >
              Póntelo porque quieres.<br />No para que te lo noten.<br />Para sentirte tú.
            </blockquote>
          </div>
          <Bolt w={56} h={92} color="#C4241E" />
        </div>
      </section>

      {/* ── Testimonios ── */}
      <section style={{ background: '#EDE5D8' }}>
        <div style={{ maxWidth: 1120 }} className="mx-auto px-6 md:px-16 py-20 md:py-28">
          <div className="flex flex-col gap-3 mb-12">
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.36em',
                color: '#A2988A',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 300,
              }}
            >
              02 · LO QUE DICEN
            </span>
            <h2
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 400,
                fontSize: 'clamp(28px, 4vw, 44px)',
                lineHeight: 1.1,
                margin: 0,
              }}
            >
              Las que ya eligieron ser ellas.
            </h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {TESTIMONIALS.map((t, i) => (
              <div
                key={i}
                className="flex flex-col gap-5 p-7"
                style={{
                  background: '#F4EFE7',
                  border: '1px solid #DED4C4',
                }}
              >
                <div style={{ height: 2, width: 28, background: '#C4241E' }} />
                <p
                  style={{
                    fontFamily: "'Playfair Display', serif",
                    fontStyle: 'italic',
                    fontSize: 20,
                    lineHeight: 1.45,
                    margin: 0,
                    flex: 1,
                  }}
                >
                  "{t.quote}"
                </p>
                <div className="flex items-center gap-3 pt-2" style={{ borderTop: '1px solid #DED4C4' }}>
                  <Bolt w={7} h={12} color="#C4241E" />
                  <span
                    style={{
                      fontSize: 12,
                      letterSpacing: '0.12em',
                      color: '#8A8175',
                      fontFamily: "'Jost', sans-serif",
                      fontWeight: 300,
                    }}
                  >
                    {t.name} · {t.city}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA final ── */}
      <section style={{ background: '#C4241E', color: '#F4EFE7' }}>
        <div
          style={{ maxWidth: 1120 }}
          className="mx-auto px-6 md:px-16 py-16 flex flex-col md:flex-row items-center justify-between gap-8"
        >
          <div className="flex flex-col gap-3">
            <span
              style={{
                fontSize: 10,
                letterSpacing: '0.5em',
                color: 'rgba(244,239,231,0.6)',
                fontFamily: "'Jost', sans-serif",
                fontWeight: 300,
              }}
            >
              ¿LISTO PARA PEDIR?
            </span>
            <p
              style={{
                fontFamily: "'Playfair Display', serif",
                fontWeight: 500,
                fontSize: 'clamp(26px, 4vw, 40px)',
                margin: 0,
                lineHeight: 1.15,
              }}
            >
              Tu próxima pieza<br />te está esperando.
            </p>
          </div>
          <a
            href={`https://wa.me/${WHATSAPP}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 flex-none hover:opacity-90 transition-opacity"
            style={{
              background: '#F4EFE7',
              color: '#14120F',
              fontSize: 11,
              letterSpacing: '0.3em',
              padding: '16px 32px',
              textDecoration: 'none',
              fontFamily: "'Jost', sans-serif",
              fontWeight: 500,
            }}
          >
            <Bolt w={9} h={15} color="#C4241E" />
            ABRIR WHATSAPP
          </a>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: '#14120F', color: '#F4EFE7', borderTop: '1px solid #2A2724' }}>
        <div
          style={{ maxWidth: 1120 }}
          className="mx-auto px-6 md:px-16 py-12 flex flex-col md:flex-row justify-between gap-8"
        >
          <div className="flex flex-col gap-4">
            <Logo dark />
          </div>
          <div className="flex flex-col gap-3">
            <span
              style={{
                fontSize: 9,
                letterSpacing: '0.32em',
                color: '#5C544A',
                fontFamily: "'Jost', sans-serif",
              }}
            >
              CONTACTO
            </span>
            <a
              href={`https://wa.me/${WHATSAPP}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 14,
                color: '#A2988A',
                textDecoration: 'none',
                fontWeight: 300,
              }}
              className="hover:text-[#F4EFE7] transition-colors"
            >
              WhatsApp
            </a>
            <a
              href="https://instagram.com/euphoriaby.dz"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                fontSize: 14,
                color: '#A2988A',
                textDecoration: 'none',
                fontWeight: 300,
              }}
              className="hover:text-[#F4EFE7] transition-colors"
            >
              @euphoriaby.dz · Instagram
            </a>
          </div>
        </div>
        <div
          style={{ borderTop: '1px solid #2A2724', maxWidth: 1120 }}
          className="mx-auto px-6 md:px-16 py-5"
        >
          <p
            style={{
              fontSize: 11,
              color: '#3C352C',
              margin: 0,
              letterSpacing: '0.14em',
              fontWeight: 300,
            }}
          >
            © 2024 Euphoria · Medellín, Colombia
          </p>
        </div>
      </footer>

    </div>
  )
}

/* ================================================================
   ✏️  CÓMO CONECTAR TU INVENTARIO — Google Sheet como base de datos
   ================================================================

   1. Creá una Google Sheet nueva con EXACTAMENTE estas columnas en la
      primera fila (los nombres deben ir en minúscula):

      nombre | codigo | material | precio | foto | disponible

      Ejemplo de una fila:
      Collar Ají | TAL-01 | Acero dorado · baño oro 18k | $38.000 |
      https://res.cloudinary.com/tu-cuenta/collar-aji.jpg | SI

      "disponible" acepta SI o NO (también sirve TRUE/FALSE).

   2. Archivo → Compartir → Publicar en la Web → elegí la hoja →
      formato "Valores separados por comas (.csv)" → Publicar.
      Copiá el link que te da Google (termina en algo como
      "...output=csv").

   3. Pegá ese link arriba en SHEET_CSV_URL (línea ~7 de este archivo).

   4. Para las fotos: subilas a Cloudinary (plan gratis, cloudinary.com)
      o a ImgBB (imgbb.com) — ambos te dan un link directo a la imagen
      apenas la subís. Pegá ese link en la columna "foto" de la hoja.
      (Los links de "compartir" de Google Drive no sirven acá: hay que
      usar un link que termine directo en la imagen.)

   5. Listo. De ahí en adelante, para actualizar el catálogo —cambiar
      precios, marcar algo como agotado, agregar una pieza nueva— solo
      editás la Google Sheet. No hace falta tocar código, ni volver a
      compilar, ni resubir nada: el sitio la lee sola cada vez que
      alguien lo visita.

   ================================================================ */
