"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Camera, Ruler, ShoppingCart, Smartphone } from "lucide-react";

const features = [
  {
    icon: Camera,
    title: "Podgląd AR na żywo",
    desc: "Obraz z kamery wypełnia ekran — bez instalowania żadnej aplikacji.",
  },
  {
    icon: Ruler,
    title: "Dokładna skala",
    desc: "Sprawdź, jak obraz wygląda w dokładnych wymiarach na Twojej ścianie.",
  },
  {
    icon: Smartphone,
    title: "Zaprojektowane na telefon",
    desc: "Działa w każdej nowoczesnej przeglądarce mobilnej.",
  },
  {
    icon: ShoppingCart,
    title: "Zakup jednym dotknięciem",
    desc: "Dodaj do koszyka Shopify bezpośrednio z widoku AR.",
  },
];

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.12 },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 200, damping: 22 } },
};

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-black text-white overflow-x-hidden">
      {/* ── Hero ── */}
      <section className="relative flex flex-col items-center justify-center min-h-screen px-6 text-center">
        {/* Ambient glow */}
        <div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,255,255,0.07) 0%, transparent 70%)",
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-6"
        >
          <span className="inline-block bg-white/10 border border-white/15 text-white/70 text-xs font-semibold tracking-widest uppercase px-4 py-2 rounded-full">
            Podgląd AR obrazów na płótnie
          </span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.7 }}
          className="text-5xl sm:text-7xl font-black tracking-tight leading-[1.05] mb-6"
        >
          Sprawdź, jak to będzie<br />
          <span className="bg-gradient-to-r from-white via-white/80 to-white/50 bg-clip-text text-transparent">
            wyglądać zanim kupisz.
          </span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="text-white/50 text-lg max-w-md leading-relaxed mb-10"
        >
          Wallify używa kamery Twojego telefonu, aby nałożyć obraz na płótnie
          bezpośrednio na ścianę — w dokładnym rzeczywistym rozmiarze, bez
          instalowania aplikacji.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.45, type: "spring", stiffness: 200, damping: 18 }}
          className="flex flex-col sm:flex-row gap-4 items-center"
        >
          <Link
            href="/ar"
            className="inline-flex items-center gap-2 bg-white text-black
                       px-8 py-4 rounded-full text-base font-bold
                       shadow-[0_4px_32px_rgba(255,255,255,0.25)]
                       hover:shadow-[0_4px_48px_rgba(255,255,255,0.35)]
                       transition-all active:scale-95"
          >
            <Camera className="w-5 h-5" />
            Wypróbuj demo
          </Link>
          <a
            href="#jak-to-dziala"
            className="text-white/50 hover:text-white text-sm transition-colors"
          >
            Jak to działa ↓
          </a>
        </motion.div>

        {/* Mock phone frame */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.8 }}
          className="mt-16 relative w-48 h-80 mx-auto"
        >
          <div className="absolute inset-0 rounded-[2.5rem] border-2 border-white/15 bg-white/5 backdrop-blur-sm overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent" />
            <div className="absolute inset-2 rounded-[2rem] bg-neutral-900 overflow-hidden flex items-center justify-center">
              <div
                className="w-32 h-24 border-2 border-white/30 rounded-sm"
                style={{ boxShadow: "0 4px 24px rgba(0,0,0,0.5)" }}
              >
                <div className="w-full h-full bg-gradient-to-br from-neutral-700 to-neutral-800 flex items-center justify-center">
                  <span className="text-white/30 text-xs">obraz</span>
                </div>
              </div>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-white/90 text-black text-[9px] font-bold px-2 py-0.5 rounded-full">
                70 × 50 cm
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ── Jak to działa ── */}
      <section
        id="jak-to-dziala"
        className="py-24 px-6 border-t border-white/8"
      >
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Trzy kroki, zero instalacji.
            </h2>
            <p className="text-white/50 max-w-xs mx-auto">
              Działa bezpośrednio w przeglądarce mobilnej.
            </p>
          </motion.div>

          <div className="grid gap-6 sm:grid-cols-3">
            {[
              { step: "01", title: "Otwórz link", desc: 'Dotknij „Przymierz na ścianie" na stronie produktu.' },
              { step: "02", title: "Zezwól na kamerę", desc: "Udziel dostępu do kamery — obraz nigdy nie opuszcza Twojego urządzenia." },
              { step: "03", title: "Skieruj i sprawdź", desc: "Skieruj telefon na ścianę. Obraz pojawi się w rzeczywistej skali." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                className="relative p-6 rounded-2xl bg-white/5 border border-white/8"
              >
                <span className="text-4xl font-black text-white/8 select-none block mb-4">
                  {item.step}
                </span>
                <h3 className="font-semibold text-white mb-2">{item.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Funkcje ── */}
      <section className="py-24 px-6 border-t border-white/8">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl sm:text-4xl font-bold text-center mb-16"
          >
            Zbudowany z myślą o konwersji.
          </motion.h2>

          <motion.ul
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true }}
            className="grid gap-6 sm:grid-cols-2"
          >
            {features.map(({ icon: Icon, title, desc }) => (
              <motion.li
                key={title}
                variants={itemVariants}
                className="flex gap-4 p-6 rounded-2xl bg-white/5 border border-white/8"
              >
                <div className="shrink-0 w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
                  <Icon className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-white mb-1">{title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{desc}</p>
                </div>
              </motion.li>
            ))}
          </motion.ul>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-24 px-6 text-center border-t border-white/8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="max-w-md mx-auto space-y-6"
        >
          <h2 className="text-3xl sm:text-4xl font-bold">Gotowy, żeby spróbować?</h2>
          <p className="text-white/50">
            Otwórz demo AR na swoim telefonie, by zobaczyć pełne wrażenia.
          </p>
          <Link
            href="/ar"
            className="inline-flex items-center gap-2 bg-white text-black
                       px-8 py-4 rounded-full font-bold text-base
                       shadow-[0_4px_32px_rgba(255,255,255,0.2)]
                       hover:shadow-[0_4px_48px_rgba(255,255,255,0.3)]
                       transition-all active:scale-95"
          >
            <Camera className="w-5 h-5" />
            Otwórz demo AR
          </Link>
        </motion.div>
      </section>

      <footer className="border-t border-white/8 py-8 text-center text-white/25 text-xs">
        Wallify — Sprawdź zanim kupisz.
      </footer>
    </main>
  );
}
