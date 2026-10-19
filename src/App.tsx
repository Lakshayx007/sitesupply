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
