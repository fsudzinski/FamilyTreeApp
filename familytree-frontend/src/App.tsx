import { Routes, Route } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import TreeView from "./pages/TreeView";
import TreeComparison from "./pages/TreeComparison";

export default function App() {
  return (
    <Routes>
      <Route path="/register" element={<Register />} />
      <Route path="/login" element={<Login />} />
      <Route path="/trees" element={<TreeView />} />
      <Route path="/compare" element={<TreeComparison />} />
    </Routes>
  );
}