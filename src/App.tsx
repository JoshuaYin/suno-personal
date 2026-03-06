import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "./components/Layout";
import CreatePage from "./pages/CreatePage";
import HistoryPage from "./pages/HistoryPage";
import MVPage from "./pages/MVPage";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/create" element={<CreatePage />} />
        <Route path="/mv" element={<MVPage />} />
        <Route path="/history" element={<HistoryPage />} />
        <Route path="*" element={<Navigate to="/create" replace />} />
      </Route>
    </Routes>
  );
}
