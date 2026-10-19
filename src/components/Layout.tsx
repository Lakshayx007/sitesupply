import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, Menu, X } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { SITE } from "../config";
import { useDb } from "../db/DbProvider";
import { Logo } from "./Logo";

/** Scrolls to a section on the home page, navigating there first if needed. */
export function useScrollTo() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return (id: string) => {
    const go = () => document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    if (pathname !== "/") {
      navigate("/");
      setTimeout(go, 80);
    } else go();
  };
}

const LINKS = [
  { id: "product", label: "Product" },
  { id: "how", label: "How it works" },
  { id: "ask", label: "AI assistant" },
];

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const scrollTo = useScrollTo();
  const { pathname } = useLocation();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-colors duration-300 ${
        scrolled || open ? "border-b border-line bg-canvas/80 backdrop-blur-xl" : "border-b border-transparent"
      }`}
    >
      <div className="mx-auto flex h-14 max-w-page items-center gap-6 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <button key={l.id} onClick={() => scrollTo(l.id)} className="rounded-md px-3 py-1.5 text-sm text-ink-2 transition-colors hover:text-ink">
              {l.label}
            </button>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          <Link to="/console/ask" className="btn-ghost hidden min-h-[34px] px-3 sm:inline-flex">
            Ask the data
          </Link>
          <Link to="/console" className="btn-primary min-h-[34px] px-3.5">
            Open console
          </Link>
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-2 hover:bg-raised md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="mobile-nav"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? <X aria-hidden="true" className="h-5 w-5" /> : <Menu aria-hidden="true" className="h-5 w-5" />}
          </button>
        </div>
      </div>
      <AnimatePresence>
        {open && (
          <motion.nav
            id="mobile-nav"
            aria-label="Main"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden md:hidden"
          >
            <div className="flex flex-col px-4 pb-4">
              {LINKS.map((l) => (
                <button
                  key={l.id}
                  onClick={() => {
                    setOpen(false);
                    scrollTo(l.id);
                  }}
                  className="rounded-md px-2 py-3 text-left text-base text-ink-2 hover:text-ink"
                >
                  {l.label}
                </button>
              ))}
              <Link to="/console/ask" className="rounded-md px-2 py-3 text-base text-ink-2 hover:text-ink">
                Ask the data
              </Link>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function Footer() {
  const scrollTo = useScrollTo();
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-page gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-sm text-sm text-muted">Delivery-delay early warning for construction material orders.</p>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">Product</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><NavLink to="/console" className="hover:text-ink">Live console</NavLink></li>
            <li><NavLink to="/console/alerts" className="hover:text-ink">Alerts</NavLink></li>
            <li><NavLink to="/console/site" className="hover:text-ink">Site engineer view</NavLink></li>
            <li><NavLink to="/console/vendors" className="hover:text-ink">Vendor scorecard</NavLink></li>
            <li><NavLink to="/console/analytics" className="hover:text-ink">Analytics</NavLink></li>
            <li><NavLink to="/console/ask" className="hover:text-ink">Ask SiteSupply</NavLink></li>
          </ul>
        </div>
        <div>
          <p className="text-sm font-medium text-ink">About</p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><button onClick={() => scrollTo("how")} className="hover:text-ink">How the score works</button></li>
            <li>
              <a href={SITE.githubUrl} className="inline-flex items-center gap-1 hover:text-ink" target="_blank" rel="noreferrer">
                GitHub
                <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="mx-auto max-w-page px-4 pb-10 sm:px-6">
        <p className="border-t border-line pt-6 text-xs text-muted">
          A concept product by {SITE.author}. The console runs on a simulated order history, not on a real customer's data.
        </p>
      </div>
    </footer>
  );
}

function DbStatusBanner() {
  const { status, error } = useDb();
  if (status !== "error") return null;
  return (
    <div role="alert" className="border-b border-late/40 bg-late/10 px-4 py-3 text-sm text-late">
      <div className="mx-auto max-w-page">Order data could not be loaded: {error.message} Refresh the page to try again.</div>
    </div>
  );
}

function skipToMain(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  document.getElementById("main")?.focus();
}

export function Layout() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return (
    <div className="flex min-h-screen flex-col">
      {/* HashRouter owns the URL hash, so the skip link moves focus instead of changing the hash. */}
      <a href="#main" className="skip-link btn-primary" onClick={skipToMain}>
        Skip to content
      </a>
      <Header />
      <DbStatusBanner />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
