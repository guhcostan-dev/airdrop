import React, { useState, useEffect } from "react";

interface MascotProps {
  size?: string | number;
  className?: string;
  mood?: "normal" | "wink" | "happy" | "focused";
  gaze?: { x: number; y: number };
}

export function AirdropMascotSvg({
  size = "100%",
  className = "",
  mood = "normal",
  gaze = { x: 0, y: 0 },
}: MascotProps) {
  const gx = Math.max(-6, Math.min(6, gaze.x * 6));
  const gy = Math.max(-4, Math.min(4, gaze.y * 4));

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={className}
      style={{ overflow: "visible", display: "block" }}
      aria-hidden="true"
    >
      <g transform={`translate(${gx * 0.35}, ${gy * 0.35})`}>
        {/* Soft upper parachute dome */}
        <path
          d="M22 46 C22 20, 98 20, 98 46 C98 52, 91 55, 84 53 C76 51, 68 51, 60 53 C52 51, 44 51, 36 53 C29 55, 22 52, 22 46 Z"
          fill="var(--pumpy-body, #ffffff)"
        />
        {/* Suspension cords */}
        <line x1="33" y1="50" x2="42" y2="63" stroke="var(--pumpy-body, #ffffff)" strokeWidth="4.5" strokeLinecap="round" />
        <line x1="87" y1="50" x2="78" y2="63" stroke="var(--pumpy-body, #ffffff)" strokeWidth="4.5" strokeLinecap="round" />
        {/* Rounded Pumpy-style Capsule Body with face */}
        <rect
          x="26"
          y="56"
          width="68"
          height="50"
          rx="25"
          fill="var(--pumpy-body, #ffffff)"
        />
        {/* Expressive Eyes that track cursor */}
        <g transform={`translate(${gx}, ${gy})`}>
          {mood === "wink" ? (
            <path
              d="M41 80 Q47 74 53 80"
              fill="none"
              stroke="var(--pumpy-eyes, #111111)"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
          ) : (
            <ellipse
              cx="47"
              cy="80"
              rx="4.8"
              ry={mood === "focused" ? "3.6" : "6.2"}
              fill="var(--pumpy-eyes, #111111)"
            />
          )}
          {mood === "happy" ? (
            <path
              d="M67 80 Q73 74 79 80"
              fill="none"
              stroke="var(--pumpy-eyes, #111111)"
              strokeWidth="4.2"
              strokeLinecap="round"
            />
          ) : (
            <ellipse
              cx="73"
              cy="80"
              rx="4.8"
              ry={mood === "focused" ? "3.6" : "6.2"}
              fill="var(--pumpy-eyes, #111111)"
            />
          )}
        </g>
      </g>
    </svg>
  );
}

interface StoryChapter {
  id: string;
  num: string;
  label: string;
  requestText: string;
  cliCommand: string;
  answerIntro: string;
  answerMeta: string;
  steps: {
    num: string;
    title: string;
    sub: string;
    metric: string;
    metricSub: string;
  }[];
  note: string;
  phoneState: {
    version: string;
    badge: string;
    headline: string;
    detail: string;
    rolloutPct: number;
  };
}

