import { HashRouter, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DbProvider } from "./db/DbProvider";
import Dashboard from "./pages/Dashboard";
import DemoAlert from "./pages/DemoAlert";
import DemoOrderDetail from "./pages/DemoOrderDetail";
import DemoOrders from "./pages/DemoOrders";
import Docs from "./pages/Docs";
import Home from "./pages/Home";
import Insights from "./pages/Insights";
import Method from "./pages/Method";
import NotFound from "./pages/NotFound";
import StatsLab from "./pages/StatsLab";
import Vendors from "./pages/Vendors";

export default function App() {
  return (
    <DbProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="demo" element={<DemoOrders />} />
            <Route path="demo/order/:id" element={<DemoOrderDetail />} />
            <Route path="demo/alert/:id" element={<DemoAlert />} />
            <Route path="vendors" element={<Vendors />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="insights" element={<Insights />} />
            <Route path="stats-lab" element={<StatsLab />} />
            <Route path="docs" element={<Docs />} />
            <Route path="method" element={<Method />} />
            <Route path="*" element={<NotFound />} />
          </Route>
        </Routes>
      </HashRouter>
    </DbProvider>
  );
}
