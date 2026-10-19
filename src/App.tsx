import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes, useParams } from "react-router-dom";
import { Layout } from "./components/Layout";
import { ToastProvider } from "./components/ui";
import { Board } from "./console/Board";
import { ConsoleProvider } from "./console/ConsoleContext";
import { ConsoleLayout } from "./console/ConsoleLayout";
import { AlertsView, AskView, SiteView } from "./console/Views";
import { DbProvider } from "./db/DbProvider";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";

// Chart-heavy pages load on demand so the landing page stays light.
const Analytics = lazy(() => import("./console/Analytics").then((m) => ({ default: m.Analytics })));
const Vendors = lazy(() => import("./console/Vendors").then((m) => ({ default: m.Vendors })));
const Loading = () => <div className="p-6 text-sm text-muted">Loading…</div>;

/** Old /demo links from the build plan still work. */
function DemoRedirect() {
  const { id } = useParams();
  return <Navigate to={id ? `/console/order/${id}` : "/console"} replace />;
}

export default function App() {
  return (
    <DbProvider>
      <ToastProvider>
        <HashRouter>
          <Routes>
            <Route element={<Layout />}>
              <Route index element={<Home />} />
              <Route path="*" element={<NotFound />} />
            </Route>
            <Route
              path="console"
              element={
                <ConsoleProvider>
                  <ConsoleLayout />
                </ConsoleProvider>
              }
            >
              <Route index element={<Board />} />
              <Route path="order/:id" element={<Board />} />
              <Route path="alert/:id" element={<Board />} />
              <Route path="alerts" element={<AlertsView />} />
              <Route path="site" element={<SiteView />} />
              <Route path="ask" element={<AskView />} />
              <Route path="vendors" element={<Suspense fallback={<Loading />}><Vendors /></Suspense>} />
              <Route path="analytics" element={<Suspense fallback={<Loading />}><Analytics /></Suspense>} />
            </Route>
            <Route path="demo" element={<DemoRedirect />} />
            <Route path="demo/order/:id" element={<DemoRedirect />} />
            <Route path="demo/alert/:id" element={<DemoRedirect />} />
          </Routes>
        </HashRouter>
      </ToastProvider>
    </DbProvider>
  );
}
