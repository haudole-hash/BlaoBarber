import { Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { DashboardPage } from "./pages/DashboardPage";
import { OrdersPage } from "./pages/OrdersPage";
import { ServicesPage } from "./pages/ServicesPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { DataMaintenancePage } from "./pages/DataMaintenancePage";
import { DepreciationsPage } from "./pages/DepreciationsPage";
import { ProfitPage } from "./pages/ProfitPage";
import { TrashPage } from "./pages/TrashPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="services" element={<ServicesPage />} />
        <Route path="orders" element={<OrdersPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="depreciations" element={<DepreciationsPage />} />
        <Route path="profit" element={<ProfitPage />} />
        <Route path="maintenance" element={<DataMaintenancePage />} />
        <Route path="trash" element={<TrashPage />} />
      </Route>
    </Routes>
  );
}