const STORY_CHAPTERS: StoryChapter[] = [
  {
    id: "hotfix",
    num: "01",
    label: "Hotfix em 30s",
    requestText: "Envie o hotfix v2.4.1 para 20% do iOS em produção — corrija o arredondamento do checkout.",
    cliCommand: "airdrop release --platform ios --rollout 20 --sign",
    answerIntro: "Pronto! Bundle Hermes compilado, assinado com ECDSA P-256 e publicado na borda.",
    answerMeta: "6 etapas · 38 ms de latência · iOS & Android · Hermes 0.87",
    steps: [
      {
        num: "01",
        title: "Hermes Bytecode (.hbc)",
        sub: "Metro bundler + compilação Hermes otimizada",
        metric: "312 KB",
        metricSub: "delta comprimido (gzip)",
      },
      {
        num: "02",
        title: "Assinatura ECDSA P-256",
        sub: "Envelope airdrop-manifest-v1 verificado via chave pública nativa",
        metric: "Assinado",
        metricSub: "SecKeyVerifySignature",
      },
      {
        num: "03",
        title: "Deduplicação SHA-256",
        sub: "Apenas arquivos inéditos são enviados ao bucket S3 / Edge",
        metric: "1 / 19 arq.",
        metricSub: "18 reaproveitados no app",
      },
      {
        num: "04",
        title: "Rollout Canário Determinístico",
        sub: "SHA-256(deviceId + ':' + updateId) mod 100 < 20",
        metric: "20% frota",
        metricSub: "Sem sessão sticky",
      },
      {
        num: "05",
        title: "Watchdog Nativo de Inicialização",
        sub: "Reverte automaticamente se o JS falhar antes de notifyAppReady()",
        metric: "Armado",
        metricSub: "2 tentativas máx.",
      },
      {
        num: "06",
        title: "Propagação Global (AWS + Cloudflare)",
        sub: "airdrop-api.guhcostan.dev + s3://airdrop-assets-177683310249",
        metric: "38 ms",
        metricSub: "p95 edge check",
      },
    ],
    note: "Dispositivos elegíveis baixam em segundo plano e aplicam na próxima abertura (ou imediatamente se mandatory).",
    phoneState: {
      version: "v2.4.1-ota.1",
      badge: "ECDSA P-256 VERIFIED",
      headline: "Checkout PIX & Cartão corrigido",
      detail: "312 KB baixados da borda · 18 assets locais preservados",
      rolloutPct: 20,
    },
  },
  {
    id: "rollout",
    num: "02",
    label: "Rollout Gradual",
    requestText: "Zero crashes no canário de 20%. Expanda o release v2.4.1 para 100% da frota em produção.",
    cliCommand: "airdrop rollout 8ea7ca4e-18bf-4276 100",
    answerIntro: "Rollout atualizado instantaneamente para 100% sem re-empacotar ou invalidar a assinatura.",
    answerMeta: "Atualização de metadados · 0 bytes re-enviados · Assinatura ECDSA preservada",
    steps: [
      {
        num: "01",
        title: "Preservação Criptográfica",
        sub: "O percentual de rollout fica fora do envelope assinado para permitir ajuste em tempo real",
        metric: "Intacta",
        metricSub: "Mesma assinatura P-256",
      },
      {
        num: "02",
        title: "Expansão de Bucket Determinístico",
        sub: "Dispositivos nos buckets 0..19 mantêm o update; buckets 20..99 recebem no próximo check",
        metric: "20% → 100%",
        metricSub: "Transição monotônica",
      },
      {
        num: "03",
        title: "Promoção entre Canais",
        sub: "Promova de staging para production mantendo o mesmo hash e assinatura",
        metric: "staging → prod",
        metricSub: "airdrop promote",
      },
      {
        num: "04",
        title: "Cache de Borda Imutável",
        sub: "Cache-Control: public, max-age=31536000, immutable na Cloudflare + S3",
        metric: "99.4% HIT",
        metricSub: "Zero egress tax",
      },
    ],
    note: "Você pode ajustar de 1% a 100% a qualquer segundo pelo CLI ou pelo Console em /dashboard.",
    phoneState: {
      version: "v2.4.1-ota.1",
      badge: "100% PRODUCTION FLEET",
      headline: "Frota global sincronizada",
      detail: "48.920 dispositivos atualizados · 0 rollbacks",
      rolloutPct: 100,
    },
  },
  {
    id: "watchdog",
    num: "03",
    label: "Auto-Rollback",
    requestText: "O que acontece se um desenvolvedor publicar um bundle com erro fatal na inicialização?",
    cliCommand: " Watchdog nativo (RNAirdrop.mm / Airdrop.java)",
    answerIntro: "O SDK nativo detecta que notifyAppReady() não foi chamado e reverte sozinho para o bundle anterior.",
    answerMeta: "Proteção em 2 inicializações · Blacklist persistente por updateId · Telemetria automática",
    steps: [
      {
        num: "01",
        title: "Staging Seguro (pendingUpdateId)",
        sub: "O bundle novo nunca sobrescreve o atual antes de provar que renderiza sem crash",
        metric: "Isolado",
        metricSub: "Swap atômico",
      },
      {
        num: "02",
        title: "Contador de Boot Pré-JS",
        sub: "Incrementado em código nativo (Obj-C/Java) antes de inicializar a VM Hermes",
        metric: "Tentativa 1 → 2",
        metricSub: "Persistido em disco",
      },
      {
        num: "03",
        title: "Reversão Automática + Blacklist",
        sub: "Se falhar antes de notifyAppReady(), restaura currentUpdateId e grava em failedUpdateIds",
        metric: "Revertido",
        metricSub: "Nunca reinstala o bug",
      },
      {
        num: "04",
        title: "Relatório de Evento (POST /v1/events)",
        sub: "O dispositivo reporta o evento de rollback para o painel e CLI",
        metric: "Auditado",
        metricSub: "Visível no Console",
      },
    ],
    note: "Nenhum usuário fica preso em tela branca — mesmo que você esteja dormindo quando o crash ocorrer.",
    phoneState: {
      version: "v2.4.0 (Restaurado)",
      badge: "AUTO-ROLLBACK EXECUTED",
      headline: "Recuperado automaticamente de falha",
      detail: "Update defeituoso bloqueado em failedUpdateIds",
      rolloutPct: 100,
    },
  },
  {
    id: "security",
    num: "04",
    label: "Zero-Trust ECDSA",
    requestText: "E se um atacante ou CDN intermediária tentar modificar 1 byte do bundle JS?",
    cliCommand: "airdrop keygen --out airdrop-private-key.pem",
    answerIntro: "O dispositivo rejeita o pacote antes de salvar no disco. Nem o próprio servidor pode forjar código.",
    answerMeta: "ECDSA P-256 (prime256v1) + SHA-256 · Chave pública gravada no Info.plist / strings.xml",
    steps: [
      {
        num: "01",
        title: "Chave Privada Offline",
        sub: "Fica apenas na sua máquina ou no GitHub Actions Secret (AIRDROP_PRIVATE_KEY)",
        metric: "Zero-Trust",
        metricSub: "Servidor não possui a chave",
      },
      {
        num: "02",
        title: "Envelope Canônico v1",
        sub: "Assina appId, channel, platform, runtimeVersion, launchAsset e todos os hashes SHA-256",
        metric: "Imutável",
        metricSub: "Qualquer byte invalida",
      },
      {
        num: "03",
        title: "Validação Nativa no Chip",
        sub: "Apple Security.framework (iOS) e java.security.Signature (Android)",
        metric: "Nativo",
        metricSub: "Zero deps JS",
      },
      {
        num: "04",
        title: "Isolamento por Runtime Version",
        sub: "Bundles JS só rodam em binários nativos compatíveis",
        metric: "Protegido",
        metricSub: "Sem crash de bridge",
      },
    ],
    note: "Segurança criptográfica de nível bancário ativada com uma única flag: airdrop init --sign.",
    phoneState: {
      version: "v2.4.1-ota.1",
      badge: "SIGNATURE VALIDATED",
      headline: "Integridade SHA-256 + ECDSA 100%",
      detail: "Tentativas de adulteração descartadas antes do boot",
      rolloutPct: 100,
    },
  },
];

