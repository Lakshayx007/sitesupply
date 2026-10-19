import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ExternalLink, Menu, X } from "lucide-react";
import { useEffect, useState, type MouseEvent } from "react";
import { NavLink, useLocation, useOutlet } from "react-router-dom";
import { SITE } from "../config";
import { useDb } from "../db/DbProvider";
import { Logo } from "./Logo";
import { SampleDataPill } from "./SampleDataPill";
import { ThemeToggle } from "./ThemeToggle";

const DEMO = [{ to: "/demo", label: "Demo" }];
const PM = [
  { to: "/vendors", label: "Vendors" },
  { to: "/dashboard", label: "Dashboard" },
  { to: "/insights", label: "Insights" },
  { to: "/stats-lab", label: "Stats Lab" },
  { to: "/docs", label: "Docs" },
  { to: "/method", label: "Method" },
];

/** Desktop nav link with a shared sliding highlight. */
function NavItem({ to, label }: { to: string; label: string }) {
  return (
    <NavLink to={to} className="relative rounded-lg px-3 py-2 text-sm font-medium">
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              className="absolute inset-0 rounded-lg bg-subtle ring-1 ring-border"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <span className={`relative transition-colors ${isActive ? "text-ink" : "text-muted hover:text-ink"}`}>{label}</span>
        </>
      )}
    </NavLink>
  );
}

const mobileLink = ({ isActive }: { isActive: boolean }) =>
  `rounded-lg px-3 py-2.5 text-base font-medium ${isActive ? "bg-subtle text-ink" : "text-muted hover:bg-subtle hover:text-ink"}`;

function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
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
      className={`sticky top-0 z-40 transition-[background-color,border-color,box-shadow] duration-300 ${
        scrolled || open
          ? "border-b border-border bg-surface/85 shadow-[0_1px_0_rgb(15_23_42/0.02)] backdrop-blur-md supports-[backdrop-filter]:bg-surface/70"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-page items-center gap-3 px-4 sm:px-6">
        <Logo />
        <SampleDataPill className="ml-1" />

        <nav aria-label="Main" className="ml-auto hidden items-center gap-0.5 lg:flex">
          {DEMO.map((l) => (
            <NavItem key={l.to} {...l} />
          ))}
          <span className="mx-2 h-5 w-px bg-border" aria-hidden="true" />
          {PM.map((l) => (
            <NavItem key={l.to} {...l} />
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-3">
          <ThemeToggle />
          <button
            type="button"
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border text-ink hover:bg-subtle lg:hidden"
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
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
            className="overflow-hidden border-t border-border bg-surface lg:hidden"
          >
            <div className="px-4 pb-5 pt-3">
              <p className="eyebrow px-3 pb-1">Product demo</p>
              <NavLink to="/demo" className={mobileLink}>
                Orders, detail and alerts
              </NavLink>
              <p className="eyebrow px-3 pb-1 pt-4">PM workspace</p>
              <div className="flex flex-col">
                {PM.map((l) => (
                  <NavLink key={l.to} to={l.to} className={mobileLink}>
                    {l.label}
                  </NavLink>
                ))}
              </div>
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-24 border-t border-border sm:mt-32">
      <div className="mx-auto grid max-w-page gap-10 px-4 py-12 sm:px-6 md:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="max-w-xl space-y-4">
          <Logo />
          <p className="text-sm leading-relaxed text-muted">
            <strong className="font-semibold text-ink">All data on this site is sample data.</strong> It was generated by a
            program (<code className="text-[13px]">scripts/make_sample_data.py</code>, seed 42) for {SITE.dataWindow}, with
            some patterns planted on purpose. It does not describe any real company, vendor or customer.
          </p>
          <p className="text-sm text-muted">A product-management portfolio project by {SITE.author}.</p>
        </div>
        <div className="grid grid-cols-2 gap-6 text-sm">
          <div>
            <p className="font-semibold">Product</p>
            <ul className="mt-3 space-y-2 text-muted">
              <li>
                <NavLink to="/demo" className="hover:text-ink">
                  Demo
                </NavLink>
              </li>
              <li>
                <NavLink to="/method" className="hover:text-ink">
                  How the data was made
                </NavLink>
              </li>
              <li>
                <a href={SITE.githubUrl} className="inline-flex items-center gap-1 hover:text-ink" target="_blank" rel="noreferrer">
                  GitHub
                  <ExternalLink aria-hidden="true" className="h-3.5 w-3.5" />
                  <span className="sr-only">(opens in a new tab)</span>
                </a>
              </li>
            </ul>
          </div>
          <div>
            <p className="font-semibold">PM workspace</p>
            <ul className="mt-3 space-y-2 text-muted">
              {PM.slice(0, 5).map((l) => (
                <li key={l.to}>
                  <NavLink to={l.to} className="hover:text-ink">
                    {l.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

function DbStatusBanner() {
  const { status, error } = useDb();
  if (status !== "error") return null;
  return (
    <div role="alert" className="border-b border-status-late/40 bg-status-late/10 px-4 py-3 text-sm text-status-late-ink">
      <div className="mx-auto max-w-page sm:px-2">
        The sample database could not be loaded: {error.message} Refresh the page to try again.
      </div>
    </div>
  );
}

function skipToMain(e: MouseEvent<HTMLAnchorElement>) {
  e.preventDefault();
  document.getElementById("main")?.focus();
}

export function Layout() {
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const reduce = useReducedMotion();

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
        <motion.div
          key={pathname}
          initial={reduce ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {outlet}
        </motion.div>
      </main>
      <Footer />
    </div>
  );
}
