import { Route, Routes } from "react-router-dom";
import AppShell from "@/components/AppShell";
import Home from "@/pages/Home";
import DraftSetup from "@/pages/DraftSetup";
import DataRefresh from "@/pages/DataRefresh";
import MyBoard from "@/pages/MyBoard";
import DraftBoard from "@/pages/DraftBoard";
import PostDraft from "@/pages/PostDraft";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/draft/:id/setup" element={<DraftSetup />} />
        <Route path="/draft/:id/board" element={<DraftBoard />} />
        <Route path="/draft/:id/results" element={<PostDraft />} />
        <Route path="/refresh" element={<DataRefresh />} />
        <Route path="/my-board" element={<MyBoard />} />
      </Route>
    </Routes>
  );
}