const SUN_MACROS = [
  {
    id: 0,
    label: "Installs",
    short: "Inst.",
    value: "48.9k",
    target: "/ 50k",
    color: "var(--sun-carbs)",
    centerMain: "99.98%",
    centerSub: "Taxa de sucesso sem crash",
  },
  {
    id: 1,
    label: "Edge Cache",
    short: "Edge",
    value: "99.4",
    target: "% hit",
    color: "var(--sun-water)",
    centerMain: "38 ms",
    centerSub: "Latência p95 Cloudflare → AWS",
  },
  {
    id: 2,
    label: "Delta Size",
    short: "Delta",
    value: "312",
    target: "KB gzip",
    color: "var(--sun-fat)",
    centerMain: "−94%",
    centerSub: "Economia de banda vs binário",
  },
  {
    id: 3,
    label: "Rollbacks",
    short: "Safe",
    value: "0",
    target: "fatais",
    color: "var(--sun-calories)",
    centerMain: "2-Boot",
    centerSub: "Watchdog nativo iOS & Android",
  },
];

const ACTIVITY_LEVELS = [
  2, 3, 1, 2, 3, 3, 0,
  1, 2, 3, 2, 3, 1, 0,
  2, 3, 3, 2, 1, 3, 2,
  1, 2, 3, 3, 2, 3, 1,
  2, 3,
];

