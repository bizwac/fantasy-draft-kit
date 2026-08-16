import { Route, Routes } from "react-router-dom";
import AppShell from "@/components/AppShell";
import Home from "@/pages/Home";
import DraftSetup from "@/pages/DraftSetup";
import MyBoard from "@/pages/MyBoard";
import DraftBoard from "@/pages/DraftBoard";
import PostDraft from "@/pages/PostDraft";
import Settings from "@/pages/Settings";
import PresentBoard from "@/pages/PresentBoard";

export default function App() {
  return (
    <Routes>
      <Route element={<AppShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/draft/:id/setup" element={<DraftSetup />} />
        <Route path="/draft/:id/board" element={<DraftBoard />} />
        <Route path="/draft/:id/results" element={<PostDraft />} />
        <Route path="/my-board" element={<MyBoard />} />
        <Route path="/settings" element={<Settings />} />
      </Route>
      {/* Outside AppShell deliberately — no sidebar/nav chrome, meant to
          fill a screen-shared window or full-screen presentation. */}
      <Route path="/draft/:id/present" element={<PresentBoard />} />
    </Routes>
  );
}
