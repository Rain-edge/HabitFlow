import { Navigate, Route, Routes } from "react-router-dom";
import Layout from "./components/Layout";
import CalendarPage from "./pages/CalendarPage";
import Dashboard from "./pages/Dashboard";
import HabitDetail from "./pages/HabitDetail";
import Habits from "./pages/Habits";
import Journal from "./pages/Journal";
import Settings from "./pages/Settings";
import Statistics from "./pages/Statistics";
import StyleGuide from "./pages/StyleGuide";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="dashboard" element={<Navigate to="/" replace />} />
        <Route path="habits" element={<Habits />} />
        <Route path="habits/:id" element={<HabitDetail />} />
        <Route path="calendar" element={<CalendarPage />} />
        <Route path="statistics" element={<Statistics />} />
        <Route path="journal" element={<Journal />} />
        <Route path="settings" element={<Settings />} />
        <Route path="style" element={<StyleGuide />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
