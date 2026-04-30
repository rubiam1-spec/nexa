import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useIsMobile } from "../shared/hooks/useIsMobile";

// ── Tokens ──
const D = { bg: "#12110F", card: "#1C1B18", border: "#2A2822", hover: "#3D3A30", txt: "#FAF9F6", txt2: "#E8E5DE", txt3: "#9C9686", txt4: "#706B5F", sprout: "#4ADE80", blue: "#60A5FA", purple: "#A78BFA", amber: "#FBBF24", red: "#F87171" };
const L = { bg: "#FAF9F6", card: "#FFFFFF", border: "#E0DDD5", txt: "#12110F", txt2: "#3D3A30", txt3: "#706B5F", green: "#16A34A" };
const serif = "'Instrument Serif', Georgia, serif";
const sans = "'Outfit', system-ui, sans-serif";
const mono = "'JetBrains Mono', monospace";

function Logo({ size = 28 }: { size?: number; dark?: boolean }) {
  return <svg width={size} height={size} viewBox="0 0 512 512"><path d="M40 0 H370 L512 142 V472 Q512 512 472 512 H40 Q0 512 0 472 V40 Q0 0 40 0 Z" fill="#12110F"/><polygon points="148,380 148,132 200,132 316,308 316,132 364,132 364,380 316,380 200,204 200,380" fill="#4ADE80"/></svg>;
}

function BrowserFrame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: D.card, borderRadius: 12, border: `1px solid ${D.border}`, overflow: "hidden", boxShadow: "0 32px 64px rgba(0,0,0,0.5)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", background: D.bg, borderBottom: `1px solid ${D.border}` }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.red }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.amber }} />
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: D.sprout }} />
        <div style={{ flex: 1, margin: "0 8px", padding: "3px 10px", background: D.border, borderRadius: 5, fontSize: 10, color: D.txt4, fontFamily: mono }}>app.nexacomercial.com.br</div>
      </div>
      {children}
    </div>
  );
}

// ── Section wrapper ──
function Sec({ dark = true, children, id, className }: { dark?: boolean; children: React.ReactNode; id?: string; className?: string }) {
  return <section id={id} className={className} style={{ background: dark ? D.bg : L.bg, padding: "100px 24px", color: dark ? D.txt : L.txt }}><div style={{ maxWidth: 1100, margin: "0 auto" }}>{children}</div></section>;
}

function H2({ children, dark = true }: { children: React.ReactNode; dark?: boolean }) {
  return <h2 style={{ fontFamily: serif, fontStyle: "italic", fontSize: 40, fontWeight: 400, lineHeight: 1.2, color: dark ? D.txt2 : L.txt, margin: "0 0 48px", maxWidth: 700 }}>{children}</h2>;
}

