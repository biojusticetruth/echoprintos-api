:root{
  /* Core palette */
  --bg:#0b1216;
  --ink:#e3eef6;
  --ink2:#a2bbca;
  --panel:#121a21;
  --panel2:#0f171d;
  --ring:#1e2a34;

  /* Glam accents */
  --accent:#1CC467;           /* BioJustice green */
  --edge1:#20e3b2;            /* cyan-teal edge */
  --edge2:#4995ef;            /* blue edge */
  --edge3:#ff77ff;            /* magenta edge */

  --r:18px;
  --shadow:0 14px 36px rgba(0,0,0,.45);
}

/* Base */
*{box-sizing:border-box}
html,body{margin:0}
body.bg{
  background:
    radial-gradient(1100px 700px at 12% -8%, rgba(35,220,190,.10), transparent 60%),
    radial-gradient(900px 700px at 88% -6%, rgba(73,149,239,.08), transparent 60%),
    radial-gradient(1000px 800px at 50% 110%, rgba(255,119,255,.06), transparent 55%),
    var(--bg);
  color:var(--ink);
  font-family:Inter, system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

/* Nav */
.nav{
  position:sticky; top:0; z-index:10;
  display:flex; align-items:center; justify-content:space-between;
  padding:14px 20px; border-bottom:1px solid #0e171f;
}
.glass{
  backdrop-filter: blur(10px) saturate(130%);
  background:linear-gradient(180deg, rgba(18,24,30,.60), rgba(12,18,24,.42));
  box-shadow:0 1px 0 rgba(255,255,255,.04);
}
.brand{font-weight:800; color:var(--ink); text-decoration:none}
.tabs{display:flex; gap:10px}
.tab{color:var(--ink2); padding:8px 12px; border-radius:999px}
.tab.active{background:#0e171d; color:var(--ink)}

/* Layout */
.wrap{max-width:1080px; margin:30px auto; padding:0 18px; display:grid; gap:20px}

/* Cards */
.card{
  background:linear-gradient(180deg,var(--panel),var(--panel2));
  border:1px solid var(--ring); border-radius:var(--r);
  box-shadow:var(--shadow); padding:20px;
}
.card.soft{background:linear-gradient(180deg,#0f161c,#0c1318)}
.card-title{margin:0; font-weight:800}

/* Edge gradient frame */
.edge{
  border:1px solid transparent;
  background:
    linear-gradient(180deg, rgba(18,24,30,.78), rgba(18,24,30,.62)) padding-box,
    linear-gradient(120deg, var(--edge1), var(--edge2), var(--edge3)) border-box;
}
.glow::before{
  content:""; position:absolute; inset:0; border-radius:inherit; pointer-events:none;
  background:
    radial-gradient(40% 60% at 0% 0%, rgba(255,255,255,.07), transparent 60%),
    radial-gradient(40% 60% at 100% 0%, rgba(255,255,255,.05), transparent 60%),
    radial-gradient(40% 60% at 0% 100%, rgba(255,255,255,.05), transparent 60%),
    radial-gradient(40% 60% at 100% 100%, rgba(255,255,255,.06), transparent 60%);
  mix-blend-mode: screen;
}
.sheen{position:relative; overflow:hidden}
.sheen::after{
  content:""; position:absolute; top:-40%; left:-70%; width:70%; height:180%;
  background: linear-gradient(120deg, transparent 0%, rgba(255,255,255,.12) 18%, rgba(255,255,255,.04) 32%, transparent 50%);
  transform: translateX(-120%) rotate(16deg);
  filter: blur(.5px);
}
.sheen:hover::after{ animation: sheen-run 1100ms ease }
@keyframes sheen-run{ to{ transform: translateX(220%) rotate(16deg) } }

/* Hero */
.eyebrow{color:var(--ink2); letter-spacing:.12em; font-size:12px; margin-bottom:8px}
.hero-title{font-family:"Playfair Display", serif; font-weight:700; font-size:32px; margin:0 0 8px}
.hero-copy{color:var(--ink2); margin:0}

/* Feed grid */
.feed-head{display:flex; align-items:center; justify-content:space-between}
.muted{color:var(--ink2)}
.feed-grid{
  list-style:none; margin:12px 0 0; padding:0;
  display:grid; gap:14px;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
}

.feed-card{
  position:relative; overflow:hidden;
  background: linear-gradient(180deg,#0f171d,#0c141a);
  border:1px solid var(--ring); border-radius:14px; padding:14px 14px 16px;
  transition: transform .18s ease, box-shadow .18s ease, border-color .18s ease;
  box-shadow:0 10px 26px rgba(0,0,0,.32);
}
.feed-card:hover{
  transform: translateY(-2px);
  box-shadow:0 18px 44px rgba(0,0,0,.45);
  border-color:#243342;
}
.feed-card .title{
  display:inline-block; color:var(--ink); text-decoration:none; font-weight:700;
}
.feed-card .title:hover{ text-decoration:underline }
.badge{
  display:inline-block; margin-left:8px; font-size:12px; color:var(--ink2);
  border:1px solid var(--ring); border-radius:999px; padding:2px 8px;
}
.meta{
  color:var(--ink2); font-size:13px; line-height:1.45; margin-top:6px;
  white-space:pre-line; /* keep ECP on one line, timestamp on next via \n */
}

/* Footer quote */
.foot-quote{color:var(--ink2); margin:0}
.sep{opacity:.5; margin:0 .5ch}
