import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function MapaPage() {
  const navigate = useNavigate();
  useEffect(() => { navigate("/unidades?view=mapa", { replace: true }); }, [navigate]);
  return null;
}