export function PumpyStoryAndBento() {
  const [activeChapterIdx, setActiveChapterIdx] = useState(0);
  const [selectedSunMacro, setSelectedSunMacro] = useState<number | null>(null);
  const [isThinking, setIsThinking] = useState(false);
  const [copiedCli, setCopiedCli] = useState(false);
  const [gaze, setGaze] = useState({ x: 0, y: 0 });

  const chapter = STORY_CHAPTERS[activeChapterIdx] ?? STORY_CHAPTERS[0]!;
  const currentSun = selectedSunMacro !== null ? SUN_MACROS[selectedSunMacro]! : SUN_MACROS[0]!;

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const nx = (e.clientX / window.innerWidth - 0.5) * 2;
      const ny = (e.clientY / window.innerHeight - 0.5) * 2;
      setGaze({ x: nx, y: ny });
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  const selectChapter = (idx: number) => {
    if (idx === activeChapterIdx) return;
    setIsThinking(true);
    setActiveChapterIdx(idx);
    setTimeout(() => setIsThinking(false), 260);
  };

  const copyCommand = (cmd: string) => {
    navigator.clipboard?.writeText(cmd);
    setCopiedCli(true);
    setTimeout(() => setCopiedCli(false), 1800);
  };

  // Generate 36 radial rays for the Pumpy Sunburst SVG
  const rays = Array.from({ length: 36 }, (_, i) => {
    const angle = (i * 10 - 90) * (Math.PI / 180);
    const group = i < 14 ? 0 : i < 24 ? 1 : i < 31 ? 2 : 3;
    const isHighlighted = selectedSunMacro === null || selectedSunMacro === group;
    const innerR = 68;
    const outerR = isHighlighted ? (i % 2 === 0 ? 104 : 96) : 80;
    const x1 = 120 + Math.cos(angle) * innerR;
    const y1 = 120 + Math.sin(angle) * innerR;
    const x2 = 120 + Math.cos(angle) * outerR;
    const y2 = 120 + Math.sin(angle) * outerR;
    const color =
      group === 0
        ? "var(--sun-carbs)"
        : group === 1
          ? "var(--sun-water)"
          : group === 2
            ? "var(--sun-fat)"
            : "var(--sun-calories)";
    return { i, x1, y1, x2, y2, color, opacity: isHighlighted ? 1 : 0.25 };
  });

  return (
    <div>
      {/* SECTION 1: CONVERSATIONAL SCROLL STORY (.scroll-story) */}
      <section className="pumpy-story-section" id="demonstracao" aria-label="Uma conversa com o Airdrop">
        <div className="pumpy-container">
          <p className="pumpy-story-eyebrow">UM COMANDO · UMA CONVERSA</p>
          <h2 className="pumpy-story-h2">
            Publique correções como quem envia uma mensagem.
          </h2>

          {/* Interactive Chapter Selector */}
          <div className="pumpy-story-chapters" role="tablist" aria-label="Cenários de uso do Airdrop">
            {STORY_CHAPTERS.map((ch, idx) => (
              <button
                key={ch.id}
                type="button"
                role="tab"
                aria-selected={activeChapterIdx === idx}
                onClick={() => selectChapter(idx)}
                className={`pumpy-chapter-btn ${activeChapterIdx === idx ? "is-active" : ""}`}
              >
                <span style={{ opacity: 0.6, fontVariantNumeric: "tabular-nums" }}>{ch.num}</span>
                <span>{ch.label}</span>
              </button>
            ))}
          </div>

          <div className="pumpy-story-canvas">
            {/* Outgoing Developer Request Bubble */}
            <div className="pumpy-story-request">
              <p className="pumpy-story-request-text">{chapter.requestText}</p>
              <div className="pumpy-story-composer-tools">
                <span style={{ color: "var(--muted)", fontSize: 16 }}>❯</span>
                <span className="pumpy-story-composer-caption">{chapter.cliCommand}</span>
                <button
                  type="button"
                  className="pumpy-story-send"
                  onClick={() => selectChapter((activeChapterIdx + 1) % STORY_CHAPTERS.length)}
                  title="Avançar para o próximo capítulo"
                  aria-label="Avançar demonstração"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 19V5M5 12l7-7 7 7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Living Mascot Status Row */}
            <div className="pumpy-story-thinking">
              <span style={{ width: 28, height: 28, display: "inline-block" }}>
                <AirdropMascotSvg mood={isThinking ? "focused" : "happy"} gaze={gaze} />
              </span>
              <span>
                {isThinking ? "Compilando e assinando com ECDSA P-256…" : "Airdrop · Resposta instantânea da borda"}
              </span>
            </div>

            {/* Inverted High-Contrast Pumpy Answer Surface */}
            <article
              className="pumpy-story-answer"
              style={{
                opacity: isThinking ? 0.72 : 1,
                transform: isThinking ? "translateY(4px)" : "none",
              }}
            >
              <p className="pumpy-story-answer-intro">{chapter.answerIntro}</p>
              <p className="pumpy-story-meta">{chapter.answerMeta}</p>

              <ol className="pumpy-story-steps">
                {chapter.steps.map((s) => (
                  <li key={s.num}>
                    <span className="pumpy-step-num">{s.num}</span>
                    <div className="pumpy-step-body">
                      <strong>{s.title}</strong>
                      <span>{s.sub}</span>
                    </div>
                    <div className="pumpy-step-metric">
                      {s.metric}
                      <small>{s.metricSub}</small>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="pumpy-story-note">
                <span>{chapter.note}</span>
                <button
                  type="button"
                  onClick={() => copyCommand(chapter.cliCommand)}
                  style={{
                    background: "#00000010",
                    border: "1px solid #00000020",
                    borderRadius: 999,
                    padding: "5px 12px",
                    fontSize: 11,
                    fontWeight: 500,
                    color: "inherit",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {copiedCli ? "✓ Comando copiado" : "Copiar CLI"}
                </button>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* SECTION 2: VISUAL BUNDLE COMPOSER + RADIAL SUNBURST TELEMETRY (.nutrition-story) */}
      <section className="pumpy-telemetry-section" id="telemetria" aria-label="Telemetria em tempo real e inspeção de pacote">
        <div className="pumpy-container">
          <p className="pumpy-story-eyebrow">UM COMANDO · TUDO ANOTADO</p>
          <h2 className="pumpy-story-h2">
            Inspeção criptográfica e telemetria de frota em um olhar.
          </h2>

          <div className="pumpy-telemetry-grid">
            {/* Left: Pumpy Photo Composer Card */}
            <div className="pumpy-composer-card">
              <figure className="pumpy-photo-frame" style={{ margin: 0 }}>
                <img
                  src="/brand/hero-orbital-drop.png"
                  alt="Cápsula OTA Airdrop transmitindo bytecode Hermes assinado"
                  loading="lazy"
                />
                <span className="pumpy-scan-line" aria-hidden="true" />
                <span className="pumpy-pin pumpy-pin-1">main.jsbundle · 312 KB</span>
                <span className="pumpy-pin pumpy-pin-2">ECDSA P-256 · Assinado</span>
                <span className="pumpy-pin pumpy-pin-3">SHA-256 · Imutável</span>
                <figcaption className="pumpy-photo-result">
                  <span>Latência de borda</span>
                  <strong>
                    38 <small>ms</small>
                  </strong>
                  <span>Cloudflare Edge → AWS S3 (us-east-2)</span>
                </figcaption>
              </figure>

              <dl className="pumpy-macros-bar" style={{ margin: 0 }}>
                <div>
                  <dt>Delta Bundle</dt>
                  <dd>
                    312<span> KB</span>
                  </dd>
                </div>
                <div>
                  <dt>Deploy</dt>
                  <dd>
                    1.4<span> s</span>
                  </dd>
                </div>
                <div>
                  <dt>Watchdog</dt>
                  <dd>
                    100<span> %</span>
                  </dd>
                </div>
              </dl>
            </div>

            {/* Right: Pumpy Radial Sunburst Overview */}
            <article className="pumpy-sun-card" aria-label="Resumo da frota em produção">
              <p style={{ fontSize: 16, fontWeight: 500, marginBottom: 16, letterSpacing: "-0.02em" }}>
                Frota hoje · Produção
              </p>
              <div className="pumpy-sun-wrap">
                <svg viewBox="0 0 240 240" width="100%" height="100%" aria-hidden="true">
                  {/* Outer subtle track */}
                  <circle
                    cx="120"
                    cy="120"
                    r="108"
                    fill="none"
                    stroke="var(--line)"
                    strokeWidth="1.5"
                    strokeDasharray="3 5"
                  />
                  {/* Inner progress ring */}
                  <circle
                    cx="120"
                    cy="120"
                    r="58"
                    fill="none"
                    stroke="var(--line-strong)"
                    strokeWidth="4"
                  />
                  <circle
                    cx="120"
                    cy="120"
                    r="58"
                    fill="none"
                    stroke={currentSun.color}
                    strokeWidth="4"
                    strokeLinecap="round"
                    strokeDasharray="340 365"
                    transform="rotate(-90 120 120)"
                    style={{ transition: "stroke 0.25s ease" }}
                  />
                  {/* 36 Sunburst Rays */}
                  {rays.map((r) => (
                    <line
                      key={r.i}
                      x1={r.x1}
                      y1={r.y1}
                      x2={r.x2}
                      y2={r.y2}
                      stroke={r.color}
                      strokeWidth="3.6"
                      strokeLinecap="round"
                      opacity={r.opacity}
                      style={{ transition: "all 0.25s ease" }}
                    />
                  ))}
                </svg>
                <div className="pumpy-sun-center">
                  <strong>{currentSun.centerMain}</strong>
                  <span>{currentSun.centerSub}</span>
                </div>
              </div>

              <div className="pumpy-sun-metrics">
                {SUN_MACROS.map((m, idx) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelectedSunMacro(selectedSunMacro === idx ? null : idx)}
                    className={`pumpy-sun-metric-btn ${selectedSunMacro === idx ? "is-selected" : ""}`}
                  >
                    <span className="pumpy-sun-metric-label">
                      <span className="pumpy-sun-dot" style={{ background: m.color }} />
                      <span>{m.label}</span>
                    </span>
                    <span className="pumpy-sun-metric-val">
                      {m.value}
                      <small>{m.target}</small>
                    </span>
                  </button>
                ))}
              </div>
              <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 14 }}>
                Clique em qualquer métrica acima para filtrar os raios de telemetria.
              </p>
            </article>
          </div>

          {/* SECTION 3: 12-COLUMN PUMPY BENTO DASHBOARD (#recursos) */}
          <div className="pumpy-bento-grid" id="recursos" role="group" aria-label="Painel Bento do Airdrop">
            {/* Widget 1: Tall Frontal iPhone (1 / 1 / 4 / 5) */}
            <div className="pumpy-widget-shell pumpy-bento-iphone">
              <h3 className="pumpy-widget-title">No dispositivo</h3>
              <article className="pumpy-widget" style={{ alignItems: "center", justifyContent: "center", padding: "14px 10px" }}>
                <div className="pumpy-frontal-device">
                  <div className="pumpy-frontal-screen">
                    <span className="pumpy-frontal-island" aria-hidden="true" />
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#959595" }}>
                        <span>9:41</span>
                        <span style={{ color: "#b8cdbb", fontFamily: "monospace" }}>5G · OTA</span>
                      </div>
                      <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ width: 26, height: 26, display: "inline-block" }}>
                          <AirdropMascotSvg mood="happy" gaze={gaze} />
                        </span>
                        <div>
                          <strong style={{ display: "block", fontSize: 13, color: "#f3f3f1" }}>Airdrop SDK</strong>
                          <span style={{ fontSize: 10, color: "#959595" }}>{chapter.phoneState.version}</span>
                        </div>
                      </div>

                      <div
                        style={{
                          marginTop: 16,
                          padding: 12,
                          borderRadius: 16,
                          background: "#171718",
                          border: "1px solid #ffffff14",
                        }}
                      >
                        <span
                          style={{
                            display: "inline-block",
                            fontSize: 9,
                            fontFamily: "monospace",
                            padding: "2px 7px",
                            borderRadius: 999,
                            background: "#b8cdbb18",
                            color: "#b8cdbb",
                            marginBottom: 6,
                          }}
                        >
                          {chapter.phoneState.badge}
                        </span>
                        <strong style={{ display: "block", fontSize: 13, color: "#f3f3f1", lineHeight: 1.3 }}>
                          {chapter.phoneState.headline}
                        </strong>
                        <p style={{ fontSize: 10, color: "#959595", marginTop: 4, lineHeight: 1.45 }}>
                          {chapter.phoneState.detail}
                        </p>
                      </div>

                      {/* Mini Sun inside iPhone Screen */}
                      <div style={{ marginTop: 14, textAlign: "center" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#959595", marginBottom: 5 }}>
                          <span>Rollout ativo</span>
                          <strong style={{ color: "#f3f3f1" }}>{chapter.phoneState.rolloutPct}%</strong>
                        </div>
                        <div style={{ height: 5, borderRadius: 5, background: "#ffffff14", overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${chapter.phoneState.rolloutPct}%`,
                              height: "100%",
                              background: "#b8cdbb",
                              borderRadius: 5,
                              transition: "width 0.3s ease",
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div style={{ borderTop: "1px solid #ffffff12", paddingTop: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#959595" }}>
                        <span>Watchdog</span>
                        <span style={{ color: "#b8cdbb" }}>✓ notifyAppReady()</span>
                      </div>
                      <div
                        style={{
                          height: 4,
                          width: 90,
                          borderRadius: 4,
                          background: "#ffffff50",
                          margin: "12px auto 0",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </article>
            </div>

            {/* Widget 2: Wide Phone + Frosted Glass iOS Notifications (1 / 5 / 2 / 13) */}
            <div className="pumpy-widget-shell pumpy-bento-phone">
              <h3 className="pumpy-widget-title">Com você em produção.</h3>
              <article
                className="pumpy-widget"
                style={{
                  position: "relative",
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div className="pumpy-notification-stack">
                  <div className="pumpy-notification">
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "#111112",
                        display: "grid",
                        placeItems: "center",
                        padding: 4,
                      }}
                    >
                      <AirdropMascotSvg mood="happy" />
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--muted)" }}>
                        <span>Airdrop OTA</span>
                        <small>agora</small>
                      </div>
                      <strong style={{ display: "block", fontSize: 11, marginTop: 1 }}>
                        Release v2.4.1 assinado e no ar.
                      </strong>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--muted)" }}>
                        ECDSA P-256 validado · 312 KB sincronizados.
                      </p>
                    </div>
                  </div>

                  <div className="pumpy-notification">
                    <div
                      style={{
                        width: 32,
                        height: 32,
                        borderRadius: 8,
                        background: "#111112",
                        display: "grid",
                        placeItems: "center",
                        padding: 4,
                      }}
                    >
                      <AirdropMascotSvg mood="wink" />
                    </div>
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--muted)" }}>
                        <span>Watchdog Nativo</span>
                        <small>agora</small>
                      </div>
                      <strong style={{ display: "block", fontSize: 11, marginTop: 1 }}>
                        Zero crashes na inicialização.
                      </strong>
                      <p style={{ margin: "2px 0 0", fontSize: 10, color: "var(--muted)" }}>
                        Seu cuidado também está em cada byte.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    justifyContent: "flex-end",
                    alignItems: "center",
                  }}
                >
                  <img
                    src="/brand/security-enclave.png"
                    alt="Enclave de segurança ECDSA P-256"
                    style={{
                      width: "min(290px, 100%)",
                      height: 175,
                      objectFit: "cover",
                      borderRadius: 18,
                      border: "1px solid var(--line)",
                    }}
                    loading="lazy"
                  />
                </div>
              </article>
            </div>

            {/* Widget 3: 30-Day Activity Grid (2 / 5 / 3 / 8) */}
            <div className="pumpy-widget-shell pumpy-bento-activity">
              <h3 className="pumpy-widget-title">Cadência</h3>
              <article className="pumpy-widget">
                <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 6 }}>
                  <strong style={{ fontSize: 15, fontWeight: 500, letterSpacing: "-0.025em" }}>26 dias com deploy</strong>
                  <small style={{ fontSize: 10, color: "var(--muted)" }}>Novembro</small>
                </div>
                <ol className="pumpy-month-grid" aria-label="26 dias com deploy em 30 dias">
                  {ACTIVITY_LEVELS.map((lvl, idx) => (
                    <li
                      key={idx}
                      className="pumpy-month-day"
                      data-level={lvl}
                      title={`Dia ${idx + 1}: nível ${lvl}`}
                    />
                  ))}
                </ol>
              </article>
            </div>

            {/* Widget 4: Latency / Payload Curve (2 / 8 / 3 / 11) */}
            <div className="pumpy-widget-shell pumpy-bento-weight">
              <h3 className="pumpy-widget-title">Latência &amp; Delta</h3>
              <article className="pumpy-widget">
                <div>
                  <strong style={{ display: "block", fontSize: 26, fontWeight: 400, letterSpacing: "-0.05em", lineHeight: 1.1 }}>
                    38 <span style={{ fontSize: 12, color: "var(--muted)" }}>ms</span>
                  </strong>
                  <small style={{ display: "block", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    −84% de banda vs release completo
                  </small>
                </div>
                <svg className="pumpy-weight-chart" viewBox="0 0 280 100" preserveAspectRatio="none" aria-hidden="true">
                  <defs>
                    <linearGradient id="pumpy-weight-area" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path
                    d="M4 14 C22 14 26 26 44 24 S64 38 82 36 S104 42 118 46 S140 58 156 55 S178 68 196 66 S220 78 238 78 S262 88 276 88 L276 100 L4 100 Z"
                    fill="url(#pumpy-weight-area)"
                  />
                  <path
                    className="pumpy-weight-line"
                    d="M4 14 C22 14 26 26 44 24 S64 38 82 36 S104 42 118 46 S140 58 156 55 S178 68 196 66 S220 78 238 78 S262 88 276 88"
                  />
                  <circle cx="276" cy="88" r="9" fill="currentColor" opacity="0.14" />
                  <circle cx="276" cy="88" r="3.5" fill="currentColor" />
                </svg>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9, color: "var(--muted)", marginTop: 3 }}>
                  <span>1 nov</span>
                  <span>30 nov</span>
                </div>
              </article>
            </div>

            {/* Widget 5: Weekly Velocity Bars (2 / 11 / 3 / 13) */}
            <div className="pumpy-widget-shell pumpy-bento-training">
              <h3 className="pumpy-widget-title">Releases</h3>
              <article className="pumpy-widget">
                <div>
                  <strong style={{ display: "block", fontSize: 26, fontWeight: 400, letterSpacing: "-0.05em", lineHeight: 1.1 }}>
                    38 <span style={{ fontSize: 11, color: "var(--muted)" }}>OTAs</span>
                  </strong>
                  <small style={{ display: "block", fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                    9.5 por semana
                  </small>
                </div>
                <div className="pumpy-training-bars" aria-hidden="true">
                  {[
                    { label: "S1", h: "52%", op: 0.45 },
                    { label: "S2", h: "74%", op: 0.65 },
                    { label: "S3", h: "82%", op: 0.85 },
                    { label: "S4", h: "100%", op: 1 },
                  ].map((w) => (
                    <div key={w.label} className="pumpy-training-week">
                      <span className="pumpy-training-track">
                        <span className="pumpy-training-fill" style={{ height: w.h, opacity: w.op }} />
                      </span>
                      <span style={{ textAlign: "center", fontSize: 9, color: "var(--muted)" }}>{w.label}</span>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            {/* Widget 6: Connected Stack Integrations (3 / 5 / 4 / 10) */}
            <div className="pumpy-widget-shell pumpy-bento-integrations">
              <article
                className="pumpy-widget"
                style={{
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 16,
                }}
              >
                <div>
                  <h3 style={{ fontSize: 17, fontWeight: 500, letterSpacing: "-0.035em", margin: 0 }}>
                    Sua stack, conectada.
                  </h3>
                  <p style={{ fontSize: 11, color: "var(--muted)", margin: "6px 0 0", lineHeight: 1.45 }}>
                    React Native, Expo, Hermes, AWS &amp; Cloudflare juntos no Airdrop.
                  </p>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {[
                    { name: "RN 0.87", tag: "RN" },
                    { name: "Expo", tag: "EX" },
                    { name: "Hermes", tag: "HB" },
                    { name: "AWS S3", tag: "S3" },
                    { name: "Cloudflare", tag: "CF" },
                    { name: "GH Actions", tag: "CI" },
                  ].map((item) => (
                    <div
                      key={item.name}
                      title={item.name}
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 13,
                        background: "var(--surface-inset)",
                        border: "1px solid var(--line-strong)",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    >
                      <span>{item.tag}</span>
                      <small style={{ fontSize: 7, color: "var(--muted)", fontWeight: 400 }}>{item.name}</small>
                    </div>
                  ))}
                </div>
              </article>
            </div>

            {/* Widget 7: Dock / Console Quick Action (3 / 10 / 4 / 13) */}
            <div className="pumpy-widget-shell pumpy-bento-dock">
              <article
                className="pumpy-widget"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  background: "radial-gradient(ellipse at 80% 90%, var(--mint-soft), transparent 70%), var(--surface)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 11, color: "var(--mint)", fontWeight: 500 }}>Release Console</span>
                  <span style={{ width: 22, height: 22 }}>
                    <AirdropMascotSvg mood="happy" />
                  </span>
                </div>
                <div>
                  <strong style={{ display: "block", fontSize: 15, fontWeight: 500, letterSpacing: "-0.02em" }}>
                    Sandbox Interativo
                  </strong>
                  <a
                    href="/dashboard/"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      fontSize: 12,
                      color: "var(--text)",
                      marginTop: 6,
                      textDecoration: "underline",
                      textUnderlineOffset: 4,
                    }}
                  >
                    Abrir Console ↗
                  </a>
                </div>
              </article>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