// ── Main ──
export default function LandingPage() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Reveal on scroll
  useEffect(() => {
    const obs = new IntersectionObserver((es) => { es.forEach((e) => { if (e.isIntersecting) { (e.target as HTMLElement).style.opacity = "1"; (e.target as HTMLElement).style.transform = "translateY(0)"; obs.unobserve(e.target); } }); }, { threshold: 0.05 });
    requestAnimationFrame(() => { document.querySelectorAll(".rv").forEach((el) => obs.observe(el)); });
    const t = setTimeout(() => { document.querySelectorAll(".rv").forEach((el) => { (el as HTMLElement).style.opacity = "1"; (el as HTMLElement).style.transform = "translateY(0)"; }); }, 2500);
    return () => { obs.disconnect(); clearTimeout(t); };
  }, []);

  const mob = useIsMobile();

  return (
    <div style={{ overflowX: "hidden" }}>
      <style>{`
        .rv{opacity:0;transform:translateY(28px);transition:opacity .8s ease,transform .8s ease}
        @keyframes fi{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .a1{animation:fi .8s ease both}.a2{animation:fi .8s ease .15s both}.a3{animation:fi .8s ease .3s both}.a4{animation:fi .8s ease .5s both}
        .hv:hover{opacity:.92;transform:scale(1.02)}
        @media(max-width:768px){.g3{grid-template-columns:1fr!important}.g2{grid-template-columns:1fr!important}.g4{grid-template-columns:repeat(2,1fr)!important}.mh{display:none!important}.fh{font-size:36px!important}.fs{font-size:30px!important}}
      `}</style>

      {/* ═══ NAV ═══ */}
      <nav style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 100, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 32px", background: scrolled ? "rgba(18,17,15,0.92)" : "transparent", backdropFilter: scrolled ? "blur(12px)" : "none", borderBottom: scrolled ? `1px solid ${D.border}` : "1px solid transparent", transition: "all 300ms" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Logo size={26} /><span style={{ fontFamily: sans, fontWeight: 700, fontSize: 15, letterSpacing: "0.06em", color: D.txt }}>NEXA</span></div>
        <button onClick={() => navigate("/entrar")} className="hv" style={{ background: D.sprout, color: D.bg, border: "none", borderRadius: 8, padding: "9px 22px", fontFamily: sans, fontSize: 13, fontWeight: 700, cursor: "pointer", transition: "all 150ms" }}>Acessar</button>
      </nav>

      {/* ═══ 1. HERO (escuro) ═══ */}
      <section style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", textAlign: "center", padding: "100px 24px 60px", background: `radial-gradient(ellipse at 50% 40%, ${D.card} 0%, ${D.bg} 65%)` }}>
        <h1 className="a1 fh" style={{ fontFamily: serif, fontStyle: "italic", fontSize: 56, fontWeight: 400, lineHeight: 1.12, maxWidth: 720, margin: "0 0 20px", color: D.txt }}>Velocidade para vender.<br />Controle para crescer.</h1>
        <p className="a2" style={{ fontFamily: sans, fontSize: 18, color: D.txt3, maxWidth: 520, margin: "0 0 36px", lineHeight: 1.6 }}>A plataforma comercial que sua incorporadora merecia.</p>
        <div className="a3" style={{ display: "flex", gap: 12, flexWrap: "wrap", justifyContent: "center" }}>
          <a href="#features" className="hv" style={{ background: D.sprout, color: D.bg, borderRadius: 8, padding: "14px 28px", fontFamily: sans, fontSize: 15, fontWeight: 700, textDecoration: "none", transition: "all 150ms" }}>Conhecer a plataforma</a>
          <button onClick={() => navigate("/entrar")} className="hv" style={{ background: "transparent", color: D.txt2, border: `1px solid ${D.border}`, borderRadius: 8, padding: "14px 28px", fontFamily: sans, fontSize: 15, fontWeight: 500, cursor: "pointer", transition: "all 150ms" }}>Acessar o sistema</button>
        </div>

        {/* Dashboard mockup */}
        {!mob && (
          <div className="a4 mh" style={{ maxWidth: 820, width: "100%", marginTop: 56 }}>
            <BrowserFrame>
              <div style={{ padding: 16, display: "flex", gap: 12 }}>
                <div style={{ width: 36, display: "flex", flexDirection: "column", gap: 5 }}>{[1,2,3,4,5,6].map(i => <div key={i} style={{ width: 26, height: 26, borderRadius: 5, background: i===1 ? `${D.sprout}15` : D.border, border: i===1 ? `1px solid ${D.sprout}30` : "none" }} />)}</div>
                <div style={{ flex: 1 }}>
                  <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 6, marginBottom: 10 }}>
                    {[{l:"DISPONÍVEIS",v:"129",c:D.sprout},{l:"EM NEGOCIAÇÃO",v:"12",c:D.amber},{l:"RESERVADAS",v:"8",c:D.blue},{l:"VENDIDAS",v:"50",c:D.purple}].map(k => (
                      <div key={k.l} style={{ background: D.bg, borderRadius: 6, padding: "8px 10px", border: `1px solid ${D.border}` }}>
                        <div style={{ fontFamily: mono, fontSize: 6.5, color: D.txt4, letterSpacing: "0.08em" }}>{k.l}</div>
                        <div style={{ fontFamily: mono, fontSize: 18, fontWeight: 700, color: k.c, marginTop: 2 }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 6 }}>
                    <div style={{ background: D.bg, borderRadius: 6, padding: 10, border: `1px solid ${D.border}` }}>
                      <div style={{ fontFamily: mono, fontSize: 6.5, color: D.txt4 }}>VGV TOTAL</div>
                      <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: D.txt, marginTop: 3 }}>R$ 130,5M</div>
                    </div>
                    <div style={{ background: D.bg, borderRadius: 6, padding: 10, border: `1px solid ${D.border}` }}>
                      <div style={{ fontFamily: mono, fontSize: 6.5, color: D.txt4, marginBottom: 5 }}>FUNIL</div>
                      {["Negociação","Proposta","Reserva","Venda"].map((s,i) => (
                        <div key={s} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                          <span style={{ fontSize: 7.5, color: D.txt3, width: 52 }}>{s}</span>
                          <div style={{ flex: 1, height: 3, borderRadius: 2, background: D.border }}><div style={{ height: "100%", borderRadius: 2, background: [D.blue,D.purple,D.amber,D.sprout][i], width: `${[100,49,17,30][i]}%` }} /></div>
                          <span style={{ fontFamily: mono, fontSize: 7.5, color: D.sprout, width: 16, textAlign: "right" }}>{[47,23,8,14][i]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </BrowserFrame>
          </div>
        )}
        <div className="a4" style={{ marginTop: 40, fontFamily: mono, fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", color: D.txt4 }}>Da simulação à escritura. Sem ponto cego.</div>
      </section>

      {/* ═══ 2. NÚMEROS (claro) ═══ */}
      <Sec dark={false} className="rv">
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, textAlign: "center" }}>
          {[{v:"187+",l:"unidades gerenciadas"},{v:"R$ 130M+",l:"em VGV rastreado"},{v:"5",l:"relatórios com PDF"},{v:"< 2min",l:"para simular"}].map(n => (
            <div key={n.l}><div style={{ fontFamily: mono, fontSize: 48, fontWeight: 700, color: L.txt, lineHeight: 1 }}>{n.v}</div><div style={{ fontFamily: sans, fontSize: 14, color: L.txt3, marginTop: 8 }}>{n.l}</div></div>
          ))}
        </div>
      </Sec>

      {/* ═══ 3. PROBLEMA (escuro) ═══ */}
      <Sec dark className="rv">
        <H2>O que acontece quando sua operação comercial depende de planilhas, WhatsApp e boa vontade?</H2>
        <div className="g2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px 48px" }}>
          {["Vendas se perdem no caminho","Reservas expiram sem aviso","Corretores não têm ferramenta","Diretor não tem visão","Cada empreendimento é um caos novo","Ninguém sabe o status real"].map(t => (
            <div key={t} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{ width: 24, height: 2, background: D.sprout, marginTop: 11, flexShrink: 0, borderRadius: 1 }} />
              <span style={{ fontFamily: sans, fontSize: 15, color: D.txt2, lineHeight: 1.5 }}>{t}</span>
            </div>
          ))}
        </div>
      </Sec>

      {/* ═══ 4. MANIFESTO (claro) ═══ */}
      <Sec dark={false} className="rv">
        <div style={{ maxWidth: 640, margin: "0 auto", borderLeft: `3px solid ${L.green}`, paddingLeft: 32 }}>
          <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 32, color: L.txt, lineHeight: 1.5, margin: 0 }}>Existe um momento em que o terreno bruto se torna patrimônio.</p>
          <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 32, color: L.txt3, lineHeight: 1.5, margin: "20px 0 0" }}>Esse momento não acontece por acaso.</p>
          <p style={{ fontFamily: serif, fontStyle: "italic", fontSize: 32, color: L.green, lineHeight: 1.5, margin: "20px 0 0" }}>A NEXA é esse momento.</p>
          <p style={{ fontFamily: sans, fontSize: 15, color: L.txt3, lineHeight: 1.7, margin: "28px 0 0" }}>Acontece porque alguém organizou a operação, controlou o processo e transformou cada metro quadrado em oportunidade rastreável.</p>
        </div>
      </Sec>

      {/* ═══ 5. COMO FUNCIONA (escuro) ═══ */}
      <Sec dark className="rv">
        <H2>Como funciona</H2>
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 24, textAlign: "center" }}>
          {[{n:"1",t:"Simule",d:"Corretor gera simulação em 2 minutos com PDF personalizado."},{n:"2",t:"Negocie",d:"Contraproposta, análise, aceite ou recuse com rastreabilidade."},{n:"3",t:"Reserve",d:"Proposta aceita? Reserva automática. Fila gerenciada."},{n:"4",t:"Venda",d:"Unidade vendida. Dashboard atualiza. Relatório pronto."}].map(s => (
            <div key={s.n}>
              <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${D.sprout}12`, border: `1px solid ${D.sprout}35`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px", fontFamily: mono, fontSize: 15, fontWeight: 700, color: D.sprout }}>{s.n}</div>
              <div style={{ fontFamily: sans, fontSize: 17, fontWeight: 700, color: D.sprout, marginBottom: 8 }}>{s.t}</div>
              <div style={{ fontFamily: sans, fontSize: 14, color: D.txt3, lineHeight: 1.6 }}>{s.d}</div>
            </div>
          ))}
        </div>
      </Sec>

      {/* ═══ 6. FEATURES (claro) ═══ */}
      <Sec dark={false} id="features" className="rv">
        <h2 style={{ fontFamily: serif, fontStyle: "italic", fontSize: 40, color: L.txt, margin: "0 0 48px", textAlign: "center" }}>O motor comercial completo.</h2>
        <div className="g3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[
            {t:"Simulador Comercial",d:"Simulação em tempo real. PDF com a marca da incorporadora.",vis:<div style={{display:"flex",flexDirection:"column",gap:3,marginTop:14}}><div style={{height:3,borderRadius:2,background:L.border}}><div style={{height:"100%",width:"65%",background:L.green,borderRadius:2}}/></div><div style={{fontFamily:mono,fontSize:18,fontWeight:700,color:L.green,textAlign:"center",marginTop:4}}>R$ 23.500/mês</div><div style={{fontFamily:mono,fontSize:9,color:L.txt3,textAlign:"center"}}>36x · sem juros bancários</div></div>},
            {t:"Pipeline Inteligente",d:"6 etapas visuais. Contraproposta e cascata automática.",vis:<div style={{display:"flex",gap:2,marginTop:14,height:28}}>{[D.txt3,D.blue,D.purple,D.amber,D.sprout,D.red].map((c,i)=><div key={i} style={{flex:1,background:`${c}18`,borderRadius:3,borderTop:`2px solid ${c}`}}/>)}</div>},
            {t:"Mapa de Unidades",d:"Grid por quadra. Status em tempo real. Fila de espera.",vis:<div style={{display:"grid",gridTemplateColumns:"repeat(8,1fr)",gap:2,marginTop:14}}>{[...Array(24)].map((_,i)=>{const c=i<16?D.sprout:i<18?D.amber:D.txt3;return<div key={i} style={{aspectRatio:"1",borderRadius:2,background:`${c}20`,border:`1px solid ${c}30`}}/>})}</div>},
            {t:"Contraproposta",d:"Diretor devolve com novos termos. Tudo registrado.",vis:<div style={{display:"flex",alignItems:"center",gap:5,marginTop:14,justifyContent:"center",fontSize:9}}><span style={{padding:"3px 8px",borderRadius:4,background:`${D.blue}15`,color:D.blue,border:`1px solid ${D.blue}30`}}>Proposta</span><span style={{color:L.txt3}}>→</span><span style={{padding:"3px 8px",borderRadius:4,background:`${D.purple}15`,color:D.purple,border:`1px solid ${D.purple}30`}}>Contra</span><span style={{color:L.txt3}}>→</span><span style={{padding:"3px 8px",borderRadius:4,background:`${L.green}12`,color:L.green,border:`1px solid ${L.green}30`}}>Aceita</span></div>},
            {t:"Reserva Automática",d:"Proposta aceita? Unidade travada. Fila promovida.",vis:<div style={{display:"flex",alignItems:"center",gap:8,marginTop:14,justifyContent:"center"}}><span style={{padding:"4px 12px",borderRadius:4,background:`${L.green}10`,border:`1px solid ${L.green}25`,fontFamily:mono,fontSize:13,color:L.green,fontWeight:600}}>72h</span><span style={{fontSize:12,color:L.txt3}}>Reserva ativa</span></div>},
            {t:"Relatórios com PDF",d:"5 tipos. Gráficos visuais. PDF profissional.",vis:<div style={{display:"flex",gap:3,alignItems:"flex-end",height:28,marginTop:14,justifyContent:"center"}}>{[60,40,80,30,55].map((h,i)=><div key={i} style={{width:14,height:`${h}%`,background:[L.green,D.blue,L.green,D.amber,D.purple][i],borderRadius:2,opacity:.7}}/>)}</div>},
          ].map(f => (
            <div key={f.t} style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 14, padding: 24, boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
              <div style={{ fontFamily: sans, fontSize: 15, fontWeight: 700, color: L.green, marginBottom: 8 }}>{f.t}</div>
              <div style={{ fontFamily: sans, fontSize: 14, color: L.txt3, lineHeight: 1.6 }}>{f.d}</div>
              {f.vis}
            </div>
          ))}
        </div>
      </Sec>

      {/* ═══ 7. PIPELINE MOCKUP (escuro) ═══ */}
      {!mob && (
        <Sec dark className="rv mh">
          <div style={{ maxWidth: 880, margin: "0 auto" }}>
            <BrowserFrame>
              <div style={{ padding: 14 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: D.txt, marginBottom: 10, fontFamily: sans }}>Pipeline Comercial</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(6,1fr)", gap: 5 }}>
                  {[{n:"Simulação",c:D.txt3,cards:["João S. · Q3 L14","Carlos M. · Q1 L03","Patrícia · Q2 L19"]},{n:"Negociação",c:D.blue,cards:["Maria C. · Q1 L08","Roberto · Q5 L12"]},{n:"Proposta",c:D.purple,cards:["Ana L. · Q2 L22","Fernanda · Q3 L07"]},{n:"Reserva",c:D.amber,cards:["Pedro · Q4 L01"]},{n:"Venda",c:D.sprout,cards:["José · Q1 L03","Marina · Q5 L08"]},{n:"Perdido",c:D.red,cards:["Lucas · Q2 L11"]}].map(col => (
                    <div key={col.n}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}><span style={{ fontSize: 8, color: col.c, fontWeight: 600 }}>{col.n}</span><span style={{ fontFamily: mono, fontSize: 7, color: D.txt4 }}>{col.cards.length}</span></div>
                      <div style={{ height: 2, background: col.c, borderRadius: 1, marginBottom: 4, opacity: .5 }} />
                      {col.cards.map((card,i) => { const [name,loc] = card.split(" · "); return (
                        <div key={i} style={{ background: D.bg, borderRadius: 5, padding: "5px 7px", border: `1px solid ${D.border}`, borderLeft: `2px solid ${col.c}`, marginBottom: 3 }}>
                          <div style={{ fontSize: 8, color: D.txt2, fontWeight: 500 }}>{name}</div>
                          <div style={{ fontFamily: mono, fontSize: 7, color: D.txt4 }}>{loc}</div>
                        </div>
                      ); })}
                    </div>
                  ))}
                </div>
              </div>
            </BrowserFrame>
          </div>
        </Sec>
      )}

      {/* ═══ 8. PERFIS (claro) ═══ */}
      <Sec dark={false} className="rv">
        <h2 style={{ fontFamily: serif, fontStyle: "italic", fontSize: 40, color: L.txt, margin: "0 0 48px", textAlign: "center" }}>Cada perfil vê o que precisa.</h2>
        <div className="g3" style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          {[{t:"Diretor",items:["VGV e funil completo","Relatórios com PDF","Configurações por empreendimento","Contraproposta e governança"]},{t:"Consultora",items:["Negociações próprias","Atividades e follow-ups","Clientes e corretores","Simulações"]},{t:"Corretor",items:["Simulador de condições","Pipeline de propostas","Fila de espera","Comissão estimada"]}].map(p => (
            <div key={p.t} style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 14, padding: 24 }}>
              <div style={{ fontFamily: sans, fontSize: 17, fontWeight: 700, color: L.green, marginBottom: 16 }}>{p.t}</div>
              {p.items.map(item => <div key={item} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}><div style={{ width: 5, height: 5, borderRadius: "50%", background: L.green, flexShrink: 0 }} /><span style={{ fontFamily: sans, fontSize: 14, color: L.txt2 }}>{item}</span></div>)}
            </div>
          ))}
        </div>
      </Sec>

      {/* ═══ 9. COMPARATIVO (escuro) ═══ */}
      <Sec dark className="rv">
        <H2>Por que não um CRM genérico?</H2>
        <div style={{ maxWidth: 700, overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: sans, fontSize: 14 }}>
            <thead><tr style={{ borderBottom: `1px solid ${D.border}` }}><th style={{ textAlign: "left", padding: "12px 16px", fontFamily: mono, fontSize: 10, color: D.txt4, textTransform: "uppercase" }}></th><th style={{ textAlign: "center", padding: "12px", fontFamily: mono, fontSize: 10, color: D.txt4, textTransform: "uppercase" }}>CRMs</th><th style={{ textAlign: "center", padding: "12px", fontFamily: mono, fontSize: 10, color: D.txt4, textTransform: "uppercase" }}>ERPs</th><th style={{ textAlign: "center", padding: "12px 16px", fontFamily: mono, fontSize: 10, color: D.sprout, textTransform: "uppercase", background: `${D.sprout}08` }}>NEXA</th></tr></thead>
            <tbody>{[["Unidade como ativo","x","~","v"],["Fila automática","x","x","v"],["Reserva com prazo","x","manual","v"],["Contraproposta","x","x","v"],["Tempo de adoção","meses","meses","dias"],["Config. por empreendimento","x","caro","v"]].map(([l,a,b,c]) => <tr key={l} style={{ borderBottom: `1px solid ${D.border}` }}><td style={{ padding: "12px 16px", color: D.txt2 }}>{l}</td><td style={{ padding: "12px", textAlign: "center", color: a==="x"?D.red:D.txt3 }}>{a==="x"?"\u00D7":a}</td><td style={{ padding: "12px", textAlign: "center", color: b==="x"?D.red:b==="~"||b==="manual"||b==="caro"?D.amber:D.txt3 }}>{b==="x"?"\u00D7":b}</td><td style={{ padding: "12px 16px", textAlign: "center", color: D.sprout, fontWeight: 600, background: `${D.sprout}06` }}>{c==="v"?"\u2713":c}</td></tr>)}</tbody>
          </table>
        </div>
      </Sec>

      {/* ═══ 10. DNA (claro) ═══ */}
      <Sec dark={false} className="rv">
        <div className="g4" style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
          {[{w:"Precisa",d:"Cada dado conectado"},{w:"Veloz",d:"Menos clique, mais venda"},{w:"Rastreável",d:"Zero zona cega"},{w:"Confiável",d:"Gestor dorme tranquilo"}].map(p => (
            <div key={p.w} style={{ background: L.card, border: `1px solid ${L.border}`, borderRadius: 12, padding: "20px 18px", textAlign: "center" }}>
              <div style={{ fontFamily: sans, fontSize: 17, fontWeight: 700, color: L.green, marginBottom: 6 }}>{p.w}</div>
              <div style={{ fontFamily: sans, fontSize: 14, color: L.txt3 }}>{p.d}</div>
            </div>
          ))}
        </div>
      </Sec>

      {/* ═══ 11. CTA FINAL (escuro) ═══ */}
      <Sec dark className="rv">
        <div style={{ textAlign: "center", padding: "40px 0" }}>
          <h2 style={{ fontFamily: serif, fontStyle: "italic", fontSize: 44, color: D.txt2, margin: "0 0 16px", lineHeight: 1.2 }}>Feito para quem constrói.</h2>
          <p style={{ fontFamily: sans, fontSize: 17, color: D.txt3, margin: "0 0 12px" }}>Incorporadoras · Urbanizadoras · Loteadoras</p>
          <p style={{ fontFamily: sans, fontSize: 15, color: D.txt4, margin: "0 0 40px" }}>Empreendimentos horizontais e verticais.</p>
          <button onClick={() => navigate("/entrar")} className="hv" style={{ background: D.sprout, color: D.bg, border: "none", borderRadius: 8, padding: "16px 48px", fontFamily: sans, fontSize: 16, fontWeight: 700, cursor: "pointer", transition: "all 150ms" }}>Acessar a plataforma</button>
          <div style={{ marginTop: 16, fontFamily: mono, fontSize: 11, color: D.txt4 }}>Sem cartão de crédito. Configuração em minutos.</div>
        </div>
      </Sec>

      {/* ═══ 12. FOOTER ═══ */}
      <footer style={{ padding: "40px 24px", background: "#0E0D0B", textAlign: "center", borderTop: `1px solid ${D.border}` }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 10 }}><Logo size={20} /><span style={{ fontFamily: sans, fontWeight: 700, fontSize: 13, color: D.txt, letterSpacing: "0.06em" }}>NEXA</span></div>
        <div style={{ fontFamily: mono, fontSize: 11, color: D.txt4 }}>Plataforma Comercial</div>
        <div style={{ fontFamily: mono, fontSize: 10, color: D.txt4, marginTop: 14 }}>2026 NEXA. Todos os direitos reservados. Cascavel, PR.</div>
      </footer>
    </div>
  );
}
